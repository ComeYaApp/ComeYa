// API Configuration for ComeYa Frontend
import { Platform } from "react-native";
import Constants from "expo-constants";

// DEVELOPMENT: Set to true to disable GPS tracking and use fixed location from DB
const DISABLE_GPS_IN_DEV = true;

// Get API base URL dynamically at runtime
export const getApiBaseUrl = (): string => {
  // HARDCODED FOR DEVELOPMENT - Change back before production
  console.log('🔧 Using HARDCODED localhost URL');
  return "http://localhost:5000";

  // Check expo config first (from app.config.js) - works in both dev and prod
  const expoBackendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL;
  if (expoBackendUrl) {
    console.log('🔧 Using Expo config URL:', expoBackendUrl);
    return expoBackendUrl;
  }

  // Check for environment variable (development)
  const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envBackendUrl) {
    console.log('🔧 Using env URL:', envBackendUrl);
    return envBackendUrl.trim();
  }

  // HARDCODED FOR DEVELOPMENT - Change back before production
  console.log('🔧 Using HARDCODED localhost URL');
  return "http://localhost:5000";

  // Development mode - use localhost backend
  // if (__DEV__) {
  //   console.log('🔧 Using DEV URL: http://localhost:5000');
  //   return "http://localhost:5000";
  // }

  // For web in production, use current origin (same domain)
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    console.log('🔧 Using window origin:', window.location.origin);
    return window.location.origin;
  }

  // Production fallback
  console.log('🔧 Using fallback URL: https://ComeYa-backend.onrender.com');
  return "https://ComeYa-backend.onrender.com";
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

