// Snap-to-route: proyecta una posición GPS sobre la polilínea de la ruta
// real por calles. Es lo que hace Uber/Glovo para que el "punto azul" se
// deslice POR LA CALLE aunque el GPS derive (patios interiores, túneles,
// cañones de edificios): si el fix está a ≤ maxSnapMeters de la ruta, se
// muestra SU proyección sobre ella; si se aleja más (el usuario cruzó por
// un paso peatonal interior), se muestra el fix crudo — nunca se inventa.
//
// Además calcula la distancia RECORRIDA y RESTANTE sobre la ruta, base del
// "Te quedan 350 m · 5 min a pie".

import { RouteCoordinate } from "./directions";

const EARTH_M = 6371000;

/** Coordenadas métricas locales (proyección equirectangular alrededor de ref). */
function toLocalXY(p: RouteCoordinate, ref: RouteCoordinate) {
  const latRad = (ref.latitude * Math.PI) / 180;
  return {
    x: (((p.longitude - ref.longitude) * Math.PI) / 180) * Math.cos(latRad) * EARTH_M,
    y: ((p.latitude - ref.latitude) * Math.PI) / 180 * EARTH_M,
  };
}

export interface SnapResult {
  /** Punto a mostrar: proyección sobre la ruta si encaja; si no, el original. */
  coordinate: RouteCoordinate;
  /** true si se proyectó sobre la ruta (a ≤ maxSnapMeters). */
  snapped: boolean;
  /** Distancia en metros del fix real a la ruta. */
  distanceToRouteM: number;
  /** Metros recorridos sobre la ruta hasta la proyección. */
  progressMeters: number;
  /** Metros que quedan hasta el final de la ruta. */
  remainingMeters: number;
  /** Longitud total de la ruta en metros. */
  routeLengthM: number;
}

/**
 * Proyecta `point` sobre `route` (polilínea de coordenadas). Devuelve null
 * si la ruta no tiene al menos 2 puntos.
 */
export function snapToRoute(
  point: RouteCoordinate,
  route: RouteCoordinate[],
  maxSnapMeters = 30,
): SnapResult | null {
  if (!route || route.length < 2) return null;
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude)
  )
    return null;

  const ref = route[0];
  const P = toLocalXY(point, ref);
  const pts = route.map((r) => toLocalXY(r, ref));

  // Longitudes acumuladas (cum[i] = metros al inicio del segmento i)
  const cum: number[] = new Array(pts.length).fill(0);
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    cum[i + 1] = cum[i] + len;
  }
  const total = cum[pts.length - 1];

  // Proyección sobre cada segmento; nos quedamos con la más cercana
  let bestDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i];
    const B = pts[i + 1];
    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const len2 = abx * abx + aby * aby;
    let t = 0;
    if (len2 > 0) {
      t = ((P.x - A.x) * abx + (P.y - A.y) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const dx = P.x - (A.x + t * abx);
    const dy = P.y - (A.y + t * aby);
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      bestSeg = i;
      bestT = t;
    }
  }

  const A = pts[bestSeg];
  const B = pts[bestSeg + 1];
  const snappedLocal = {
    x: A.x + bestT * (B.x - A.x),
    y: A.y + bestT * (B.y - A.y),
  };
  const snappedPoint: RouteCoordinate = {
    latitude: ref.latitude + (snappedLocal.y / EARTH_M) * (180 / Math.PI),
    longitude:
      ref.longitude +
      (snappedLocal.x / (EARTH_M * Math.cos((ref.latitude * Math.PI) / 180))) *
        (180 / Math.PI),
  };

  const segLen = cum[bestSeg + 1] - cum[bestSeg];
  const along = cum[bestSeg] + bestT * segLen;

  return {
    coordinate: bestDist <= maxSnapMeters ? snappedPoint : point,
    snapped: bestDist <= maxSnapMeters,
    distanceToRouteM: bestDist,
    progressMeters: along,
    remainingMeters: Math.max(0, total - along),
    routeLengthM: total,
  };
}

/** Formatea la distancia restante y el ETA ("350 m · 5 min"). */
export function formatRemaining(
  remainingMeters: number,
  mode: "driving" | "walking" = "walking",
): string {
  const dist =
    remainingMeters >= 1000
      ? `${(remainingMeters / 1000).toFixed(1).replace(".", ",")} km`
      : `${Math.round(remainingMeters)} m`;
  // A pie ~4,8 km/h (80 m/min) · coche urbano ~28 km/h (~470 m/min)
  const metersPerMin = mode === "walking" ? 80 : 470;
  const mins = Math.max(1, Math.round(remainingMeters / metersPerMin));
  return `${dist} · ${mins} min`;
}
