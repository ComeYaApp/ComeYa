import { db } from "./db";
import { orders, users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { processRefundWithCommissions } from "./stripeConnect";

const PENALTY_RULES = {
  pending: { refund: 100, penalty: 0 },
  confirmed: { refund: 100, penalty: 0 },
  preparing: { refund: 80, penalty: 20 },
  ready: { refund: 50, penalty: 50 },
  picked_up: { refund: 0, penalty: 100 },
  delivered: { refund: 0, penalty: 100 },
};

export async function cancelOrderWithPenalty(
  orderId: string,
  userId: string,
  reason: string,
) {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return { success: false, error: "Order not found" };

    if (order.userId !== userId)
      return { success: false, error: "Unauthorized" };

    const rule = PENALTY_RULES[order.status as keyof typeof PENALTY_RULES] || {
      refund: 0,
      penalty: 100,
    };
    const refundAmount = Math.round(order.total * (rule.refund / 100));
    const penaltyAmount = order.total - refundAmount;

    if (refundAmount > 0) {
      await processRefundWithCommissions(orderId, refundAmount);
    }

    await db
      .update(orders)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: new Date(),
        refundAmount,
        penaltyAmount,
      })
      .where(eq(orders.id, orderId));

    logger.info("Order cancelled", {
      orderId,
      refund: refundAmount,
      penalty: penaltyAmount,
    });
    return {
      success: true,
      refundAmount,
      penaltyAmount,
      refundPercent: rule.refund,
    };
  } catch (error: any) {
    logger.error("Cancellation failed", error);
    return { success: false, error: error.message };
  }
}

export async function getCancellationPreview(orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { success: false, error: "Order not found" };

  const rule = PENALTY_RULES[order.status as keyof typeof PENALTY_RULES] || {
    refund: 0,
    penalty: 100,
  };
  return {
    success: true,
    canCancel: rule.refund > 0,
    refundPercent: rule.refund,
    refundAmount: Math.round(order.total * (rule.refund / 100)),
    penaltyAmount: Math.round(order.total * (rule.penalty / 100)),
  };
}
