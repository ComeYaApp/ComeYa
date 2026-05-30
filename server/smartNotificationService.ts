import { db } from "./db";
import { users, orders } from "@shared/schema-mysql";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

interface SmartNotificationTarget {
  userSegment?: "new" | "active" | "inactive" | "vip";
  lastOrderDays?: number;
  minOrders?: number;
  maxOrders?: number;
}

export class SmartNotificationService {
  // Segmentar usuarios
  static async segmentUsers(
    target: SmartNotificationTarget,
  ): Promise<string[]> {
    const now = new Date();
    const userIds: string[] = [];

    if (target.userSegment === "new") {
      // Usuarios registrados en los últimos 7 días sin pedidos
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(gte(users.createdAt, sevenDaysAgo), eq(users.role, "customer")),
        );

      for (const user of newUsers) {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.userId, user.id))
          .limit(1);

        if (!order) {
          userIds.push(user.id);
        }
      }
    } else if (target.userSegment === "inactive") {
      // Usuarios sin pedidos en los últimos 30 días
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "customer"));

      for (const user of allUsers) {
        const [lastOrder] = await db
          .select()
          .from(orders)
          .where(eq(orders.userId, user.id))
          .orderBy(desc(orders.createdAt))
          .limit(1);

        if (lastOrder && lastOrder.createdAt < thirtyDaysAgo) {
          userIds.push(user.id);
        }
      }
    } else if (target.userSegment === "active") {
      // Usuarios con pedidos en los últimos 7 días
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentOrders = await db
        .select({ userId: orders.userId })
        .from(orders)
        .where(gte(orders.createdAt, sevenDaysAgo))
        .groupBy(orders.userId);

      userIds.push(...recentOrders.map((o) => o.userId));
    } else if (target.userSegment === "vip") {
      // Usuarios con más de 10 pedidos
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "customer"));

      for (const user of allUsers) {
        const orderCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(eq(orders.userId, user.id));

        if (orderCount[0].count >= 10) {
          userIds.push(user.id);
        }
      }
    }

    return [...new Set(userIds)]; // Eliminar duplicados
  }

  // Enviar notificación de reactivación
  static async sendReactivationNotification() {
    const inactiveUsers = await this.segmentUsers({ userSegment: "inactive" });

    let sent = 0;
    for (const userId of inactiveUsers) {
      try {
        await sendPushToUser(userId, {
          title: "¡Te extrañamos! 😊",
          body: "Vuelve y disfruta de un 15% de descuento en tu próximo pedido",
          data: { screen: "Home", coupon: "COMEBACK15" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }

    return { success: true, sent, total: inactiveUsers.length };
  }

  // Enviar notificación de promoción
  static async sendPromotionNotification(
    title: string,
    body: string,
    target: SmartNotificationTarget,
    deepLink?: string,
  ) {
    const targetUsers = await this.segmentUsers(target);

    let sent = 0;
    for (const userId of targetUsers) {
      try {
        await sendPushToUser(userId, {
          title,
          body,
          data: { screen: deepLink || "Home", type: "promotion" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }

    return { success: true, sent, total: targetUsers.length };
  }

  // Enviar recordatorio inteligente (hora del almuerzo/cena)
  static async sendMealTimeReminder() {
    const hour = new Date().getHours();
    let message = "";
    let targetSegment: "active" | "vip" = "active";

    if (hour >= 12 && hour <= 14) {
      message =
        "¿Hambre? 🍽️ Es hora del almuerzo. Pide ahora y recibe en 30 min";
    } else if (hour >= 19 && hour <= 21) {
      message = "🌙 Hora de la cena. Tu restaurante favorito está abierto";
      targetSegment = "vip";
    } else {
      return { success: false, message: "No es hora de comida" };
    }

    const targetUsers = await this.segmentUsers({ userSegment: targetSegment });

    let sent = 0;
    for (const userId of targetUsers) {
      try {
        await sendPushToUser(userId, {
          title: message,
          body: "Explora negocios cerca de ti",
          data: { screen: "Home", type: "reminder" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }

    return { success: true, sent, total: targetUsers.length };
  }

  // Enviar notificación de nuevo negocio
  static async sendNewBusinessNotification(
    businessId: string,
    businessName: string,
  ) {
    const activeUsers = await this.segmentUsers({ userSegment: "active" });

    let sent = 0;
    for (const userId of activeUsers) {
      try {
        await sendPushToUser(userId, {
          title: `🎉 Nuevo: ${businessName}`,
          body: "Descubre el nuevo restaurante en tu zona",
          data: { screen: "BusinessDetail", businessId, type: "new_business" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }

    return { success: true, sent, total: activeUsers.length };
  }

  // Enviar notificación personalizada basada en favoritos
  static async sendFavoriteBusinessPromotion(
    businessId: string,
    promotion: string,
  ) {
    // Buscar usuarios que tienen este negocio en favoritos
    const { userFavorites } = await import("@shared/schema-mysql");

    const favorites = await db
      .select()
      .from(userFavorites)
      .where(
        and(
          eq(userFavorites.itemType, "business"),
          eq(userFavorites.itemId, businessId),
        ),
      );

    let sent = 0;
    for (const fav of favorites) {
      try {
        await sendPushToUser(fav.userId, {
          title: "💝 Oferta en tu favorito",
          body: promotion,
          data: {
            screen: "BusinessDetail",
            businessId,
            type: "favorite_promo",
          },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${fav.userId}:`, error);
      }
    }

    return { success: true, sent, total: favorites.length };
  }
}
