import { db } from "../db";
import { systemSettings } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Tarifa por tramos Soria:
// 0-1 km  = gratis (dentro del negocio)
// 1-2 km  = 2.50€
// 2-3 km  = 4.00€
// 3-4 km  = 5.00€
// >4 km   = 5€ + 1€ por cada km adicional

export interface DeliveryTiers {
  tier1: number; // 1-2 km (cents)
  tier2: number; // 2-3 km (cents)
  tier3: number; // 3-4 km (cents)
  extraPerKm: number; // >4 km extra por km (cents)
  speedKmPerMin: number;
  defaultPrepTime: number;
}

let cachedConfig: DeliveryTiers | null = null;
let lastFetch = 0;
const CACHE_TTL = 60000;

export async function getDeliveryConfig(): Promise<DeliveryTiers> {
  const now = Date.now();
  if (cachedConfig && now - lastFetch < CACHE_TTL) return cachedConfig;

  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.category, "delivery"));

  const config: DeliveryTiers = {
    tier1: 250, // 2.50€
    tier2: 400, // 4.00€
    tier3: 500, // 5.00€
    extraPerKm: 100, // 1.00€/km
    speedKmPerMin: 0.5,
    defaultPrepTime: 20,
  };

  settings.forEach((s) => {
    const v = parseFloat(s.value);
    switch (s.key) {
      case "delivery_tier1":
        config.tier1 = Math.round(v * 100);
        break;
      case "delivery_tier2":
        config.tier2 = Math.round(v * 100);
        break;
      case "delivery_tier3":
        config.tier3 = Math.round(v * 100);
        break;
      case "delivery_extra_per_km":
        config.extraPerKm = Math.round(v * 100);
        break;
      case "delivery_speed":
        config.speedKmPerMin = v;
        break;
      case "delivery_prep_time":
        config.defaultPrepTime = v;
        break;
    }
  });

  cachedConfig = config;
  lastFetch = now;
  return config;
}

export function calculateDeliveryFee(
  distanceKm: number,
  config: DeliveryTiers,
): number {
  if (distanceKm <= 1) return config.tier1; // minimo siempre tier1
  if (distanceKm <= 2) return config.tier1;
  if (distanceKm <= 3) return config.tier2;
  if (distanceKm <= 4) return config.tier3;
  const extraKm = Math.ceil(distanceKm - 4);
  return config.tier3 + extraKm * config.extraPerKm;
}

export function clearDeliveryConfigCache() {
  cachedConfig = null;
}
