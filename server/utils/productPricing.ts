// Precios de producto orientados al cliente (modelo compuesto ComeYa).
//
// Los productos se guardan en BD con su precio base (el que fija el negocio).
// Los endpoints públicos exponen tres vistas:
//   price         = base × 1,05             (compatible con la app antigua)
//   customerPrice = price + comisión        (lo que el cliente paga de verdad)
//   basePrice     = base
// La gestión del negocio/admin sigue viendo la base.
//
// Importes en céntimos.

import { applyMarkupPct, commissionOn } from "../pricingService";

/** Tasa de comisión efectiva de un negocio en porcentaje (15, 10, 8…). */
export async function getBusinessRatePct(businessId: string): Promise<number> {
  const { SubscriptionService } = await import("../subscriptionService");
  const rate = await SubscriptionService.getBusinessCommissionRate(businessId);
  return Math.round(rate * 1000) / 10;
}

/** Precio cliente de un producto a partir de su base en céntimos. */
export function productCustomerPrice(
  baseCents: number,
  markupPct: number,
  ratePct: number,
): number {
  const marked = applyMarkupPct(Math.max(0, Math.round(baseCents)), markupPct);
  return marked + commissionOn(marked, ratePct);
}

/**
 * Añade customerPrice (base + markup + comisión) y basePrice a una fila SIN
 * tocar `price`: la app antigua sigue viendo el precio de siempre y aplicando
 * su propio markup; la app nueva usa customerPrice directamente.
 */
export function addCustomerPrice<T extends { price?: number | null }>(
  row: T,
  markupPct: number,
  ratePct: number,
): T & { customerPrice: number; basePrice: number } {
  const basePrice = Math.max(0, Math.round(Number(row.price ?? 0)));
  const marked = applyMarkupPct(basePrice, markupPct);
  return {
    ...row,
    customerPrice: marked + commissionOn(marked, ratePct),
    basePrice,
  };
}

/**
 * Resolvedor de tasas memoizado por petición: listados con productos de
 * varios negocios consultan la tasa de cada negocio una sola vez.
 */
export function createRateResolver(): (businessId: string) => Promise<number> {
  const cache = new Map<string, Promise<number>>();
  return (businessId: string): Promise<number> => {
    let pending = cache.get(businessId);
    if (!pending) {
      pending = getBusinessRatePct(businessId).catch(() => 15);
      cache.set(businessId, pending);
    }
    return pending;
  };
}
