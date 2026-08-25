// Cron: cancela pedidos estancados sin repartidor tras 30 minutos.
// La devolución la gestiona orderCancellationService (Stripe automático,
// saldo en monedero o cola manual según cómo pagó el cliente).
import { db } from "./db";
import { orders } from "@shared/schema-mysql";
import { inArray, lt, and, isNull, ne } from "drizzle-orm";
import { cancelOrder } from "./orderCancellationService";

const STALE_MINUTES = 30;
const STALE_STATUSES = ["pending", "accepted", "preparing", "ready"];

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
      const result = await cancelOrder(
        order.id,
        "system",
        `Pedido estancado: sin repartidor tras ${STALE_MINUTES} minutos`,
        { actorRole: "system" },
      );

      if (result.success) {
        console.log(
          `⏰ Stale order ${order.id} cancelado — devolución: ${result.refund?.message ?? "no aplica"}`,
        );
      } else {
        console.error(
          `⏰ Stale order ${order.id} no se pudo cancelar: ${result.message}`,
        );
      }
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
  console.log(
    `⏰ Stale orders cron iniciado (cada 2 min, límite ${STALE_MINUTES} min)`,
  );
  checkStaleOrders().catch(console.error);
  interval = setInterval(
    () => {
      checkStaleOrders().catch(console.error);
    },
    2 * 60 * 1000,
  );
}

export function stopStaleOrdersCron() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
