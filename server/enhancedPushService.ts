import { db } from "./db";
import { users, orders, deliveryDrivers } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendOrderStatusNotification(
  orderId: string,
  userId: string,
  newStatus: string,
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.pushToken) return;

  let notification: NotificationPayload | null = null;

  switch (newStatus) {
    case "accepted":
      notification = {
        title: "¡Pedido aceptado! 🎉",
        // estimatedPrepMinutes es la columna real del schema (minutos estimados)
        body: `${order.businessName} aceptó tu pedido - Listo en ${(order as any).estimatedPrepMinutes || 25} min`,
        data: { orderId, screen: "OrderTracking" },
      };
      break;

    case "preparing":
      notification = {
        title: "Preparando tu pedido 👨‍🍳",
        body: `${order.businessName} está preparando tu pedido`,
        data: { orderId, screen: "OrderTracking" },
      };
      break;

    case "ready":
      notification = {
        title: "Tu pedido está listo 📦",
        body: "Esperando a que un repartidor lo recoja",
        data: { orderId, screen: "OrderTracking" },
      };
      break;

    case "assigned_driver":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.deliveryPersonId))
          .limit(1);

        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        notification = {
          title: `${driverName} fue asignado 🚗`,
          body: "Pronto recogerá tu pedido",
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;

    case "picked_up":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.deliveryPersonId))
          .limit(1);

        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        const eta = order.estimatedDeliveryTime || 15;
        notification = {
          title: `${driverName} va en camino 🚗`,
          body: `Llega en ${eta} min`,
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;

    case "arriving":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.deliveryPersonId))
          .limit(1);

        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        notification = {
          title: `${driverName} está cerca ⚡`,
          body: "Llega en 2 minutos",
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;

    case "delivered":
      notification = {
        title: "¡Pedido entregado! 🎉",
        body: "¡Disfruta tu comida! Confirma la entrega para liberar el pago",
        data: { orderId, screen: "DeliveryConfirmation" },
      };
      break;

    case "cancelled":
      notification = {
        title: "Pedido cancelado",
        body: "Tu pedido ha sido cancelado",
        data: { orderId, screen: "OrderDetails" },
      };
      break;
  }

  if (notification) {
    await sendPushNotification(user.pushToken, notification);
  }
}

// Envía un push real a un token de Expo (https://exp.host API v2)
export async function sendPushNotification(
  pushToken: string,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const message = {
      to: pushToken,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    // Limpiar tokens muertos (app desinstalada / reinstalada)
    if (response.ok) {
      try {
        const result = (await response.json()) as { data?: { status?: string; details?: any } };
        const status = result?.data?.status;
        if (status && status !== "ok") {
          const reason = result?.data?.details?.error;
          if (status === "error" && (reason === "DeviceNotRegistered" || reason === "InvalidCredentials")) {
            await db.update(users).set({ pushToken: null }).where(eq(users.pushToken, pushToken));
            console.log(`🗑️ Push token inválido eliminado (${reason})`);
          } else {
            console.error(`Push error status=${status}:`, JSON.stringify(result?.data?.details ?? {}));
          }
        }
      } catch {
        // respuesta no-JSON de Expo, ignorar
      }
    } else {
      console.error(`Expo push HTTP ${response.status}`);
    }

    console.log(`📱 Push notification sent: ${payload.title}`);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

export async function notifyPagoMovilStatus(
  userId: string,
  status: "verified" | "rejected",
  orderId: string,
  reason?: string,
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || !user.pushToken) return;

  const notification =
    status === "verified"
      ? {
          title: "✅ Pago verificado",
          body: "Tu pago fue confirmado. Tu pedido está siendo procesado.",
          data: { orderId, screen: "OrderTracking" },
        }
      : {
          title: "❌ Pago rechazado",
          body:
            reason ||
            "Tu comprobante fue rechazado. Por favor verifica los datos.",
          data: { orderId, screen: "PaymentProofUpload" },
        };

  await sendPushNotification(user.pushToken, notification);
}

const DEFAULT_NOTIFICATION_PREFERENCES = {
  promotions: true,
  news: true,
};

function parseNotificationPreferences(raw: string | null | undefined) {
  if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const parsed = JSON.parse(raw);
    return {
      promotions:
        typeof parsed.promotions === "boolean"
          ? parsed.promotions
          : DEFAULT_NOTIFICATION_PREFERENCES.promotions,
      news:
        typeof parsed.news === "boolean"
          ? parsed.news
          : DEFAULT_NOTIFICATION_PREFERENCES.news,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    /** "orders" (operativos, siempre se envían) | "promotions" | "news" */
    category?: "orders" | "promotions" | "news";
  },
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.pushToken) return;

  // Respetar preferencias del usuario para categorías no operativas
  if (payload.category === "promotions" || payload.category === "news") {
    const prefs = parseNotificationPreferences(user.notificationPreferences);
    if (!prefs[payload.category]) return;
  }

  await sendPushNotification(user.pushToken, payload);
}

export async function notifyDriverNewOrder(
  driverId: string,
  orderId: string,
): Promise<void> {
  const [driver] = await db
    .select()
    .from(users)
    .where(eq(users.id, driverId))
    .limit(1);

  if (!driver || !driver.pushToken) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const earning = Math.round((order.total * 0.15) / 100);

  await sendPushNotification(driver.pushToken, {
    title: "Nuevo pedido disponible 📦",
    body: `${order.businessName} - Gana $${earning}`,
    data: { orderId, screen: "DriverAvailable" },
  });
}
