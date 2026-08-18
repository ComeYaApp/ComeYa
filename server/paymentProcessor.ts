// Automated Payment Processor for MOUZO - Production Ready
import { getStripe } from "./stripeClient";
import { db } from "./db";
import { orders, transactions, businesses, users } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { financialService } from "./unifiedFinancialService";

// Anti-fraud: Hold funds for 1 hour after delivery
const FUND_HOLD_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface PaymentDistribution {
  platformAmount: number;
  businessAmount: number;
  deliveryAmount: number;
  totalAmount: number;
}

interface ProcessPaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  distribution?: PaymentDistribution;
}

async function calculateCommissionsForOrder(order: {
  total: number;
  deliveryFee?: number | null;
  productosBase?: number | null;
  nemyCommission?: number | null;
}): Promise<PaymentDistribution> {
  const commissions = await financialService.calculateCommissions(
    order.total,
    order.deliveryFee || 0,
    order.productosBase || undefined,
    order.nemyCommission || undefined,
  );
  return {
    platformAmount: commissions.platform,
    businessAmount: commissions.business,
    deliveryAmount: commissions.driver,
    totalAmount: commissions.total,
  };
}

export async function createPaymentIntent(orderData: {
  orderId: string;
  businessId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
}): Promise<ProcessPaymentResult> {
  const stripe = getStripe();
  // Input validation
  if (!orderData.orderId || !orderData.businessId || !orderData.customerId) {
    return { success: false, error: "Missing required order information" };
  }

  if (orderData.amount < 100 || orderData.amount > 10000000) {
    return {
      success: false,
      error: "Amount must be between $1.00 and $100,000.00",
    };
  }

  try {
    // Fetch order to ensure we use canonical totals for commission split
    const [order] = await db
      .select({
        id: orders.id,
        total: orders.total,
        deliveryFee: orders.deliveryFee,
        productosBase: orders.productosBase,
        nemyCommission: orders.nemyCommission,
      })
      .from(orders)
      .where(eq(orders.id, orderData.orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Get business Stripe account
    const [business] = await db
      .select({
        stripeAccountId: businesses.stripeAccountId,
        name: businesses.name,
        isActive: businesses.isActive,
        stripeAccountStatus: businesses.stripeAccountStatus,
      })
      .from(businesses)
      .where(eq(businesses.id, orderData.businessId))
      .limit(1);

    if (!business) {
      return { success: false, error: "Business not found" };
    }

    if (!business.isActive || business.stripeAccountStatus !== "active") {
      return { success: false, error: "Business account is not active" };
    }

    if (!business.stripeAccountId) {
      return {
        success: false,
        error: "Business has not completed Stripe onboarding",
      };
    }

    // Calculate commission distribution using unified service with canonical order values
    const distribution = await calculateCommissionsForOrder(order);
    const amountToCharge = order.total;

    // Create payment intent with application fee
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountToCharge,
      currency: orderData.currency,
      application_fee_amount: distribution.platformAmount,
      transfer_data: {
        destination: business.stripeAccountId,
      },
      metadata: {
        orderId: orderData.orderId,
        businessId: orderData.businessId,
        customerId: orderData.customerId,
        platformAmount: distribution.platformAmount.toString(),
        businessAmount: distribution.businessAmount.toString(),
        deliveryAmount: distribution.deliveryAmount.toString(),
      },
      description: `MOUZO Order ${orderData.orderId} - ${business.name}`,
      statement_descriptor: "MOUZO DELIVERY",
    };

    // Add payment method if provided
    if (orderData.paymentMethodId) {
      paymentIntentParams.payment_method = orderData.paymentMethodId;
      paymentIntentParams.confirmation_method = "manual";
      paymentIntentParams.confirm = true;
    }

    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentParams);

    // Record transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderData.orderId,
      businessId: orderData.businessId,
      userId: orderData.customerId,
      amount: orderData.amount,
      type: "payment_intent",
      status: "pending",
      stripePaymentIntentId: paymentIntent.id,
      metadata: JSON.stringify({
        distribution,
        stripeAccountId: business.stripeAccountId,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`Payment intent created for order ${orderData.orderId}:`, {
      paymentIntentId: paymentIntent.id,
      amount: amountToCharge,
      distribution,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      distribution,
    };
  } catch (error: any) {
    console.error("Error creating payment intent:", {
      error: error.message,
      orderId: orderData.orderId,
      businessId: orderData.businessId,
    });

    // Return user-friendly error messages
    if (error.type === "StripeInvalidRequestError") {
      return { success: false, error: "Invalid payment information" };
    }

    if (error.code === "account_invalid") {
      return {
        success: false,
        error: "Business payment account is not properly configured",
      };
    }

    return {
      success: false,
      error: "Failed to process payment. Please try again.",
    };
  }
}

export async function processDeliveryPayment(
  orderId: string,
  driverId: string,
): Promise<ProcessPaymentResult> {
  const stripe = getStripe();
  if (!orderId || !driverId) {
    return { success: false, error: "Order ID and driver ID are required" };
  }

  try {
    // Get order and verify it's delivered
    const [order] = await db
      .select({
        id: orders.id,
        businessId: orders.businessId,
        driverId: orders.deliveryPersonId,
        total: orders.total,
        status: orders.status,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        deliveredAt: orders.deliveredAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status !== "delivered") {
      return {
        success: false,
        error: "Order must be delivered before processing payment",
      };
    }

    if (order.driverId !== driverId) {
      return { success: false, error: "Driver mismatch" };
    }

    if (!order.stripePaymentIntentId) {
      return {
        success: false,
        error: "No payment intent found for this order",
      };
    }

    // Anti-fraud: Check if enough time has passed since delivery
    const now = new Date();
    const deliveredAt = new Date(order.deliveredAt!);
    const timeSinceDelivery = now.getTime() - deliveredAt.getTime();

    if (timeSinceDelivery < FUND_HOLD_DURATION_MS) {
      const remainingTime = Math.ceil(
        (FUND_HOLD_DURATION_MS - timeSinceDelivery) / (60 * 1000),
      );
      return {
        success: false,
        error: `Funds are held for fraud prevention. Available in ${remainingTime} minutes.`,
      };
    }

    // Get driver's Stripe account
    const [driver] = await db
      .select({ stripeAccountId: users.stripeAccountId })
      .from(users)
      .where(and(eq(users.id, driverId), eq(users.role, "driver")))
      .limit(1);

    if (!driver?.stripeAccountId) {
      return {
        success: false,
        error: "Driver has not completed payment setup",
      };
    }

    // Calculate delivery commission using unified service
    const distribution = await calculateCommissionsForOrder(order);

    // Transfer delivery commission to driver
    const transfer = await stripe.transfers.create({
      amount: distribution.deliveryAmount,
      currency: "usd",
      destination: driver.stripeAccountId,
      metadata: {
        orderId: orderId,
        driverId: driverId,
        type: "delivery_commission",
      },
      description: `Delivery commission for order ${orderId}`,
    });

    // Record delivery payment transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: order.businessId,
      userId: driverId,
      amount: distribution.deliveryAmount,
      type: "delivery_payment",
      status: "completed",
      stripeTransferId: transfer.id,
      metadata: JSON.stringify({
        transferId: transfer.id,
        deliveryCommission: distribution.deliveryAmount,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update order status
    await db
      .update(orders)
      .set({
        status: "completed",
        paymentProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    console.log(`Delivery payment processed for order ${orderId}:`, {
      transferId: transfer.id,
      driverId,
      amount: distribution.deliveryAmount,
    });

    return {
      success: true,
      distribution,
    };
  } catch (error: any) {
    console.error("Error processing delivery payment:", {
      error: error.message,
      orderId,
      driverId,
    });

    return { success: false, error: "Failed to process delivery payment" };
  }
}

export async function processRefund(
  orderId: string,
  reason: string,
  amount?: number,
): Promise<ProcessPaymentResult> {
  const stripe = getStripe();
  if (!orderId || !reason) {
    return { success: false, error: "Order ID and reason are required" };
  }

  try {
    // Get order details
    const [order] = await db
      .select({
        id: orders.id,
        businessId: orders.businessId,
        userId: orders.userId,
        total: orders.total,
        status: orders.status,
        stripePaymentIntentId: orders.stripePaymentIntentId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (!order.stripePaymentIntentId) {
      return { success: false, error: "No payment found for this order" };
    }

    if (order.status === "refunded") {
      return { success: false, error: "Order has already been refunded" };
    }

    // Determine refund amount
    const refundAmount = amount || order.total;

    if (refundAmount > order.total) {
      return {
        success: false,
        error: "Refund amount cannot exceed order total",
      };
    }

    // Process refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        orderId: orderId,
        refundReason: reason,
      },
    });

    // Record refund transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: order.businessId,
      userId: order.userId,
      amount: -refundAmount, // Negative amount for refund
      type: "refund",
      status: "completed",
      stripeRefundId: refund.id,
      metadata: JSON.stringify({
        refundId: refund.id,
        reason: reason,
        originalAmount: order.total,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update order status
    const newStatus =
      refundAmount === order.total ? "refunded" : "partially_refunded";
    await db
      .update(orders)
      .set({
        status: newStatus,
        refundedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    console.log(`Refund processed for order ${orderId}:`, {
      refundId: refund.id,
      amount: refundAmount,
      reason,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error processing refund:", {
      error: error.message,
      orderId,
      reason,
    });

    return { success: false, error: "Failed to process refund" };
  }
}
