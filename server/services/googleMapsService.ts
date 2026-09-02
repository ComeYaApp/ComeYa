/**
 * Google Maps API Service — Caching, Rate Limiting & Cost Optimization
 * 
 * Estrategias de ahorro:
 * 1. Cache en memoria con TTL por tipo de request
 * 2. Rate limiting por endpoint (Directions, Geocoding, etc.)
 * 3. Reutilización de resultados para rutas comunes
 * 4. Debouncing para requests repetidos
 */

// SOLO la Backend Key de Google Cloud (sin restricción de app). Las claves
// Android (SHA-1) y Web (referrers) están restringidas a su plataforma y
// NUNCA funcionan desde el servidor: usarlas como fallback solo enmascara
// el error y quema cuota. Si falta, caemos al fallback OSRM/línea recta.
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

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
  directions: { maxRequests: Number(process.env.GOOGLE_DIRECTIONS_RATE_LIMIT || 120), windowMs: 60 * 1000 }, // 120 req/min
  geocoding: { maxRequests: 40, windowMs: 60 * 1000 },      // 40 req/min
  distanceMatrix: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 req/min
  places: { maxRequests: 20, windowMs: 60 * 1000 },         // 20 req/min
  // OSRM es GRATIS: su contador es propio y NUNCA queda bloqueado por los
  // límites de Google (antes el límite de directions lo cortaba también)
  osrm: { maxRequests: 90, windowMs: 60 * 1000 },           // 90 req/min
  all: { maxRequests: 150, windowMs: 60 * 1000 },           // Global: 150 req/min total
};

// ─── Límites diarios (protección del saldo de Google Cloud) ──────────────
// Suaves (en memoria): un reinicio los resetea, pero evitan quemar el saldo
// por un bucle o pico accidental. Ajustables por variables de entorno.
const dailyCounters = new Map<string, { count: number; day: string }>();

const DAILY_LIMITS: Record<string, number> = {
  geocoding: Number(process.env.GOOGLE_GEOCODE_DAILY_LIMIT || 500),
  directions: Number(process.env.GOOGLE_DIRECTIONS_DAILY_LIMIT || 5000),
  matrix: Number(process.env.GOOGLE_MATRIX_DAILY_LIMIT || 1000),
  places: Number(process.env.GOOGLE_PLACES_DAILY_LIMIT || 500),
};

function checkDailyLimit(endpoint: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  let counter = dailyCounters.get(endpoint);
  if (!counter || counter.day !== today) {
    counter = { count: 0, day: today };
    dailyCounters.set(endpoint, counter);
  }
  const limit = DAILY_LIMITS[endpoint] ?? Number.MAX_SAFE_INTEGER;
  if (counter.count >= limit) {
    console.warn(`⚠️ [GoogleMaps] Límite DIARIO alcanzado: ${endpoint} (${limit}/día) — omitiendo llamada`);
    return false;
  }
  counter.count++;
  return true;
}

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

// ─── Caché persistente de geocodificación (BD) ───────────────────────────
// Una dirección se geocodifica UNA sola vez y queda para siempre en BD:
// es el mayor ahorro posible (cero coste en reinicios y entre servidores).
let geocodeCacheReady = false;

async function ensureGeocodeCacheTable() {
  if (geocodeCacheReady) return;
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS geocode_cache (
        address_key VARCHAR(255) PRIMARY KEY,
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        formatted_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    geocodeCacheReady = true;
  } catch (err) {
    console.error("❌ [GoogleMaps] No se pudo crear geocode_cache:", err);
  }
}

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
export type TravelMode = "driving" | "walking";

// ─── Caché de rutas persistente en BD ─────────────────────────────────────
// Los mismos recorridos (negocio ↔ direcciones de clientes) se repiten cada
// día: guardarlos en BD evita volver a pagar a Google por el mismo camino.
let routeCacheReady = false;

async function ensureRouteCacheTable() {
  if (routeCacheReady) return;
  try {
    const { db } = await import("../db");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS route_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        polyline TEXT NOT NULL,
        distance_text VARCHAR(64) DEFAULT NULL,
        distance_value INT DEFAULT NULL,
        duration_text VARCHAR(64) DEFAULT NULL,
        duration_value INT DEFAULT NULL,
        steps_json LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_route_cache_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    routeCacheReady = true;
  } catch (err) {
    console.error("❌ [GoogleMaps] route_cache no disponible:", err);
  }
}

/** Clave de caché: coordenadas redondeadas a 3 decimales (~111 m) + modo. */
export function routeCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode,
): string {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `route:${r(originLat)},${r(originLng)}→${r(destLat)},${r(destLng)}:${mode}`;
}

/** Lee una ruta cacheada de la BD (y la sube a la caché en memoria). */
async function getRouteFromDb(
  cacheKey: string,
  mode: TravelMode,
): Promise<DirectionsResult | null> {
  if (!routeCacheReady) return null;
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const [rows]: any = await db.execute(
      sql`SELECT polyline, distance_text, distance_value, duration_text, duration_value, steps_json
          FROM route_cache WHERE cache_key = ${cacheKey} LIMIT 1`,
    );
    const row = rows?.[0];
    if (!row?.polyline) return null;
    let steps: any[] = [];
    try {
      steps = row.steps_json ? JSON.parse(row.steps_json) : [];
    } catch {}
    const result: DirectionsResult = {
      polyline: row.polyline,
      distance: { text: row.distance_text, value: row.distance_value },
      duration: { text: row.duration_text, value: row.duration_value },
      steps,
      startLocation: null as any,
      endLocation: null as any,
    };
    // Subir a memoria para los próximos hits
    const memKey = getCacheKey("directions", {
      originLat: Number(cacheKey.split(":")[1]?.split(",")[0]),
      originLng: Number(cacheKey.split(":")[1]?.split(",")[1]?.split("→")[0]),
      destLat: Number(cacheKey.split(":")[2]?.split(",")[0]?.split("→")[1]),
      destLng: Number(cacheKey.split(":")[2]?.split(",")[1]?.split(":")[0]),
      mode,
    });
    setCache(memKey, result);
    return result;
  } catch (err) {
    console.error("❌ [GoogleMaps] Error leyendo route_cache:", err);
    return null;
  }
}

/** Guarda una ruta real en la BD para no volver a pedirla. */
async function saveRouteToDb(
  cacheKey: string,
  result: DirectionsResult,
): Promise<void> {
  if (!routeCacheReady) return;
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO route_cache (cache_key, polyline, distance_text, distance_value, duration_text, duration_value, steps_json)
      VALUES (${cacheKey}, ${result.polyline}, ${result.distance?.text ?? null},
              ${result.distance?.value ?? null}, ${result.duration?.text ?? null},
              ${result.duration?.value ?? null}, ${JSON.stringify(result.steps || [])})
      ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
    `);
    routeCacheHitsDb++;
  } catch (err) {
    console.error("❌ [GoogleMaps] Error guardando route_cache:", err);
  }
}

// Contadores de salud del sistema de rutas (visibles en maps-stats del admin)
export const routeStats = {
  dbHits: 0,
  failed: 0,
  rateLimited: 0,
  dailyLimited: 0,
};
let routeCacheHitsDb = 0;

export async function getDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode = "driving",
  opts?: { preferOsrm?: boolean },
): Promise<DirectionsResult | null> {
  const memKey = getCacheKey("directions", {
    originLat,
    originLng,
    destLat,
    destLng,
    mode,
  });

  // 1) Caché en memoria
  const cached = getFromCache<DirectionsResult>(memKey, TTL.directions);
  if (cached) {
    console.log(`🗺️ [GoogleMaps Cache HIT] Directions`);
    return cached;
  }

  // 2) Caché persistente en BD (sobrevive reinicios y días)
  await ensureRouteCacheTable();
  const dbKey = routeCacheKey(originLat, originLng, destLat, destLng, mode);
  const fromDb = await getRouteFromDb(dbKey, mode);
  if (fromDb) {
    routeCacheHitsDb++;
    routeStats.dbHits++;
    console.log(`🗺️ [RouteCache BD HIT] ${dbKey}`);
    return fromDb;
  }

  // preferOsrm: mapas con MUCHAS rutas a la vez (p. ej. el bulk del centro
  // de operaciones admin) van directos a OSRM (gratis, rutas reales por
  // calles) y reservan la cuota de Google para los mapas de usuario final.
  const preferOsrm = opts?.preferOsrm === true;

  // 3) Google (con sus límites) — OSRM tiene contador propio y NO se ve
  // afectado por los límites de Google
  let result: DirectionsResult | null = null;
  if (!preferOsrm && API_KEY && checkRateLimit("directions")) {
    if (checkDailyLimit("directions")) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=${mode}&language=es&key=${API_KEY}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000), // 8s timeout
        });
        const data = await response.json();

        if (data.status === "OK" && data.routes?.length) {
          const route = data.routes[0];
          const leg = route.legs[0];

          result = {
            polyline: route.overview_polyline?.points || "",
            distance: leg.distance,
            duration: leg.duration,
            steps: (leg.steps || []).map((s: any) => ({
              instruction:
                s.html_instructions
                  ?.replace(/<[^>]*>/g, "")
                  .trim() || "",
              distance: s.distance,
              duration: s.duration,
            })),
            startLocation: leg.start_location,
            endLocation: leg.end_location,
          };

          setCache(memKey, result);
          await saveRouteToDb(dbKey, result);
          console.log(`🗺️ [GoogleMaps API] Directions fetched & cached`);
          return result;
        }
        console.warn(
          `⚠️ [GoogleMaps] Directions error: ${data.status} — ${data.error_message || ""} (probando OSRM)`,
        );
      } catch (error: any) {
        console.error(
          `❌ [GoogleMaps] Directions fetch error:`,
          error.message,
          "(probando OSRM)",
        );
      }
    } else {
      routeStats.dailyLimited++;
      console.warn(
        `⚠️ [GoogleMaps] Directions: límite diario alcanzado — OSRM solamente`,
      );
    }
  } else if (!preferOsrm) {
    routeStats.rateLimited++;
    console.warn(`⚠️ [GoogleMaps Rate Limit] Directions — usando OSRM`);
  } else {
    console.log("🗺️ [GoogleMaps] preferOsrm — OSRM directo");
  }

  // 4) OSRM (gratis, rutas reales por calles): contador propio, reintentos
  // y fallback walking→driving
  if (result == null && checkRateLimit("osrm")) {
    result = await fetchOsrmRoute(
      originLat,
      originLng,
      destLat,
      destLng,
      mode,
    );
    if (result) {
      setCache(memKey, result);
      await saveRouteToDb(dbKey, result);
    }
  }

  if (result == null) {
    routeStats.failed++;
    console.warn(`⚠️ [GoogleMaps] Sin ruta real para ${dbKey}`);
  }
  return result;
}

// Servidores OSRM públicos (se prueban en orden) — coche y a pie
const OSRM_MIRRORS: Record<TravelMode, string[]> = {
  driving: [
    "https://router.project-osrm.org",
    "https://routing.openstreetmap.de/routed-car",
  ],
  walking: ["https://routing.openstreetmap.de/routed-foot"],
};

/**
 * Ruta real por calles usando OSRM público (gratuito, sin API key).
 * Cada espejo se intenta 2 veces (los servidores demo caen a menudo);
 * si el modo walking falla en todos, se intenta el perfil de coche como
 * último recurso (mejor una ruta por calles de coche que nada).
 * Devuelve el mismo formato que Google Directions o null si falla.
 */
async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode = "driving",
): Promise<DirectionsResult | null> {
  const attempt = async (base: string, profile: TravelMode) => {
    const path = `/route/v1/${profile}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ComeYa-Delivery-App/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry) return null;

    const leg = route.legs?.[0];
    const distanceMeters = Math.round(route.distance || leg?.distance || 0);
    const durationSeconds = Math.round(route.duration || leg?.duration || 0);

    // Generar instrucciones básicas a partir de los nombres de las calles
    const steps = (leg?.steps || [])
      .filter((s: any) => s.name || s.maneuver?.type === "arrive")
      .slice(0, 25)
      .map((s: any) => ({
        instruction:
          s.maneuver?.type === "arrive"
            ? "Llega a tu destino"
            : `${maneuverEs(s.maneuver?.type, s.maneuver?.modifier)} ${s.name || ""}`.trim(),
        distance: {
          text: formatMeters(s.distance),
          value: Math.round(s.distance || 0),
        },
        duration: {
          text: formatSeconds(s.duration),
          value: Math.round(s.duration || 0),
        },
      }));

    return {
      polyline: route.geometry,
      distance: {
        text:
          distanceMeters >= 1000
            ? `${(distanceMeters / 1000).toFixed(1)} km`
            : `${distanceMeters} m`,
        value: distanceMeters,
      },
      duration: {
        text: `${Math.max(1, Math.round(durationSeconds / 60))} min`,
        value: durationSeconds,
      },
      steps,
      startLocation: { lat: originLat, lng: originLng },
      endLocation: { lat: destLat, lng: destLng },
    } as DirectionsResult;
  };

  const mirrors = OSRM_MIRRORS[mode] ?? OSRM_MIRRORS.driving;
  for (const base of mirrors) {
    for (let attemptN = 0; attemptN < 2; attemptN++) {
      try {
        const result = await attempt(base, mode);
        if (result) {
          console.log(`🗺️ [OSRM] Directions fetched (${base}, intento ${attemptN + 1})`);
          return result;
        }
      } catch {
        // reintentar el mismo espejo y luego pasar al siguiente
      }
      if (attemptN === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Último recurso: perfil de coche para modo walking (rutas por calles
  // válidas aunque no sean peatonales) — mejor que no dibujar nada
  if (mode === "walking") {
    for (const base of OSRM_MIRRORS.driving) {
      try {
        const result = await attempt(base, "driving");
        if (result) {
          console.log(`🗺️ [OSRM] Walking fallback → driving (${base})`);
          return result;
        }
      } catch {}
    }
  }

  console.warn("⚠️ [OSRM] Todos los mirrors fallaron");
  return null;
}

function maneuverEs(type?: string, modifier?: string): string {
  switch (type) {
    case "depart":
      return "Sal en";
    case "turn":
      if (modifier === "left") return "Gira a la izquierda en";
      if (modifier === "right") return "Gira a la derecha en";
      if (modifier === "straight") return "Continúa por";
      return "Gira en";
    case "new name":
      return "Continúa por";
    case "merge":
      return "Incorpórate en";
    case "on ramp":
      return "Toma la rampa hacia";
    case "off ramp":
      return "Sal hacia";
    case "fork":
      return "Mantente en";
    case "end of road":
      return "Al final de la vía gira en";
    case "roundabout":
    case "rotary":
      return "En la rotonda toma la salida por";
    default:
      return "Continúa por";
  }
}

function formatMeters(m?: number): string {
  if (!m) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatSeconds(s?: number): string {
  if (!s) return "";
  return `${Math.max(1, Math.round(s / 60))} min`;
}

/**
 * Geocodificar una dirección — con caché en memoria, caché persistente en
 * BD (una dirección = una llamada a Google para siempre), rate limit por
 * minuto y límite diario de gasto.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const normalized = address.toLowerCase().trim();
  const cacheKey = getCacheKey("geocoding", { address: normalized });

  // 1) Caché en memoria
  const cached = getFromCache<GeocodingResult>(cacheKey, TTL.geocoding);
  if (cached) {
    console.log(`🗺️ [GoogleMaps Cache HIT] Geocoding`);
    return cached;
  }

  // 2) Caché persistente en BD (sobrevive reinicios)
  await ensureGeocodeCacheTable();
  if (geocodeCacheReady) {
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const [rows]: any = await db.execute(
        sql`SELECT lat, lng, formatted_address FROM geocode_cache WHERE address_key = ${normalized} LIMIT 1`,
      );
      const row = rows?.[0];
      if (row) {
        const result: GeocodingResult = {
          lat: Number(row.lat),
          lng: Number(row.lng),
          formattedAddress: row.formatted_address || "",
          placeId: "",
        };
        setCache(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.error("❌ [GoogleMaps] Error leyendo geocode_cache:", err);
    }
  }

  // 3) Límites: diario y por minuto (solo se cuentan llamadas reales a Google)
  if (!checkDailyLimit("geocoding") || !checkRateLimit("geocoding")) {
    console.warn(`⚠️ [GoogleMaps] Geocoding omitida por límite (${normalized})`);
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

  // Calidad: un resultado "partial_match" (Google no encontró la calle y
  // devolvió la ciudad o una calle homónima de otra zona) es PEOR que nada:
  // guarda coordenadas del centro de Soria que dibujan rutas a un punto
  // equivocado. Se devuelve null y NO se cachea — el sistema lo intentará
  // de nuevo con otra formulación de la dirección.
  const first = data.results[0];
  if (first.partial_match === true) {
    console.warn(`⚠️ [GoogleMaps] Geocoding parcial (${normalized}) — descartado`);
    return null;
  }

  const result: GeocodingResult = {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
    placeId: first.place_id,
  };

    setCache(cacheKey, result);

    // 4) Persistir para no volver a pagar por esta dirección nunca más
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`
        INSERT INTO geocode_cache (address_key, lat, lng, formatted_address)
        VALUES (${normalized}, ${result.lat}, ${result.lng}, ${result.formattedAddress})
        ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng)
      `);
    } catch (err) {
      console.error("❌ [GoogleMaps] Error guardando en geocode_cache:", err);
    }

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
 * Distance Matrix — duraciones/distancia entre orígenes y destinos.
 * Cache por celda normalizada + fallback Haversine cuando Google no responde.
 */
export interface MatrixCell {
  distanceMeters: number;
  durationSeconds: number;
}

export async function getDistanceMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>,
): Promise<(MatrixCell | null)[][]> {
  const rows: (MatrixCell | null)[][] = [];

  // Intentar resolver cada celda desde caché
  const missing: Array<{ oi: number; di: number }> = [];
  for (let oi = 0; oi < origins.length; oi++) {
    rows[oi] = [];
    for (let di = 0; di < destinations.length; di++) {
      const cacheKey = getCacheKey("matrix", {
        oLat: origins[oi].lat,
        oLng: origins[oi].lng,
        dLat: destinations[di].lat,
        dLng: destinations[di].lng,
      });
      const cached = getFromCache<MatrixCell>(cacheKey, TTL.distanceMatrix);
      if (cached) {
        rows[oi][di] = cached;
      } else {
        missing.push({ oi, di });
      }
    }
  }

  if (!missing.length) return rows;

  if (
    !API_KEY ||
    !checkDailyLimit("matrix") ||
    !checkRateLimit("distanceMatrix")
  ) {
    // Fallback: Haversine + velocidad media de 25 km/h
    for (const { oi, di } of missing) {
      const km = calculateHaversineDistance(
        origins[oi].lat,
        origins[oi].lng,
        destinations[di].lat,
        destinations[di].lng,
      );
      const cell: MatrixCell = {
        distanceMeters: Math.round(km * 1000),
        durationSeconds: Math.max(120, Math.round((km / 25) * 3600)),
      };
      rows[oi][di] = cell;
      setCache(
        getCacheKey("matrix", {
          oLat: origins[oi].lat,
          oLng: origins[oi].lng,
          dLat: destinations[di].lat,
          dLng: destinations[di].lng,
        }),
        cell,
      );
    }
    return rows;
  }

  try {
    const originsStr = origins
      .map((o) => `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`)
      .join("|");
    const destsStr = destinations
      .map((d) => `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`)
      .join("|");
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(originsStr)}` +
      `&destinations=${encodeURIComponent(destsStr)}` +
      `&mode=driving&language=es&key=${API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();

    if (data.status !== "OK" || !data.rows) throw new Error(data.status);

    for (let oi = 0; oi < data.rows.length; oi++) {
      for (let di = 0; di < data.rows[oi].elements.length; di++) {
        const el = data.rows[oi].elements[di];
        const cell: MatrixCell | null =
          el.status === "OK"
            ? {
                distanceMeters: el.distance?.value ?? null,
                durationSeconds: el.duration?.value ?? null,
              }
            : null;
        if (cell && cell.distanceMeters != null) {
          rows[oi][di] = cell;
          setCache(
            getCacheKey("matrix", {
              oLat: origins[oi].lat,
              oLng: origins[oi].lng,
              dLat: destinations[di].lat,
              dLng: destinations[di].lng,
            }),
            cell,
          );
        }
      }
    }
  } catch (e) {
    console.warn("⚠️ [GoogleMaps] Distance Matrix falló, usando Haversine:", e);
    for (const { oi, di } of missing) {
      const km = calculateHaversineDistance(
        origins[oi].lat,
        origins[oi].lng,
        destinations[di].lat,
        destinations[di].lng,
      );
      rows[oi][di] = {
        distanceMeters: Math.round(km * 1000),
        durationSeconds: Math.max(120, Math.round((km / 25) * 3600)),
      };
    }
  }

  return rows;
}

/**
 * Places Autocomplete — sugerencias de direcciones vía proxy (la key nunca
 * sale del servidor). Cache por input normalizado para no pagar dos veces
 * por la misma búsqueda.
 */
export interface PlacePrediction {
  description: string;
  mainText: string;
  secondaryText: string;
  placeId: string;
}

export async function placesAutocomplete(
  input: string,
  bias?: { lat: number; lng: number; radiusM?: number },
): Promise<PlacePrediction[]> {
  const normalized = input.trim().toLowerCase();
  if (normalized.length < 3) return [];

  const biasLat = bias ? Math.round(bias.lat * 100) / 100 : null;
  const biasLng = bias ? Math.round(bias.lng * 100) / 100 : null;
  const cacheKey = getCacheKey("places", { input: normalized, biasLat, biasLng });
  const cached = getFromCache<PlacePrediction[]>(cacheKey, TTL.places);
  if (cached) return cached;

  if (!API_KEY || !checkDailyLimit("places") || !checkRateLimit("places")) {
    return [];
  }

  try {
    let url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}&language=es` +
      `&components=country:es&key=${API_KEY}`;
    if (bias?.lat != null && bias?.lng != null) {
      url += `&location=${bias.lat},${bias.lng}&radius=${bias.radiusM || 30000}`;
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data.status !== "OK" || !data.predictions?.length) return [];

    const predictions: PlacePrediction[] = data.predictions
      .slice(0, 5)
      .map((p: any) => ({
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || "",
        placeId: p.place_id,
      }));

    setCache(cacheKey, predictions);
    return predictions;
  } catch {
    return [];
  }
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
  getDistanceMatrix,
  placesAutocomplete,
  calculateHaversineDistance,
  estimateDeliveryTimeMinutes,
  decodePolyline,
  getUsageStats,
};