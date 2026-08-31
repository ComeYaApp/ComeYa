// Propinas al repartidor: un solo servicio para los tres canales.
//
// Reglas de negocio:
// - SOLO tras la entrega confirmada por el cliente (delivered +
//   confirmedByCustomer) y SOLO si el pedido tiene repartidor. Nunca en el
//   checkout ni durante el pedido.
// - La propina es 100 % del repartidor (la plataforma no cobra comisión).
// - Montos fijos 1-5 €.
//
// Canales:
// - "stripe": PaymentIntent del cliente → webhook/confirmación → abono a wallet.
// - "manual": bizum/sepa/paypal al número de la plataforma → el cliente
//   declara y adjunta comprobante → el ADMIN verifica → abono a wallet.
//   Sin verificación, no se abona.
// - "cash":   efectivo en mano entre cliente y repartidor → DOBLE
//   confirmación (quien declara + quien confirma). Se registra como ganancia
//   pero NO entra en la wallet (el dinero no pasa por la plataforma).
//
// Una transacción "tip" por pedido y método (idempotente): se crea
// "pending" al declarar y pasa a "completed"/"failed" al confirmarse.
import { db } from "./db";
import { orders, transactions, wallets, reviews } from "@shared/schema-mysql";
import { and, eq } from "drizzle-orm";
import { orderRefFromId } from "./orderNumberService";

export type TipMethod = "stripe" | "manual" | "cash";

interface TipMeta {
  tipMethod?: TipMethod;
  declaredBy?: "customer" | "driver";
  reviewId?: string;
  paymentIntentId?: string;
  proofUrl?: string;
}

export function parseTipMeta(metadata: string | null): TipMeta {
  try {
    return metadata ? JSON.parse(metadata) : {};
  } catch {
    return {};
  }
}

export async function checkTipEligibility(orderId: string, userId?: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { ok: false as const, error: "Pedido no encontrado" };
  if (userId && order.userId !== userId)
    return { ok: false as const, error: "No autorizado" };
  if (order.status !== "delivered")
    return {
      ok: false as const,
      error: "La propina solo está disponible después de la entrega",
    };
  if (!order.confirmedByCustomer)
    return {
      ok: false as const,
      error: "La propina solo está disponible después de confirmar la entrega",
    };
  if (!order.deliveryPersonId)
    return {
      ok: false as const,
      error: "Este pedido no tiene repartidor asignado",
    };
  return { ok: true as const, order };
}

/** Transacción tip existente de un pedido para un método concreto. */
export async function getTipTx(orderId: string, method: TipMethod) {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.orderId, orderId), eq(transactions.type, "tip")),
    )
    .limit(10);
  return (
    rows.find((t: any) => parseTipMeta(t.metadata).tipMethod === method) || null
  );
}

/**
 * Declara una propina (la crea como "pending" si no existía). Idempotente:
 * volver a declarar no duplica la transacción.
 */
export async function declareTip(opts: {
  orderId: string;
  driverId: string;
  amountCents: number;
  method: TipMethod;
  declaredBy: "customer" | "driver";
  reviewId?: string;
  paymentIntentId?: string;
  proofUrl?: string;
}) {
  const existing = await getTipTx(opts.orderId, opts.method);
  if (existing) {
    if (existing.status === "completed") {
      return {
        success: true,
        already: true,
        txId: existing.id,
        message: "Propina ya registrada",
      };
    }
    // Re-declaración: refrescar importe y datos sin duplicar
    const meta: TipMeta = {
      ...parseTipMeta(existing.metadata),
      declaredBy: opts.declaredBy,
      reviewId: opts.reviewId ?? parseTipMeta(existing.metadata).reviewId,
      paymentIntentId:
        opts.paymentIntentId ??
        parseTipMeta(existing.metadata).paymentIntentId,
      proofUrl: opts.proofUrl ?? parseTipMeta(existing.metadata).proofUrl,
    };
    await db
      .update(transactions)
      .set({
        amount: opts.amountCents,
        metadata: JSON.stringify(meta),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, existing.id));
    return { success: true, txId: existing.id, message: "Propina pendiente" };
  }

  const txId = crypto.randomUUID();
  const meta: TipMeta = {
    tipMethod: opts.method,
    declaredBy: opts.declaredBy,
    reviewId: opts.reviewId,
    paymentIntentId: opts.paymentIntentId,
    proofUrl: opts.proofUrl,
  };
  await db.insert(transactions).values({
    id: txId,
    userId: opts.driverId,
    orderId: opts.orderId,
    type: "tip",
    amount: opts.amountCents,
    description: `Propina al repartidor por pedido ${await orderRefFromId(opts.orderId)} (${opts.method})`,
    status: "pending",
    metadata: JSON.stringify(meta),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return { success: true, txId, message: "Propina pendiente" };
}

/**
 * Completa una propina: pasa la transacción a "completed", abona la wallet
 * del repartidor (solo canales de plataforma: stripe/manual) y avisa por
 * push. Idempotente.
 */
export async function completeTip(opts: {
  orderId: string;
  method: TipMethod;
  driverId?: string;
  reviewId?: string;
}): Promise<{ success: boolean; already?: boolean; message: string }> {
  const tx = await getTipTx(opts.orderId, opts.method);
  if (!tx) return { success: false, message: "Propina no encontrada" };
  if (tx.status === "completed") {
    return { success: true, already: true, message: "Propina ya registrada" };
  }

  const meta = parseTipMeta(tx.metadata);
  const driverId = opts.driverId || tx.userId;
  const reviewId = opts.reviewId || meta.reviewId;

  // Solo el dinero de plataforma toca la wallet; el efectivo no
  if (opts.method !== "cash" && driverId) {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);
    if (wallet) {
      await db
        .update(wallets)
        .set({
          balance: wallet.balance + tx.amount,
          totalEarned: wallet.totalEarned + tx.amount,
        })
        .where(eq(wallets.userId, driverId));
    }
  }

  await db
    .update(transactions)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(transactions.id, tx.id));

  // Reflejar el importe cobrado en la reseña (si la propina vino con una)
  if (reviewId) {
    await db
      .update(reviews)
      .set({ tipAmount: tx.amount })
      .where(eq(reviews.id, reviewId))
      .catch(() => {});
  }

  // Avisar al repartidor
  if (driverId) {
    try {
      const { sendPushToUser } = await import("./enhancedPushService");
      const label =
        opts.method === "cash" ? "en efectivo" : "";
      await sendPushToUser(driverId, {
        title: "💝 ¡Recibiste una propina!",
        body: `El cliente te dejó una propina de ${(tx.amount / 100).toFixed(2)} €${label ? ` ${label}` : ""}`,
        data: { screen: "DriverEarnings" },
      });
    } catch {}
  }

  return { success: true, message: "Propina registrada" };
}

/** Rechaza/cancela una propina pendiente (doble confirmación o admin). */
export async function failTip(
  orderId: string,
  method: TipMethod,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  const tx = await getTipTx(orderId, method);
  if (!tx) return { success: false, message: "Propina no encontrada" };
  await db
    .update(transactions)
    .set({
      status: "failed",
      description: `${tx.description ?? ""} — ${reason ?? "rechazada"}`,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));
  return { success: true, message: "Propina rechazada" };
}

/** Crea el PaymentIntent de Stripe para una propina con tarjeta. */
export async function createStripeTipIntent(opts: {
  orderId: string;
  driverId: string;
  amountCents: number;
  reviewId?: string;
}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { success: false as const, error: "Stripe no configurado" };
  const StripeModule = await import("stripe");
  const StripeClass = (StripeModule as any).default || StripeModule;
  const stripe = new StripeClass(key);
  const intent = await stripe.paymentIntents.create({
    amount: opts.amountCents,
    currency: "eur",
    metadata: {
      isTip: "true",
      orderId: opts.orderId,
      driverId: opts.driverId,
      reviewId: opts.reviewId ?? "",
      tipMethod: "stripe",
    },
  });
  return {
    success: true as const,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

/**
 * Aplica el pago de una propina con tarjeta (webhook o confirmación
 * explícita del cliente). Verifica el PaymentIntent en Stripe antes de
 * abonar: el dinero solo se abona si el cargo existe.
 */
export async function handleStripeTipPayment(
  paymentIntentId: string,
): Promise<{ success: boolean; message: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { success: false, message: "Stripe no configurado" };
  const StripeModule = await import("stripe");
  const StripeClass = (StripeModule as any).default || StripeModule;
  const stripe = new StripeClass(key);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    return {
      success: false,
      message: `El pago no se completó (estado: ${intent.status})`,
    };
  }

  const meta = intent.metadata || {};
  const orderId = meta.orderId;
  const method: TipMethod = (meta.tipMethod as TipMethod) || "stripe";
  if (!orderId || meta.isTip !== "true") {
    return { success: false, message: "PaymentIntent sin datos de propina" };
  }

  // Registrar la propina si el webhook no lo hizo ya (rescate)
  const existing = await getTipTx(orderId, method);
  if (!existing) {
    await declareTip({
      orderId,
      driverId: meta.driverId || "",
      amountCents: intent.amount,
      method,
      declaredBy: "customer",
      reviewId: meta.reviewId || undefined,
      paymentIntentId: intent.id,
    });
  }
  return completeTip({
    orderId,
    method,
    driverId: meta.driverId || undefined,
    reviewId: meta.reviewId || undefined,
  });
}

/** Propinas cash pendientes de un pedido (para mostrarlas en la app). */
export async function getPendingCashTip(orderId: string) {
  const tx = await getTipTx(orderId, "cash");
  if (!tx || tx.status !== "pending") return null;
  const meta = parseTipMeta(tx.metadata);
  return {
    amountCents: tx.amount,
    declaredBy: meta.declaredBy || "customer",
  };
}
