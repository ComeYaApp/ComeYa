// Migra la tabla weekly_settlements a la versión del script oficial
// (setup-weekly-settlement-system.sql): añade 'deadline' si falta.
// Idempotente: se puede ejecutar las veces que sea.
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
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_settlements'",
  )) as any;

  const names = cols.map((c: any) => c.COLUMN_NAME);
  console.log("Columnas actuales:", names.join(","));

  if (!names.includes("deadline")) {
    await conn.query(
      "ALTER TABLE weekly_settlements ADD COLUMN deadline DATETIME NULL",
    );
    console.log("✅ Columna 'deadline' añadida a weekly_settlements");
  } else {
    console.log("⏭️ 'deadline' ya existe");
  }

  // Índice para el cron de vencidos (si no existe)
  try {
    await conn.query("CREATE INDEX idx_deadline ON weekly_settlements (deadline)");
    console.log("✅ Índice idx_deadline creado");
  } catch (e: any) {
    if (String(e.code).includes("ER_DUP_KEYNAME")) {
      console.log("⏭️ Índice idx_deadline ya existe");
    } else {
      throw e;
    }
  }

  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("MIGRACIÓN FALLÓ:", e.message);
  process.exit(1);
});
