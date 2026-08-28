import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_CONFIG } from "@/constants/api";

/**
 * Gets the base URL for the Express API server
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  return API_CONFIG.BASE_URL;
}

// Token cache to avoid repeated AsyncStorage reads
let tokenCache: string | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 5000; // 5 seconds

export async function getAuthToken(): Promise<string | null> {
  // Use cache if recent
  if (tokenCache && Date.now() - tokenCacheTime < TOKEN_CACHE_DURATION) {
    return tokenCache;
  }

  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;

    // Try to get token directly first
    let token = await AsyncStorage.getItem("token");

    // Fallback to user object
    if (!token) {
      const stored = await AsyncStorage.getItem("@ComeYa_user");
      if (stored) {
        const user = JSON.parse(stored);
        token = user.token;
      }
    }

    // Update cache
    tokenCache = token;
    tokenCacheTime = Date.now();

    return token;
  } catch (error) {
    return null;
  }
}

// Clear token cache (call on logout)
export function clearTokenCache() {
  tokenCache = null;
  tokenCacheTime = 0;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Extraer el mensaje amigable del JSON ({ error } o { message });
    // si no hay JSON, usar el texto crudo. (Antes el throw caía en su
    // propio catch y el mensaje amigable se perdía.)
    let message = text;
    try {
      const json = JSON.parse(text);
      if (json && (json.error || json.message)) {
        message = json.error || json.message;
      }
    } catch {}
    throw new Error(message);
  }
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const stored = await AsyncStorage.getItem("@ComeYa_user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    if (!user.refreshToken) return null;

    const baseUrl = (await import("@/constants/api")).getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: user.refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.token) return null;

    // Guardar nuevo token
    user.token = data.token;
    await AsyncStorage.setItem("@ComeYa_user", JSON.stringify(user));
    await AsyncStorage.setItem("token", data.token);
    tokenCache = data.token;
    tokenCacheTime = Date.now();
    return data.token;
  } catch {
    return null;
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  console.log(`🚀 API Request: ${method} ${url.toString()}`);
  if (data) {
    console.log("📦 Request data:", JSON.stringify(data).substring(0, 100));
  }

  const token = await getAuthToken();
  console.log("🔑 Token:", token ? `${token.substring(0, 20)}...` : "NO TOKEN");

  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`✅ Response status: ${res.status}`);

    // Si es 401, intentar refresh y reintentar
    if (res.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
      // Si no se pudo refrescar, limpiar sesión
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.removeItem("@ComeYa_user");
      await AsyncStorage.removeItem("token");
      tokenCache = null;
      tokenCacheTime = 0;
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error("❌ API Request failed:", error);
    throw error;
  }
}

// Use when you need to handle non-2xx responses manually
export async function apiRequestRaw(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const token = await getAuthToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
