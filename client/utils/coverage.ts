/**
 * Coordenadas de cobertura de Soria, España
 * Radio amplio (~15km desde el centro) para cubrir toda la ciudad y alrededores
 */
export const SORIA_BOUNDS = {
  minLat: 41.70,
  maxLat: 41.83,
  minLng: -2.55,
  maxLng: -2.38,
};

/**
 * Centro de Soria para inicializar mapas
 */
export const SORIA_CENTER = {
  latitude: 41.7636,
  longitude: -2.4677,
};

// Legacy aliases
export const SAN_CRISTOBAL_BOUNDS = SORIA_BOUNDS;
export const SAN_CRISTOBAL_CENTER = SORIA_CENTER;
export const AUTLAN_BOUNDS = SORIA_BOUNDS;
export const AUTLAN_CENTER = SORIA_CENTER;

/**
 * Valida si unas coordenadas están dentro de la zona de cobertura de Soria
 */
export const isInCoverageArea = (latitude: number, longitude: number): boolean => {
  return (
    latitude >= SORIA_BOUNDS.minLat &&
    latitude <= SORIA_BOUNDS.maxLat &&
    longitude >= SORIA_BOUNDS.minLng &&
    longitude <= SORIA_BOUNDS.maxLng
  );
};
