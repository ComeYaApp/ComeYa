// Enhanced Webhook Handlers for ComeYa - Production Ready
import { Request, Response } from "express";
import { getStripe } from "./stripeClient";
import { db } from "./db";
import { orders, transactions, businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { orderRef } from "./orderNumberService";

const ENV_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Secreto para verificar la firma de Stripe. Prioridad: BD (app_settings),
 * donde el registro automático del webhook guarda el secreto vigente al
 * crear el endpoint; si no hay fila, el de la variable de entorno.
 */
async function getWebhookSecret(): Promise<string | null> {
  try {
    const { sql } = await import("drizzle-orm");
    const [rows]: any = await db.execute(
      sql`SELECT value FROM app_settings WHERE \`key\` = 'stripe_webhook_secret' LIMIT 1`,
    );
    if (rows?.[0]?.value) return String(rows[0].value);
  } catch (err) {
    console.error("getWebhookSecret: error leyendo app_settings:", err);
  }
  return ENV_WEBHOOK_SECRET || null;
}

interface WebhookContext {
  eventId: string;
  eventType: string;
  timestamp: Date;
  accountId?: string;
}

function logWebhookEvent(context: WebhookContext, message: string, data?: any) {
  console.log(
    `[WEBHOOK ${context.eventId}] ${context.eventType} - ${message}`,
    {
      timestamp: context.timestamp,
      accountId: context.accountId,
      data,
    },
  );
}

function logWebhookError(
  context: WebhookContext,
  error: string,
  details?: any,
) {
  console.error(`[WEBHOOK ${context.eventId}] ERROR - ${error}`, {
    eventType: context.eventType,
    timestamp: context.timestamp,
    accountId: context.accountId,
    details,
  });
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("Missing Stripe signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    // Con el middleware express.raw registrado en server.ts, req.body llega
    // como Buffer. Si ya fuera un objeto (json), la firma no se puede verificar.
    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body
        : typeof req.body === "string"
          ? Buffer.from(req.body)
          : Buffer.from(JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const context: WebhookContext = {
    eventId: event.id,
    eventType: event.type,
    timestamp: new Date(event.created * 1000),
    accountId: event.account || undefined,
  };

  logWebhookEvent(context, "Received webhook event");

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
          context,
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
          context,
        );
        break;

      case "account.updated":
        await handleAccountUpdated(
          event.data.object as Stripe.Account,
          context,
        );
        break;

      case "transfer.created":
        await handleTransferCreated(
          event.data.object as Stripe.Transfer,
          context,
        );
        break;

      case "payout.paid":
        await handlePayoutPaid(event.data.object as Stripe.Payout, context);
        break;

      case "payout.failed":
        await handlePayoutFailed(event.data.object as Stripe.Payout, context);
        break;

      case "charge.refunded":
        await handleChargeRefunded(
          event.data.object as Stripe.Charge,
          context,
        );
        break;

      case "refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status === "failed") {
          await handleRefundFailed(refund, context);
        }
        break;
      }

      case "charge.dispute.created":
        await handleDisputeCreated(
          event.data.object as Stripe.Dispute,
          context,
        );
        break;

      default:
        logWebhookEvent(context, `Unhandled event type: ${event.type}`);
    }

    logWebhookEvent(context, "Webhook processed successfully");
    res.status(200).json({ received: true });
  } catch (error: any) {
    logWebhookError(context, "Failed to process webhook", {
      error: error.message,
      stack: error.stack,
    });

    // Return 200 to prevent Stripe retries for unrecoverable errors
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Business not found")
    ) {
      res.status(200).json({ received: true, warning: "Resource not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  context: WebhookContext,
) {
  // Pago de la DIFERENCIA de una sustitución: no es el pago del pedido,
  // solo aplica la sustitución pendiente (el pedido ya estaba confirmado)
  if (paymentIntent.metadata?.isDelta === "true") {
    const { applyDeltaPaymentFromWebhook } = await import(
      "./substitutionService"
    );
    const deltaResult = await applyDeltaPaymentFromWebhook(paymentIntent);
    logWebhookEvent(
      context,
      `Substitution delta payment: ${deltaResult.message}`,
    );
    return;
  }

  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    logWebhookError(context, "Missing orderId in payment intent metadata");
    return;
  }

  logWebhookEvent(
    context,
    `Processing successful payment for order ${orderId}`,
    {
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  );

  try {
    // Confirmar pedido pagado (lógica compartida con la reconciliación del
    // cron, que rescata pagos cuyo webhook se perdió)
    const { confirmPaidOrder } = await import("./paymentConfirmationService");
    const result = await confirmPaidOrder(orderId, paymentIntent, "webhook");
    if (!result.success) {
      throw new Error(result.message);
    }

    logWebhookEvent(
      context,
      `Order ${orderId} marked as accepted and transaction recorded (${result.message})`,
    );
  } catch (error: any) {
    logWebhookError(context, `Failed to update order ${orderId}`, error);
    throw error;
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  context: WebhookContext,
) {
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    logWebhookError(
      context,
      "Missing orderId in failed payment intent metadata",
    );
    return;
  }

  logWebhookEvent(context, `Processing failed payment for order ${orderId}`, {
    lastPaymentError: paymentIntent.last_payment_error,
  });

  try {
    await db
      .update(orders)
      .set({
        status: "payment_failed",
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    logWebhookEvent(context, `Order ${orderId} marked as payment failed`);
  } catch (error: any) {
    logWebhookError(
      context,
      `Failed to update failed payment for order ${orderId}`,
      error,
    );
    throw error;
  }
}

async function handleAccountUpdated(
  account: Stripe.Account,
  context: WebhookContext,
) {
  logWebhookEvent(context, `Account updated: ${account.id}`, {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });

  try {
    await db
      .update(businesses)
      .set({
        stripeAccountStatus:
          account.charges_enabled && account.payouts_enabled
            ? "active"
            : "pending",
        updatedAt: new Date(),
      })
      .where(eq(businesses.stripeAccountId, account.id));

    logWebhookEvent(
      context,
      `Business account status updated for Stripe account ${account.id}`,
    );
  } catch (error: any) {
    logWebhookError(
      context,
      `Failed to update business for account ${account.id}`,
      error,
    );
    throw error;
  }
}

async function handleTransferCreated(
  transfer: Stripe.Transfer,
  context: WebhookContext,
) {
  logWebhookEvent(context, `Transfer created: ${transfer.id}`, {
    amount: transfer.amount,
    destination: transfer.destination,
    currency: transfer.currency,
  });

  // Log transfer for audit purposes
  const orderId = transfer.metadata?.orderId;
  if (orderId) {
    try {
      await db.insert(transactions).values({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId: orderId,
        businessId: transfer.metadata?.businessId || "",
        userId: transfer.metadata?.userId || "",
        amount: transfer.amount,
        type: "transfer",
        status: "completed",
        stripeTransferId: transfer.id,
        metadata: JSON.stringify({
          destination: transfer.destination,
          currency: transfer.currency,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logWebhookEvent(
        context,
        `Transfer transaction recorded for order ${orderId}`,
      );
    } catch (error: any) {
      logWebhookError(context, `Failed to record transfer transaction`, error);
    }
  }
}

async function handlePayoutPaid(
  payout: Stripe.Payout,
  context: WebhookContext,
) {
  logWebhookEvent(context, `Payout paid: ${payout.id}`, {
    amount: payout.amount,
    currency: payout.currency,
    method: payout.method,
  });
}

async function handlePayoutFailed(
  payout: Stripe.Payout,
  context: WebhookContext,
) {
  logWebhookError(context, `Payout failed: ${payout.id}`, {
    amount: payout.amount,
    currency: payout.currency,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
  });
}

// ── Reembolsos y disputas ─────────────────────────────────────────────────────
// Reconcilia el estado real de Stripe con nuestra tabla refunds: si un
// reembolso que dimos por bueno falla, o si el cliente abre una disputa en
// su banco, el registro local se corrige y se avisa a los admins.

async function handleChargeRefunded(
  charge: Stripe.Charge,
  context: WebhookContext,
) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { refunds } = await import("@shared/schema-mysql");
  const rows = await db
    .select()
    .from(refunds)
    .where(eq(refunds.stripePaymentIntentId, paymentIntentId));

  for (const row of rows) {
    if (row.status !== "completed") {
      await db
        .update(refunds)
        .set({ status: "completed", processedAt: new Date() })
        .where(eq(refunds.id, row.id));
      logWebhookEvent(context, `Refund ${row.id} confirmada por Stripe`);
    }
  }
}

async function handleRefundFailed(
  refund: Stripe.Refund,
  context: WebhookContext,
) {
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;
  if (!paymentIntentId) return;

  const { refunds } = await import("@shared/schema-mysql");
  await db
    .update(refunds)
    .set({
      status: "failed",
      failureReason: refund.reason || "Stripe reportó fallo en la devolución",
    })
    .where(eq(refunds.stripePaymentIntentId, paymentIntentId));

  logWebhookError(context, `Refund failed para PI ${paymentIntentId}`);
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  context: WebhookContext,
) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  logWebhookError(
    context,
    `Disputa abierta por el banco (chargeback) — PI ${paymentIntentId}`,
    { orderId: order?.id, amount: dispute.amount, reason: dispute.reason },
  );

  // Avisar a los admins: un chargeback requiere respuesta en el panel de
  // Stripe dentro del plazo o se pierde por defecto
  if (order) {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { inArray } = await import("drizzle-orm");
      const { sendPushToUser } = await import("./enhancedPushService");
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ["admin", "super_admin"]));
      for (const admin of admins) {
        await sendPushToUser(admin.id, {
          title: "🚨 Chargeback abierto",
          body: `Pedido ${orderRef(order)}: el cliente ha reclamado ${(dispute.amount / 100).toFixed(2)} € a su banco. Responde en Stripe antes del plazo.`,
          data: {
            orderId: order.id,
            screen: "AdminDashboard",
            section: "finance_refunds",
            type: "chargeback",
          },
        }).catch(() => {});
      }
    } catch {}
  }
}
