// Solo lectura: columnas de la tabla users
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

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  const [cols] = await conn.query(
    "SHOW COLUMNS FROM users",
  );
  const names = cols.map((c) => c.Field);
  console.log("users:", names.join(", "));
  console.log("has push_token:", names.includes("push_token"));
  console.log("has updated_at:", names.includes("updated_at"));

  await conn.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
