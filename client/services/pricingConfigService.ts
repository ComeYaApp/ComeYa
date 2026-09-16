// Config de precios de ComeYa (GET /api/pricing-config).
// El servidor es la única fuente de verdad de los importes: esto solo sirve
// para MOSTRAR los mismos precios que él calculará (markup y coste de
// servicio). Cache en memoria de 5 minutos.
import { apiRequest } from "@/lib/query-client";

export interface PricingConfig {
  markupPct: number;
  commissionPct: number;
  serviceFeeCents: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  markupPct: 5,
  commissionPct: 15,
  serviceFeeCents: 49,
};

let cache: { data: PricingConfig; expires: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPricingConfig(): Promise<PricingConfig> {
  if (cache && cache.expires > Date.now()) return cache.data;
  try {
    const response = await apiRequest("GET", "/api/pricing-config");
    const data = await response.json();
    const cfg: PricingConfig = {
      markupPct: Number(data?.markupPct) || DEFAULT_PRICING_CONFIG.markupPct,
      commissionPct:
        Number(data?.commissionPct) || DEFAULT_PRICING_CONFIG.commissionPct,
      serviceFeeCents:
        Number(data?.serviceFeeCents) || DEFAULT_PRICING_CONFIG.serviceFeeCents,
    };
    cache = { data: cfg, expires: Date.now() + CACHE_TTL_MS };
    return cfg;
  } catch {
    return DEFAULT_PRICING_CONFIG;
  }
}

// Multiplicador de markup para precios de producto (p. ej. 1.05)
export async function getMarkupMultiplier(): Promise<number> {
  const cfg = await getPricingConfig();
  return 1 + cfg.markupPct / 100;
}

export function clearPricingCache() {
  cache = null;
}
