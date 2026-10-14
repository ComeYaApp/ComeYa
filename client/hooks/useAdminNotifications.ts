import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { onAdminRealtimeEvent, onAdminRealtimeConnection } from "@/services/adminRealtime";

export type NotifLevel = "critical" | "high" | "medium";

export interface AdminNotif {
  id: string;
  level: NotifLevel;
  icon: string;
  title: string;
  body: string;
  section?: string;
  timestamp: Date;
  read: boolean;
}

// Aviso flotante (toast) derivado de un AdminNotif
export interface AdminToast extends AdminNotif {
  ts: number;
}

const SILENCE_KEY = "admin_notifications_silenced";

// Sonidos via Web Audio API — sin archivos externos (solo navegador; en
// nativo el try/catch lo silencia)
function playSound(level: NotifLevel, silenced: boolean) {
  if (silenced) return;
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (level === "critical") {
      // Tres pitidos urgentes
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (level === "high") {
      // Dos pitidos suaves
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
    // medium: sin sonido
  } catch {}
}

// Traduce el tipo de aviso del servidor a icono local
function iconForType(type: string): string {
  const map: Record<string, string> = {
    new_order: "shopping-bag",
    new_registration: "user-plus",
    new_delivery_verification: "user-check",
    driver_data_updated: "truck",
    driver_document_updated: "file-text",
    document_updated: "file-text",
    new_proof: "file-text",
    new_fee_proof: "calendar",
    new_payout: "send",
    new_ticket: "message-circle",
    new_issue: "alert-circle",
    fraud: "alert-octagon",
    order_stuck: "clock",
    ops_no_driver: "clock",
    ops_no_response: "bell-off",
    ops_stale_gps: "wifi-off",
    ops_too_long: "alert-triangle",
    cancellation_refund: "rotate-ccw",
    refund_failed: "alert-triangle",
    chargeback: "alert-octagon",
    new_subscription: "star",
  };
  return map[type] || "bell";
}

function mapServerNotif(row: any): AdminNotif {
  return {
    id: String(row.id),
    level: (row.severity as NotifLevel) || "medium",
    icon: iconForType(String(row.type)),
    title: String(row.title || "Aviso"),
    body: String(row.body || ""),
    section: row.section ? String(row.section) : undefined,
    timestamp: row.createdAt ? new Date(row.createdAt) : new Date(),
    read: !!row.readAt,
  };
}

/**
 * Centro de avisos del admin:
 * - Carga el HISTORIAL del servidor (persistente, con no leídos).
 * - Escucha en vivo el evento unificado `admin_notification`.
 * - Mantiene toasts flotantes con botón "Ver" y sonido por severidad.
 * - Silencio persistente (AsyncStorage/localStorage).
 */
export function useAdminNotifications() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [silenced, setSilencedState] = useState(false);
  const [connected, setConnected] = useState(false);
  const silencedRef = useRef(false);

  // Cargar preferencia de silencio
  useEffect(() => {
    AsyncStorage.getItem(SILENCE_KEY)
      .then((v) => {
        const s = v === "1";
        silencedRef.current = s;
        setSilencedState(s);
      })
      .catch(() => {});
  }, []);

  const setSilenced = useCallback((value: boolean) => {
    silencedRef.current = value;
    setSilencedState(value);
    AsyncStorage.setItem(SILENCE_KEY, value ? "1" : "0").catch(() => {});
  }, []);

  // Historial del servidor
  const refresh = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/notifications?limit=60");
      const data = await res.json();
      if (data?.notifications) {
        setNotifs(data.notifications.map(mapServerNotif));
      }
    } catch {
      /* sin conexión: se conserva lo que haya */
    }
  }, []);

  useEffect(() => {
    if (!user || !["admin", "super_admin"].includes(user.role)) return;
    refresh();
  }, [user?.id, user?.role, refresh]);

  // Eventos en vivo (socket único compartido)
  useEffect(() => {
    if (!user || !["admin", "super_admin"].includes(user.role)) return;

    const unsubscribeConn = onAdminRealtimeConnection(setConnected);

    const unsubscribe = onAdminRealtimeEvent(
      "admin_notification",
      (payload: any) => {
        if (!payload?.title) return;
        const notif = mapServerNotif({ ...payload, createdAt: new Date() });
        setNotifs((prev) => [notif, ...prev].slice(0, 120));
        // Aviso flotante: lo más importante se queda visible
        setToasts((prev) => [...prev, { ...notif, ts: Date.now() }].slice(-4));
        playSound(notif.level, silencedRef.current);
        // Se autodescarta visualmente a los 9 s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== notif.id));
        }, 9000);
      },
    );

    return () => {
      unsubscribe();
      unsubscribeConn();
    };
  }, [user?.id, user?.role]);

  // Contador de no leídos
  const unreadCount = notifs.filter((n) => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await apiRequest("POST", `/api/admin/notifications/${id}/read`, {});
    } catch {
      /* el estado local ya se actualizó */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiRequest("POST", "/api/admin/notifications/read-all", {});
    } catch {
      /*silencioso*/
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setNotifs([]), []);

  return {
    notifs,
    unreadCount,
    toasts,
    dismissToast,
    silenced,
    setSilenced,
    connected,
    markRead,
    markAllRead,
    clear,
    refresh,
  };
}
