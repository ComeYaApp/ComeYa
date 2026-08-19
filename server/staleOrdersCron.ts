// Cron: cancela pedidos estancados sin repartidor tras 30 minutos y gestiona
// la devolución del importe (Stripe automática; resto marcada para el admin).
import { db } from "./db";
import { orders, users, businesses } from "@shared/schema-mysql";
import { inArray, lt, and, isNull, eq, ne } from "drizzle-orm";
import { sendPushToUser, sendOrderStatusNotification } from "./enhancedPushService";

const STALE_MINUTES = 30;
const STALE_STATUSES = ["pending", "accepted", "preparing", "ready"];
// Métodos con reembolso automático por Stripe
const STRIPE_METHODS = ["card", "stripe"];

export async function checkStaleOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status as any, STALE_STATUSES),
        isNull(orders.deliveryPersonId),
        lt(orders.createdAt, cutoff),
        // Los pedidos de recogida en local no llevan repartidor: no deben
        // cancelarse por "falta de asignación"
        ne(orders.orderType, "pickup"),
      ),
    )
    .limit(50);

  for (const order of stale) {
    try {
      let refundedAutomatically = false;
      let refundError: string | null = null;

      // Devolución automática para pagos con tarjeta vía Stripe
      if (
        STRIPE_METHODS.includes(order.paymentMethod) &&
        (order.paymentIntentId || (order as any).stripePaymentIntentId)
      ) {
        try {
          const stripeModule = await import("stripe");
          const Stripe = stripeModule.default;
          if (process.env.STRIPE_SECRET_KEY) {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const piId =
              order.paymentIntentId || (order as any).stripePaymentIntentId;
            await stripe.paymentIntents.refund(piId);
            refundedAutomatically = true;
          }
        } catch (err: any) {
          refundError = err?.message || "refund failed";
          console.error(
            `Stale order ${order.id}: Stripe refund error — ${refundError}`,
          );
        }
      }

      await db
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "system",
          cancellationReason: `Pedido estancado: sin repartidor tras ${STALE_MINUTES} minutos`,
          refundAmount: order.total,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      // Notificar al cliente
      await sendOrderStatusNotification(order.id, order.userId, "cancelled").catch(
        () => {},
      );

      // Notificar al negocio
      try {
        const [biz] = await db
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq(businesses.id, order.businessId))
          .limit(1);
        if (biz?.ownerId) {
          await sendPushToUser(biz.ownerId, {
            title: "❌ Pedido cancelado automáticamente",
            body: `El pedido #${order.id.slice(-6)} superó ${STALE_MINUTES} min sin repartidor y fue cancelado.`,
            data: { orderId: order.id, screen: "BusinessOrders" },
          });
        }
      } catch {}

      // Si no se pudo reembolsar automáticamente, avisar al admin
      if (
        !refundedAutomatically &&
        (STRIPE_METHODS.includes(order.paymentMethod) ||
          ["bizum", "paypal", "pago_movil"].includes(order.paymentMethod))
      ) {
        try {
          const admins = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.role, ["admin", "super_admin"]));
          for (const admin of admins) {
            await sendPushToUser(admin.id, {
              title: "💶 Devolución pendiente",
              body: `Pedido #${order.id.slice(-6)} cancelado por estancamiento. Ejecutar devolución manual${refundError ? ` (${refundError})` : ""}.`,
              data: { orderId: order.id, screen: "AdminOrders" },
            });
          }
        } catch {}
      }

      console.log(
        `⏰ Stale order ${order.id} cancelled (${refundedAutomatically ? "refunded via Stripe" : "manual refund flagged"})`,
      );
    } catch (error) {
      console.error(`Error cancelling stale order ${order.id}:`, error);
    }
  }

  return stale.length;
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startStaleOrdersCron() {
  if (interval) return;
  if (process.env.NODE_ENV === "development") {
    console.log("⏰ Stale orders cron: solo producción (omitido en desarrollo)");
    return;
  }
  console.log(`⏰ Stale orders cron iniciado (cada 2 min, límite ${STALE_MINUTES} min)`);
  checkStaleOrders().catch(console.error);
  interval = setInterval(() => {
    checkStaleOrders().catch(console.error);
  }, 2 * 60 * 1000);
}

export function stopStaleOrdersCron() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
