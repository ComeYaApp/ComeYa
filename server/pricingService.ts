// Motor de precios de ComeYa — única fuente de verdad del modelo híbrido.
//
//   precio base (negocio) ──markup 5%──► subtotal que paga el cliente
//   comisión ComeYa = 15% sobre el subtotal (base + markup)
//   coste de servicio = 0,49 € por pedido de reparto (al cliente)
//   reservas: 0,99 € por comensal asistente + 0,49 € de servicio (al negocio)
//
// Ejemplo con una hamburguesa de 10,00 €:
//   subtotal = 10,50 € · comisión = 1,58 € · servicio = 0,49 €
//
// Todos los valores viven en system_settings (editables en el panel admin)
// y se cachean 60 s. IMPORTANTE: tras cambiarlos hay que invalidar el caché
// (PUT /api/admin/settings ya lo hace).
import { getSettingValue } from "./systemSettingsService";

export interface PricingConfig {
  markupPct: number; // % sobre el precio base (visible en el precio de la app)
  commissionPct: number; // % de ComeYa sobre el subtotal (base + markup)
  serviceFeeCents: number; // coste de servicio por pedido de reparto
  reservationGuestFeeCents: number; // por comensal que asiste a la reserva
  reservationServiceFeeCents: number; // coste de servicio por reserva liquidada
}

export const DEFAULT_PRICING: PricingConfig = {
  markupPct: 5,
  commissionPct: 15,
  serviceFeeCents: 49,
  reservationGuestFeeCents: 99,
  reservationServiceFeeCents: 49,
};

let cache: { data: PricingConfig; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  if (cache && cache.expires > Date.now()) return cache.data;

  const [markupPct, commissionPct, serviceFeeCents, guestFee, resService] =
    await Promise.all([
      getSettingValue("pricing_markup_pct", DEFAULT_PRICING.markupPct),
      getSettingValue("pricing_commission_pct", DEFAULT_PRICING.commissionPct),
      getSettingValue(
        "pricing_service_fee_cents",
        DEFAULT_PRICING.serviceFeeCents,
      ),
      getSettingValue(
        "pricing_reservation_guest_fee_cents",
        DEFAULT_PRICING.reservationGuestFeeCents,
      ),
      getSettingValue(
        "pricing_reservation_service_fee_cents",
        DEFAULT_PRICING.reservationServiceFeeCents,
      ),
    ]);

  const data: PricingConfig = {
    markupPct: num(markupPct, DEFAULT_PRICING.markupPct),
    commissionPct: num(commissionPct, DEFAULT_PRICING.commissionPct),
    serviceFeeCents: Math.round(
      num(serviceFeeCents, DEFAULT_PRICING.serviceFeeCents),
    ),
    reservationGuestFeeCents: Math.round(
      num(guestFee, DEFAULT_PRICING.reservationGuestFeeCents),
    ),
    reservationServiceFeeCents: Math.round(
      num(resService, DEFAULT_PRICING.reservationServiceFeeCents),
    ),
  };
  cache = { data, expires: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidatePricingCache() {
  cache = null;
}

// Precio con markup a partir del precio base (ambos en céntimos)
export function applyMarkup(baseCents: number, cfg: PricingConfig): number {
  return Math.round(baseCents * (1 + cfg.markupPct / 100));
}

// Comisión de plataforma sobre un subtotal (base + markup), ratePct en %
export function commissionOn(subtotalCents: number, ratePct: number): number {
  return Math.round((subtotalCents * ratePct) / 100);
}
