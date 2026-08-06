// Production database connection
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

// Cargar .env.local con override para asegurar que las variables de BD estén disponibles
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

// Parse MYSQL_DATABASE_URL or use individual env vars
function createConnectionConfig() {
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;

  if (mysqlUrl) {
    // Parse the MySQL URL
    const url = new URL(mysqlUrl);
    const config: mysql.PoolOptions = {
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading /
      waitForConnections: true,
      connectionLimit: 3,
      maxIdle: 3,
      idleTimeout: 60000,
      queueLimit: 0,
      connectTimeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      charset: "utf8mb4",
    };

    // Handle SSL configuration
    if (url.searchParams.get("ssl-mode") === "DISABLED") {
      // Explicitly disable SSL
      config.ssl = false;
      console.log("❌ SSL disabled for MySQL connection");
    } else if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      // For localhost, disable SSL by default
      config.ssl = false;
      console.log("🏠 SSL disabled for localhost connection");
    } else {
      // 1. Variable de entorno (Render)
      // 2. Archivo ca.pem local (desarrollo)
      // 3. Fallback sin CA
      const caEnv = process.env.AIVEN_CA_CERT;
      const caPath = path.join(process.cwd(), "ca.pem");
      const ca = caEnv
        ? Buffer.from(caEnv, "base64").toString("utf-8")
        : fs.existsSync(caPath)
          ? fs.readFileSync(caPath, "utf-8")
          : null;

      if (ca) {
        config.ssl = { ca, rejectUnauthorized: true };
        console.log("📜 Using SSL certificate for MySQL connection");
      } else {
        config.ssl = { rejectUnauthorized: false };
        console.log("🔒 Using SSL without CA certificate");
      }
    }

    return config;
  }

  // Fallback to individual env vars
  const host = process.env.DB_HOST || "localhost";
  const config: mysql.PoolOptions = {
    host,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  const fallbackCharset = process.env.DB_CHARSET || "utf8mb4";
  config.charset = normalizeCharset(fallbackCharset);

  // Handle SSL for non-local connections
  if (host !== "localhost" && host !== "127.0.0.1") {
    config.ssl = {
      rejectUnauthorized: false,
    };
    console.log(
      "🔒 Using SSL with disabled certificate verification for",
      host,
    );
  }

  return config;
}

function normalizeCharset(charset: string) {
  const normalized = charset.toLowerCase();
  if (normalized === "cesu8" || normalized === "cesu-8") {
    return "utf8mb4";
  }
  return charset;
}

// Default to real DB even in tests; allow opting into stubs via USE_DB_STUBS=true
const isTest = process.env.NODE_ENV === "test";
const useDbStubs = process.env.USE_DB_STUBS === "true";

let connection: mysql.Pool;
let db: any;

if (isTest && useDbStubs) {
  console.log("🧪 Test mode: using in-memory stubs for db");

  // Minimal no-op implementations that satisfy the call sites used in tests
  connection = {
    getConnection: async () => ({ release() {} }),
  } as unknown as mysql.Pool;

  db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
    insert: () => ({ values: async () => ({}) }),
    update: () => ({ set: () => ({ where: async () => ({}) }) }),
  };
} else {
  // Create production connection pool
  connection = mysql.createPool(createConnectionConfig());

  // Forzar utf8mb4 en cada nueva conexión del pool
  const originalGetConnection = connection.getConnection.bind(connection);
  connection.getConnection = async () => {
    const conn = await originalGetConnection();
    await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    return conn;
  };

  db = drizzle(connection);

  // Add connection pool event handlers (commented out to reduce log noise)
  // connection.on('connection', (conn) => {
  //   console.log('🔗 New database connection established');
  // });

  // connection.on('acquire', (conn) => {
  //   console.log('🔒 Connection acquired from pool');
  // });

  // connection.on('release', (conn) => {
  //   console.log('🔓 Connection released back to pool');
  // });

  // connection.on('enqueue', () => {
  //   console.log('⏳ Waiting for available connection...');
  // });

  if (!isTest) {
    // Import and run gamification seed
    import("./gamificationSeed")
      .then(({ seedGamification }) => {
        setTimeout(() => seedGamification(), 2000);
      })
      .catch(() => {});

    // Test connection on startup and run migrations
    connection
      .getConnection()
      .then(async (conn) => {
        console.log("✅ Database connected successfully");

        try {
          await conn.query(
            `ALTER TABLE businesses ADD COLUMN custom_commission INT DEFAULT NULL`,
          );
          console.log("Added custom_commission to businesses");
        } catch (err: any) {
          if (err.code !== "ER_DUP_FIELDNAME")
            console.log("Migration note:", err.message);
        }

        try {
          await conn.query(
            `ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT NULL`,
          );
          console.log("Added profile_image to users");
        } catch (err: any) {
          if (err.code !== "ER_DUP_FIELDNAME")
            console.log("Migration note:", err.message);
        }

        try {
          await conn.query(
            `ALTER TABLE users ADD COLUMN bank_account TEXT DEFAULT NULL`,
          );
          console.log("Added bank_account to users");
        } catch (err: any) {
          if (err.code !== "ER_DUP_FIELDNAME")
            console.log("Migration note:", err.message);
        }

        // Chat messages: columna para almacenar historial de chat cliente↔repartidor
        try {
          await conn.query(
            `ALTER TABLE orders ADD COLUMN chat_messages TEXT DEFAULT NULL`,
          );
          console.log("✅ Added chat_messages to orders");
        } catch (err: any) {
          if (err.code !== "ER_DUP_FIELDNAME")
            console.log("Migration note:", err.message);
        }

        conn.release();
      })
      .catch((err) => {
        console.error("❌ Database connection failed:", err.message);
      });
  }
}

async function ensureColumn(
  conn: mysql.PoolConnection,
  tableName: string,
  columnName: string,
  addSql: string,
) {
  const [rows] = await conn.query(
    `
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName],
  );

  const count = Array.isArray(rows) ? (rows[0] as any)?.count : 0;
  if (!count) {
    await conn.query(addSql);
  }
}

export async function ensureTestSchema() {
  if (useDbStubs) {
    return;
  }

  const conn = await connection.getConnection();
  try {
    await ensureColumn(
      conn,
      "users",
      "profile_image",
      "ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT NULL",
    );
    await ensureColumn(
      conn,
      "users",
      "stripe_account_id",
      "ALTER TABLE users ADD COLUMN stripe_account_id TEXT DEFAULT NULL",
    );
    await ensureColumn(
      conn,
      "users",
      "bank_account",
      "ALTER TABLE users ADD COLUMN bank_account TEXT DEFAULT NULL",
    );
  } finally {
    conn.release();
  }
}

export { db, connection };
