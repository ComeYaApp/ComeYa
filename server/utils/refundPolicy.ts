/**
 * Política de reembolsos: decide por qué vía sale el dinero de un pedido.
 * Módulo puro (sin BD ni Stripe) para poder testearlo aislado.
 */

export type RefundMethod = "stripe" | "manual_transfer" | "cash_none" | "no_charge";

export function isStripePayment(order: {
  paymentMethod?: string | null;
}): boolean {
  return (
    typeof order.paymentMethod === "string" &&
    order.paymentMethod.startsWith("stripe_")
  );
}

export function isCashPayment(order: {
  paymentMethod?: string | null;
}): boolean {
  return order.paymentMethod === "cash" || order.paymentMethod === "efectivo";
}

export function isManualPayment(order: { paymentMethod?: string | null }): boolean {
  return !isStripePayment(order) && !isCashPayment(order);
}

/**
 * Decide cómo se devuelve el dinero de este pedido.
 * Solo hay dos vías reales de salida: Stripe (automática) y transferencia
 * manual. cash_none/no_charge dejan constancia de que no hay nada que devolver.
 */
export function resolveRefundMethod(order: any): RefundMethod {
  // Stripe solo si además hay un cobro real que revertir. Un PaymentIntent
  // existe desde que se ABRE la ventana de pago: si el cliente la canceló,
  // hay intent pero no hay cargo y reembolsar falla para siempre.
  if (
    isStripePayment(order) &&
    order.stripePaymentIntentId &&
    order.paidAt
  ) {
    return "stripe";
  }

  // Pago Stripe abierto pero nunca completado: no hay dinero que devolver
  if (isStripePayment(order) && !order.paidAt) {
    return "no_charge";
  }

  // Efectivo nunca cobrado: el cliente no puso dinero, no hay nada que devolver
  if (isCashPayment(order) && !order.cashCollected) {
    return "cash_none";
  }

  // Bizum, SEPA, PayPal y efectivo ya cobrado: el dinero entró fuera de la
  // plataforma, así que sale igual — el admin transfiere y sube comprobante.
  return "manual_transfer";
}
