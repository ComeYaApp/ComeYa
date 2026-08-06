/**
 * Google Maps API Service — Caching, Rate Limiting & Cost Optimization
 * 
 * Estrategias de ahorro:
 * 1. Cache en memoria con TTL por tipo de request
 * 2. Rate limiting por endpoint (Directions, Geocoding, etc.)
 * 3. Reutilización de resultados para rutas comunes
 * 4. Debouncing para requests repetidos
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_WEB_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ||
  "";

// ─── Cache Configuration ────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<any>>();

const TTL = {
  // Directions: cache largo (las calles no cambian frecuentemente)
  directions: 30 * 60 * 1000,       // 30 minutos
  // Geocoding: cache muy largo (las direcciones no cambian)
  geocoding: 24 * 60 * 60 * 1000,   // 24 horas
  // Distance Matrix: cache medio
  distanceMatrix: 15 * 60 * 1000,   // 15 minutos
  // Places: cache medio
  places: 60 * 60 * 1000,           // 1 hora
};

// ─── Rate Limiter ────────────────────────────────────────────────────────
const rateCounters = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  directions: { maxRequests: 40, windowMs: 60 * 1000 },     // 40 req/min (Google: 50 req/s con billing)
  geocoding: { maxRequests: 40, windowMs: 60 * 1000 },      // 40 req/min
  distanceMatrix: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 req/min
  all: { maxRequests: 100, windowMs: 60 * 1000 },           // Global: 100 req/min total
};

function checkRateLimit(endpoint: string): boolean {
  const now = Date.now();
  const limits = RATE_LIMITS[endpoint] || RATE_LIMITS.all;

  // Check endpoint-specific limit
  let counter = rateCounters.get(endpoint);
  if (!counter || now > counter.resetAt) {
    counter = { count: 0, resetAt: now + limits.windowMs };
    rateCounters.set(endpoint, counter);
  }
  
  if (counter.count >= limits.maxRequests) {
    return false; // Rate limited
  }
  counter.count++;

  // Check global limit
  let globalCounter = rateCounters.get("all");
  if (!globalCounter || now > globalCounter.resetAt) {
    globalCounter = { count: 0, resetAt: now + RATE_LIMITS.all.windowMs };
    rateCounters.set("all", globalCounter);
  }
  if (globalCounter.count >= RATE_LIMITS.all.maxRequests) {
    return false;
  }
  globalCounter.count++;

  return true;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────

function getCacheKey(type: string, params: Record<string, any>): string {
  // Normalizar coordenadas a 3 decimales (~111m precisión) para aumentar cache hits
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if ((key.includes("lat") || key.includes("lng") || key.includes("latitude") || key.includes("longitude")) && typeof value === "number") {
      normalized[key] = Math.round(value * 1000) / 1000; // 3 decimales
    } else {
      normalized[key] = value;
    }
  }
  return `${type}:${JSON.stringify(normalized)}`;
}

function getFromCache<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: 0 }); // ttl manejado en getFromCache
}

// Limpiar cache periódicamente (cada 30 min, solo entradas expiradas)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > 3600000) { // entradas > 1 hora
      cache.delete(key);
    }
  }
}, 30 * 60 * 1000);

// ─── Core API Functions ──────────────────────────────────────────────────

interface DirectionsResult {
  polyline: string;
  distance: { text: string; value: number }; // value en metros
  duration: { text: string; value: number }; // value en segundos
  steps: Array<{
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  }>;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}

/**
 * Obtener direcciones entre dos puntos — con cache y rate limiting
 * @param originLat Latitud origen
 * @param originLng Longitud origen
 * @param destLat Latitud destino
 * @param destLng Longitud destino
 * @returns Resultado de direcciones o null si falla
 */
export async function getDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DirectionsResult | null> {
  const cacheKey = getCacheKey("directions", { originLat, originLng, destLat, destLng });
  
  // Check cache
  const cached = getFromCache<DirectionsResult>(cacheKey, TTL.directions);
  if (cached) {
    console.log(`🗺️ [GoogleMaps Cache HIT] Directions`);
    return cached;
  }

  // Check rate limit
  if (!checkRateLimit("directions")) {
    console.warn(`⚠️ [GoogleMaps Rate Limit] Directions — usando fallback`);
    return null;
  }

  if (!API_KEY) {
    console.warn("⚠️ [GoogleMaps] No API key configured");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&language=es&key=${API_KEY}`;
    
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(8000) // 8s timeout
    });
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.length) {
      console.warn(`⚠️ [GoogleMaps] Directions error: ${data.status} — ${data.error_message || ""}`);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    const result: DirectionsResult = {
      polyline: route.overview_polyline?.points || "",
      distance: leg.distance,
      duration: leg.duration,
      steps: (leg.steps || []).map((s: any) => ({
        instruction: s.html_instructions?.replace(/<[^>]*>/g, "").trim() || "",
        distance: s.distance,
        duration: s.duration,
      })),
      startLocation: leg.start_location,
      endLocation: leg.end_location,
    };

    setCache(cacheKey, result);
    console.log(`🗺️ [GoogleMaps API] Directions fetched & cached`);
    return result;
  } catch (error: any) {
    console.error(`❌ [GoogleMaps] Directions fetch error:`, error.message);
    return null;
  }
}

/**
 * Geocodificar una dirección
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const cacheKey = getCacheKey("geocoding", { address: address.toLowerCase().trim() });
  
  const cached = getFromCache<GeocodingResult>(cacheKey, TTL.geocoding);
  if (cached) {
    console.log(`🗺️ [GoogleMaps Cache HIT] Geocoding`);
    return cached;
  }

  if (!checkRateLimit("geocoding")) {
    console.warn(`⚠️ [GoogleMaps Rate Limit] Geocoding`);
    return null;
  }

  if (!API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data.status !== "OK" || !data.results?.length) {
      return null;
    }

    const result: GeocodingResult = {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
      formattedAddress: data.results[0].formatted_address,
      placeId: data.results[0].place_id,
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Obtener múltiples direcciones (batch) — optimizado para evitar múltiples llamadas
 * Calcula rutas desde un origen común a varios destinos
 */
export async function getDirectionsBatch(
  originLat: number,
  originLng: number,
  destinations: Array<{ lat: number; lng: number; id: string }>,
): Promise<Map<string, DirectionsResult | null>> {
  const results = new Map<string, DirectionsResult | null>();
  
  // Intentar cache primero
  const uncached: typeof destinations = [];
  for (const dest of destinations) {
    const cacheKey = getCacheKey("directions", { originLat, originLng, destLat: dest.lat, destLng: dest.lng });
    const cached = getFromCache<DirectionsResult>(cacheKey, TTL.directions);
    if (cached) {
      results.set(dest.id, cached);
    } else {
      uncached.push(dest);
    }
  }

  // Fetch uncached one by one (con delay para rate limiting)
  for (let i = 0; i < uncached.length; i++) {
    const dest = uncached[i];
    // Stagger requests: 200ms delay between each
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const result = await getDirections(originLat, originLng, dest.lat, dest.lng);
    results.set(dest.id, result);
  }

  return results;
}

/**
 * Calcular distancia simple (Haversine) — sin usar API de Google
 * Útil para estimaciones rápidas sin costo
 */
export function calculateHaversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
}

/**
 * Estimar tiempo de entrega basado en distancia (sin API)
 */
export function estimateDeliveryTimeMinutes(distanceKm: number): number {
  // Asumiendo velocidad promedio de 25 km/h en ciudad
  const speedKmh = 25;
  const hours = distanceKm / speedKmh;
  return Math.max(5, Math.ceil(hours * 60)); // mínimo 5 minutos
}

/**
 * Decodificar Google Maps polyline a array de coordenadas
 */
export function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const poly: Array<{ latitude: number; longitude: number }> = [];
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
 * Obtener estadísticas de uso del servicio
 */
export function getUsageStats() {
  const stats: Record<string, { used: number; limit: number; remaining: number; resetIn: number }> = {};
  const now = Date.now();
  
  for (const [endpoint, counter] of rateCounters.entries()) {
    const limits = RATE_LIMITS[endpoint] || RATE_LIMITS.all;
    stats[endpoint] = {
      used: counter.count,
      limit: limits.maxRequests,
      remaining: Math.max(0, limits.maxRequests - counter.count),
      resetIn: Math.max(0, Math.ceil((counter.resetAt - now) / 1000)),
    };
  }
  
  return {
    cacheSize: cache.size,
    rateLimiters: stats,
    apiKeyConfigured: !!API_KEY,
  };
}

export const googleMapsService = {
  getDirections,
  geocodeAddress,
  getDirectionsBatch,
  calculateHaversineDistance,
  estimateDeliveryTimeMinutes,
  decodePolyline,
  getUsageStats,
};