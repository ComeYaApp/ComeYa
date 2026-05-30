// Real Payment Processing Service
import Stripe from "stripe";
import { db } from "./db";
import {
  orders,
  payments,
  wallets,
  transactions,
  businesses,
  drivers,
} from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

// Lazy-loaded Stripe instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "Stripe is not configured. Please add STRIPE_SECRET_KEY.",
      );
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripeInstance;
}

const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  },
});

interface CreatePaymentIntentParams {
  orderId: string;
  amount: number;
  customerId: string;
  businessId: string;
  driverId?: string;
  paymentMethod?: string;
}

interface ProcessPaymentParams {
  paymentIntentId: string;
  orderId: string;
}

export async function createPaymentIntent(params: CreatePaymentIntentParams) {
  try {
    const { orderId, amount, customerId, businessId, driverId, paymentMethod } =
      params;

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "mxn",
      payment_method: paymentMethod,
      confirmation_method: "manual",
      confirm: paymentMethod ? true : false,
      metadata: {
        orderId,
        customerId,
        businessId,
        driverId: driverId || "",
        type: "order_payment",
      },
    });

    // Save payment record
    await db.insert(payments).values({
      id: paymentIntent.id,
      orderId,
      customerId,
      businessId,
      driverId,
      amount,
      currency: "MXN",
      status: paymentIntent.status,
      paymentMethod: paymentMethod || "card",
      stripePaymentIntentId: paymentIntent.id,
      createdAt: new Date(),
    });

    return {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      },
    };
  } catch (error: any) {
    console.error("Create PaymentIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function confirmPaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    // Update payment status
    await db
      .update(payments)
      .set({
        status: paymentIntent.status,
        updatedAt: new Date(),
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));

    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error("Confirm PaymentIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Credit wallet with a transaction record (used by cash commissions)
export async function creditWallet(
  userId: string,
  amount: number,
  type: string,
  orderId?: string,
  description?: string,
) {
  return await db.transaction(async (tx) => {
    let [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      const result = await tx
        .insert(wallets)
        .values({
          userId,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          cashOwed: 0,
        })
        .$returningId();

      const newId = Array.isArray(result)
        ? result[0].id
        : (result as any).insertId;
      [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, newId))
        .limit(1);
    }

    const newBalance = (wallet?.balance || 0) + amount;

    await tx
      .update(wallets)
      .set({
        balance: newBalance,
        totalEarned: (wallet?.totalEarned || 0) + amount,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));

    await tx.insert(transactions).values({
      walletId: wallet!.id,
      userId,
      amount,
      type,
      status: "completed",
      description: description || `${type} - Orden ${orderId ?? ""}`.trim(),
      orderId,
      createdAt: new Date(),
    });

    return { success: true, newBalance };
  });
}

export async function processSuccessfulPayment(paymentIntentId: string) {
  try {
    // Get payment details
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    if (!payment) {
      throw new Error("Payment not found");
    }

    // Fetch order to calculate commissions correctly (card sales)
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    if (!order) {
      throw new Error(
        `Order ${payment.orderId} not found for payment ${paymentIntentId}`,
      );
    }

    const commissions = await financialService.calculateCommissions(
      payment.amount,
      order.deliveryFee || 0,
      order.productosBase || undefined,
      order.nemyCommission || undefined,
    );

    const platformAmount = commissions.platform;
    const businessAmount = commissions.business;
    const driverAmount = payment.driverId ? commissions.driver : 0;

    // Update business wallet using unified service
    await financialService.updateWalletBalance(
      payment.businessId,
      businessAmount,
      "commission",
      payment.orderId,
      `Venta con tarjeta - Pedido ${payment.orderId}`,
    );

    // Update driver wallet (if assigned) using unified service
    if (payment.driverId && driverAmount > 0) {
      await financialService.updateWalletBalance(
        payment.driverId,
        driverAmount,
        "delivery_fee",
        payment.orderId,
        `Tarifa de entrega - Pedido ${payment.orderId}`,
      );
    }

    // Update order status
    await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, payment.orderId));

    // Update payment status
    await db
      .update(payments)
      .set({
        status: "succeeded",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return {
      success: true,
      distribution: {
        platform: platformAmount,
        business: businessAmount,
        driver: driverAmount,
      },
    };
  } catch (error: any) {
    console.error("Process successful payment error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function createSetupIntent(customerId: string) {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return {
      success: true,
      setupIntent: {
        id: setupIntent.id,
        clientSecret: setupIntent.client_secret,
      },
    };
  } catch (error: any) {
    console.error("Create SetupIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function processDeliveredOrder(orderId: string) {
  try {
    // Get order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error("Order not found");
    }

    // Release held funds immediately (FUND_HOLD_DURATION_HOURS=0)
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (payment && payment.status === "succeeded") {
      // Funds already distributed, just update order
      await db
        .update(orders)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      return {
        success: true,
        message: "Order marked as delivered, funds already distributed",
      };
    }

    return {
      success: false,
      error: "Payment not found or not succeeded",
    };
  } catch (error: any) {
    console.error("Process delivered order error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
