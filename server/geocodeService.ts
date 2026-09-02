// Servicio de geocodificación compartido.
// TODAS las geocodificaciones pasan por googleMapsService, que añade:
// caché en memoria + caché persistente en BD (una dirección = una llamada
// a Google para siempre) + rate limit por minuto + límite diario de gasto.
// El job periódico garantiza que negocio/dirección sin coordenadas acabe
// geolocalizado aunque el intento del alta fallara.

import { db } from "./db";
import { businesses, addresses, orders } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { googleMapsService } from "./services/googleMapsService";

/** Clave de servidor de Google Maps: SOLO la Backend Key. La Android
 *  (restringida por SHA-1) no funciona desde el servidor. */
export function getMapsServerKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || "";
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
    const addrMissing = await db.select().from(addresses).limit(30);
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

    // 2b) Saneo de coordenadas "fantasma": direcciones guardadas con el
    // centro de Soria por defecto (41.7636, -2.4677) cuando el usuario no
    // movió el pin en el formulario web. Solo si la calle no es la Plaza
    // Mayor y la geocodificación tiene éxito — nunca se borran coordenadas.
    const SORIA_CENTER = { lat: 41.7636, lng: -2.4677 };
    const addrRows = await db.select().from(addresses).limit(60);
    const addrCenter = addrRows.filter(
      (a: any) =>
        a.latitude &&
        a.longitude &&
        Math.abs(Number(a.latitude) - SORIA_CENTER.lat) < 0.0001 &&
        Math.abs(Number(a.longitude) - SORIA_CENTER.lng) < 0.0001 &&
        !/plaza\s+mayor/i.test(a.street || ""),
    );

    let addrCenterFixed = 0;
    for (const a of addrCenter) {
      const geo = await geocodeAddress(`${a.street}, ${a.city || "Soria"}`);
      if (geo) {
        await db
          .update(addresses)
          .set({ latitude: String(geo.lat), longitude: String(geo.lng) })
          .where(eq(addresses.id, a.id));
        addrCenterFixed++;
      }
    }
    addrFixed += addrCenterFixed;

    // 3) Pedidos antiguos sin coordenadas de entrega (los nuevos ya las
    // guardan al crearse). Solo entregas activas/recientes con dirección.
    const { and, ne } = await import("drizzle-orm");
    const orderRows: any[] = await db
      .select()
      .from(orders)
      .where(
        and(ne(orders.status, "delivered"), ne(orders.status, "cancelled")),
      )
      .limit(40);
    const ordersToFix = orderRows.filter(
      (o: any) =>
        !o.deliveryLatitude ||
        !o.deliveryLongitude ||
        o.deliveryLatitude === "" ||
        o.deliveryLongitude === "",
    );

    let ordersFixed = 0;
    for (const o of ordersToFix.slice(0, 20)) {
      const addressText =
        typeof o.deliveryAddress === "string"
          ? o.deliveryAddress
          : o.deliveryAddress?.street || null;
      if (!addressText) continue;
      const geo = await geocodeAddress(addressText);
      if (geo) {
        await db
          .update(orders)
          .set({
            deliveryLatitude: String(geo.lat),
            deliveryLongitude: String(geo.lng),
          })
          .where(eq(orders.id, o.id));
        ordersFixed++;
      }
    }

    if (bizFixed > 0 || addrFixed > 0 || ordersFixed > 0) {
      logger.info(
        `[geocode] Job completado: ${bizFixed} negocios, ${addrFixed} direcciones y ${ordersFixed} pedidos geocodificados`,
      );
    }
  } catch (error) {
    logger.error("[geocode] Job falló", error);
  }
}
