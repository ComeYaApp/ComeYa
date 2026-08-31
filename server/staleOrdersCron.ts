// Cron de limpieza de pedidos:
// 1. Pedidos "pending"/"payment_failed" SIN ACEPTACIÓN del negocio > 10 min
//    → cancelación automática + reembolso del 100% (política de la app).
//    Incluye los pedidos huérfanos cuyo pago se canceló en la pasarela.
//    EXENCIONES: pedidos con comprobante manual en verificación (esperan
//    al admin, no al negocio) y pagos Stripe confirmados cuyo webhook se
//    perdió (se rescatan consultando el PaymentIntent).
// 2. Pedidos aceptados/preparando/listo SIN REPARTIDOR > 30 min
//    → cancelación (el negocio ya invirtió en la comida, margen mayor).
// 3. Comprobantes manuales sin verificar > 2 h → cancelación (el admin
//    nunca llegó a revisar el pago).
// 4. Reintentos de reembolsos fallidos (refundStatus = 'failed').
// Las devoluciones las gestiona orderCancellationService/refundService
// (Stripe automático, saldo en monedero o cola manual según el pago).
import { db } from "./db";
import { orders } from "@shared/schema-mysql";
import { inArray, lt, and, isNull, ne, eq, or } from "drizzle-orm";
import { cancelOrder } from "./orderCancellationService";
import { orderRef } from "./orderNumberService";

// Política: sin aceptación del negocio → 10 min (visible para el cliente)
export const NO_ACCEPTANCE_MINUTES = 10;
// Sin repartidor (ya aceptados por el negocio) → 2 h (antes 30 min: el
// usuario pidió dar más margen para encontrar repartidor antes de anular)
export const NO_DRIVER_MINUTES = 120;
// Comprobante manual sin verificar → 2 h (el pedido espera al ADMIN)
export const PROOF_PENDING_MAX_MINUTES = 120;

/**
 * Rescata pagos de Stripe confirmados cuyo webhook se perdió (ver
 * paymentConfirmationService.rescueStripePayment, compartido con la
 * guardia de aceptación del negocio).
 */
async function rescueStripePayment(order: any): Promise<boolean> {
  const { rescueStripePayment: rescue } = await import(
    "./paymentConfirmationService"
  );
  return rescue(order);
}

/** Cancela pedidos que el negocio no aceptó en el plazo de la política. */
async function checkUnacceptedOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - NO_ACCEPTANCE_MINUTES * 60 * 1000);

  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status as any, ["pending", "payment_failed"]),
        isNull(orders.businessResponseAt),
        lt(orders.createdAt, cutoff),
      ),
    )
    .limit(50);

  // Pedidos con comprobante en verificación: no los mata esta regla,
  // esperan a que el admin revise el pago (regla propia de 2 h)
  const { pendingProofOrderIds } = await import("./utils/paymentState");
  const proofPending = await pendingProofOrderIds(stale.map((o: any) => o.id));

  let cancelled = 0;
  for (const order of stale) {
    try {
      if (proofPending.has(order.id)) continue;
      if (await rescueStripePayment(order)) continue;

      const result = await cancelOrder(
        order.id,
        "system",
        `Sin pago confirmado ni aceptación del negocio en ${NO_ACCEPTANCE_MINUTES} minutos — cancelación automática con reembolso del 100%`,
        { actorRole: "system" },
      );

      if (result.success) {
        cancelled++;
        console.log(
          `⏰ ${orderRef(order)} cancelado por falta de aceptación — devolución: ${result.refund?.message ?? "no aplica"}`,
        );
      } else {
        console.error(
          `⏰ ${orderRef(order)} (sin aceptar) no se pudo cancelar: ${result.message}`,
        );
      }
    } catch (error) {
      console.error(`Error cancelling unaccepted order ${order.id}:`, error);
    }
  }

  return cancelled;
}

/** Cancela pedidos cuyo comprobante manual lleva demasiado sin verificarse. */
async function checkStuckPaymentProofs(): Promise<number> {
  const cutoff = new Date(
    Date.now() - PROOF_PENDING_MAX_MINUTES * 60 * 1000,
  );
  try {
    const { paymentProofs } = await import("@shared/schema-mysql");
    const stuckProofs = await db
      .select({ orderId: paymentProofs.orderId })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.status, "pending"),
          lt(paymentProofs.submittedAt, cutoff),
        ),
      )
      .limit(50);

    const ids = stuckProofs
      .map((p: any) => p.orderId)
      .filter((id: any): id is string => Boolean(id));
    if (!ids.length) return 0;

    // Solo los que siguen pending (los ya verificados avanzaron de estado)
    const stuck = await db
      .select()
      .from(orders)
      .where(and(inArray(orders.id, ids), inArray(orders.status as any, ["pending"])));

    let cancelled = 0;
    for (const order of stuck) {
      try {
        const result = await cancelOrder(
          order.id,
          "system",
          `El comprobante de pago no se verificó en ${PROOF_PENDING_MAX_MINUTES / 60} horas — cancelación automática con reembolso del 100%`,
          { actorRole: "system" },
        );
        if (result.success) {
          cancelled++;
          console.log(
            `⏰ ${orderRef(order)} cancelado: comprobante sin verificar`,
          );
        }
      } catch (error) {
        console.error(`Error cancelling proof-stuck order ${order.id}:`, error);
      }
    }
    return cancelled;
  } catch {
    return 0;
  }
}

/** Cancela pedidos aceptados que nunca consiguieron repartidor. */
async function checkStaleOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - NO_DRIVER_MINUTES * 60 * 1000);

  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status as any, ["accepted", "preparing", "ready"]),
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
        `Pedido estancado: sin repartidor tras ${NO_DRIVER_MINUTES} minutos`,
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

/**
 * Reintenta reembolsos de cancelaciones automáticas que quedaron en 'failed'.
 * Usa retryRefund del servicio (el admin también puede hacerlo a mano).
 */
async function retryFailedRefunds(): Promise<number> {
  try {
    const { refunds, orders: ordersTable } = await import(
      "@shared/schema-mysql"
    );
    const { eq } = await import("drizzle-orm");
    const svc = await import("./refundService");
    if (typeof (svc as any).retryRefund !== "function") return 0;

    // Máximo 10 por pasada para no saturar la API de Stripe
    const failed = await db
      .select({ id: refunds.id, orderId: refunds.orderId })
      .from(refunds)
      .where(eq(refunds.status, "failed"))
      .limit(10);

    let handled = 0;
    for (const r of failed) {
      try {
        const [order] = await db
          .select({
            paymentMethod: ordersTable.paymentMethod,
            paidAt: ordersTable.paidAt,
          })
          .from(ordersTable)
          .where(eq(ordersTable.id, r.orderId))
          .limit(1);

        // Pago Stripe cuya ventana se abrió pero nunca se cobró: no hay
        // cargo que reembolsar. Se cierra el registro para siempre (antes
        // se reintentaba cada 2 min y fallaba eternamente).
        if (
          order &&
          String(order.paymentMethod || "").startsWith("stripe_") &&
          !order.paidAt
        ) {
          await db
            .update(refunds)
            .set({
              status: "completed",
              processedAt: new Date(),
              amount: 0,
            })
            .where(eq(refunds.id, r.id));
          await db
            .update(ordersTable)
            .set({ refundStatus: "processed" })
            .where(eq(ordersTable.id, r.orderId));
          handled++;
          continue;
        }

        await (svc as any).retryRefund(r.id, "system");
        handled++;
      } catch {
        /* seguirá en failed para reintento manual del admin */
      }
    }
    if (handled) console.log(`💸 Reembolsos procesados: ${handled}`);
    return handled;
  } catch {
    return 0;
  }
}

/**
 * Cierra pickups atascados: el negocio aceptó pero nunca terminó la
 * preparación (>2 h), o el pedido está "ready" y el cliente nunca llegó a
 * recogerlo (>24 h). Antes estos pedidos quedaban para siempre en el mapa.
 */
async function checkStuckPickups(): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stuck = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.orderType, "pickup"),
        inArray(orders.status as any, ["accepted", "preparing", "ready"]),
        or(
          and(
            inArray(orders.status as any, ["accepted", "preparing"]),
            lt(orders.createdAt, twoHoursAgo),
          ),
          and(
            eq(orders.status as any, "ready"),
            lt(orders.createdAt, dayAgo),
          ),
        ),
      ),
    )
    .limit(50);

  let cancelled = 0;
  for (const order of stuck) {
    try {
      const result = await cancelOrder(
        order.id,
        "system",
        order.status === "ready"
          ? "Recogida en local sin recoger en 24 horas — cancelación automática con reembolso del 100%"
          : "Recogida en local estancada (el negocio no terminó en 2 horas) — cancelación automática con reembolso del 100%",
        { actorRole: "system" },
      );
      if (result.success) {
        cancelled++;
        console.log(`⏰ Pickup ${orderRef(order)} cerrado por inactividad`);
      }
    } catch (error) {
      console.error(`Error closing stuck pickup ${order.id}:`, error);
    }
  }
  return cancelled;
}

/**
 * Borra pedidos fantasma: creados hace >24 h, sin pago y sin aceptación.
 * Son intentos abandonados (el cliente nunca llegó a pagar): no tienen
 * dinero ni contabilidad que conservar y ensucian mapas y listas.
 */
async function deleteUnpaidPhantoms(): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const phantoms = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status as any, "pending"),
        isNull(orders.paidAt),
        lt(orders.createdAt, dayAgo),
      ),
    )
    .limit(50);
  if (phantoms.length) {
    await db
      .delete(orders)
      .where(
        inArray(
          orders.id as any,
          phantoms.map((p: any) => p.id),
        ),
      );
    console.log(`🗑️ Pedidos fantasma (sin pago, >24 h) eliminados: ${phantoms.length}`);
  }
  return phantoms.length;
}

export async function runOrderCleanup(): Promise<{
  unaccepted: number;
  stale: number;
  proofStuck: number;
  stuckPickups: number;
  phantoms: number;
}> {
  const [unaccepted, stale, proofStuck, stuckPickups, phantoms] =
    await Promise.all([
      checkUnacceptedOrders(),
      checkStaleOrders(),
      checkStuckPaymentProofs(),
      checkStuckPickups(),
      deleteUnpaidPhantoms(),
    ]);
  // Los reembolsos fallidos se reintentan SIEMPRE, no solo cuando en esta
  // pasada hubo cancelaciones: un 'failed' (p. ej. pedido stripe nunca
  // cobrado que se cierra como no_charge) quedaría eternamente sin
  // procesar si ninguna cancelación lo desbloquea.
  retryFailedRefunds().catch(() => {});
  return { unaccepted, stale, proofStuck, stuckPickups, phantoms };
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startStaleOrdersCron() {
  if (interval) return;
  if (process.env.NODE_ENV === "development") {
    console.log("⏰ Stale orders cron: solo producción (omitido en desarrollo)");
    return;
  }
  console.log(
    `⏰ Stale orders cron iniciado (cada 2 min · sin aceptar: ${NO_ACCEPTANCE_MINUTES} min · sin repartidor: ${NO_DRIVER_MINUTES} min · comprobante sin verificar: ${PROOF_PENDING_MAX_MINUTES} min)`,
  );
  runOrderCleanup().catch(console.error);
  interval = setInterval(
    () => {
      runOrderCleanup().catch(console.error);
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

export { checkStaleOrders, checkUnacceptedOrders };
