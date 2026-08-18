// IMMEDIATE Driver Payment System - Pay on Delivery
import { getStripe } from "./stripeClient";
import { db } from "./db";
import { orders, users, transactions } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Pay driver IMMEDIATELY when order is marked as delivered
export async function payDriverImmediately(orderId: string) {
  try {
    console.log(`💰 IMMEDIATE driver payment for order: ${orderId}`);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.deliveryPersonId) {
      throw new Error(`Order ${orderId} has no delivery person`);
    }

    // Get driver's Stripe account
    const [driver] = await db
      .select({ stripeAccountId: users.stripeAccountId, name: users.name })
      .from(users)
      .where(eq(users.id, order.deliveryPersonId))
      .limit(1);

    if (!driver?.stripeAccountId) {
      console.log(`⚠️ Driver has no Stripe account`);
      return { success: true, method: "internal_wallet" };
    }

    // IMMEDIATE transfer - NO WAITING
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: order.deliveryEarnings || 0,
      currency: "eur",
      destination: driver.stripeAccountId,
      metadata: {
        orderId: orderId,
        driverId: order.deliveryPersonId,
        type: "immediate_delivery_payment",
      },
      description: `IMMEDIATE payment - Order ${orderId}`,
    });

    // Record transaction
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: order.businessId,
      userId: order.deliveryPersonId,
      amount: order.deliveryEarnings || 0,
      type: "immediate_delivery_payment",
      status: "completed",
      stripeTransferId: transfer.id,
      metadata: JSON.stringify({
        transferId: transfer.id,
        driverName: driver.name,
        timing: "immediate_on_delivery",
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mark driver as paid
    await db
      .update(orders)
      .set({
        driverPaidAt: new Date(),
        driverPaymentStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    console.log(`✅ Driver paid immediately: ${transfer.id}`);
    return { success: true, transferId: transfer.id };
  } catch (error: any) {
    console.error(`❌ Error paying driver:`, error);
    return { success: false, error: error.message };
  }
}
