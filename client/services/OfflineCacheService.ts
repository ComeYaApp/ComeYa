import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milisegundos
}

export class OfflineCacheService {
  private static readonly CACHE_PREFIX = "@ComeYa_cache_";
  private static readonly BUSINESSES_KEY = "businesses";
  private static readonly PRODUCTS_KEY = "products";
  private static readonly CART_KEY = "cart";
  private static readonly FAVORITES_KEY = "favorites";
  private static readonly USER_KEY = "user";
  private static readonly ORDERS_KEY = "orders";

  // Verificar conexión
  static async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  // Guardar en caché
  static async set<T>(
    key: string,
    data: T,
    expiresIn: number = 3600000,
  ): Promise<void> {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiresIn,
      };
      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cacheItem),
      );
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  // Obtener de caché
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();

      // Verificar si expiró
      if (now - cacheItem.timestamp > cacheItem.expiresIn) {
        await this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  // Eliminar de caché
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error("Cache remove error:", error);
    }
  }

  // Limpiar toda la caché
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  // Guardar negocios
  static async cacheBusinesses(businesses: any[]): Promise<void> {
    await this.set(this.BUSINESSES_KEY, businesses, 1800000); // 30 min
  }

  // Obtener negocios cacheados
  static async getCachedBusinesses(): Promise<any[] | null> {
    return this.get<any[]>(this.BUSINESSES_KEY);
  }

  // Guardar productos de un negocio
  static async cacheBusinessProducts(
    businessId: string,
    products: any[],
  ): Promise<void> {
    await this.set(`${this.PRODUCTS_KEY}_${businessId}`, products, 1800000); // 30 min
  }

  // Obtener productos cacheados
  static async getCachedBusinessProducts(
    businessId: string,
  ): Promise<any[] | null> {
    return this.get<any[]>(`${this.PRODUCTS_KEY}_${businessId}`);
  }

  // Guardar carrito (sin expiración)
  static async cacheCart(cart: any): Promise<void> {
    await this.set(this.CART_KEY, cart, Infinity);
  }

  // Obtener carrito cacheado
  static async getCachedCart(): Promise<any | null> {
    return this.get<any>(this.CART_KEY);
  }

  // Guardar favoritos
  static async cacheFavorites(favorites: any[]): Promise<void> {
    await this.set(this.FAVORITES_KEY, favorites, 3600000); // 1 hora
  }

  // Obtener favoritos cacheados
  static async getCachedFavorites(): Promise<any[] | null> {
    return this.get<any[]>(this.FAVORITES_KEY);
  }

  // Guardar usuario
  static async cacheUser(user: any): Promise<void> {
    await this.set(this.USER_KEY, user, Infinity);
  }

  // Obtener usuario cacheado
  static async getCachedUser(): Promise<any | null> {
    return this.get<any>(this.USER_KEY);
  }

  // Guardar pedidos
  static async cacheOrders(orders: any[]): Promise<void> {
    await this.set(this.ORDERS_KEY, orders, 1800000); // 30 min
  }

  // Obtener pedidos cacheados
  static async getCachedOrders(): Promise<any[] | null> {
    return this.get<any[]>(this.ORDERS_KEY);
  }

  // Cola de sincronización (acciones pendientes)
  private static readonly SYNC_QUEUE_KEY = "sync_queue";

  static async addToSyncQueue(action: {
    type: string;
    endpoint: string;
    method: string;
    data: any;
    timestamp: number;
  }): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      queue.push(action);
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Add to sync queue error:", error);
    }
  }

  static async getSyncQueue(): Promise<any[]> {
    try {
      const queue = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error("Get sync queue error:", error);
      return [];
    }
  }

  static async clearSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SYNC_QUEUE_KEY);
    } catch (error) {
      console.error("Clear sync queue error:", error);
    }
  }

  static async removeFromSyncQueue(index: number): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      queue.splice(index, 1);
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Remove from sync queue error:", error);
    }
  }

  // Sincronizar cola cuando vuelva la conexión
  static async syncQueue(
    apiRequest: (method: string, endpoint: string, data?: any) => Promise<any>,
  ): Promise<void> {
    const isOnline = await this.isOnline();
    if (!isOnline) return;

    const queue = await this.getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} pending actions...`);

    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      try {
        await apiRequest(action.method, action.endpoint, action.data);
        await this.removeFromSyncQueue(i);
        console.log(`Synced action: ${action.type}`);
      } catch (error) {
        console.error(`Failed to sync action: ${action.type}`, error);
        // Si falla, lo dejamos en la cola para reintentar después
      }
    }
  }

  // Obtener tamaño de caché
  static async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(this.CACHE_PREFIX));
      let totalSize = 0;

      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error("Get cache size error:", error);
      return 0;
    }
  }

  // Obtener estadísticas de caché
  static async getCacheStats(): Promise<{
    totalItems: number;
    totalSize: number;
    sizeInMB: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(this.CACHE_PREFIX));
      const totalSize = await this.getCacheSize();

      return {
        totalItems: cacheKeys.length,
        totalSize,
        sizeInMB: totalSize / (1024 * 1024),
      };
    } catch (error) {
      console.error("Get cache stats error:", error);
      return { totalItems: 0, totalSize: 0, sizeInMB: 0 };
    }
  }
}
