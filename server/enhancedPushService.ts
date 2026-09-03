import { db } from "./db";
import { users, orders, deliveryDrivers, pushTokens } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/** Máximo de dispositivos por usuario al enviar (protección anti-bucle). */
const MAX_TOKENS_PER_USER = 10;

/**
 * Tokens push activos de un usuario: TODOS los de la tabla multi-dispositivo
 * push_tokens; si la tabla aún está vacía (primer arranque tras el deploy,
 * migración no ejecutada) cae al token histórico de users.push_token.
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId))
    .limit(MAX_TOKENS_PER_USER);
  const tokens = rows.map((r: { token: string }) => r.token);
  if (tokens.length > 0) return tokens;

  const [user] = await db
    .select({ pushToken: users.pushToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.pushToken) return [user.pushToken];
  return [];
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

  let notification: NotificationPayload | null = null;

  switch (newStatus) {
    case "accepted":
      notification = {
        title: "¡Pedido aceptado! 🎉",
        // estimatedPrepMinutes es la columna real del schema. Solo se dice
        // "Listo en X min" si el negocio indicó el tiempo — antes el fallback
        // fijo 25 inventaba un número que no cuadraba con el resto.
        body: (order as any).estimatedPrepMinutes
          ? `${order.businessName} aceptó tu pedido - Listo en ${(order as any).estimatedPrepMinutes} min`
          : `${order.businessName} aceptó tu pedido — en breve empiezan a prepararlo`,
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
        // ETA REAL de la ruta (la misma que recalcula el tracking con
        // Directions API cada fix, caché 60 s — normalmente ya está
        // calculada y no cuesta una llamada extra). Si no hay dato, el
        // mensaje NO inventa minutos (antes: fallback fijo de 15).
        let etaText = "";
        try {
          const { EnhancedTrackingService } = await import(
            "./enhancedTrackingService"
          );
          const res = await EnhancedTrackingService.calculateDynamicETA(
            orderId,
          );
          const minutes = res?.eta?.minutes;
          if (typeof minutes === "number" && minutes > 0) {
            const capped = Math.max(1, Math.min(45, Math.round(minutes)));
            etaText = `Llega en aproximadamente ${capped} min`;
          }
        } catch (e) {
          console.warn("ETA picked_up no disponible:", e);
        }
        notification = {
          title: `${driverName} recogió tu pedido 📦`,
          body:
            etaText ||
            `${driverName} recogió tu pedido — va de camino a tu puerta`,
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
          title: `${driverName} está llegando ⚡`,
          // Sin minutos hardcodeados: los avisos de 5 y 2 minutos los dan
          // las alertas deduplicadas (eta_5min/eta_2min) con la ETA real
          body: "Ya casi está en tu puerta",
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
    await sendPushToUser(userId, notification);
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
      // El dispositivo desinstaló la app o su token expiró: quitar SOLO ese
      // token (multi-dispositivo: los demás teléfonos del usuario siguen
      // recibiendo) y limpiar la columna legacy si era la que apuntaba ahí
      await db
        .delete(pushTokens)
        .where(eq(pushTokens.token, pushToken))
        .catch(() => {});
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

  await sendPushToUser(userId, notification);
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

  const tokens = await getUserPushTokens(userId);
  if (!tokens.length) {
    // Antes era un retorno silencioso: imposible saber por qué no llegaba
    // el push. El token se registra solo al abrir la app (AuthContext).
    console.warn(
      `📵 Push omitido: sin token registrado para ${user?.email || user?.name || userId} (${userId}) — ${payload.title}`,
    );
    return;
  }

  // Respetar preferencias del usuario para categorías no operativas
  if (payload.category === "promotions" || payload.category === "news") {
    const prefs = parseNotificationPreferences(user?.notificationPreferences);
    if (!prefs[payload.category]) return;
  }

  // Enviar a TODOS los dispositivos del usuario (multi-dispositivo: la
  // cuenta puede estar en varios teléfonos). Si un token falla con
  // DeviceNotRegistered, se limpia en sendPushNotification sin afectar al
  // resto de envíos.
  const sent = new Set<string>();
  for (const token of tokens) {
    if (sent.has(token)) continue;
    sent.add(token);
    try {
      await sendPushNotification(token, payload);
    } catch (e) {
      console.warn("Push a un dispositivo falló (continuando):", e);
    }
  }
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

  if (!driver) return;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const earning = Math.round((order.total * 0.15) / 100);

  await sendPushToUser(driverId, {
    title: "Nuevo pedido disponible 📦",
    body: `${order.businessName} - Gana ${earning} €`,
    data: { orderId, screen: "DriverAvailable" },
  });
}
