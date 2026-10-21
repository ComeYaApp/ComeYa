// Liquidación de pedidos — única fuente de verdad del modelo de precios
// compuesto de ComeYa (markup + comisión).
//
// Invariantes:
//   subtotal        = base + markup          (round(base × 1,05))
//   nemyCommission  = round(subtotal × tasa) (tasa del plan del negocio)
//   total           = subtotal + nemyCommission + deliveryFee + serviceFee − descuentos
//   platformFee + businessEarnings + deliveryEarnings = total
//   businessEarnings = productosBase   (el negocio cobra el 100 % de su base)
//   deliveryEarnings = deliveryFee     (el repartidor cobra el 100 % del envío)
//   platformFee      = residuo: markup + comisión + servicio − descuentos
//
// Todos los importes en céntimos de euro.

import { applyMarkupPct, commissionOn } from "../pricingService";

export interface OrderPricing {
  subtotal: number;
  markupAmount: number;
  nemyCommission: number;
  total: number;
}

export interface OrderEarnings {
  platformFee: number;
  businessEarnings: number;
  deliveryEarnings: number;
}

/** Precios de pedido a partir de la base del negocio y su tasa. */
export function computeOrderPricing(
  productosBase: number,
  ratePct: number,
  markupPct: number,
  deliveryFee: number,
  serviceFee: number,
  discounts = 0,
): OrderPricing {
  const base = Math.max(0, Math.round(productosBase));
  const subtotal = applyMarkupPct(base, markupPct);
  const markupAmount = subtotal - base;
  const nemyCommission = commissionOn(subtotal, ratePct);
  const total = Math.max(
    0,
    subtotal + nemyCommission + deliveryFee + serviceFee - discounts,
  );
  return { subtotal, markupAmount, nemyCommission, total };
}

/** Reparto de ganancias: negocio = base, repartidor = envío, ComeYa = residuo. */
export function computeEarnings(
  total: number,
  businessBase: number,
  deliveryFee: number,
): OrderEarnings {
  const businessEarnings = Math.max(0, Math.round(businessBase));
  const deliveryEarnings = Math.max(0, Math.round(deliveryFee));
  const platformFee = total - businessEarnings - deliveryEarnings;
  return { platformFee, businessEarnings, deliveryEarnings };
}

/**
 * Ganancia base del negocio de un pedido, incluso si los campos de earnings
 * no se calcularon al crearlo. NUNCA se usa el subtotal completo: el markup o
 * la comisión que el cliente pagó por encima de la base no le pertenecen al
 * negocio.
 */
export function businessBaseOfOrder(order: {
  productosBase?: number | null;
  subtotal?: number | null;
  nemyCommission?: number | null;
  markupAmount?: number | null;
}): number {
  const productosBase = Number(order.productosBase ?? 0);
  if (productosBase > 0) return productosBase;
  return Math.max(
    0,
    Number(order.subtotal ?? 0) -
      Number(order.nemyCommission ?? 0) -
      Number(order.markupAmount ?? 0),
  );
}

/** Earnings de un pedido sin campos calculados (fallback seguro). */
export function settleOrderFields(order: {
  total?: number | null;
  deliveryFee?: number | null;
  productosBase?: number | null;
  subtotal?: number | null;
  nemyCommission?: number | null;
  markupAmount?: number | null;
}): OrderEarnings {
  const total = Number(order.total ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  return computeEarnings(total, businessBaseOfOrder(order), deliveryFee);
}
