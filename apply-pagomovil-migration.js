require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return rows[0].c > 0;
}

async function addColumn(conn, table, column, definition) {
  if (await columnExists(conn, table, column)) {
    console.log(`  ⏭️  ${table}.${column} ya existe`);
    return;
  }
  await conn.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
  );
  console.log(`  ✅ ${table}.${column} agregada`);
}

async function run() {
  const conn = await pool.getConnection();
  console.log("✅ Conectado a Mouzo DB\n");

  // orders
  console.log("📋 orders:");
  await addColumn(
    conn,
    "orders",
    "pago_movil_reference",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(conn, "orders", "pago_movil_proof_url", "TEXT DEFAULT NULL");
  await addColumn(
    conn,
    "orders",
    "pago_movil_phone",
    "VARCHAR(20) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "orders",
    "pago_movil_bank",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "orders",
    "pago_movil_status",
    "VARCHAR(20) DEFAULT 'pending'",
  );
  await addColumn(
    conn,
    "orders",
    "pago_movil_verified_by",
    "VARCHAR(255) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "orders",
    "pago_movil_verified_at",
    "TIMESTAMP NULL DEFAULT NULL",
  );
  await addColumn(
    conn,
    "orders",
    "pago_movil_rejected_reason",
    "TEXT DEFAULT NULL",
  );

  // users
  console.log("\n👤 users:");
  await addColumn(
    conn,
    "users",
    "pago_movil_phone",
    "VARCHAR(20) DEFAULT NULL",
  );
  await addColumn(conn, "users", "pago_movil_bank", "VARCHAR(50) DEFAULT NULL");
  await addColumn(
    conn,
    "users",
    "pago_movil_cedula",
    "VARCHAR(20) DEFAULT NULL",
  );

  // businesses
  console.log("\n🏪 businesses:");
  await addColumn(
    conn,
    "businesses",
    "pago_movil_phone",
    "VARCHAR(20) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "businesses",
    "pago_movil_bank",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "businesses",
    "pago_movil_cedula",
    "VARCHAR(20) DEFAULT NULL",
  );

  // withdrawal_requests
  console.log("\n💸 withdrawal_requests:");
  await addColumn(
    conn,
    "withdrawal_requests",
    "pago_movil_phone",
    "VARCHAR(20) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "withdrawal_requests",
    "pago_movil_bank",
    "VARCHAR(50) DEFAULT NULL",
  );
  await addColumn(
    conn,
    "withdrawal_requests",
    "pago_movil_cedula",
    "VARCHAR(20) DEFAULT NULL",
  );

  // pago_movil_verifications (tabla nueva)
  console.log("\n📱 pago_movil_verifications:");
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pago_movil_verifications (
      id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
      order_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      reference VARCHAR(50) NOT NULL UNIQUE,
      amount INT NOT NULL,
      proof_url TEXT DEFAULT NULL,
      client_phone VARCHAR(20) DEFAULT NULL,
      client_bank VARCHAR(50) DEFAULT NULL,
      dest_phone VARCHAR(20) DEFAULT NULL,
      dest_bank VARCHAR(50) DEFAULT NULL,
      dest_cedula VARCHAR(20) DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      verified_by VARCHAR(255) DEFAULT NULL,
      verified_at TIMESTAMP NULL DEFAULT NULL,
      rejected_reason TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("  ✅ tabla creada/verificada");

  conn.release();
  await pool.end();
  console.log("\n🎉 Migración completada!");
}

run().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
