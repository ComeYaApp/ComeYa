/**
 * Estado de pago de un pedido, pensado para el panel del negocio.
 *
 * El negocio trabaja 100% con pagos digitales: un pedido "pending" solo
 * puede estar esperando el pago del cliente (tarjeta/Bizum en el Payment
 * Sheet) o esperando que administración verifique un comprobante manual
 * (Bizum manual / transferencia SEPA / PayPal). El negocio debe VER el
 * pedido en ambos casos, pero solo puede aceptar pedidos pagados.
 */
export type PaymentState =
  | "paid"
  | "proof_pending"
  | "awaiting_payment"
  | "failed";

export interface PaymentStateOrder {
  id: string;
  status?: string | null;
  paymentMethod?: string | null;
  paidAt?: Date | string | null;
}

/**
 * Clasifica el estado de pago. Pura y sincrónica: recibe el conjunto de
 * orderIds con comprobante pendiente para poder testearla sin BD.
 */
export function classifyPaymentState(
  order: PaymentStateOrder,
  pendingProofOrderIds: ReadonlySet<string>,
): PaymentState {
  const status = String(order?.status ?? "");
  if (status === "payment_failed") return "failed";
  // Todo estado posterior a pending implica pago confirmado (webhook,
  // verificación del admin o flujo histórico de efectivo).
  if (status !== "pending") return "paid";
  // Pedido "pending" pero YA PAGADO (webhook Stripe o comprobante aprobado):
  // espera la ACEPTACIÓN del negocio, no el pago.
  if (order?.paidAt) return "paid";
  const method = String(order?.paymentMethod ?? "").toLowerCase();
  if (method === "cash" || method === "efectivo") return "paid";
  if (pendingProofOrderIds.has(order.id)) return "proof_pending";
  return "awaiting_payment";
}

/** orderIds con comprobante pendiente de verificación (import perezoso de BD). */
export async function pendingProofOrderIds(
  orderIds: string[],
): Promise<Set<string>> {
  if (!orderIds.length) return new Set();
  try {
    const { db } = await import("../db");
    const { paymentProofs } = await import("@shared/schema-mysql");
    const { and, eq, inArray } = await import("drizzle-orm");
    const rows = await db
      .select({ orderId: paymentProofs.orderId })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.status, "pending"),
          inArray(paymentProofs.orderId, orderIds),
        ),
      );
    return new Set(rows.map((r: any) => r.orderId).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Estado de pago de un único pedido (consulta el comprobante si hace falta). */
export async function paymentStateOf(
  order: PaymentStateOrder,
): Promise<PaymentState> {
  if (order?.status !== "pending") return classifyPaymentState(order, new Set());
  return classifyPaymentState(order, await pendingProofOrderIds([order.id]));
}

/** Mensaje de rechazo de aceptación según el estado (guardia del PUT status). */
export function acceptanceBlockedMessage(state: PaymentState): string | null {
  if (state === "proof_pending") {
    return "El pago de este pedido está en verificación por administración. Se activará automáticamente al aprobarse el comprobante.";
  }
  if (state === "awaiting_payment") {
    return "El cliente aún no ha completado el pago. El pedido se activará automáticamente al confirmarse.";
  }
  return null;
}
