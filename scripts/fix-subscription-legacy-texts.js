// Repara los textos con mojibake de los planes legacy (free/premium/business).
// Solo toca filas de subscription_plans / subscription_benefits.
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

const PLAN_FIXES = {
  free: "Plan básico sin coste",
  premium: "Para clientes frecuentes",
  business: "Para empresas y autónomos",
};

const BENEFIT_FIXES = [
  ["premium", "free_delivery", "Envío gratis ilimitado"],
  ["business", "promotional_tools", "Herramientas promocionales"],
  ["business", "reduced_commission", "7% de descuento en comisión"],
];

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  for (const [planKey, description] of Object.entries(PLAN_FIXES)) {
    const [r] = await conn.query(
      "UPDATE subscription_plans SET description = ? WHERE plan_key = ?",
      [description, planKey],
    );
    console.log(`plan ${planKey}: ${r.affectedRows} fila(s) actualizada(s)`);
  }

  for (const [plan, type, description] of BENEFIT_FIXES) {
    const [r] = await conn.query(
      "UPDATE subscription_benefits SET description = ? WHERE plan = ? AND benefit_type = ?",
      [description, plan, type],
    );
    console.log(
      `benefit ${plan}/${type}: ${r.affectedRows} fila(s) actualizada(s)`,
    );
  }

  await conn.end();
  console.log("✅ Textos reparados");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
