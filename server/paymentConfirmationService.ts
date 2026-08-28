/**
 * Confirmación de un pedido pagado por Stripe.
 *
 * Lógica extraída del webhook payment_intent.succeeded para poder
 * reutilizarla desde el cron de reconciliación: si un PaymentIntent
 * succeeded llegó a Stripe pero el webhook se perdió, el pedido queda
 * "pending" para siempre — aquí se confirma exactamente igual.
 */
import { db } from "./db";
import { orders, transactions, businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

type MinimalPaymentIntent = {
  id: string;
  amount: number;
  currency?: string | null;
  payment_method?: any;
};

/**
 * Marca el pedido como aceptado/pagado, registra la transacción y avisa
 * al negocio (push + websocket). Idempotente en la práctica: volver a
 * fijar status accepted + paidAt con el mismo intent no duplica nada
 * crítico salvo la fila de transacción, que solo se crea si no existe.
 */
export async function confirmPaidOrder(
  orderId: string,
  paymentIntent: MinimalPaymentIntent,
  source: "webhook" | "reconciliation" = "webhook",
): Promise<{ success: boolean; message: string }> {
  const [existingOrder] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!existingOrder) {
    return { success: false, message: `Order not found: ${orderId}` };
  }

  // Transacción de pago ya registrada (dedup antes de tocar nada). El
  // intent de Stripe va en metadata: la tabla transactions no tiene
  // columna propia para él (el esquema anterior insertaba una columna
  // inexistente y el webhook fallaba en cada reintento de Stripe)
  const { and } = await import("drizzle-orm");
  const existingTx = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(eq(transactions.orderId, orderId), eq(transactions.type, "payment")),
    )
    .limit(1);

  // Ya confirmado Y con transacción por una entrega previa: no repetir nada
  if (existingOrder.status !== "pending" && existingOrder.paidAt && existingTx.length) {
    return { success: true, message: "already-confirmed" };
  }

  const wasPending = existingOrder.status === "pending";
  if (wasPending) {
    await db
      .update(orders)
      .set({
        status: "accepted",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  if (!existingTx.length) {
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: orderId,
      businessId: existingOrder.businessId,
      userId: existingOrder.userId,
      amount: paymentIntent.amount,
      type: "payment",
      status: "completed",
      metadata: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        paymentMethod: paymentIntent.payment_method ?? null,
        currency: paymentIntent.currency ?? "eur",
        confirmedVia: source,
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Notify business owner about the paid order (solo si es confirmación
  // nueva: un rescate/reintento no debe volver a avisar)
  if (wasPending) try {
    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, existingOrder.businessId))
      .limit(1);
    if (biz?.ownerId) {
      const { sendPushToUser } = await import("./enhancedPushService");
      const { orderRef } = await import("./orderNumberService");
      await sendPushToUser(biz.ownerId, {
        title: "💳 Pago recibido — nuevo pedido",
        body: `${existingOrder.businessName} recibió el pedido ${orderRef(existingOrder)}. Revísalo y ponlo en preparación.`,
        data: { orderId, screen: "BusinessOrders" },
      });
    }
    const { notifyNewOrder } = await import("./websocket");
    notifyNewOrder(existingOrder.businessId, existingOrder);
  } catch (notifyError) {
    console.error("confirmPaidOrder: failed to notify business", notifyError);
  }

  return { success: true, message: "confirmed" };
}
