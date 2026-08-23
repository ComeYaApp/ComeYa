import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getAuthToken, getApiUrl, apiRequestRaw } from "@/lib/query-client";

export interface DriverLocationUpdate {
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  lastUpdate?: string;
}

interface Options {
  /** Intervalo del polling de respaldo cuando el socket falla */
  fallbackIntervalMs?: number;
  /** Desactivar el socket (p.ej. en pantallas sin auth) */
  enabled?: boolean;
}

/**
 * Seguimiento en tiempo real de la posición del repartidor para un pedido.
 * Usa WebSocket (room `order:{orderId}`) con fallback automático a polling
 * HTTP si el socket no conecta o se cae.
 */
export function useDriverLocationSocket(
  orderId: string | null | undefined,
  opts: Options = {},
) {
  const fallbackIntervalMs = opts.fallbackIntervalMs ?? 5000;
  const enabled = opts.enabled ?? true;

  const [location, setLocation] = useState<DriverLocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) return;
    let cancelled = false;

    (async () => {
      const token = await getAuthToken();
      if (cancelled) return;

      try {
        const { io } = await import("socket.io-client");
        const socket = io(getApiUrl(), {
          auth: { token: token ?? undefined },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (cancelled) return;
          setConnected(true);
          setUsingFallback(false);
          socket.emit("join_order", { orderId });
        });

        socket.on("driver_location", (data: DriverLocationUpdate) => {
          if (cancelled) return;
          setLocation(data);
        });

        socket.on("disconnect", () => {
          if (cancelled) return;
          setConnected(false);
          setUsingFallback(true);
        });

        socket.on("connect_error", () => {
          if (cancelled) return;
          setConnected(false);
          setUsingFallback(true);
        });
      } catch {
        if (!cancelled) setUsingFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [enabled, orderId]);

  // Fallback: polling HTTP cuando el socket no está disponible
  useEffect(() => {
    if (!enabled || !orderId || !usingFallback) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiRequestRaw(
          "GET",
          `/api/delivery/location/${orderId}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.latitude != null && data?.longitude != null) {
            setLocation({
              orderId,
              latitude: parseFloat(data.latitude),
              longitude: parseFloat(data.longitude),
              lastUpdate: data.lastUpdate,
            });
          }
        }
      } catch {
        // sin conexión — reintentará en el siguiente tick
      }
    };

    poll();
    const t = setInterval(poll, fallbackIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled, orderId, usingFallback, fallbackIntervalMs]);

  return { location, connected, usingFallback };
}
