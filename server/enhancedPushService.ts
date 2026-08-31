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
      // Recogida en local: el cliente ES quien va a buscar el pedido
      if ((order as any).orderType === "pickup") {
        notification = {
          title: "YA PUEDES RECOGER TU PEDIDO",
          body: `${order.businessName} te espera — muestra tu código QR al llegar`,
          data: { orderId, screen: "OrderTracking" },
        };
      } else {
        notification = {
          title: "Tu pedido está listo 📦",
          body: "Esperando a que un repartidor lo recoja",
          data: { orderId, screen: "OrderTracking" },
        };
      }
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
          title: `${driverName} recogió tu pedido 📦`,
          body: `Llega en ${eta} min`,
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;

    case "on_the_way":
    case "in_transit":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.deliveryPersonId))
          .limit(1);

        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        notification = {
          title: `${driverName} va en camino 🚗`,
          body: "Tu pedido está de camino a tu puerta",
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

// ── Envío push a Expo ──────────────────────────────────────────────────────
// La app vive ahora en el proyecto EAS de la ORGANIZACIÓN: los tokens nuevos
// pertenecen a ese proyecto y se envían por la API nueva de Expo con token de
// acceso (EXPO_ACCESS_TOKEN). Los tokens de builds antiguos (proyecto
// personal) siguen vivos y se atienden con el endpoint legacy como respaldo.
const NEW_PUSH_API = "https://api.expo.dev/v2/push/send";
const LEGACY_PUSH_API = "https://exp.host/--/api/v2/push/send";

interface PushSendResult {
  ok: boolean;
  status?: string;
  reason?: string;
  details?: Record<string, any>;
}

async function sendViaNewApi(message: any): Promise<PushSendResult> {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, reason: "no-access-token" };
  try {
    const response = await fetch(NEW_PUSH_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: `http-${response.status}`,
        details: { body: await response.text().catch(() => "") },
      };
    }
    const result = (await response.json()) as any;
    const item = result?.data?.[0];
    const status = item?.status;
    return {
      ok: status === "ok",
      status,
      reason: item?.details?.error || item?.message || undefined,
      details: item?.details ?? {},
    };
  } catch (error: any) {
    return { ok: false, reason: error?.message ?? "fetch-error" };
  }
}

async function sendViaLegacyApi(message: any): Promise<PushSendResult> {
  try {
    const response = await fetch(LEGACY_PUSH_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: `http-${response.status}`,
        details: { body: await response.text().catch(() => "") },
      };
    }
    const result = (await response.json()) as {
      data?: { status?: string; message?: string; details?: any };
    };
    const status = result?.data?.status;
    return {
      ok: status === "ok",
      status,
      reason: result?.data?.details?.error || result?.data?.message || undefined,
      details: result?.data?.details ?? {},
    };
  } catch (error: any) {
    return { ok: false, reason: error?.message ?? "fetch-error" };
  }
}

// Envía un push real a un token de Expo: API nueva (organización) con
// respaldo automático en la legacy para los tokens del proyecto personal.
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

    let result = await sendViaNewApi(message);
    if (!result.ok) {
      if (result.reason !== "no-access-token") {
        console.warn(
          `⚠️ Push API nueva falló (${result.reason}): reintento por endpoint legacy — ${payload.title}`,
        );
      }
      result = await sendViaLegacyApi(message);
    }

    if (result.ok) {
      // Solo aquí el envío quedó confirmado por Expo
      console.log(`📱 Push entregado a Expo: ${payload.title}`);
      return;
    }

    const reason = result.reason;
    if (reason === "DeviceNotRegistered") {
      await db
        .update(users)
        .set({ pushToken: null })
        .where(eq(users.pushToken, pushToken));
      console.log(`🗑️ Push token inválido eliminado (${reason})`);
    } else if (reason === "InvalidCredentials") {
      // Fallo de credenciales APNs/FCM del proyecto en Expo, no del
      // dispositivo: borrar el token dejaría al usuario sin push para siempre
      console.error(
        "🚨 Push InvalidCredentials: revisa las credenciales push (Apple Push Key / FCM v1) del proyecto en expo.dev",
        JSON.stringify(result.details ?? {}),
      );
    } else {
      console.error(
        `Push error status=${result.status ?? "?"} reason=${reason ?? "?"}:`,
        JSON.stringify(result.details ?? {}),
      );
    }
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
  if (!user?.pushToken) {
    // Antes era un retorno silencioso: imposible saber por qué no llegaba
    // el push. El token se registra solo al abrir la app (AuthContext).
    console.warn(
      `📵 Push omitido: sin token registrado para ${user?.email || user?.name || userId} (${userId}) — ${payload.title}`,
    );
    return;
  }

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
    body: `${order.businessName} - Gana ${earning} €`,
    data: { orderId, screen: "DriverAvailable" },
  });
}
