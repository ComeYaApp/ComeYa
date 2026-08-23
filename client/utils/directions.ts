// Utilidades de rutas GPS reales (Google Directions vía proxy del servidor).
// Compartido por pantallas de repartidor y mapa de seguimiento del cliente.
import { apiRequest } from "@/lib/query-client";

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  instruction: string;
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
}

export interface DirectionsResult {
  coordinates: RouteCoordinate[];
  distanceText?: string;
  durationText?: string;
  steps?: RouteStep[];
  fallback: boolean;
}

/** Decodifica un polyline encoded de Google Directions a coordenadas. */
export function decodePolyline(
  encoded: string,
): RouteCoordinate[] {
  const poly: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

/**
 * Obtiene la ruta real por calles entre dos puntos usando el proxy
 * /api/gps/directions (la API key de Google nunca sale del servidor).
 * Si no hay API key o falla, devuelve la línea recta como fallback.
 */
export async function fetchRouteDirections(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<DirectionsResult | null> {
  try {
    const response = await apiRequest(
      "GET",
      `/api/gps/directions?originLat=${origin.latitude}&originLng=${origin.longitude}&destLat=${destination.latitude}&destLng=${destination.longitude}`,
    );
    const data = await response.json();

    if (!data.success) return null;

    if (data.polyline) {
      return {
        coordinates: decodePolyline(data.polyline),
        distanceText: data.distance?.text,
        durationText: data.duration?.text,
        steps: data.steps || [],
        fallback: false,
      };
    }

    // Fallback del servidor: sin polyline, línea recta con ETA estimada
    return {
      coordinates: [origin, destination],
      distanceText: data.distance?.text,
      durationText: data.duration?.text,
      steps: [],
      fallback: true,
    };
  } catch (err) {
    console.error("Error fetching directions:", err);
    return null;
  }
}

/** Distancia en metros entre dos coordenadas (para decidir cuándo refrescar ruta). */
export function distanceMeters(
  a: RouteCoordinate,
  b: RouteCoordinate,
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
