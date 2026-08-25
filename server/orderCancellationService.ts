// Order Cancellation Service
// Única vía para cancelar un pedido. Valida el momento, aplica la política de
// reembolso según quién cancela, ejecuta la devolución por refundService y
// avisa a los tres roles implicados.
//
// Política (alineada con Uber Eats / Rappi):
//
//   Cancela   Momento                    Cliente recibe        Negocio  Repartidor
//   cliente   antes de aceptar           100%                  no       no
//   cliente   en preparación             total - productos     sí       no
//   cliente   listo / en camino          0%                    sí       sí
//   negocio   antes de la recogida       100%                  no       compensación
//   sistema   sin repartidor (30 min)    100%                  no       no
//   admin     cualquiera                 100% (editable)       según    según
import { db } from "./db";
import { orders, payouts, users } from "@shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { sendPushToUser } from "./enhancedPushService";
import {
  createRefund,
  type LiableParty,
} from "./refundService";

export type CancelActorRole =
  | "customer"
  | "business_owner"
  | "delivery_driver"
  | "admin"
  | "super_admin"
  | "system";

/** Fases del pedido, agrupando los estados que la BD usa en la práctica. */
type Phase =
  | "pre_accept"
  | "accepted"
  | "preparing"
  | "ready"
  | "in_transit"
  | "done";

const PHASE_BY_STATUS: Record<string, Phase> = {
  pending: "pre_accept",
  confirmed: "pre_accept",
  accepted: "accepted",
  assigned_driver: "accepted",
  preparing: "preparing",
  ready: "ready",
  picked_up: "in_transit",
  on_the_way: "in_transit",
  in_transit: "in_transit",
  arriving: "in_transit",
  delivered: "done",
};

export interface CancelPolicy {
  refundAmount: number; // lo que recupera el cliente, en centavos
  penaltyAmount: number; // lo que no recupera
  businessKeepsEarnings: boolean;
  driverKeepsEarnings: boolean;
  liableParty: LiableParty;
  explanation: string;
}

export interface CancelOptions {
  actorRole?: CancelActorRole;
  /** Solo admin: fuerza el importe a devolver (centavos). */
  refundOverride?: number;
  /** Solo admin: fuerza el responsable del coste. */
  liableParty?: LiableParty;
}

export interface CancelResult {
  success: boolean;
  message: string;
  error?: string;
  orderId?: string;
  policy?: CancelPolicy;
  refund?: {
    refundId?: string;
    method?: string;
    status?: string;
    amount?: number;
    message: string;
  };
}

function getPhase(status: string): Phase | null {
  return PHASE_BY_STATUS[status] ?? null;
}

/** Un pedido ya entregado o ya cancelado no se cancela: se abre una incidencia. */
export function isCancellable(status: string): boolean {
  const phase = getPhase(status);
  return phase !== null && phase !== "done";
}

// ── Política ──────────────────────────────────────────────────────────────────
/**
 * Calcula qué pasa con el dinero. No toca la base de datos, así que sirve
 * también para el preview que ve el admin antes de confirmar.
 */
export function computeCancelPolicy(
  order: any,
  actorRole: CancelActorRole,
  opts: CancelOptions = {},
): CancelPolicy {
  const total = order.total || 0;
  const products = order.productosBase || order.subtotal || 0;
  const phase = getPhase(order.status) || "pre_accept";

  // El periodo de arrepentimiento siempre devuelve todo
  const withinRegret =
    order.regretPeriodEndsAt && new Date(order.regretPeriodEndsAt) > new Date();

  const full = (liableParty: LiableParty, explanation: string): CancelPolicy => ({
    refundAmount: total,
    penaltyAmount: 0,
    businessKeepsEarnings: false,
    driverKeepsEarnings: false,
    liableParty,
    explanation,
  });

  if (actorRole === "admin" || actorRole === "super_admin") {
    const refundAmount =
      typeof opts.refundOverride === "number"
        ? Math.max(0, Math.min(opts.refundOverride, total))
        : total;
    return {
      refundAmount,
      penaltyAmount: total - refundAmount,
      businessKeepsEarnings: refundAmount < total,
      driverKeepsEarnings: refundAmount < total,
      liableParty: opts.liableParty || "platform",
      explanation:
        refundAmount === total
          ? "Cancelación por administración con devolución completa."
          : `Cancelación por administración con devolución parcial de ${(refundAmount / 100).toFixed(2)} €.`,
    };
  }

  if (actorRole === "system") {
    return full(
      "platform",
      "Cancelado por el sistema al no encontrar repartidor: se devuelve el importe completo.",
    );
  }

  if (actorRole === "business_owner") {
    const driverKeeps = phase === "in_transit";
    return {
      refundAmount: total,
      penaltyAmount: 0,
      businessKeepsEarnings: false,
      driverKeepsEarnings: driverKeeps,
      liableParty: "business",
      explanation: driverKeeps
        ? "Cancelado por el negocio con el pedido ya en camino: el cliente recupera todo y el repartidor mantiene su tarifa."
        : "Cancelado por el negocio: el cliente recupera el importe completo.",
    };
  }

  if (actorRole === "delivery_driver") {
    return full(
      "driver",
      "Cancelado por el repartidor: el cliente recupera el importe completo.",
    );
  }

  // Cliente
  if (withinRegret || phase === "pre_accept" || phase === "accepted") {
    return full(
      "platform",
      withinRegret
        ? "Cancelación dentro del periodo de arrepentimiento: devolución completa sin cargos."
        : "El negocio aún no había empezado a preparar el pedido: devolución completa.",
    );
  }

  if (phase === "preparing") {
    const refundAmount = Math.max(0, total - products);
    return {
      refundAmount,
      penaltyAmount: products,
      businessKeepsEarnings: true,
      driverKeepsEarnings: false,
      liableParty: "platform",
      explanation: `El negocio ya había empezado a preparar el pedido: se descuentan ${(products / 100).toFixed(2)} € de comida y se devuelven ${(refundAmount / 100).toFixed(2)} €.`,
    };
  }

  // ready / in_transit
  return {
    refundAmount: 0,
    penaltyAmount: total,
    businessKeepsEarnings: true,
    driverKeepsEarnings: true,
    liableParty: "platform",
    explanation:
      "El pedido ya estaba listo o en camino: no procede devolución. Si hubo un problema con la entrega, abre una incidencia.",
  };
}

/** Preview de la cancelación sin ejecutarla, para el panel admin. */
export async function getCancelPreview(
  orderId: string,
  actorRole: CancelActorRole = "admin",
  opts: CancelOptions = {},
): Promise<{
  success: boolean;
  message?: string;
  order?: any;
  policy?: CancelPolicy;
  cancellable?: boolean;
}> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { success: false, message: "Pedido no encontrado" };

  return {
    success: true,
    order,
    cancellable: isCancellable(order.status),
    policy: computeCancelPolicy(order, actorRole, opts),
  };
}

// ── Anular payouts que ya no corresponden ─────────────────────────────────────
async function voidPendingPayouts(
  orderId: string,
  recipientTypes: ("business" | "driver")[],
  reason: string,
) {
  if (recipientTypes.length === 0) return;
  try {
    const rows = await db
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.orderId, orderId),
          eq(payouts.status, "pending"),
          inArray(payouts.recipientType, recipientTypes),
        ),
      );

    for (const p of rows) {
      await db
        .update(payouts)
        .set({
          amount: 0,
          adjustmentAmount: (p.adjustmentAmount || 0) + p.amount,
          adjustmentReason: reason,
          status: "cancelled",
        })
        .where(eq(payouts.id, p.id));
    }

    if (rows.length > 0) {
      logger.info(`${rows.length} payout(s) anulados por cancelación`, {
        orderId,
      });
    }
  } catch (err: any) {
    logger.error(`Error anulando payouts: ${err.message}`, { orderId });
  }
}

// ── Notificaciones ────────────────────────────────────────────────────────────
async function notifyCancellation(
  order: any,
  actorRole: CancelActorRole,
  policy: CancelPolicy,
  reason: string,
) {
  const short = `#${order.id.slice(-6)}`;
  const who =
    actorRole === "customer"
      ? "el cliente"
      : actorRole === "business_owner"
        ? "el negocio"
        : actorRole === "delivery_driver"
          ? "el repartidor"
          : actorRole === "system"
            ? "el sistema"
            : "administración";

  // Cliente (salvo que haya cancelado él mismo)
  if (actorRole !== "customer") {
    await sendPushToUser(order.userId, {
      title: "❌ Pedido cancelado",
      body: `Pedido ${short} cancelado por ${who}. ${
        policy.refundAmount > 0
          ? `Se devolverán ${(policy.refundAmount / 100).toFixed(2)} €.`
          : reason
      }`,
      data: {
        orderId: order.id,
        screen: "OrderTracking",
        type: "order_cancelled",
      },
    }).catch(() => {});
  }

  // Negocio
  if (actorRole !== "business_owner") {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const [biz] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      if (biz?.ownerId) {
        await sendPushToUser(biz.ownerId, {
          title: "❌ Pedido cancelado",
          body: `Pedido ${short} cancelado por ${who}.${
            policy.businessKeepsEarnings
              ? " Mantienes el importe de los productos."
              : ""
          }`,
          data: {
            orderId: order.id,
            screen: "BusinessOrders",
            type: "order_cancelled",
          },
        }).catch(() => {});
      }
    } catch {}
  }

  // Repartidor asignado
  if (order.deliveryPersonId && actorRole !== "delivery_driver") {
    await sendPushToUser(order.deliveryPersonId, {
      title: "❌ Pedido cancelado",
      body: `El pedido ${short} se ha cancelado.${
        policy.driverKeepsEarnings ? " Se te abonará la tarifa de envío." : ""
      }`,
      data: {
        orderId: order.id,
        screen: "DriverMyDeliveries",
        type: "order_cancelled",
      },
    }).catch(() => {});
  }

  // Admins, para que la devolución quede en su radar
  if (
    actorRole !== "admin" &&
    actorRole !== "super_admin" &&
    policy.refundAmount > 0
  ) {
    try {
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ["admin", "super_admin"]));
      for (const admin of admins) {
        await sendPushToUser(admin.id, {
          title: "💶 Cancelación con devolución",
          body: `Pedido ${short} cancelado por ${who}: ${(policy.refundAmount / 100).toFixed(2)} € a devolver.`,
          data: {
            orderId: order.id,
            screen: "AdminDashboard",
            section: "finance_refunds",
            type: "cancellation_refund",
          },
        }).catch(() => {});
      }
    } catch {}
  }
}

// ── Resolver el rol del actor ─────────────────────────────────────────────────
async function resolveActorRole(
  actorId: string,
  order: any,
  hint?: CancelActorRole,
): Promise<CancelActorRole> {
  if (hint) return hint;
  if (actorId === "system") return "system";

  try {
    const [u] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (u?.role) return u.role as CancelActorRole;
  } catch {}

  return order.userId === actorId ? "customer" : "system";
}

// ── API principal ─────────────────────────────────────────────────────────────
/**
 * Cancela un pedido aplicando la política de reembolso correspondiente.
 * Firma posicional por compatibilidad con callService.ts.
 */
export async function cancelOrder(
  orderId: string,
  actorId: string,
  reason: string,
  opts: CancelOptions = {},
): Promise<CancelResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return {
      success: false,
      message: "Pedido no encontrado",
      error: "not_found",
    };
  }

  if (order.status === "cancelled") {
    return {
      success: false,
      message: "Este pedido ya estaba cancelado",
      error: "already_cancelled",
    };
  }

  if (!isCancellable(order.status)) {
    return {
      success: false,
      message:
        order.status === "delivered"
          ? "El pedido ya se entregó. Para un problema con la entrega, abre una incidencia."
          : `Un pedido en estado "${order.status}" no se puede cancelar`,
      error: "not_cancellable",
    };
  }

  const actorRole = await resolveActorRole(actorId, order, opts.actorRole);

  // Solo el dueño del pedido puede cancelarlo como cliente
  if (actorRole === "customer" && order.userId !== actorId) {
    return { success: false, message: "No autorizado", error: "forbidden" };
  }

  const policy = computeCancelPolicy(order, actorRole, opts);

  // 1) Marcar el pedido como cancelado con toda la trazabilidad
  await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: actorId,
      cancellationReason: reason,
      refundAmount: policy.refundAmount,
      penaltyAmount: policy.penaltyAmount,
      refundStatus: policy.refundAmount > 0 ? "pending" : null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // 2) Anular los payouts pendientes de quien ya no debe cobrar
  const toVoid: ("business" | "driver")[] = [];
  if (!policy.businessKeepsEarnings) toVoid.push("business");
  if (!policy.driverKeepsEarnings) toVoid.push("driver");
  await voidPendingPayouts(orderId, toVoid, `Pedido cancelado: ${reason}`);

  // 3) Devolver el dinero
  let refundInfo: CancelResult["refund"];
  if (policy.refundAmount > 0) {
    const result = await createRefund({
      orderId,
      amount: policy.refundAmount,
      type: "cancellation",
      reason,
      liableParty: opts.liableParty || policy.liableParty,
      requestedBy:
        actorRole === "admin" || actorRole === "super_admin"
          ? actorId
          : undefined,
      notes: policy.explanation,
      notifyCustomer: false, // se avisa una sola vez en notifyCancellation
    });
    refundInfo = {
      refundId: result.refundId,
      method: result.method,
      status: result.status,
      amount: result.amount,
      message: result.message,
    };
  }

  // 4) Avisar a todos
  await notifyCancellation(order, actorRole, policy, reason);

  logger.info(
    `Pedido ${orderId} cancelado por ${actorRole} — devolución ${policy.refundAmount} centavos`,
    { orderId },
  );

  return {
    success: true,
    orderId,
    message: "Pedido cancelado",
    policy,
    refund: refundInfo,
  };
}

/**
 * Comprueba si un pedido se puede cancelar y con qué consecuencias.
 * Se mantiene por compatibilidad con llamadores antiguos.
 */
export async function checkCancellationEligibility(orderId: string) {
  const preview = await getCancelPreview(orderId, "customer");
  if (!preview.success) {
    return { success: false, canCancel: false, error: preview.message };
  }
  return {
    success: true,
    canCancel: preview.cancellable,
    refundAmount: preview.policy?.refundAmount ?? 0,
    penalty: preview.policy?.penaltyAmount ?? 0,
    explanation: preview.policy?.explanation,
  };
}
