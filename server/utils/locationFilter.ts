/**
 * Filtro anti-teletransporte para las posiciones del repartidor.
 *
 * Un fix de GPS puede llegar con mala precisión (batería ahorrada, túnel,
 * primer fix tras abrir la app) o reproducido por la cola offline (posiciones
 * viejas re-enviadas en ráfaga al reconectar). Sin filtro, cualquiera de
 * ellas hace que el marcador SALTE o RETROCEDA en los mapas de los 4 roles.
 *
 * Reglas (estado por repartidor, en memoria):
 *  1. Precisión worse que MAX_ACCURACY_M → se descarta.
 *  2. Coordenadas no finitas o (0,0) → se descarta.
 *  3. Fix con marca de tiempo ≤ a la última aceptada → se descarta (out-of-order).
 *  4. Salto imposible: velocidad implícita > MAX_SPEED_MPS → se descarta.
 *     (una ráfaga de la cola offline da velocidades de cientos de m/s;
 *      un desplazamiento real tras 10 min sin señal da pocos m/s y pasa)
 */

export interface DriverFixState {
  lat: number;
  lng: number;
  at: number;
}

/** Precisión GPS máxima aceptada en metros. */
export const MAX_ACCURACY_M = 100;
/** Velocidad implícita máxima entre fixes consecutivos (m/s ≈ 126 km/h). */
export const MAX_SPEED_MPS = 35;

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export type FixVerdict =
  | { accept: true }
  | { accept: false; reason: "not_finite" | "zero" | "low_accuracy" | "stale" | "impossible_jump" };

/**
 * Evalúa un fix y, si se acepta, actualiza el estado del repartidor.
 * `now` inyectable para tests.
 */
export function evaluateDriverFix(
  states: Map<string, DriverFixState>,
  driverId: string,
  rawLat: unknown,
  rawLng: unknown,
  opts?: {
    accuracy?: number | null | undefined;
    timestamp?: number | null | undefined;
    now?: number;
  },
): FixVerdict {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { accept: false, reason: "not_finite" };
  }
  if (lat === 0 && lng === 0) return { accept: false, reason: "zero" };

  const accuracy = Number(opts?.accuracy);
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M) {
    return { accept: false, reason: "low_accuracy" };
  }

  const now = opts?.now ?? Date.now();
  const at = Number.isFinite(Number(opts?.timestamp)) && opts!.timestamp! > 0
    ? Number(opts!.timestamp)
    : now;

  const prev = states.get(driverId);
  if (prev) {
    if (at <= prev.at) return { accept: false, reason: "stale" };

    const dt = (at - prev.at) / 1000;
    const dist = haversineM(prev.lat, prev.lng, lat, lng);
    if (dt > 0 && dist / dt > MAX_SPEED_MPS) {
      return { accept: false, reason: "impossible_jump" };
    }
  }

  states.set(driverId, { lat, lng, at });
  return { accept: true };
}
