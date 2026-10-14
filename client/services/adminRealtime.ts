// Conexión socket ÚNICA del panel admin, compartida por todos los
// componentes que necesitan eventos en vivo (campana de avisos, centro de
// operaciones, mapa). Antes cada hook abría su propia conexión a la sala
// "admins" (campana + mapa + mapa embebido = 3 sockets).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/api";

type Handler = (payload: any) => void;

const EVENTS = [
  // Aviso unificado del centro de avisos (servidor → historial + push)
  "admin_notification",
  // Operación en vivo
  "new_order",
  "order_status_changed",
  "admin_order_stuck",
  "driver_location",
] as const;

let socket: any = null;
let connecting: Promise<any> | null = null;
const listeners = new Map<string, Set<Handler>>();
let connected = false;
const connectionListeners = new Set<(ok: boolean) => void>();

function dispatch(event: string, payload: any) {
  const subs = listeners.get(event);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(payload);
    } catch (e) {
      console.error(`adminRealtime listener error (${event}):`, e);
    }
  }
}

async function ensureSocket(): Promise<any> {
  if (socket) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const { io } = await import("socket.io-client");
      const token = await AsyncStorage.getItem("token");
      if (!token) return null;

      socket = io(getApiBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
      });

      for (const ev of EVENTS) {
        socket.on(ev, (payload: any) => dispatch(ev, payload));
      }

      socket.on("connect", () => {
        connected = true;
        // El servidor resuelve el rol desde BD con el token
        socket.emit("join", { userId: "", role: "" });
        connectionListeners.forEach((cb) => cb(true));
      });
      socket.on("disconnect", () => {
        connected = false;
        connectionListeners.forEach((cb) => cb(false));
      });
      socket.on("connect_error", () => {
        connected = false;
        connectionListeners.forEach((cb) => cb(false));
      });

      return socket;
    } catch (e) {
      console.error("adminRealtime connect error:", e);
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/** Suscribirse a un evento del admin. Devuelve la función para desuscribirse. */
export function onAdminRealtimeEvent(event: string, cb: Handler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);
  void ensureSocket();
  return () => {
    listeners.get(event)?.delete(cb);
  };
}

/** Suscribirse al estado de la conexión */
export function onAdminRealtimeConnection(
  cb: (connected: boolean) => void,
): () => void {
  connectionListeners.add(cb);
  cb(connected);
  void ensureSocket();
  return () => {
    connectionListeners.delete(cb);
  };
}

export function isAdminRealtimeConnected(): boolean {
  return connected;
}
