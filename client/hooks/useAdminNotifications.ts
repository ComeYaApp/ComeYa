import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/api";
import { ISSUE_LABELS } from "@shared/orderIssues";

export type NotifLevel = "critical" | "high" | "medium";

export interface AdminNotif {
  id: string;
  level: NotifLevel;
  icon: string;
  title: string;
  body: string;
  action?: { label: string; section: string };
  timestamp: Date;
  read: boolean;
}

// Sonidos via Web Audio API — sin archivos externos
function playSound(level: NotifLevel) {
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

let _addNotif:
  | ((n: Omit<AdminNotif, "id" | "timestamp" | "read">) => void)
  | null = null;

export function useAdminNotifications() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const socketRef = useRef<any>(null);

  const add = useCallback(
    (n: Omit<AdminNotif, "id" | "timestamp" | "read">) => {
      const notif: AdminNotif = {
        ...n,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        read: false,
      };
      setNotifs((prev) => [notif, ...prev].slice(0, 50)); // max 50
      playSound(n.level);
    },
    [],
  );

  // Exponer add globalmente para que AdminShell pueda usarlo
  _addNotif = add;

  const markRead = useCallback((id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifs([]), []);

  useEffect(() => {
    if (!user || !["admin", "super_admin"].includes(user.role)) return;

    let socket: any;

    const connect = async () => {
      try {
        const { io } = await import("socket.io-client");
        // El servidor exige un JWT verificado para unirse a la room "admins"
        const token = await AsyncStorage.getItem("token");
        socket = io(getApiBaseUrl(), {
          transports: ["websocket", "polling"],
          auth: token ? { token } : undefined,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join", { userId: user.id, role: user.role });
        });

        // 🚨 CRÍTICO — Fraude detectado
        socket.on("admin_fraud_detected", (data: any) => {
          add({
            level: "critical",
            icon: "alert-octagon",
            title: "🚨 Fraude detectado",
            body: `${data.userName ?? "Usuario"}: ${data.reason}`,
            action: { label: "Ver comprobantes", section: "finance_proofs" },
          });
        });

        // ⚠️ ALTO — Nuevo comprobante pendiente
        socket.on("admin_new_proof", (data: any) => {
          const fmt = (c: number) => `${(c / 100).toFixed(2)} €`;
          add({
            level: "high",
            icon: "file-text",
            title: "⚠️ Comprobante pendiente",
            body: `${data.userName} envió ${fmt(data.amount)} via ${data.method}`,
            action: { label: "Verificar", section: "finance_proofs" },
          });
        });

        // ⚠️ ALTO — Comprobante de tarifas de reservas pendiente
        socket.on("admin_new_fee_proof", (data: any) => {
          const fmt = (c: number) => `${(c / 100).toFixed(2)} €`;
          add({
            level: "high",
            icon: "calendar",
            title: "💳 Tarifas de reservas pendientes",
            body: `${data.ownerName} pagó ${fmt(data.amount)} via ${data.method} · verificar comprobante`,
            action: { label: "Verificar", section: "finance_reservations" },
          });
        });

        // ⚠️ ALTO — Nuevo payout generado
        socket.on("admin_new_payout", (data: any) => {
          const fmt = (c: number) => `${(c / 100).toFixed(2)} €`;
          add({
            level: "high",
            icon: "send",
            title: "💸 Payout pendiente",
            body: `${data.recipientName} (${data.recipientType === "business" ? "Negocio" : "Repartidor"}) · ${fmt(data.amount)}`,
            action: { label: "Gestionar", section: "finance_payouts" },
          });
        });

        // 📦 MEDIO — Nuevo pedido
        socket.on("new_order", (data: any) => {
          add({
            level: "medium",
            icon: "shopping-bag",
            title: "📦 Nuevo pedido",
            body: `${data.businessName ?? "Negocio"} · ${((data.total ?? 0) / 100).toFixed(2)} €`,
            action: { label: "Ver pedidos", section: "orders_active" },
          });
        });

        // 🎫 MEDIO — Nuevo ticket de soporte
        socket.on("admin_new_ticket", (data: any) => {
          add({
            level: "medium",
            icon: "message-circle",
            title: "🎫 Nuevo ticket",
            body: `${data.userName}: ${data.subject}`,
            action: { label: "Ver tickets", section: "support_tickets" },
          });
        });

        // ⚠️ ALTO — Nueva incidencia de pedido reportada por un cliente
        socket.on("admin_new_issue", (data: any) => {
          add({
            level: "high",
            icon: "alert-circle",
            title: "⚠️ Incidencia en un pedido",
            body: `Pedido ${data.orderNumber ? `#CY${String(data.orderNumber).padStart(6,"0")}` : `#${(data.orderId ?? "").slice(-6).toUpperCase()}`}: ${ISSUE_LABELS[data.issueType] ?? data.issueType ?? "problema"}`,
            action: { label: "Revisar", section: "support_issues" },
          });
        });

        // ⏰ MEDIO — Pedido sin repartidor
        socket.on("admin_order_stuck", (data: any) => {
          add({
            level: "medium",
            icon: "clock",
            title: "⏰ Pedido sin repartidor",
            body: `${data.businessName} lleva ${data.minutesWaiting} min esperando`,
            action: { label: "Ver pedidos", section: "orders_active" },
          });
        });

        socket.on("disconnect", () => {});
      } catch {}
    };

    connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?.role]);

  const unreadCount = notifs.filter((n) => !n.read).length;

  return { notifs, unreadCount, markRead, markAllRead, clear };
}

// Para disparar notificaciones desde fuera del hook (ej: polling)
export function pushAdminNotif(
  n: Omit<AdminNotif, "id" | "timestamp" | "read">,
) {
  _addNotif?.(n);
}
