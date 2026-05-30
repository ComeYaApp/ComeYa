import cron from "node-cron";
import { db } from "./db";
import { orders } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { pickupService } from "./pickupService";

// Mapa para trackear qué notificaciones ya se enviaron
const sentNotifications = new Map<string, Set<number>>();

export function startPickupNotificationCron() {
  // Cada 5 minutos
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("🔔 Running pickup notification cron...");

      const activeOrders = await db.select().from(orders);

      for (const order of activeOrders) {
        // Solo pedidos pickup activos
        if (
          order.orderType !== "pickup" ||
          !["accepted", "preparing"].includes(order.status)
        ) {
          continue;
        }

        const progress = pickupService.getProgress(order);

        // Inicializar set de notificaciones enviadas para esta orden
        if (!sentNotifications.has(order.id)) {
          sentNotifications.set(order.id, new Set());
        }

        const sent = sentNotifications.get(order.id)!;

        // Enviar notificación según progreso (solo una vez por hito)
        if (progress >= 25 && progress < 30 && !sent.has(25)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            25,
          );
          sent.add(25);
          console.log(
            `📲 Sent 25% notification for order ${order.id.slice(-6)}`,
          );
        } else if (progress >= 50 && progress < 55 && !sent.has(50)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            50,
          );
          sent.add(50);
          console.log(
            `📲 Sent 50% notification for order ${order.id.slice(-6)}`,
          );
        } else if (progress >= 75 && progress < 80 && !sent.has(75)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            75,
          );
          sent.add(75);
          console.log(
            `📲 Sent 75% notification for order ${order.id.slice(-6)}`,
          );
        }
      }

      // Limpiar notificaciones de órdenes completadas (más de 2 horas)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      for (const [orderId, _] of sentNotifications.entries()) {
        const order = activeOrders.find((o) => o.id === orderId);
        if (!order || new Date(order.createdAt!).getTime() < twoHoursAgo) {
          sentNotifications.delete(orderId);
        }
      }
    } catch (error) {
      console.error("❌ Pickup notification cron error:", error);
    }
  });

  console.log("✅ Pickup notification cron started (every 5 minutes)");
}
