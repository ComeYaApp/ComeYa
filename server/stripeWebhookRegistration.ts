/**
 * Registro automático del webhook de pagos de Stripe.
 *
 * El negocio se enteraba de los pagos SOLO por este webhook, pero el
 * endpoint /api/payments/webhook/stripe no estaba registrado en la cuenta
 * de Stripe (solo existía el de Connect) y los pagos confirmados quedaban
 * "pending" para siempre. Este módulo garantiza en cada arranque que el
 * endpoint exista, esté habilitado, tenga todos los eventos necesarios y
 * que su secreto de firma esté guardado en app_settings — así la verificación
 * de firmas funciona aunque la variable de entorno quede desincronizada.
 */
import { getStripe } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";

const WEBHOOK_PATH = "/api/payments/webhook/stripe";
const SETTINGS_KEY = "stripe_webhook_secret";

const WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.updated",
  "charge.dispute.created",
  "payout.paid",
  "payout.failed",
  "transfer.created",
];

async function storedSecret(): Promise<string | null> {
  try {
    const [rows]: any = await db.execute(
      sql`SELECT value FROM app_settings WHERE \`key\` = ${SETTINGS_KEY} LIMIT 1`,
    );
    return rows?.[0]?.value ? String(rows[0].value) : null;
  } catch {
    return null;
  }
}

async function persistSecret(secret: string): Promise<void> {
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, value) VALUES (${SETTINGS_KEY}, ${secret})
        ON DUPLICATE KEY UPDATE value = VALUES(value)`,
  );
}

async function createEndpoint(stripe: any, url: string): Promise<string> {
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    // Misma versión de API que el webhook de Connect de la cuenta
    api_version: "2026-03-25.dahlia",
  });
  console.log(`✅ Webhook de pagos Stripe creado: ${created.id}`);
  return created.secret;
}

export async function ensureStripeWebhook(): Promise<void> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return;
    const base = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
    if (!base) {
      console.warn("ensureStripeWebhook: BACKEND_URL no definido, se omite");
      return;
    }
    const url = `${base}${WEBHOOK_PATH}`;
    const stripe = getStripe();

    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = endpoints.data.find((e: any) => e.url === url);

    // Endpoint correcto y completo: solo falta comprobar que tenemos su secreto
    if (existing && existing.status === "enabled") {
      const hasAll = WEBHOOK_EVENTS.every((ev: string) =>
        existing.enabled_events.includes(ev),
      );
      if (hasAll && (await storedSecret())) {
        console.log("✅ Webhook de pagos Stripe verificado (ya activo)");
        return;
      }
      if (hasAll && process.env.STRIPE_WEBHOOK_SECRET) {
        // Sin fila en BD, pero hay secreto en el entorno: la firma la
        // verifica el fallback de webhookHandlers — no tocar nada.
        console.log("✅ Webhook de pagos Stripe activo (secreto desde entorno)");
        return;
      }
      // Sin secreto conocido: Stripe nunca lo devuelve para un endpoint
      // existente, así que se recrea para obtener uno nuevo.
      console.warn("ensureStripeWebhook: recreando endpoint (sin secreto conocido)");
      await stripe.webhookEndpoints.del(existing.id);
      const secret = await createEndpoint(stripe, url);
      await persistSecret(secret);
      return;
    }

    // Deshabilitado o eventos incompletos: recrear desde cero
    if (existing) {
      console.warn(`ensureStripeWebhook: recreando endpoint (status ${existing.status})`);
      await stripe.webhookEndpoints.del(existing.id);
    }

    const secret = await createEndpoint(stripe, url);
    await persistSecret(secret);
  } catch (err: any) {
    console.error("ensureStripeWebhook error:", err?.message ?? err);
  }
}
