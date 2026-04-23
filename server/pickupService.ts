import { eq } from "drizzle-orm";
import { db } from "./db";
import { orders } from "@shared/schema-mysql";
import { sendPushToUser } from "./enhancedPushService";

// Generar código de 6 dígitos único
function generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generar QR code data (JSON string)
function generateQRData(orderId: string, pickupCode: string): string {
  return JSON.stringify({
    orderId,
    pickupCode,
    timestamp: Date.now(),
    type: "pickup",
  });
}

export const pickupService = {
  // Crear pedido pickup con código
  async createPickupOrder(orderId: string, estimatedMinutes: number) {
    const pickupCode = generatePickupCode();
    const qrData = generateQRData(orderId, pickupCode);

    await db.update(orders).set({
      pickupCode,
      pickupQrCode: qrData,
      estimatedPickupTime: estimatedMinutes,
    }).where(eq(orders.id, orderId));

    return { pickupCode, qrData };
  },

  // Calcular tiempo restante
  getTimeRemaining(order: any): number | null {
    if (!order.estimatedPickupTime || !order.createdAt) return null;
    
    const createdAt = new Date(order.createdAt).getTime();
    const now = Date.now();
    const estimatedMs = order.estimatedPickupTime * 60 * 1000;
    const elapsed = now - createdAt;
    const remaining = Math.max(0, estimatedMs - elapsed);
    
    return Math.ceil(remaining / 60000); // minutos
  },

  // Calcular progreso (0-100)
  getProgress(order: any): number {
    if (!order.estimatedPickupTime || !order.createdAt) return 0;
    
    const createdAt = new Date(order.createdAt).getTime();
    const now = Date.now();
    const estimatedMs = order.estimatedPickupTime * 60 * 1000;
    const elapsed = now - createdAt;
    
    return Math.min(100, Math.round((elapsed / estimatedMs) * 100));
  },

  // Enviar notificación según progreso
  async sendProgressNotification(orderId: string, userId: string, progress: number) {
    let title = "";
    let body = "";

    if (progress >= 25 && progress < 30) {
      // 25% - Preparación iniciada
      title = "🍳 Preparando tu pedido";
      body = "Tu pedido está en preparación. Quedan aprox. 15 min";
    } else if (progress >= 50 && progress < 55) {
      // 50% - Mitad del camino
      title = "⏱️ A mitad de camino";
      body = "Tu pedido va por la mitad. Quedan aprox. 10 min";
    } else if (progress >= 75 && progress < 80) {
      // 75% - Casi listo
      title = "🔥 ¡Casi listo!";
      body = "Tu pedido está casi listo. Quedan aprox. 5 min";
    } else {
      return; // No enviar notificación
    }

    await sendPushToUser(userId, {
      title,
      body,
      data: { orderId, screen: "OrderTracking" },
    });
  },

  // Marcar como listo para recoger
  async markReadyForPickup(orderId: string, userId: string) {
    await db.update(orders).set({
      status: "ready",
      pickupReadyAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Notificación al cliente
    await sendPushToUser(userId, {
      title: "✅ ¡Tu pedido está listo!",
      body: "Puedes venir a recogerlo cuando quieras",
      data: { orderId, screen: "OrderTracking" },
      sound: "default",
      priority: "high",
    });
  },

  // Cliente avisa que llegó
  async customerArrived(orderId: string, businessOwnerId: string) {
    await db.update(orders).set({
      customerArrivedAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Notificar al negocio
    await sendPushToUser(businessOwnerId, {
      title: "🚶 Cliente en el local",
      body: `El cliente llegó a recoger el pedido #${orderId.slice(-6)}`,
      data: { orderId, screen: "BusinessOrders" },
    });
  },

  // Validar código de pickup
  async validatePickupCode(orderId: string, code: string): Promise<boolean> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return order?.pickupCode === code;
  },

  // Obtener estadísticas de tiempos por negocio
  async getBusinessAverageTime(businessId: string): Promise<number> {
    const result = await db.select().from(orders).where(
      eq(orders.businessId, businessId)
    );

    const pickupOrders = result.filter(o => 
      o.orderType === "pickup" && 
      o.pickupReadyAt && 
      o.createdAt
    );

    if (pickupOrders.length === 0) return 20; // Default 20 min

    const totalMinutes = pickupOrders.reduce((sum, order) => {
      const created = new Date(order.createdAt!).getTime();
      const ready = new Date(order.pickupReadyAt!).getTime();
      return sum + ((ready - created) / 60000);
    }, 0);

    return Math.round(totalMinutes / pickupOrders.length);
  },

  // Contar pedidos pendientes del negocio (zona de espera)
  async getPendingOrdersCount(businessId: string, beforeOrderId: string): Promise<number> {
    const allOrders = await db.select().from(orders).where(
      eq(orders.businessId, businessId)
    );

    const targetOrder = allOrders.find(o => o.id === beforeOrderId);
    if (!targetOrder) return 0;

    const targetCreatedAt = new Date(targetOrder.createdAt!).getTime();

    return allOrders.filter(o => 
      o.orderType === "pickup" &&
      ["accepted", "preparing"].includes(o.status) &&
      new Date(o.createdAt!).getTime() < targetCreatedAt
    ).length;
  },
};
