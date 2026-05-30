import { apiRequest as originalApiRequest } from "@/lib/query-client";
import { OfflineCacheService } from "./OfflineCacheService";

export async function apiRequestWithCache(
  method: string,
  endpoint: string,
  data?: any,
  options?: {
    cache?: boolean;
    cacheKey?: string;
    cacheExpiry?: number;
  },
): Promise<Response> {
  const isOnline = await OfflineCacheService.isOnline();

  // Si está offline y es GET, intentar obtener de caché
  if (!isOnline && method === "GET") {
    const cacheKey = options?.cacheKey || endpoint;
    const cached = await OfflineCacheService.get(cacheKey);

    if (cached) {
      console.log(`[OFFLINE] Serving from cache: ${endpoint}`);
      // Simular Response
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error("Sin conexión y sin datos en caché");
  }

  // Si está offline y NO es GET, agregar a cola de sincronización
  if (!isOnline && method !== "GET") {
    console.log(`[OFFLINE] Adding to sync queue: ${method} ${endpoint}`);
    await OfflineCacheService.addToSyncQueue({
      type: `${method} ${endpoint}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
    });

    // Simular respuesta exitosa
    return new Response(
      JSON.stringify({ success: true, offline: true, queued: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Si está online, hacer request normal
  try {
    const response = await originalApiRequest(method, endpoint, data);

    // Si es GET y cache está habilitado, guardar en caché
    if (method === "GET" && options?.cache !== false) {
      const cacheKey = options?.cacheKey || endpoint;
      const responseData = await response.clone().json();
      await OfflineCacheService.set(
        cacheKey,
        responseData,
        options?.cacheExpiry || 1800000, // 30 min por defecto
      );
    }

    return response;
  } catch (error) {
    // Si falla el request y hay caché, usar caché
    if (method === "GET") {
      const cacheKey = options?.cacheKey || endpoint;
      const cached = await OfflineCacheService.get(cacheKey);

      if (cached) {
        console.log(`[FALLBACK] Serving from cache: ${endpoint}`);
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    throw error;
  }
}

// Helpers específicos para endpoints comunes
export const OfflineAPI = {
  // Negocios
  async getBusinesses() {
    return apiRequestWithCache("GET", "/api/businesses", undefined, {
      cache: true,
      cacheKey: "businesses",
      cacheExpiry: 1800000, // 30 min
    });
  },

  async getBusinessProducts(businessId: string) {
    return apiRequestWithCache(
      "GET",
      `/api/businesses/${businessId}/products`,
      undefined,
      {
        cache: true,
        cacheKey: `products_${businessId}`,
        cacheExpiry: 1800000,
      },
    );
  },

  // Favoritos
  async getFavorites() {
    return apiRequestWithCache("GET", "/api/favorites", undefined, {
      cache: true,
      cacheKey: "favorites",
      cacheExpiry: 3600000, // 1 hora
    });
  },

  // Pedidos
  async getOrders() {
    return apiRequestWithCache("GET", "/api/orders", undefined, {
      cache: true,
      cacheKey: "orders",
      cacheExpiry: 1800000,
    });
  },

  // Usuario
  async getUserProfile() {
    return apiRequestWithCache("GET", "/api/users/profile", undefined, {
      cache: true,
      cacheKey: "user_profile",
      cacheExpiry: Infinity, // No expira
    });
  },
};
