// Cash Payment Service with Change Calculation
import { db } from "./db";
import { orders, payments } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

interface CashPaymentParams {
  orderId: string;
  customerId: string;
  businessId: string;
  cashReceived: number;
  orderTotal: number;
}

interface CashPaymentResult {
  success: boolean;
  change?: number;
  paymentId?: string;
  error?: string;
}

export async function processCashPayment(
  params: CashPaymentParams,
): Promise<CashPaymentResult> {
  try {
    const { orderId, customerId, businessId, cashReceived, orderTotal } =
      params;

    // Validate cash amount
    if (cashReceived < orderTotal) {
      return {
        success: false,
        error: `Efectivo insuficiente. Se requieren ${orderTotal} €, recibido ${cashReceived} €`,
      };
    }

    const change = cashReceived - orderTotal;

    // Create payment record
    const result = await db.insert(payments).values({
      orderId,
      customerId,
      businessId,
      amount: orderTotal,
      currency: "EUR",
      status: "succeeded",
      paymentMethod: "cash",
      processedAt: new Date(),
    });

    // Get the inserted ID
    const paymentId = result[0].insertId.toString();

    // Update order status
    await db
      .update(orders)
      .set({
        status: "paid",
        paymentMethod: "cash",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      success: true,
      change,
      paymentId,
    };
  } catch (error: any) {
    console.error("Process cash payment error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function confirmCashDelivery(orderId: string, driverId: string) {
  try {
    // Update order status to delivered
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Process commission distribution for cash payments
    await processCashCommissions(orderId);

    return {
      success: true,
      message: "Cash delivery confirmed",
    };
  } catch (error: any) {
    console.error("Confirm cash delivery error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function processCashCommissions(orderId: string) {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return;

    // Use unified financial service to keep commission split consistent system-wide
    const commissions = await financialService.calculateCommissions(
      order.total,
      order.deliveryFee || 0,
      order.productosBase || undefined,
      order.nemyCommission || undefined,
    );

    const platformAmount = commissions.platform;
    const businessAmount = commissions.business;
    const driverAmount = commissions.driver;

    // Update wallets using wallet functions
    const { creditWallet } = await import("./paymentService");

    // Business gets their commission
    await creditWallet(
      order.businessId,
      businessAmount,
      "cash_commission",
      orderId,
    );

    // Driver gets their commission (if assigned)
    if (order.deliveryPersonId) {
      await creditWallet(
        order.deliveryPersonId,
        driverAmount,
        "cash_delivery_fee",
        orderId,
      );
    }

    if (platformAmount > 0) {
      // TODO: Define platform wallet handling for cash; currently held at platform level
      console.log(
        `ℹ️ Plataforma debe registrar $${platformAmount} para pedido ${orderId}`,
      );
    }

    console.log(`💰 Cash commissions processed for order ${orderId}`);
  } catch (error) {
    console.error("Process cash commissions error:", error);
  }
}

export async function getCashPaymentDetails(orderId: string) {
  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1);

    if (!payment) {
      return {
        success: false,
        error: "Cash payment not found",
      };
    }

    return {
      success: true,
      payment,
    };
  } catch (error: any) {
    console.error("Get cash payment details error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function calculateChange(
  orderTotal: number,
  cashReceived: number,
) {
  if (cashReceived < orderTotal) {
    return {
      success: false,
      error: "Efectivo insuficiente",
      shortage: orderTotal - cashReceived,
    };
  }

  const change = cashReceived - orderTotal;

  // Calculate optimal change breakdown (Mexican denominations)
  const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  const changeBreakdown: { [key: string]: number } = {};
  let remainingChange = change;

  for (const denom of denominations) {
    if (remainingChange >= denom) {
      const count = Math.floor(remainingChange / denom);
      changeBreakdown[`$${denom}`] = count;
      remainingChange =
        Math.round((remainingChange - count * denom) * 100) / 100;
    }
  }

  return {
    success: true,
    change,
    breakdown: changeBreakdown,
    message: change === 0 ? "Pago exacto" : `Cambio: $${change}`,
  };
}
