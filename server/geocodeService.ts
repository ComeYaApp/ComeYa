// Servicio de geocodificación compartido.
// TODAS las geocodificaciones pasan por googleMapsService, que añade:
// caché en memoria + caché persistente en BD (una dirección = una llamada
// a Google para siempre) + rate limit por minuto + límite diario de gasto.
// El job periódico garantiza que negocio/dirección sin coordenadas acabe
// geolocalizado aunque el intento del alta fallara.

import { db } from "./db";
import { businesses, addresses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { googleMapsService } from "./services/googleMapsService";

/** Clave de servidor de Google Maps: GOOGLE_MAPS_API_KEY primero (la de
 *  servidor); la EXPO_PUBLIC (SDK Android) solo como último recurso. */
export function getMapsServerKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/** Geocodifica una dirección con Google vía el servicio cacheado. */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  if (!address?.trim()) return null;
  const base = address.trim();
  const query = base.toLowerCase().includes("soria")
    ? base
    : `${base}, Soria, España`;
  const result = await googleMapsService.geocodeAddress(query);
  return result ? { lat: result.lat, lng: result.lng } : null;
}

/**
 * Trabajo periódico: rellena lat/lng de negocios y direcciones que no
 * tienen coordenadas (creados con la API caída, datos antiguos, etc.).
 * Así se garantiza que TODO negocio acabe geolocalizado aunque el intento
 * en el momento del alta fallara.
 */
export async function geocodeMissingCoordinatesJob() {
  try {
    const key = getMapsServerKey();
    if (!key) {
      logger.warn("[geocode] Sin GOOGLE_MAPS_API_KEY: job omitido");
      return;
    }

    // 1) Negocios sin coordenadas
    const bizMissing = await db
      .select()
      .from(businesses)
      .limit(10);
    const bizToFix = bizMissing.filter(
      (b: any) =>
        b.address &&
        (!b.latitude || !b.longitude || b.latitude === "" || b.longitude === ""),
    );

    let bizFixed = 0;
    for (const b of bizToFix) {
      const geo = await geocodeAddress(b.address!);
      if (geo) {
        await db
          .update(businesses)
          .set({ latitude: String(geo.lat), longitude: String(geo.lng) })
          .where(eq(businesses.id, b.id));
        bizFixed++;
      }
    }

    // 2) Direcciones de clientes sin coordenadas
    const addrMissing = await db.select().from(addresses).limit(20);
    const addrToFix = addrMissing.filter(
      (a: any) =>
        !a.latitude || !a.longitude || a.latitude === "" || a.longitude === "",
    );

    let addrFixed = 0;
    for (const a of addrToFix) {
      const geo = await geocodeAddress(`${a.street}, ${a.city || "Soria"}`);
      if (geo) {
        await db
          .update(addresses)
          .set({ latitude: String(geo.lat), longitude: String(geo.lng) })
          .where(eq(addresses.id, a.id));
        addrFixed++;
      }
    }

    if (bizFixed > 0 || addrFixed > 0) {
      logger.info(
        `[geocode] Job completado: ${bizFixed} negocios y ${addrFixed} direcciones geocodificados`,
      );
    }
  } catch (error) {
    logger.error("[geocode] Job falló", error);
  }
}
