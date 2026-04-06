/**
 * Calcula la distancia entre dos coordenadas GPS usando la fórmula de Haversine
 * @returns Distancia en kilómetros
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radio de la Tierra en km
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
};

const toRad = (deg: number) => deg * (Math.PI / 180);

/**
 * Calcula el delivery fee basado en la distancia.
 * Tarifas por tramos (Soria, España):
 *   <= 2 km = 2.50€
 *   2-3 km  = 4.00€
 *   3-4 km  = 5.00€
 *   > 4 km  = 5.00€ + 1€ por km adicional
 * @returns Euros (no centavos)
 */
export const calculateDeliveryFee = async (distance: number): Promise<number> => {
  if (distance <= 2) return 2.5;
  if (distance <= 3) return 4.0;
  if (distance <= 4) return 5.0;
  return 5.0 + Math.ceil(distance - 4);
};

/**
 * Estima el tiempo de entrega basado en distancia
 * @returns Tiempo en minutos
 */
export const estimateDeliveryTime = (distance: number, prepTime: number = 20): number => {
  const SPEED_KM_PER_MIN = 0.5; // ~30 km/h promedio en ciudad
  const travelTime = distance / SPEED_KM_PER_MIN;
  return Math.ceil(prepTime + travelTime);
};
