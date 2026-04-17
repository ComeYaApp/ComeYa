// Enhanced Webhook Handlers for ComeYa - Production Ready
import { Request, Response } from "express";
import { getStripe } from "./stripeClient";
import { db } from "./db";
import { orders, transactions, businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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

  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
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
    // Verificar que el pedido existe
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!existingOrder) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Update order status
    await db
      .update(orders)
      .set({
        status: "accepted",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Create transaction record
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: existingOrder.businessId,
      userId: existingOrder.userId,
      amount: paymentIntent.amount,
      type: "payment",
      status: "completed",
      stripePaymentIntentId: paymentIntent.id,
      metadata: JSON.stringify({
        paymentMethod: paymentIntent.payment_method,
        currency: paymentIntent.currency,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logWebhookEvent(
      context,
      `Order ${orderId} marked as accepted and transaction recorded`,
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
