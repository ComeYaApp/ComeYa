import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 WebSocket connected: ${socket.id}`);

    // Join room por rol
    socket.on('join', (data: { userId: string; role: string; businessId?: string }) => {
      socket.join(`user:${data.userId}`);
      if (data.role === 'business_owner' && data.businessId) {
        socket.join(`business:${data.businessId}`);
        logger.info(`👔 Business ${data.businessId} joined room`);
      }
      if (data.role === 'delivery_driver') {
        socket.join('drivers');
        logger.info(`🚗 Driver ${data.userId} joined drivers room`);
      }
      if (data.role === 'admin') {
        socket.join('admins');
        logger.info(`👨‍💼 Admin ${data.userId} joined admins room`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 WebSocket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('WebSocket not initialized');
  return io;
}

// Eventos específicos
export function notifyNewOrder(businessId: string, order: any) {
  if (!io) return;
  io.to(`business:${businessId}`).emit('new_order', order);
  io.to('admins').emit('new_order', order);
  logger.info(`📦 New order notification sent to business ${businessId}`);
}

export function notifyOrderStatusChange(userId: string, orderId: string, status: string) {
  if (!io) return;
  io.to(`user:${userId}`).emit('order_status_changed', { orderId, status });
}

export function notifyDriverAssigned(driverId: string, order: any) {
  if (!io) return;
  io.to(`user:${driverId}`).emit('order_assigned', order);
}

export function notifyPaymentVerified(businessId: string, orderId: string) {
  if (!io) return;
  io.to(`business:${businessId}`).emit('payment_verified', { orderId });
}

// ── Admin-specific events ─────────────────────────────────────────────────────

export function notifyAdminFraud(data: { userId: string; userName?: string; proofId: string; reason: string }) {
  if (!io) return;
  io.to('admins').emit('admin_fraud_detected', { ...data, timestamp: new Date().toISOString() });
  logger.warn(`🚨 Fraud alert sent to admins: ${data.reason}`);
}

export function notifyAdminNewProof(data: { proofId: string; orderId: string; userName: string; amount: number; method: string }) {
  if (!io) return;
  io.to('admins').emit('admin_new_proof', { ...data, timestamp: new Date().toISOString() });
}

export function notifyAdminNewPayout(data: { payoutId: string; recipientName: string; amount: number; recipientType: string }) {
  if (!io) return;
  io.to('admins').emit('admin_new_payout', { ...data, timestamp: new Date().toISOString() });
}

export function notifyAdminNewTicket(data: { ticketId: string; userName: string; subject: string; priority: string }) {
  if (!io) return;
  io.to('admins').emit('admin_new_ticket', { ...data, timestamp: new Date().toISOString() });
}

export function notifyAdminOrderStuck(data: { orderId: string; businessName: string; minutesWaiting: number }) {
  if (!io) return;
  io.to('admins').emit('admin_order_stuck', { ...data, timestamp: new Date().toISOString() });
}

export function notifyAdmins(data: { type: string; [key: string]: any }) {
  if (!io) return;
  io.to('admins').emit('admin_notification', { ...data, timestamp: new Date().toISOString() });
}
