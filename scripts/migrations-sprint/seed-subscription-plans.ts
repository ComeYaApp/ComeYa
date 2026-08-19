// Seed de los 7 planes de suscripción ComeYa Soria (idempotente).
// Planes: soria_local, impulso_local, top_soria, premium_soria,
// logistica_local, escaparate_soria, express_semana.
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

interface PlanDef {
  planKey: string;
  name: string;
  description: string;
  price: number; // centavos
  billingCycle: string;
  audience: "customer" | "business";
  color: string;
  icon: string;
  displayOrder: number;
  benefits: Array<{ type: string; value: number; description: string }>;
}

const PLANS: PlanDef[] = [
  {
    planKey: "soria_local",
    name: "Plan Soria Local",
    description:
      "4 envíos gratis al mes en pedidos superiores a 15 €. A partir del 5º pedido, 50% de descuento en el envío.",
    price: 499,
    billingCycle: "monthly",
    audience: "customer",
    color: "#10B981",
    icon: "truck",
    displayOrder: 1,
    benefits: [
      { type: "free_delivery", value: 4, description: "4 envíos gratis al mes" },
      { type: "min_order", value: 1500, description: "En pedidos superiores a 15 €" },
      { type: "discount", value: 50, description: "50% de descuento en el envío desde el 5º pedido" },
    ],
  },
  {
    planKey: "impulso_local",
    name: "Impulso Local",
    description:
      "Comisión reducida del 10% por pedido en vez del 15%. Retén más margen de tu comida.",
    price: 2900,
    billingCycle: "monthly",
    audience: "business",
    color: "#F59E0B",
    icon: "percent",
    displayOrder: 2,
    benefits: [
      { type: "commission_rate", value: 10, description: "Comisión del 10% por pedido" },
    ],
  },
  {
    planKey: "top_soria",
    name: "Top Soria",
    description:
      "Aparece en el carrusel 'Los Recomendados de Soria', prioridad de repartidores en horas punta y ofertas exclusivas.",
    price: 7900,
    billingCycle: "monthly",
    audience: "business",
    color: "#8B5CF6",
    icon: "star",
    displayOrder: 3,
    benefits: [
      { type: "featured", value: 1, description: "Negocio destacado en el carrusel superior" },
      { type: "priority", value: 1, description: "Prioridad de asignación de repartidores" },
    ],
  },
  {
    planKey: "premium_soria",
    name: "Premium Soria",
    description:
      "Todo lo de Top Soria + diseño y mejora de imágenes de tus platos (hasta 5 al mes) y prioridad en eventos.",
    price: 9900,
    billingCycle: "monthly",
    audience: "business",
    color: "#DC2626",
    icon: "award",
    displayOrder: 4,
    benefits: [
      { type: "featured", value: 1, description: "Negocio destacado" },
      { type: "priority", value: 1, description: "Prioridad de repartidores" },
      { type: "image_design", value: 5, description: "Hasta 5 imágenes de platos al mes" },
    ],
  },
  {
    planKey: "logistica_local",
    name: "Logística Local (B2B)",
    description:
      "Solicita repartidores para tus ventas de Instagram/WhatsApp/web. Tarifa plana de 3,50 € por entrega.",
    price: 3900,
    billingCycle: "monthly",
    audience: "business",
    color: "#3B82F6",
    icon: "package",
    displayOrder: 5,
    benefits: [
      { type: "flat_delivery_fee", value: 350, description: "Tarifa plana 3,50 € por entrega" },
    ],
  },
  {
    planKey: "escaparate_soria",
    name: "Escaparate Soria",
    description:
      "Marketplace de proximidad: perfil y catálogo en la app con 8% de comisión y entregas agrupadas (12:00 y 18:00).",
    price: 1900,
    billingCycle: "monthly",
    audience: "business",
    color: "#EC4899",
    icon: "store",
    displayOrder: 6,
    benefits: [
      { type: "commission_rate", value: 8, description: "Comisión del 8% por venta" },
      { type: "delivery_window", value: 1, description: "Entregas agrupadas 12:00 y 18:00" },
    ],
  },
  {
    planKey: "express_semana",
    name: "Express Semanal (Eventos)",
    description:
      "Acceso prioritario a la flota de reparto durante una semana completa. Ideal para campañas: San Valentín, Día de la Madre, Navidad.",
    price: 4900,
    billingCycle: "weekly",
    audience: "business",
    color: "#EF4444",
    icon: "zap",
    displayOrder: 7,
    benefits: [
      { type: "priority", value: 1, description: "Prioridad total de reparto esa semana" },
    ],
  },
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

  // Los planes legacy (Premium 15 € / Business 30 €) quedan desactivados:
  // la app ya solo muestra la estructura Soria.
  await conn.query(
    "UPDATE subscription_plans SET is_active = 0 WHERE plan_key IN ('premium', 'business')",
  );

  for (const plan of PLANS) {
    const id = `plan-${plan.planKey}`;
    await conn.query(
      `INSERT INTO subscription_plans
        (id, plan_key, name, description, price, billing_cycle, is_active, display_order, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        price = VALUES(price),
        billing_cycle = VALUES(billing_cycle),
        display_order = VALUES(display_order),
        color = VALUES(color),
        icon = VALUES(icon),
        is_active = 1`,
      [
        id,
        plan.planKey,
        plan.name,
        plan.description,
        plan.price,
        plan.billingCycle,
        plan.displayOrder,
        plan.color,
        plan.icon,
      ],
    );

    // Beneficios: borrar los del plan y reinsertar (idempotente)
    await conn.query("DELETE FROM subscription_benefits WHERE plan = ?", [
      plan.planKey,
    ]);
    for (const b of plan.benefits) {
      await conn.query(
        `INSERT INTO subscription_benefits (id, plan, benefit_type, benefit_value, description, created_at)
         VALUES (UUID(), ?, ?, ?, ?, NOW())`,
        [plan.planKey, b.type, b.value, b.description],
      );
    }
    console.log(`✅ Plan ${plan.planKey} sembrado`);
  }

  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("SEED FALLÓ:", e.message);
  process.exit(1);
});
