// Refund Service
// Única vía por la que sale dinero hacia el cliente. El principio es la
// simetría: el dinero vuelve por donde entró.
//
//   stripe_*  con PaymentIntent cobrado  → stripe.refunds.create (a la tarjeta)
//   cash      sin cobrar                 → nada que devolver (cash_none)
//   cash      ya cobrado                 → transferencia manual
//   paypal / bizum_manual / sepa         → transferencia manual
//
// No se usa saldo interno: el cliente de ComeYa no tiene monedero con el que
// pagar pedidos (el checkout solo acepta Stripe y los métodos manuales), así
// que acreditarle saldo dejaría el dinero atrapado.
//
// La atribución de responsabilidad (negocio / repartidor / plataforma) se
// registra siempre y, si el payout del culpable sigue pendiente, se descuenta
// de él — el "order error adjustment" de Uber.
import { db } from "./db";
import {
  orders,
  refunds,
  payouts,
  transactions,
  businesses,
} from "@shared/schema-mysql";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { sendPushToUser } from "./enhancedPushService";
import { orderRef, orderRefFromId } from "./orderNumberService";

export type RefundType =
  | "issue"
  | "cancellation"
  | "dispute"
  | "manual"
  | "substitution";
export type LiableParty = "business" | "driver" | "platform";

export interface RefundRequest {
  orderId: string;
  amount: number; // en centavos
  type: RefundType;
  reason: string;
  issueId?: string;
  liableParty?: LiableParty;
  requestedBy?: string; // admin que autoriza; null = automático (cron / arrepentimiento)
  notes?: string;
  /** Si false, no se notifica al cliente (el llamador ya lo hace). */
  notifyCustomer?: boolean;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  method?: RefundMethod;
  status?: "pending" | "processing" | "completed" | "failed";
  amount?: number;
  message: string;
  error?: string;
}

// ── Discriminación del método de pago ─────────────────────────────────────────
// La lógica pura vive en utils/refundPolicy (testeable sin BD); aquí se
// re-exporta para mantener los imports existentes.
import {
  isStripePayment,
  isCashPayment,
  isManualPayment,
  resolveRefundMethod,
  type RefundMethod,
} from "./utils/refundPolicy";

export {
  isStripePayment,
  isCashPayment,
  isManualPayment,
  resolveRefundMethod,
};
export type { RefundMethod };

export type PaymentKind = "stripe" | "cash" | "manual";

export function getPaymentKind(order: {
  paymentMethod?: string | null;
}): PaymentKind {
  if (isStripePayment(order)) return "stripe";
  if (isCashPayment(order)) return "cash";
  return "manual";
}

// ── Stripe ────────────────────────────────────────────────────────────────────
async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const StripeModule = await import("stripe");
    const StripeClass: any = (StripeModule as any).default || StripeModule;
    return new StripeClass(key);
  } catch {
    return null;
  }
}

// ── Cuánto se ha devuelto ya de este pedido ───────────────────────────────────
export async function getRefundedTotal(orderId: string): Promise<number> {
  const rows = await db
    .select({ amount: refunds.amount, status: refunds.status })
    .from(refunds)
    .where(eq(refunds.orderId, orderId));

  return rows
    .filter(
      (r: { amount: number | null; status: string }) =>
        r.status === "completed" ||
        r.status === "processing" ||
        r.status === "pending",
    )
    .reduce(
      (sum: number, r: { amount: number | null; status: string }) =>
        sum + (r.amount || 0),
      0,
    );
}

/** Máximo que aún se puede devolver de un pedido. */
export async function getRefundableAmount(order: any): Promise<number> {
  const already = await getRefundedTotal(order.id);
  return Math.max(0, (order.total || 0) - already);
}

// ── Atribución por defecto según el tipo de incidencia ────────────────────────
const DEFAULT_LIABILITY: Record<string, LiableParty> = {
  missing_items: "business",
  wrong_items: "business",
  incomplete: "business",
  damaged: "business",
  quality: "business",
  never_arrived: "driver",
  driver_issue: "driver",
  late_delivery: "platform",
  other: "platform",
};

export function defaultLiableParty(issueType: string): LiableParty {
  return DEFAULT_LIABILITY[issueType] || "platform";
}

/**
 * Reparte el coste del reembolso entre negocio, repartidor y plataforma.
 * Un negocio nunca responde de más que el valor de los productos, ni un
 * repartidor de más que su tarifa de envío: el resto lo absorbe la plataforma.
 */
function splitCost(
  amount: number,
  liableParty: LiableParty | undefined,
  order: any,
): { businessDeduction: number; driverDeduction: number; platformCost: number } {
  if (liableParty === "business") {
    const cap = order.productosBase || order.subtotal || 0;
    const businessDeduction = Math.min(amount, cap);
    return {
      businessDeduction,
      driverDeduction: 0,
      platformCost: amount - businessDeduction,
    };
  }

  if (liableParty === "driver") {
    const cap = order.deliveryFee || 0;
    const driverDeduction = Math.min(amount, cap);
    return {
      businessDeduction: 0,
      driverDeduction,
      platformCost: amount - driverDeduction,
    };
  }

  return { businessDeduction: 0, driverDeduction: 0, platformCost: amount };
}

// ── Descuento en el payout del responsable ────────────────────────────────────
/**
 * Descuenta del payout pendiente del culpable. Si ya se le pagó, no se toca
 * nada: queda registrado en el refund para compensarlo en el siguiente ciclo
 * y visible en Finanzas.
 */
async function applyPayoutAdjustment(
  orderId: string,
  recipientType: "business" | "driver",
  deduction: number,
  reason: string,
): Promise<boolean> {
  if (deduction <= 0) return false;

  try {
    const [payout] = await db
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.orderId, orderId),
          eq(payouts.recipientType, recipientType),
          eq(payouts.status, "pending"),
        ),
      )
      .limit(1);

    if (!payout) return false;

    const applied = Math.min(deduction, payout.amount);
    await db
      .update(payouts)
      .set({
        amount: payout.amount - applied,
        adjustmentAmount: (payout.adjustmentAmount || 0) + applied,
        adjustmentReason: reason,
      })
      .where(eq(payouts.id, payout.id));

    logger.info(
      `Payout ${payout.id} ajustado -${applied} centavos (${recipientType})`,
      { orderId },
    );
    return true;
  } catch (err: any) {
    logger.error(`Error ajustando payout: ${err.message}`, { orderId });
    return false;
  }
}

// ── Registro contable de la devolución ────────────────────────────────────────
async function recordRefundTransaction(
  customerId: string,
  amount: number,
  orderId: string,
  description: string,
) {
  await db.insert(transactions).values({
    userId: customerId,
    orderId,
    type: "refund",
    amount,
    description,
    status: "completed",
  });
}

// ── Notificación al cliente ───────────────────────────────────────────────────
const METHOD_COPY: Record<RefundMethod, string> = {
  stripe: "Se ha devuelto a tu método de pago (puede tardar 5-10 días hábiles).",
  manual_transfer:
    "Realizaremos la transferencia en las próximas 24-48 horas al mismo medio con el que pagaste.",
  cash_none: "No se realizó ningún cargo, por lo que no hay importe a devolver.",
  no_charge: "El pago nunca se completó, no hay importe a devolver.",
};

async function notifyRefund(
  customerId: string,
  orderId: string,
  amount: number,
  method: RefundMethod,
) {
  const euros = (amount / 100).toFixed(2);
  const withoutCharge = method === "cash_none" || method === "no_charge";
  const ref = await orderRefFromId(orderId);
  const title = withoutCharge
    ? "Pedido cancelado"
    : `Devolución de ${euros} €`;
  const body = withoutCharge
    ? `Pedido ${ref}: ${METHOD_COPY[method]}`
    : `Pedido ${ref}. ${METHOD_COPY[method]}`;

  await sendPushToUser(customerId, {
    title,
    body,
    data: { orderId, screen: "OrderTracking", type: "refund" },
  }).catch(() => {});
}

// ── API principal ─────────────────────────────────────────────────────────────
/**
 * Crea y ejecuta un reembolso. Es idempotente respecto al total del pedido:
 * nunca devuelve más de lo cobrado, sumando reembolsos anteriores.
 */
export async function createRefund(req: RefundRequest): Promise<RefundResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, req.orderId))
    .limit(1);

  if (!order) {
    return { success: false, message: "Pedido no encontrado", error: "not_found" };
  }

  const method = resolveRefundMethod(order);

  // Sin cargo previo no hay devolución: se registra para dejar constancia.
  // Aplica a efectivo nunca cobrado (cash_none) y a pagos cuya ventana se
  // abrió pero nunca se completó (no_charge) — intentar reembolsar estos
  // por Stripe falla para siempre ("does not have a successful charge").
  if (method === "cash_none" || method === "no_charge") {
    const noChargeId = randomUUID();
    await db.insert(refunds).values({
      id: noChargeId,
      orderId: order.id,
      issueId: req.issueId,
      customerId: order.userId,
      amount: 0,
      type: req.type,
      reason: req.reason,
      method,
      status: "completed",
      liableParty: req.liableParty,
      platformCost: 0,
      requestedBy: req.requestedBy,
      processedAt: new Date(),
      notes: req.notes,
    });

    if (req.notifyCustomer !== false) {
      await notifyRefund(order.userId, order.id, 0, method);
    }

    return {
      success: true,
      refundId: noChargeId,
      method,
      status: "completed",
      amount: 0,
      message:
        method === "cash_none"
          ? "El pedido se pagaba en efectivo y no se llegó a cobrar"
          : "El pago nunca se completó; no hay importe que devolver",
    };
  }

  // Tope: nunca más de lo que queda por devolver
  const refundable = await getRefundableAmount(order);
  if (refundable <= 0) {
    return {
      success: false,
      message: "Este pedido ya está reembolsado por completo",
      error: "already_refunded",
    };
  }

  const amount = Math.min(Math.round(req.amount), refundable);
  if (amount <= 0) {
    return { success: false, message: "Importe inválido", error: "invalid_amount" };
  }

  const cost = splitCost(amount, req.liableParty, order);
  const realId = randomUUID();

  // 1) Registrar el reembolso antes de tocar dinero
  await db.insert(refunds).values({
    id: realId,
    orderId: order.id,
    issueId: req.issueId,
    customerId: order.userId,
    amount,
    type: req.type,
    reason: req.reason,
    method,
    status: method === "manual_transfer" ? "pending" : "processing",
    stripePaymentIntentId: order.stripePaymentIntentId || null,
    liableParty: req.liableParty,
    businessDeduction: cost.businessDeduction,
    driverDeduction: cost.driverDeduction,
    platformCost: cost.platformCost,
    requestedBy: req.requestedBy,
    notes: req.notes,
  });

  // 2) Ejecutar según el método
  let finalStatus: "pending" | "completed" | "failed" = "pending";
  let failureReason: string | null = null;
  let stripeRefundId: string | null = null;

  if (method === "stripe") {
    const stripe = await getStripe();
    if (!stripe) {
      finalStatus = "failed";
      failureReason = "Stripe no está configurado (falta STRIPE_SECRET_KEY)";
    } else {
      try {
        // El método correcto es refunds.create; paymentIntents.refund no existe
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount,
          reason: "requested_by_customer",
          metadata: {
            orderId: order.id,
            refundId: realId,
            issueId: req.issueId || "",
            type: req.type,
          },
        });
        stripeRefundId = refund.id;
        finalStatus = refund.status === "failed" ? "failed" : "completed";
        if (refund.status === "failed") failureReason = "Stripe rechazó la devolución";
      } catch (err: any) {
        finalStatus = "failed";
        failureReason = err?.message || "Error al devolver en Stripe";
        logger.error(`Stripe refund failed: ${failureReason}`, {
          orderId: order.id,
        });
      }
    }
  } else {
    // manual_transfer: queda pendiente de que el admin transfiera y suba
    // el comprobante. El apunte contable se hace al marcarlo como pagado.
    finalStatus = "pending";
  }

  // 3) Cerrar el registro
  await db
    .update(refunds)
    .set({
      status: finalStatus,
      stripeRefundId,
      failureReason,
      processedAt: finalStatus === "completed" ? new Date() : null,
    })
    .where(eq(refunds.id, realId));

  // 4) Descontar al responsable y actualizar el pedido
  if (finalStatus !== "failed") {
    let adjusted = false;
    if (cost.businessDeduction > 0) {
      adjusted =
        (await applyPayoutAdjustment(
          order.id,
          "business",
          cost.businessDeduction,
          `Incidencia: ${req.reason}`,
        )) || adjusted;
    }
    if (cost.driverDeduction > 0) {
      adjusted =
        (await applyPayoutAdjustment(
          order.id,
          "driver",
          cost.driverDeduction,
          `Incidencia: ${req.reason}`,
        )) || adjusted;
    }
    if (adjusted) {
      await db
        .update(refunds)
        .set({ payoutAdjusted: true })
        .where(eq(refunds.id, realId));
    }

    const totalRefunded = await getRefundedTotal(order.id);
    await db
      .update(orders)
      .set({
        refundAmount: totalRefunded,
        refundStatus: finalStatus === "completed" ? "processed" : "pending",
        refundedAt: finalStatus === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (finalStatus === "completed") {
      await recordRefundTransaction(
        order.userId,
        amount,
        order.id,
        `Devolución ${orderRef(order)}: ${req.reason}`,
      ).catch(() => {});

      if (req.notifyCustomer !== false) {
        await notifyRefund(order.userId, order.id, amount, method);
      }
    }
  } else {
    await db
      .update(orders)
      .set({ refundStatus: "failed", updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    await notifyAdminsRefundFailed(order.id, amount, failureReason || "");
  }

  return {
    success: finalStatus !== "failed",
    refundId: realId,
    method,
    status: finalStatus,
    amount,
    message:
      finalStatus === "completed"
        ? `Devolución de ${(amount / 100).toFixed(2)} € completada`
        : finalStatus === "pending"
          ? `Devolución de ${(amount / 100).toFixed(2)} € registrada, pendiente de transferencia manual`
          : `No se pudo completar la devolución: ${failureReason}`,
    error: failureReason || undefined,
  };
}

/** Reintenta un reembolso que falló (típicamente un error transitorio de Stripe). */
export async function retryRefund(
  refundId: string,
  adminId: string,
): Promise<RefundResult> {
  const [row] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId))
    .limit(1);

  if (!row) return { success: false, message: "Devolución no encontrada" };
  if (row.status === "completed")
    return { success: false, message: "Esta devolución ya se completó" };

  // Se anula la fallida y se crea una nueva, para no perder el histórico
  await db
    .update(refunds)
    .set({ status: "failed", notes: `${row.notes || ""}\n[reintentado por admin]`.trim() })
    .where(eq(refunds.id, refundId));

  return createRefund({
    orderId: row.orderId,
    amount: row.amount,
    type: row.type as RefundType,
    reason: row.reason || "Reintento de devolución",
    issueId: row.issueId || undefined,
    liableParty: (row.liableParty as LiableParty) || undefined,
    requestedBy: adminId,
  });
}

/** Marca como pagada una devolución de tipo manual_transfer. */
export async function markRefundPaid(
  refundId: string,
  adminId: string,
  data: { proofUrl?: string; notes?: string },
): Promise<RefundResult> {
  const [row] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId))
    .limit(1);

  if (!row) return { success: false, message: "Devolución no encontrada" };
  if (row.status === "completed")
    return { success: false, message: "Ya está marcada como pagada" };

  await db
    .update(refunds)
    .set({
      status: "completed",
      processedAt: new Date(),
      proofUrl: data.proofUrl,
      notes: data.notes ?? row.notes,
      requestedBy: row.requestedBy || adminId,
    })
    .where(eq(refunds.id, refundId));

  const totalRefunded = await getRefundedTotal(row.orderId);
  await db
    .update(orders)
    .set({
      refundAmount: totalRefunded,
      refundStatus: "processed",
      refundedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, row.orderId));

  await recordRefundTransaction(
    row.customerId,
    row.amount,
    row.orderId,
    `Devolución ${await orderRefFromId(row.orderId)} por transferencia manual`,
  ).catch(() => {});

  await notifyRefund(row.customerId, row.orderId, row.amount, "manual_transfer");

  return {
    success: true,
    refundId,
    amount: row.amount,
    status: "completed",
    message: "Devolución marcada como pagada",
  };
}

// ── Aviso a admins cuando algo falla ──────────────────────────────────────────
async function notifyAdminsRefundFailed(
  orderId: string,
  amount: number,
  reason: string,
) {
  try {
    const { users } = await import("@shared/schema-mysql");
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role, ["admin", "super_admin"]));

    for (const admin of admins) {
      await sendPushToUser(admin.id, {
        title: "⚠️ Devolución fallida",
        body: `Pedido ${await orderRefFromId(orderId)}: ${(amount / 100).toFixed(2)} € — ${reason}`,
        data: {
          orderId,
          screen: "AdminDashboard",
          section: "finance_refunds",
          type: "refund_failed",
        },
      }).catch(() => {});
    }
  } catch {}
}

/** Etiqueta legible del método de pago, para el panel admin. */
export async function describePaymentForRefund(order: any): Promise<{
  kind: PaymentKind;
  label: string;
  refundMethod: RefundMethod;
  automatic: boolean;
  note: string;
}> {
  const kind = getPaymentKind(order);

  if (kind === "stripe") {
    const ok = !!order.stripePaymentIntentId;
    return {
      kind,
      label:
        order.paymentMethod === "stripe_bizum"
          ? "Bizum (Stripe)"
          : "Tarjeta (Stripe)",
      refundMethod: ok ? "stripe" : "manual_transfer",
      automatic: ok,
      note: ok
        ? "La devolución se hace automáticamente al método de pago original. Tarda 5-10 días hábiles en verse en la cuenta del cliente."
        : "No hay PaymentIntent registrado, así que Stripe no puede revertir el cobro. Habrá que transferir a mano.",
    };
  }

  if (kind === "cash") {
    const collected = !!order.cashCollected;
    return {
      kind,
      label: "Efectivo",
      refundMethod: collected ? "manual_transfer" : "cash_none",
      automatic: false,
      note: collected
        ? "El repartidor ya cobró en efectivo: hay que devolver el importe por transferencia y subir el comprobante."
        : "Aún no se ha cobrado nada, así que no hay importe que devolver.",
    };
  }

  return {
    kind,
    label:
      order.paymentMethod === "bizum_manual"
        ? "Bizum manual"
        : order.paymentMethod === "sepa"
          ? "Transferencia SEPA"
          : order.paymentMethod === "paypal"
            ? "PayPal"
            : String(order.paymentMethod || "Manual"),
    refundMethod: "manual_transfer",
    automatic: false,
    note: "El cobro entró fuera de la plataforma, así que la devolución se hace por transferencia manual con comprobante.",
  };
}

/** Nombre del negocio, para mensajes y notas. */
export async function getBusinessName(businessId: string): Promise<string> {
  try {
    const [biz] = await db
      .select({ name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    return biz?.name || "el negocio";
  } catch {
    return "el negocio";
  }
}
