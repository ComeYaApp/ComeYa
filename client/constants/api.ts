// API Configuration for ComeYa Frontend
import { Platform } from "react-native";
import Constants from "expo-constants";

// Solo en desarrollo (Metro/__DEV__) se puede desactivar el GPS real.
// En builds de producción el tracking GPS siempre está activo.
const DISABLE_GPS_IN_DEV = false;

// Get API base URL dynamically at runtime
export const getApiBaseUrl = (): string => {
  // Check expo config first (from app.config.js)
  const expoBackendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (expoBackendUrl) {
    return expoBackendUrl;
  }

  // Check for environment variable
  const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envBackendUrl) {
    return envBackendUrl.trim();
  }

  return "https://comeya-backend.onrender.com";
};

export const API_CONFIG = {
  get BASE_URL() {
    return getApiBaseUrl();
  },
  ENDPOINTS: {
    AUTH: {
      VERIFY_PHONE: "/api/auth/verify-phone",
      SEND_CODE: "/api/auth/send-code",
      LOGIN: "/api/auth/login",
      LOGOUT: "/api/auth/logout",
    },
    BUSINESSES: {
      LIST: "/api/businesses",
      DETAIL: (id: string) => `/api/businesses/${id}`,
      PRODUCTS: (id: string) => `/api/businesses/${id}/products`,
    },
    ORDERS: {
      CREATE: "/api/orders",
      LIST: "/api/orders",
      DETAIL: (id: string) => `/api/orders/${id}`,
      UPDATE_STATUS: (id: string) => `/api/orders/${id}/status`,
    },
    USERS: {
      PROFILE: "/api/user/profile",
      UPDATE: "/api/user/profile",
    },
  },
  TIMEOUT: 10000, // 10 seconds
};

export const GPS_CONFIG = {
  DISABLE_IN_DEV: DISABLE_GPS_IN_DEV,
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Default headers for API requests
export const getDefaultHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};
