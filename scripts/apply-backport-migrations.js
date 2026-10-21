// Aplica las migraciones del backport de forma IDEMPOTENTE (MySQL 8).
//
// MySQL 8 no soporta `ADD COLUMN IF NOT EXISTS`, así que se comprueba
// information_schema antes de cada ALTER. No borra ni reescribe datos:
// solo añade columnas que falten y normaliza el estado legacy approved.
//
// Uso: node scripts/apply-backport-migrations.js

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

const COLUMNS = [
  {
    table: "orders",
    column: "markup_amount",
    ddl: "ALTER TABLE orders ADD COLUMN markup_amount INT DEFAULT 0 AFTER productos_base",
  },
  {
    table: "users",
    column: "document_requested_at",
    ddl: "ALTER TABLE users ADD COLUMN document_requested_at TIMESTAMP NULL",
  },
  {
    table: "users",
    column: "document_request_note",
    ddl: "ALTER TABLE users ADD COLUMN document_request_note TEXT NULL",
  },
  {
    table: "users",
    column: "document_requested_by",
    ddl: "ALTER TABLE users ADD COLUMN document_requested_by VARCHAR(255) NULL",
  },
  {
    table: "subscriptions",
    column: "business_id",
    ddl: "ALTER TABLE subscriptions ADD COLUMN business_id VARCHAR(255) NULL AFTER user_id",
  },
];

async function main() {
  const raw = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) {
    console.error("❌ Falta DATABASE_URL / MYSQL_DATABASE_URL");
    process.exit(1);
  }
  const url = new URL(raw);
  const database = url.pathname.slice(1);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306", 10),
    user: url.username,
    password: url.password,
    database,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 15000,
  });

  console.log(`🔧 Migraciones en ${url.hostname}/${database}\n`);

  for (const item of COLUMNS) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, item.table, item.column],
    );
    if (Number(rows[0].n) > 0) {
      console.log(`✓ ${item.table}.${item.column} ya existe`);
      continue;
    }
    await conn.query(item.ddl);
    console.log(`＋ ${item.table}.${item.column} añadida`);
  }

  // Normalización de estado legacy (aprobado → verificado). Solo cambia el
  // estado; los documentos subidos no se tocan.
  const [usersUpdated] = await conn.query(
    "UPDATE users SET verification_status = 'verified' WHERE verification_status = 'approved'",
  );
  const [bizUpdated] = await conn.query(
    "UPDATE businesses SET verification_status = 'verified' WHERE verification_status = 'approved'",
  );
  console.log(
    `✓ Estados approved→verified: users ${usersUpdated.affectedRows}, businesses ${bizUpdated.affectedRows}`,
  );

  await conn.end();
  console.log("\n✅ Migraciones aplicadas. No se ha borrado ni reescrito ningún pedido.");
}

main().catch(async (error) => {
  console.error("❌ Error aplicando migraciones:", error.message);
  process.exit(1);
});
