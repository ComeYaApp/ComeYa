/**
 * Movimiento fluido de marcadores en los mapas WEB (Google Maps JS).
 *
 * En vez de `marker.setPosition(target)` (salto seco cada 2 s), interpola la
 * posición con requestAnimationFrame para que el repartidor se deslice entre
 * fixes. Coste: 0 llamadas de red — todo es local.
 *
 * Saltos grandes (> BIG_JUMP_M) no se animan: se aceptan directamente
 * (primer fix, reasignación de repartidor…).
 */

const DEFAULT_DURATION_MS = 1900; // el WS emite cada 2 s
const BIG_JUMP_M = 400;

interface AnimationState {
  rafId: number;
}

const animations = new WeakMap<object, AnimationState>();

export interface LatLngLike {
  lat: number;
  lng: number;
}

function metersBetween(a: LatLngLike, b: LatLngLike): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function currentOf(marker: any): LatLngLike {
  const p = marker.getPosition();
  return p ? { lat: p.lat(), lng: p.lng() } : { lat: 0, lng: 0 };
}

/**
 * Mueve el marcador hacia el destino animando la posición.
 * Seguro llamarlo con cada update del websocket.
 */
export function animateMarkerTo(
  marker: any,
  target: LatLngLike,
  durationMs: number = DEFAULT_DURATION_MS,
): void {
  if (!marker || !Number.isFinite(target?.lat) || !Number.isFinite(target?.lng))
    return;

  const from = currentOf(marker);
  const validFrom = from.lat !== 0 || from.lng !== 0;

  // Sin posición previa o salto grande: colocación directa
  if (
    !validFrom ||
    durationMs <= 0 ||
    metersBetween(from, target) > BIG_JUMP_M
  ) {
    stopMarkerAnimation(marker);
    marker.setPosition(new (window as any).google.maps.LatLng(target.lat, target.lng));
    return;
  }

  // Ya hay una animación en curso: parte de la posición ACTUAL del marcador
  stopMarkerAnimation(marker);

  const start = performance.now();
  const state: AnimationState = { rafId: 0 };
  animations.set(marker, state);

  const step = (now: number) => {
    // Si este marker empezó otra animación, esta queda muerta
    if (animations.get(marker) !== state) return;
    const t = Math.min(1, (now - start) / durationMs);
    const lat = from.lat + (target.lat - from.lat) * t;
    const lng = from.lng + (target.lng - from.lng) * t;
    marker.setPosition(new (window as any).google.maps.LatLng(lat, lng));
    if (t < 1) {
      state.rafId = requestAnimationFrame(step);
    } else {
      animations.delete(marker);
    }
  };
  state.rafId = requestAnimationFrame(step);
}

export function stopMarkerAnimation(marker: any): void {
  const state = animations.get(marker);
  if (state) {
    cancelAnimationFrame(state.rafId);
    animations.delete(marker);
  }
}
