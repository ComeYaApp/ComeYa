// Solo lectura: inspeccionar textos de planes/beneficios de suscripción
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

  const [plans] = await conn.query(
    "SELECT plan_key, name, description FROM subscription_plans ORDER BY display_order",
  );
  console.log("=== PLANES ===");
  for (const p of plans) {
    console.log(`[${p.plan_key}] ${p.name}`);
    console.log(`  desc: ${p.description}`);
  }

  const [benefits] = await conn.query(
    "SELECT plan, benefit_type, description FROM subscription_benefits ORDER BY plan, benefit_type",
  );
  console.log("\n=== BENEFICIOS ===");
  for (const b of benefits) {
    console.log(`[${b.plan}] ${b.benefit_type}: ${b.description}`);
  }

  await conn.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
