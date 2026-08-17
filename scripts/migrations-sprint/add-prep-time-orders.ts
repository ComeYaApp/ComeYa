// Migración: columnas de aviso anticipado de preparación en orders.
// Idempotente. Añade estimated_prep_minutes, estimated_prep_range y delivery_window.
import fs from "fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

const columns: Array<[string, string]> = [
  ["estimated_prep_minutes", "ALTER TABLE orders ADD COLUMN estimated_prep_minutes INT NULL"],
  ["estimated_prep_range", "ALTER TABLE orders ADD COLUMN estimated_prep_range VARCHAR(20) NULL"],
  ["delivery_window", "ALTER TABLE orders ADD COLUMN delivery_window VARCHAR(20) NULL"],
];

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || env.MYSQLHOST,
    user: env.DB_USER || env.MYSQLUSER,
    password: env.DB_PASSWORD || env.MYSQLPASSWORD,
    database: env.DB_NAME || env.MYSQLDATABASE,
    port: Number(env.DB_PORT || env.MYSQLPORT || 3306),
    ssl: { rejectUnauthorized: false },
    multipleStatements: false,
  });

  const [cols] = (await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'",
  )) as any;
  const names = cols.map((c: any) => c.COLUMN_NAME);

  for (const [name, sql] of columns) {
    if (!names.includes(name)) {
      await conn.query(sql);
      console.log(`✅ Columna '${name}' añadida a orders`);
    } else {
      console.log(`⏭️ '${name}' ya existe`);
    }
  }

  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("MIGRACIÓN FALLÓ:", e.message);
  process.exit(1);
});
