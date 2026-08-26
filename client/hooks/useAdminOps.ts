import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { getAuthToken, getApiUrl, apiRequestRaw } from "@/lib/query-client";

export interface OpsAlert {
  type: "no_driver" | "no_response" | "stale_gps" | "too_long";
  message: string;
}

export interface OpsOrder {
  id: string;
  status: string;
  orderType?: string | null;
  total: number;
  subtotal: number;
  deliveryFee: number;
  paymentMethod?: string | null;
  createdAt: string;
  assignedAt?: string | null;
  estimatedDelivery?: string | null;
  pickedUpAt?: string | null;
  arrivedAt?: string | null;
  minutesActive: number | null;
  alerts: OpsAlert[];
  customer: {
    name: string;
    phone: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  };
  business: {
    id: string;
    name: string;
    type?: string | null;
    categories?: any;
    phone: string | null;
    lat: number;
    lng: number;
  } | null;
  driver: {
    id: string;
    name: string;
    phone: string | null;
    vehicleType?: string | null;
    rating?: string | null;
    lat: number | null;
    lng: number | null;
    lastUpdate?: string | null;
    lastUpdateMinutes: number | null;
  } | null;
}

export interface OpsDriver {
  id: string;
  name: string;
  phone: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  rating: string | null;
  totalDeliveries: number;
  isAvailable: boolean;
  isBlocked: boolean;
  isOnline: boolean;
  lat: number;
  lng: number;
  lastUpdate?: string | null;
  lastUpdateMinutes: number | null;
  staleGps: boolean;
  activeOrderId: string | null;
}

export interface OpsBusiness {
  id: string;
  name: string;
  type?: string | null;
  categories?: any;
  phone: string | null;
  address: string | null;
  lat: number;
  lng: number;
  isOpen: boolean;
  isPaused: boolean;
  isFeatured: boolean;
  rating: string | null;
  totalOrders: number;
  activeOrders: number;
}

export interface OpsKpis {
  activeOrders: number;
  byStatus: Record<string, number>;
  ordersWithoutDriver: number;
  ordersToday: number;
  deliveredToday: number;
  cancelledToday: number;
  cancellationRate: number;
  revenueToday: number;
  avgTotalMinutes: number | null;
  avgDeliveryMinutes: number | null;
  alertCount: number;
  drivers: { total: number; available: number; online: number; blocked: number };
  businesses: { total: number; open: number; paused: number; withoutCoords: number };
}

export interface OpsOverview {
  kpis: OpsKpis;
  orders: OpsOrder[];
  drivers: OpsDriver[];
  businesses: OpsBusiness[];
  alerts: {
    orderId: string;
    status: string;
    businessName: string | null;
    minutesActive: number | null;
    alerts: OpsAlert[];
  }[];
  updatedAt: string;
}

interface LiveDriverPosition {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  status?: string;
  lastUpdate: string;
}

/**
 * Datos del centro de operaciones del admin.
 * - Un solo fetch a /api/admin/ops/overview (con caché de 5s en servidor).
 * - WebSocket (room "admins") para el movimiento de repartidores y pedidos
 *   nuevos, con refresco inmediato de KPIs cuando algo cambia.
 * - Si el socket no conecta, el polling sigue funcionando igual.
 */
export function useAdminOps(pollMs = 15000) {
  const [data, setData] = useState<OpsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [livePositions, setLivePositions] = useState<
    Record<string, LiveDriverPosition>
  >({});

  const socketRef = useRef<Socket | null>(null);
  const refreshTimerRef = useRef<any>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiRequestRaw("GET", "/api/admin/ops/overview");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Error ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setData({
          kpis: json.kpis,
          orders: json.orders || [],
          drivers: json.drivers || [],
          businesses: json.businesses || [],
          alerts: json.alerts || [],
          updatedAt: json.updatedAt,
        });
        setError(null);
      } else {
        throw new Error(json.error || "Respuesta inválida");
      }
    } catch (e: any) {
      // El error se muestra en el panel: antes un fallo dejaba el mapa vacío
      // sin ninguna señal visible
      setError(e?.message || "No se pudo cargar el panel de operaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling base
  useEffect(() => {
    fetchOverview();
    const t = setInterval(fetchOverview, pollMs);
    return () => clearInterval(t);
  }, [fetchOverview, pollMs]);

  // WebSocket de la room admins
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getAuthToken();
      if (cancelled || !token) return;

      try {
        const { io } = await import("socket.io-client");
        const socket = io(getApiUrl(), {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (cancelled) return;
          setSocketConnected(true);
          // El servidor valida el rol con el token, no con este payload
          socket.emit("join", { userId: "", role: "admin" });
        });

        socket.on("driver_location", (p: LiveDriverPosition) => {
          if (cancelled || !p?.driverId) return;
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setLivePositions((prev) => ({
            ...prev,
            [p.driverId]: { ...p, latitude: lat, longitude: lng },
          }));
        });

        // Un pedido nuevo o un cambio de estado altera los KPIs: refrescamos
        // en cuanto pasa (con un pequeño debounce para no encadenar fetches)
        const scheduleRefresh = () => {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(fetchOverview, 1500);
        };
        socket.on("new_order", scheduleRefresh);
        socket.on("order_status_changed", scheduleRefresh);
        socket.on("admin_order_stuck", scheduleRefresh);

        socket.on("disconnect", () => {
          if (!cancelled) setSocketConnected(false);
        });
        socket.on("connect_error", () => {
          if (!cancelled) setSocketConnected(false);
        });
      } catch {
        if (!cancelled) setSocketConnected(false);
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchOverview]);

  // Mezcla las posiciones en vivo del socket sobre los datos del fetch
  const driversLive: OpsDriver[] = (data?.drivers || []).map((d) => {
    const live = livePositions[d.id];
    if (!live) return d;
    return {
      ...d,
      lat: live.latitude,
      lng: live.longitude,
      lastUpdate: live.lastUpdate,
      lastUpdateMinutes: 0,
      staleGps: false,
      isOnline: true,
    };
  });

  const ordersLive: OpsOrder[] = (data?.orders || []).map((o) => {
    if (!o.driver) return o;
    const live = livePositions[o.driver.id];
    if (!live) return o;
    return {
      ...o,
      driver: {
        ...o.driver,
        lat: live.latitude,
        lng: live.longitude,
        lastUpdate: live.lastUpdate,
        lastUpdateMinutes: 0,
      },
    };
  });

  return {
    kpis: data?.kpis ?? null,
    orders: ordersLive,
    drivers: driversLive,
    businesses: data?.businesses ?? [],
    alerts: data?.alerts ?? [],
    updatedAt: data?.updatedAt ?? null,
    loading,
    error,
    socketConnected,
    refresh: fetchOverview,
  };
}
