import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

interface SocketUser {
  id: string;
  role: string;
}

// Decodifica el JWT del handshake (auth.token) — el mismo secreto que el middleware HTTP
function decodeSocketUser(socket: any): SocketUser | null {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "comeya_local_secret_key",
    ) as any;
    if (!decoded?.id) return null;
    return { id: decoded.id, role: decoded.role || "customer" };
  } catch {
    return null;
  }
}

// Comprueba que el usuario puede ver la ubicación de este pedido
async function canJoinOrderRoom(user: SocketUser, orderId: string): Promise<boolean> {
  try {
    const { db } = await import("./db");
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { eq } = await import("drizzle-orm");

    const [order] = await db
      .select({
        userId: orders.userId,
        deliveryPersonId: orders.deliveryPersonId,
        businessId: orders.businessId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return false;
    if (user.role === "admin" || user.role === "super_admin") return true;
    if (order.userId === user.id || order.deliveryPersonId === user.id) {
      return true;
    }
    if (order.businessId) {
      const [biz] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      if (biz?.ownerId === user.id) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info(`🔌 WebSocket connected: ${socket.id}`);

    // Autenticación por JWT en el handshake
    socket.data.user = decodeSocketUser(socket);

    // Unirse a una room de pedido para tracking en vivo (validado por rol)
    socket.on("join_order", async (data: { orderId: string }) => {
      const user: SocketUser | null = socket.data.user;
      if (!user || !data?.orderId) return;
      if (await canJoinOrderRoom(user, data.orderId)) {
        socket.join(`order:${data.orderId}`);
        logger.info(`📍 User ${user.id} joined order:${data.orderId}`);
      }
    });

    // Join room por rol (compatibilidad con clientes existentes)
    socket.on(
      "join",
      (data: { userId: string; role: string; businessId?: string }) => {
        // Si hay token válido, la identidad del token manda sobre el payload
        const user: SocketUser | null = socket.data.user;
        const userId = user?.id || data.userId;
        const role = user?.role || data.role;

        socket.join(`user:${userId}`);
        if (role === "business_owner" && data.businessId) {
          socket.join(`business:${data.businessId}`);
          logger.info(`👔 Business ${data.businessId} joined room`);
        }
        if (role === "delivery_driver") {
          socket.join("drivers");
          logger.info(`🚗 Driver ${userId} joined drivers room`);
        }
        // La room de admins expone datos sensibles (fraude, comprobantes,
        // pedidos globales): exige token JWT verificado, no el payload del
        // cliente. Antes cualquiera podía emitir join con role:"admin".
        if (
          (user?.role === "admin" || user?.role === "super_admin") &&
          user?.id
        ) {
          socket.join("admins");
          logger.info(`👨‍💼 Admin ${user.id} joined admins room`);
        } else if (role === "admin" || role === "super_admin") {
          logger.security("Intento de join a admins sin token válido", {
            socketId: socket.id,
            claimedUserId: data.userId,
          });
        }
      },
    );

    socket.on("disconnect", () => {
      logger.info(`🔌 WebSocket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("WebSocket not initialized");
  return io;
}

// Eventos específicos
export function notifyNewOrder(businessId: string, order: any) {
  if (!io) return;
  io.to(`business:${businessId}`).emit("new_order", order);
  io.to("admins").emit("new_order", order);
  logger.info(`📦 New order notification sent to business ${businessId}`);
}

export function notifyOrderStatusChange(
  userId: string,
  orderId: string,
  status: string,
) {
  if (!io) return;
  io.to(`user:${userId}`).emit("order_status_changed", { orderId, status });
}

export function notifyDriverAssigned(driverId: string, order: any) {
  if (!io) return;
  io.to(`user:${driverId}`).emit("order_assigned", order);
}

export function notifyPaymentVerified(businessId: string, orderId: string) {
  if (!io) return;
  io.to(`business:${businessId}`).emit("payment_verified", { orderId });
}

export function notifyNewReservation(businessId: string, reservation: any) {
  if (!io) return;
  io.to(`business:${businessId}`).emit("new_reservation", reservation);
}

export function notifyReservationStatusChange(
  userId: string,
  reservation: any,
) {
  if (!io) return;
  io.to(`user:${userId}`).emit("reservation_status_changed", reservation);
}

// ── Admin-specific events ─────────────────────────────────────────────────────

export function notifyAdminFraud(data: {
  userId: string;
  userName?: string;
  proofId: string;
  reason: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_fraud_detected", {
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.warn(`🚨 Fraud alert sent to admins: ${data.reason}`);
}

export function notifyAdminNewProof(data: {
  proofId: string;
  orderId: string;
  userName: string;
  amount: number;
  method: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_new_proof", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Comprobante de pago de tarifas de reservas pendiente de verificar
export function notifyAdminNewFeeProof(data: {
  proofId: string;
  ownerName: string;
  amount: number;
  method: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_new_fee_proof", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAdminNewPayout(data: {
  payoutId: string;
  recipientName: string;
  amount: number;
  recipientType: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_new_payout", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAdminNewTicket(data: {
  ticketId: string;
  userName: string;
  subject: string;
  priority: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_new_ticket", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAdminNewIssue(data: {
  issueId: string;
  orderId: string;
  issueType: string;
  priority: string;
}) {
  if (!io) return;
  io.to("admins").emit("admin_new_issue", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAdminOrderStuck(data: {
  orderId: string;
  businessName: string;
  minutesWaiting: number;
}) {
  if (!io) return;
  io.to("admins").emit("admin_order_stuck", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAdmins(data: { type: string; [key: string]: any }) {
  if (!io) return;
  io.to("admins").emit("admin_notification", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}
