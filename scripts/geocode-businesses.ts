/**
 * Rellena `businesses.latitude/longitude` con las coordenadas REALES de la
 * dirección que el negocio ya tiene registrada.
 *
 * Motivo: la migración `fix_soria_coordinates.sql` repartió a todos los
 * negocios coordenadas de relleno dentro de un radio de ~500 m del centro de
 * Soria. En el mapa de la app eso hacía que todas las etiquetas cayeran unas
 * encima de otras y que el cliente no pudiera distinguir dónde está cada
 * comercio.
 *
 * Uso (en el servidor, donde esté `GOOGLE_MAPS_API_KEY`):
 *   npx tsx scripts/geocode-businesses.ts            # solo informa
 *   npx tsx scripts/geocode-businesses.ts --apply    # escribe en la BD
 *   npx tsx scripts/geocode-businesses.ts --apply --only=<businessId>
 *
 * Es idempotente: puede ejecutarse tantas veces como haga falta. Los negocios
 * sin dirección utilizable se listan al final para corregirlos a mano desde
 * el perfil del negocio (que ya tiene selector de dirección en el mapa).
 */
import { db } from "../server/db";
import { businesses } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { geocodeAddress } from "../server/services/googleMapsService";

// Centro de Soria: se usa para detectar coordenadas de relleno.
const SORIA_CENTER = { lat: 41.7636, lng: -2.4677 };
// Radio (km) dentro del cual una coordenada se considera "de relleno".
const PLACEHOLDER_RADIUS_KM = 1.2;

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error(
      "❌ Falta GOOGLE_MAPS_API_KEY: sin clave no se puede geocodificar.",
    );
    process.exit(1);
  }

  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      address: businesses.address,
      latitude: businesses.latitude,
      longitude: businesses.longitude,
    })
    .from(businesses);

  const targets = rows.filter((b) => (only ? b.id === only : true));

  let updated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const b of targets) {
    const address = String(b.address || "").trim();
    if (!address) {
      skipped++;
      failed.push(`${b.name} (${b.id}) — sin dirección registrada`);
      continue;
    }

    const lat = parseFloat(String(b.latitude ?? ""));
    const lng = parseFloat(String(b.longitude ?? ""));
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

    // Si ya tiene una coordenada concreta y no es la de relleno del centro,
    // se respeta (alguien la corrigió a mano desde la app).
    if (
      hasCoords &&
      distanceKm(lat, lng, SORIA_CENTER.lat, SORIA_CENTER.lng) >
        PLACEHOLDER_RADIUS_KM
    ) {
      skipped++;
      continue;
    }

    const query = /soria/i.test(address) ? address : `${address}, Soria, España`;
    const result = await geocodeAddress(query);

    if (!result) {
      failed.push(`${b.name} (${b.id}) — no se pudo geocodificar "${address}"`);
      continue;
    }

    console.log(
      `📍 ${b.name}: ${address} → ${result.lat}, ${result.lng}`,
    );

    if (apply) {
      await db
        .update(businesses)
        .set({
          latitude: String(result.lat),
          longitude: String(result.lng),
        })
        .where(eq(businesses.id, b.id));
      updated++;
    }
  }

  console.log(
    `\n${apply ? "✅ Actualizados" : "ℹ️  Detectados"}: ${updated || targets.length - skipped - failed.length}`,
  );
  console.log(`⏭️  Respetados (ya tenían coordenada propia): ${skipped}`);
  if (failed.length) {
    console.log(`\n⚠️  Revisar a mano (${failed.length}):`);
    failed.forEach((f) => console.log(`   - ${f}`));
  }
  if (!apply) {
    console.log("\nEjecuta con --apply para escribir los cambios en la BD.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error geocodificando negocios:", err);
  process.exit(1);
});
