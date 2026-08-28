// Pending Orders Monitor for ComeYa
// Automatically calls businesses after 3 minutes of unaccepted orders
import { db } from "./db";
import { orders, businesses } from "@shared/schema-mysql";
import { eq, and, lt, isNull, or } from "drizzle-orm";
import { callBusinessForOrder } from "./callService";

const THREE_MINUTES_MS = 3 * 60 * 1000;

async function checkAndCallPendingOrders() {
  try {
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - THREE_MINUTES_MS);

    // Find pending orders older than 3 minutes that haven't been called
    const pendingOrders = await db
      .select({
        orderId: orders.id,
        businessId: orders.businessId,
        businessName: orders.businessName,
        total: orders.total,
        userId: orders.userId,
        createdAt: orders.createdAt,
        callAttempted: orders.callAttempted,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          lt(orders.createdAt, threeMinutesAgo),
          or(eq(orders.callAttempted, false), isNull(orders.callAttempted)),
        ),
      );

    if (pendingOrders.length === 0) {
      return;
    }

    console.log(
      `Found ${pendingOrders.length} pending orders older than 3 minutes`,
    );

    for (const order of pendingOrders) {
      // Get business phone number
      const [business] = await db
        .select({ phone: businesses.phone, name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);

      if (!business?.phone) {
        console.log(
          `No phone number for business ${order.businessId}, skipping call`,
        );
        continue;
      }

      console.log(
        `Initiating call to ${business.name} for order ${order.orderId}`,
      );

      // Call the business using orderId (the function fetches details internally)
      const result = await callBusinessForOrder(order.orderId);

      // Mark call as attempted regardless of success
      await db
        .update(orders)
        .set({
          callAttempted: true,
          callAttemptedAt: new Date(),
        })
        .where(eq(orders.id, order.orderId));

      if (result.success) {
        console.log(
          `Call initiated successfully for order ${order.orderId}, SID: ${result.callSid}`,
        );
      } else {
        console.error(
          `Failed to call for order ${order.orderId}: ${result.error}`,
        );
      }
    }
  } catch (error) {
    console.error("Error in pending orders monitor:", error);
  }
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startPendingOrdersMonitor() {
  if (process.env.NODE_ENV === "development") {
    console.log("Pending orders monitor disabled in development");
    // In development, we can create test data when needed
    return;
  }

  if (process.env.NODE_ENV === "production") {
    console.log("Starting pending orders monitor in production");
    // Check immediately, then every 2 minutes
    checkAndCallPendingOrders();
    monitorInterval = setInterval(checkAndCallPendingOrders, 2 * 60 * 1000);
  }
}

export function stopPendingOrdersMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("Pending orders monitor stopped");
  }
}
