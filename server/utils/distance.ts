import { getSettingValue } from "../systemSettingsService";

/**
 * Calcula la distancia entre dos coordenadas GPS usando la fórmula de Haversine
 * @returns Distancia en kilómetros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calcula el delivery fee basado en la distancia.
 * Lee los valores desde system_settings (configurables por el admin).
 */
export async function calculateDeliveryFee(distance: number): Promise<number> {
  const baseFee  = await getSettingValue("delivery_base_fee",  300);
  const perKm    = await getSettingValue("delivery_fee_per_km", 50);
  const minFee   = await getSettingValue("delivery_min_fee",   300);
  const maxFee   = await getSettingValue("delivery_max_fee",   500);

  const fee = baseFee + distance * perKm;
  return Math.max(minFee, Math.min(fee, maxFee));
}

/**
 * Versión síncrona con valores por defecto (para cuando no se puede await).
 * Usar calculateDeliveryFee() siempre que sea posible.
 */
export function calculateDeliveryFeeSync(
  distance: number,
  baseFee = 300,
  perKm = 50,
  minFee = 300,
  maxFee = 500
): number {
  const fee = baseFee + distance * perKm;
  return Math.max(minFee, Math.min(fee, maxFee));
}

/**
 * Estima el tiempo de entrega basado en distancia
 * @returns Tiempo en minutos
 */
export function estimateDeliveryTime(distance: number, prepTime = 20): number {
  const SPEED_KM_PER_MIN = 0.5; // ~30 km/h promedio en ciudad
  const travelTime = distance / SPEED_KM_PER_MIN;
  return Math.ceil(prepTime + travelTime);
}

/**
 * Valida si unas coordenadas están dentro de la zona de cobertura.
 * Lee el radio máximo desde system_settings (configurable por el admin).
 */
export async function isInCoverageArea(latitude: number, longitude: number): Promise<boolean> {
  // Soria, España — centro configurable en el futuro
  const CENTER_LAT = 41.7636;
  const CENTER_LNG = -2.4677;
  const maxRadius = await getSettingValue("max_delivery_radius_km", 10);

  const distance = calculateDistance(latitude, longitude, CENTER_LAT, CENTER_LNG);
  return distance <= maxRadius;
}

/**
 * Versión síncrona para cuando no se puede usar await
 */
export function isInCoverageAreaSync(latitude: number, longitude: number, maxRadius = 10): boolean {
  const CENTER_LAT = 41.7636;
  const CENTER_LNG = -2.4677;

  const distance = calculateDistance(latitude, longitude, CENTER_LAT, CENTER_LNG);
  return distance <= maxRadius;
}
