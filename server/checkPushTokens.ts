// Diagnóstico read-only: lista usuarios con push_token registrado.
// Uso: npx tsx server/checkPushTokens.ts   (lee .env.local como server/db.ts)
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function main() {
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!mysqlUrl) {
    console.error("❌ No se encontró MYSQL_DATABASE_URL ni DATABASE_URL");
    process.exit(1);
  }

  const url = new URL(mysqlUrl);
  const caEnv = process.env.AIVEN_CA_CERT;
  const caPath = path.join(process.cwd(), "ca.pem");
  const ca = caEnv
    ? Buffer.from(caEnv, "base64").toString("utf-8")
    : fs.existsSync(caPath)
      ? fs.readFileSync(caPath, "utf-8")
      : null;

  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    connectTimeout: 30000,
    charset: "utf8mb4",
  });

  try {
    const [rows] = (await conn.query(
      `SELECT id, name, phone, role, push_token, updated_at
       FROM users
       WHERE push_token IS NOT NULL AND push_token <> ''
       ORDER BY updated_at DESC
       LIMIT 20`,
    )) as [any[], unknown];

    console.log(`\n📱 Usuarios con push_token registrado: ${rows.length}\n`);
    for (const r of rows) {
      console.log(
        `- ${r.name ?? "(sin nombre)"} | ${r.phone ?? "-"} | ${r.role ?? "-"} | actualizado: ${r.updated_at ?? "-"}`,
      );
      console.log(`  token: ${r.push_token}`);
    }
    if (rows.length === 0) {
      console.log(
        "Ningún usuario tiene token todavía: abre la app nueva y acepta el permiso de notificaciones.",
      );
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
