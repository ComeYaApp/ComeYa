// Auditoría READ-ONLY de pedidos históricos (Fase 7 del plan).
//
// NO modifica nada: solo SELECT. Sirve para medir el impacto del modelo de
// precios compuesto ANTES de desplegar y para decidir si hace falta una
// revisión manual de liquidaciones antiguas.
//
// Uso: node scripts/audit-historical-orders.js
// Requiere MYSQL_DATABASE_URL o DATABASE_URL (o .env.local).

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const eur = (cents) => `${((Number(cents) || 0) / 100).toFixed(2)} €`;

async function main() {
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!mysqlUrl) {
    console.error(
      "❌ Falta MYSQL_DATABASE_URL o DATABASE_URL. No se consultó nada.",
    );
    process.exit(1);
  }
  const url = new URL(mysqlUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306", 10),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });

  console.log("🔎 Auditoría histórica de pedidos (SOLO LECTURA)\n");

  const [[totals]] = await connection.execute(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'delivered') AS delivered,
      SUM(productos_base IS NOT NULL AND productos_base > 0) AS con_base,
      SUM(productos_base IS NULL OR productos_base = 0) AS sin_base,
      SUM(markup_amount IS NOT NULL AND markup_amount > 0) AS con_markup
    FROM orders
  `);
  console.log("📦 Pedidos");
  console.log(`   total: ${totals.total} · entregados: ${totals.delivered}`);
  console.log(
    `   con productos_base: ${totals.con_base} · sin base (legacy): ${totals.sin_base}`,
  );
  console.log(`   con markup_amount: ${totals.con_markup}\n`);

  // Comisión no cobrada: total no incluye nemy_commission + servicio + envío.
  // (1 céntimo de tolerancia por redondeos.)
  const [[commission]] = await connection.execute(`
    SELECT
      COUNT(*) AS afectados,
      COALESCE(SUM(subtotal + COALESCE(nemy_commission,0) + delivery_fee + COALESCE(service_fee,0) - total), 0) AS delta
    FROM orders
    WHERE COALESCE(nemy_commission,0) > 0
      AND total < subtotal + COALESCE(nemy_commission,0) + delivery_fee + COALESCE(service_fee,0) - 1
  `);
  console.log("💸 Comisión no cobrada al cliente (histórico)");
  console.log(
    `   pedidos afectados: ${commission.afectados} · diferencia estimada: ${eur(commission.delta)}\n`,
  );

  // Negocio pagado por encima de su base (bug businessEarnings ?? subtotal).
  const [[overpay]] = await connection.execute(`
    SELECT
      COUNT(*) AS afectados,
      COALESCE(SUM(business_earnings - expected_base), 0) AS delta
    FROM (
      SELECT
        business_earnings,
        CASE
          WHEN COALESCE(productos_base,0) > 0 THEN productos_base
          ELSE GREATEST(0, subtotal - COALESCE(nemy_commission,0) - COALESCE(markup_amount,0))
        END AS expected_base
      FROM orders
      WHERE status = 'delivered'
        AND business_earnings IS NOT NULL
    ) t
    WHERE business_earnings > expected_base + 1
  `);
  console.log("🏪 Negocios pagados por encima de su base");
  console.log(
    `   pedidos afectados: ${overpay.afectados} · sobrepago estimado: ${eur(overpay.delta)}\n`,
  );

  const [[missingEarnings]] = await connection.execute(`
    SELECT COUNT(*) AS afectados
    FROM orders
    WHERE status = 'delivered'
      AND (business_earnings IS NULL OR delivery_earnings IS NULL OR platform_fee IS NULL)
  `);
  console.log("🧾 Pedidos entregados sin earnings calculados");
  console.log(`   pedidos afectados: ${missingEarnings.afectados}\n`);

  const [payouts] = await connection.execute(`
    SELECT recipient_type, COUNT(*) AS n, COALESCE(SUM(amount),0) AS total
    FROM payouts
    GROUP BY recipient_type
  `);
  console.log("💰 Payouts registrados por tipo");
  for (const row of payouts) {
    console.log(
      `   ${row.recipient_type}: ${row.n} pagos · ${eur(row.total)}`,
    );
  }
  console.log(
    "\n✅ Auditoría completada. No se ha modificado ningún dato (solo SELECT).",
  );

  await connection.end();
}

main().catch(async (error) => {
  console.error("❌ Error en la auditoría:", error.message);
  process.exit(1);
});
