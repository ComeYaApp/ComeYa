import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

interface SocketUser {
  id: string;
  role: string;
}

// Decodifica el JWT del handshake (auth.token) — el mismo secreto que el middleware HTTP.
// El rol NO se confía del token (los access tokens antiguos no lo llevan):
// se consulta en BD, igual que authenticateToken. Sin esto los admins llegaban
// como "customer" y nunca entraban a la room "admins" (sin notificaciones ni
// posiciones en vivo).
async function decodeSocketUser(socket: any): Promise<SocketUser | null> {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "comeya_local_secret_key",
    ) as any;
    if (!decoded?.id) return null;

    let role: string | null = decoded.role || null;
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema-mysql");
      const { eq } = await import("drizzle-orm");
      const [row] = (await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, decoded.id))
        .limit(1)) as any[];
      if (row?.role) role = row.role;
    } catch {
      // si la BD no responde, se cae al rol del token (o customer)
    }

    const normalized =
      role === "delivery" || role === "driver"
        ? "delivery_driver"
        : role === "business"
          ? "business_owner"
          : role;
    return { id: decoded.id, role: normalized || "customer" };
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

    // Autenticación por JWT en el handshake + rol fresco desde BD. Se guarda
    // como promesa y los handlers la esperan: si se asignara tras un await,
    // un "join" rápido del cliente llegaría antes de resolverse el rol.
    const userReady = decodeSocketUser(socket);
    userReady
      .then((u) => {
        socket.data.user = u;
      })
      .catch(() => {});

    // Unirse a una room de pedido para tracking en vivo (validado por rol)
    socket.on("join_order", async (data: { orderId: string }) => {
      const user: SocketUser | null = await userReady;
      if (!user || !data?.orderId) return;
      if (await canJoinOrderRoom(user, data.orderId)) {
        socket.join(`order:${data.orderId}`);
        logger.info(`📍 User ${user.id} joined order:${data.orderId}`);
      }
    });

    // Join room por rol (compatibilidad con clientes existentes)
    socket.on(
      "join",
      async (data: { userId: string; role: string; businessId?: string }) => {
        // Si hay token válido, la identidad del token manda sobre el payload
        const user: SocketUser | null = await userReady;
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

  // Aviso del admin: historial + socket + push (app cerrada) en un solo paso
  (async () => {
    try {
      const { recordAdminNotification } = await import(
        "./adminNotificationService"
      );
      await recordAdminNotification({
        type: "new_order",
        severity: "medium",
        title: "📦 Nuevo pedido",
        body: `${order?.businessName ?? "Negocio"} · ${((order?.total ?? 0) / 100).toFixed(2)} €`,
        section: "orders_active",
        data: { orderId: order?.id },
        entityKey: order?.id ? `order:${order.id}` : undefined,
      });
    } catch (e) {
      console.error("notifyNewOrder admin notification error:", e);
    }
  })();
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
// Todos pasan por recordAdminNotification (historial en BD + socket + push).
// El socket emite el evento unificado "admin_notification": el panel web/nativo
// escucha solo ese canal y el servidor es la única fuente de los avisos.

export function notifyAdminFraud(data: {
  userId: string;
  userName?: string;
  proofId: string;
  reason: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "fraud",
      severity: "critical",
      title: "🚨 Fraude detectado",
      body: `${data.userName ?? "Usuario"}: ${data.reason}`,
      section: "finance_proofs",
      data,
      entityKey: `fraud:${data.proofId}`,
    });
    logger.warn(`🚨 Fraud alert sent to admins: ${data.reason}`);
  })().catch(() => {});
}

export function notifyAdminNewProof(data: {
  proofId: string;
  orderId: string;
  userName: string;
  amount: number;
  method: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "new_proof",
      severity: "high",
      title: "⚠️ Comprobante pendiente",
      body: `${data.userName} envió ${(data.amount / 100).toFixed(2)} € vía ${data.method}`,
      section: "finance_proofs",
      data,
      entityKey: `proof:${data.proofId}`,
    });
  })().catch(() => {});
}

// Comprobante de pago de tarifas de reservas pendiente de verificar
export function notifyAdminNewFeeProof(data: {
  proofId: string;
  ownerName: string;
  amount: number;
  method: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "new_fee_proof",
      severity: "high",
      title: "💳 Tarifas de reservas pendientes",
      body: `${data.ownerName} pagó ${(data.amount / 100).toFixed(2)} € vía ${data.method} · verificar comprobante`,
      section: "finance_reservations",
      data,
      entityKey: `feeproof:${data.proofId}`,
    });
  })().catch(() => {});
}

export function notifyAdminNewPayout(data: {
  payoutId: string;
  recipientName: string;
  amount: number;
  recipientType: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "new_payout",
      severity: "high",
      title: "💸 Payout pendiente",
      body: `${data.recipientName} (${data.recipientType === "business" ? "Negocio" : "Repartidor"}) · ${(data.amount / 100).toFixed(2)} €`,
      section: "finance_payouts",
      data,
      entityKey: `payout:${data.payoutId}`,
    });
  })().catch(() => {});
}

export function notifyAdminNewTicket(data: {
  ticketId: string;
  userName: string;
  subject: string;
  priority: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "new_ticket",
      severity: "medium",
      title: "🎫 Nuevo ticket de soporte",
      body: `${data.userName}: ${data.subject}`,
      section: "support_tickets",
      data,
      entityKey: `ticket:${data.ticketId}`,
    });
  })().catch(() => {});
}

export function notifyAdminNewIssue(data: {
  issueId: string;
  orderId: string;
  issueType: string;
  priority: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    const severity = data.priority === "high" ? "critical" : "high";
    await recordAdminNotification({
      type: "new_issue",
      severity: severity as any,
      title: "⚠️ Incidencia en un pedido",
      body: `Incidencia (${data.issueType}) en el pedido #${(data.orderId ?? "").slice(-6).toUpperCase()}`,
      section: "support_issues",
      data,
      entityKey: `issue:${data.issueId}`,
    });
  })().catch(() => {});
}

// Aviso de pedido atascado: el socket "admin_order_stuck" refresca el centro
// de operaciones; el aviso persistente lo crea el reconciliador de alertas
// (backgroundJobs) con dedupe por pedido.
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

// Emisión directa a la sala admins (uso interno del servicio de avisos)
export function notifyAdmins(data: { type: string; [key: string]: any }) {
  if (!io) return;
  io.to("admins").emit("admin_notification", {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// Nueva suscripción activada (pago verificado) — el admin debe verlo al momento
export function notifyAdminNewSubscription(sub: {
  id: string;
  userId: string;
  plan: string;
}) {
  (async () => {
    const { recordAdminNotification } = await import(
      "./adminNotificationService"
    );
    await recordAdminNotification({
      type: "new_subscription",
      severity: "medium",
      title: "⭐ Nueva suscripción",
      body: `Plan ${sub.plan ?? "Premium"} activado`,
      section: "premiums",
      data: sub,
      entityKey: `sub:${sub.id}`,
    });
  })().catch(() => {});
}
