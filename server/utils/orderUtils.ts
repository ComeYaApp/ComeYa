import { eq } from "drizzle-orm";

export async function ensureOrderAccess(
  orderId: string,
  userId: string,
  role: string,
) {
  const { orders, businesses } = await import("@shared/schema-mysql");
  const { db } = await import("../db");

  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      deliveryPersonId: orders.deliveryPersonId,
      businessId: orders.businessId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { status: 404, error: "Order not found" } as const;
  }

  if (role === "admin" || role === "super_admin") {
    return { order } as const;
  }

  if (order.userId === userId || order.deliveryPersonId === userId) {
    return { order } as const;
  }

  if (order.businessId) {
    const [business] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (business?.ownerId === userId) {
      return { order } as const;
    }
  }

  return {
    status: 403,
    error: "You do not have permission to access this order",
  } as const;
}
