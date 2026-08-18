// Aplica las migraciones pendientes de forma idempotente (MySQL 8 no soporta
// ADD COLUMN IF NOT EXISTS: se filtra el error de columna duplicada).
const fs = require("fs");
const mysql = require("mysql2/promise");

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

const MIGRATIONS = [
  "migrations/add_notification_preferences_and_referrals.sql",
  "migrations/fix_scheduled_orders_table.sql",
];

const IGNORABLE = {
  "1060": "columna ya existe",
  "1061": "índice ya existe",
  "1091": "columna/índice no existe (nada que borrar)",
};

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
    multipleStatements: false,
  });

  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(file, "utf8");
    // Separar sentencias por ";" al final de línea (sin strings multilinea complejos)
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^--.*$/gm, "").trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmtRaw of statements) {
      // MySQL 8 no soporta IF NOT EXISTS en ALTER/INDEX: se normaliza y se
      // tolera el error de duplicado (1060/1061) o inexistente (1091)
      const stmt = stmtRaw
        .replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN")
        .replace(/CREATE UNIQUE INDEX IF NOT EXISTS/gi, "CREATE UNIQUE INDEX")
        .replace(/CREATE INDEX IF NOT EXISTS/gi, "CREATE INDEX")
        .replace(/DROP COLUMN IF EXISTS/gi, "DROP COLUMN")
        .replace(/DROP INDEX IF EXISTS/gi, "DROP INDEX");
      try {
        await conn.query(stmt);
        console.log(`✅ ${file}: ${stmt.replace(/\s+/g, " ").slice(0, 80)}...`);
      } catch (e) {
        if (IGNORABLE[String(e.errno)]) {
          console.log(
            `↩️  ${file}: omitido (${IGNORABLE[String(e.errno)]})`,
          );
        } else {
          console.error(
            `❌ ${file}: ${e.message} :: ${stmt.replace(/\s+/g, " ").slice(0, 100)}`,
          );
          process.exitCode = 1;
        }
      }
    }
  }

  await conn.end();
  console.log("Migraciones aplicadas");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
