/**
 * Servicio de sustituciones de productos.
 *
 * Flujo:
 *  1. El cliente pre-autoriza en el checkout (reembolso / llamar /
 *     sustituir por un producto concreto) — se guarda en
 *     orders.substituteProductIds como {productoOriginal: sustituto}.
 *  2. Si falta stock, el negocio pulsa "Aplicar sustitución" sobre esa
 *     pre-autorización (o propone otro producto).
 *  3. Precio: la diferencia siempre acompaña al producto servido.
 *     - Sustituto más barato (delta < 0): se aplica al momento y la
 *       diferencia se devuelve por el método de pago original
 *       (refundService: Stripe automático o cola manual).
 *     - Sustituto más caro (delta > 0): queda como propuesta y el
 *       CLIENTE debe aprobar y pagar la diferencia (Payment Sheet).
 *  4. Nunca se compensa con otro producto: el dinero vuelve o se cobra.
 */
import { db } from "./db";
import {
  orders,
  products,
  substitutions,
  businesses,
  transactions,
} from "@shared/schema-mysql";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendPushToUser } from "./enhancedPushService";
import { orderRef } from "./orderNumberService";
import { getIO } from "./websocket";

interface ParsedItem {
  id?: string;
  product?: { id?: string; name?: string; price?: number; image?: string };
  price?: number;
  name?: string;
  quantity?: number;
  [key: string]: any;
}

interface SubstitutionResult {
  success: boolean;
  message: string;
  applied?: boolean;
  proposed?: boolean;
  refunded?: number;
  needsPayment?: boolean;
  delta?: number;
  clientSecret?: string;
  paymentIntentId?: string;
  substitution?: any;
}

const TERMINAL_STATUSES = ["delivered", "cancelled", "payment_failed"];

function parseItems(order: any): ParsedItem[] {
  try {
    const raw =
      typeof order.items === "string" ? JSON.parse(order.items) : order.items;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Precio del producto original en céntimos (en el pedido viaja en euros). */
function itemPriceCents(item: ParsedItem): number {
  const price = item?.product?.price ?? item?.price ?? 0;
  return Math.round(Number(price) * 100);
}

function parseSubstituteMap(order: any): Record<string, string> {
  try {
    const raw =
      typeof order.substituteProductIds === "string"
        ? JSON.parse(order.substituteProductIds)
        : order.substituteProductIds;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function deltaText(delta: number): string {
  const eur = (Math.abs(delta) / 100).toFixed(2);
  return delta < 0
    ? `−${eur} € a devolver`
    : delta > 0
      ? `+${eur} € a cobrar`
      : "mismo precio";
}

export async function listSubstitutions(orderId: string): Promise<any[]> {
  try {
    return await db
      .select()
      .from(substitutions)
      .where(eq(substitutions.orderId, orderId))
      .orderBy(desc(substitutions.createdAt));
  } catch {
    return [];
  }
}

async function notifyCustomer(order: any, title: string, body: string) {
  try {
    await sendPushToUser(order.userId, {
      title,
      body,
      data: { orderId: order.id, screen: "OrderTracking", type: "substitution" },
    });
    getIO().to(`user:${order.userId}`).emit("substitution_update", {
      orderId: order.id,
    });
  } catch (err) {
    console.error("substitution notifyCustomer:", err);
  }
}

async function notifyBusiness(order: any, title: string, body: string) {
  try {
    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);
    if (biz?.ownerId) {
      await sendPushToUser(biz.ownerId, {
        title,
        body,
        data: { orderId: order.id, screen: "BusinessOrders" },
      });
    }
    getIO().to(`business:${order.businessId}`).emit("substitution_update", {
      orderId: order.id,
    });
  } catch (err) {
    console.error("substitution notifyBusiness:", err);
  }
}

/** Recalcula el total del pedido y aplica la sustitución. */
async function applySubstitution(
  order: any,
  sub: any,
): Promise<SubstitutionResult> {
  const delta = Number(sub.priceDelta) || 0;

  await db
    .update(orders)
    .set({
      subtotal: Math.max(0, (order.subtotal || 0) + delta),
      total: Math.max(0, (order.total || 0) + delta),
      productosBase: Math.max(0, (order.productosBase || 0) + delta),
      businessEarnings: (order.businessEarnings ?? order.subtotal ?? 0) + delta,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  let refunded = 0;
  if (delta < 0) {
    // Más barato: devolver la diferencia por el método de pago original
    const { createRefund } = await import("./refundService");
    const refund = await createRefund({
      orderId: order.id,
      amount: -delta,
      type: "substitution" as any,
      reason: `Diferencia por sustitución: ${sub.itemName || "producto"} → ${sub.substituteName || "sustituto"} (${deltaText(delta)})`,
      requestedBy: undefined,
      notifyCustomer: true,
    });
    if (!refund.success) {
      console.error(
        `applySubstitution: reembolso falló (${order.id}):`,
        refund.message,
      );
    } else {
      refunded = -delta;
    }
  }

  await db
    .update(substitutions)
    .set({ status: "applied", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(substitutions.id, sub.id));

  await notifyBusiness(
    order,
    "✅ Sustitución aplicada",
    `Pedido ${orderRef(order)}: ${sub.itemName || "producto"} → ${sub.substituteName || "sustituto"} (${deltaText(delta)}).`,
  );

  return {
    success: true,
    message: "Sustitución aplicada",
    applied: true,
    refunded,
    delta,
  };
}

/**
 * El negocio propone/aplica una sustitución. Si coincide con la
 * pre-autorización del cliente y es más barata o igual, se aplica en el
 * acto (el cliente ya la autorizó en el checkout); si es más cara queda
 * propuesta para que el cliente la apruebe y pague la diferencia.
 */
export async function proposeSubstitution(
  order: any,
  itemProductId: string,
  substituteProductId: string,
  proposedBy: string,
): Promise<SubstitutionResult> {
  if (TERMINAL_STATUSES.includes(String(order.status))) {
    return {
      success: false,
      message: "El pedido ya está cerrado, no admite sustituciones",
    };
  }

  const items = parseItems(order);
  const item = items.find(
    (it: ParsedItem) =>
      it.product?.id === itemProductId || it.id === itemProductId,
  );
  if (!item) {
    return {
      success: false,
      message: "Producto del pedido no encontrado",
    };
  }

  const [substitute] = await db
    .select()
    .from(products)
    .where(eq(products.id, substituteProductId))
    .limit(1);
  if (!substitute) {
    return { success: false, message: "Producto sustituto no encontrado" };
  }

  const originalPrice = itemPriceCents(item);
  const substitutePrice = Number(substitute.price) || 0;
  const delta = substitutePrice - originalPrice;

  const map = parseSubstituteMap(order);
  const preAuthorized =
    map[itemProductId] === substituteProductId ||
    map["__global__"] === substituteProductId ||
    map[item.product?.id || ""] === substituteProductId;

  const subId = randomUUID();
  await db.insert(substitutions).values({
    id: subId,
    orderId: order.id,
    itemProductId,
    itemName: item.product?.name || item.name || "Producto",
    originalPrice,
    substituteProductId,
    substituteName: substitute.name,
    substituteImage: substitute.image || null,
    substitutePrice,
    priceDelta: delta,
    status: "proposed",
    proposedBy,
  });

  const row = {
    id: subId,
    orderId: order.id,
    itemProductId,
    itemName: item.product?.name || item.name || "Producto",
    originalPrice,
    substituteProductId,
    substituteName: substitute.name,
    substituteImage: substitute.image || null,
    substitutePrice,
    priceDelta: delta,
    status: "proposed",
  };

  if (preAuthorized && delta <= 0) {
    return applySubstitution(order, row);
  }

  await notifyCustomer(
    order,
    "🔄 Sustitución propuesta",
    `El negocio propone: ${row.itemName} → ${row.substituteName} (${deltaText(delta)}). Abre el pedido para aprobarla o rechazarla.`,
  );

  return {
    success: true,
    message: "Sustitución propuesta al cliente",
    proposed: true,
    delta,
    substitution: row,
  };
}

/** El cliente aprueba (pagando la diferencia si es positiva) o rechaza. */
export async function decideSubstitution(
  order: any,
  subId: string,
  approved: boolean,
  userId: string,
): Promise<SubstitutionResult> {
  if (order.userId !== userId) {
    return { success: false, message: "No autorizado" };
  }

  const [sub] = await db
    .select()
    .from(substitutions)
    .where(and(eq(substitutions.id, subId), eq(substitutions.orderId, order.id)))
    .limit(1);
  if (!sub) return { success: false, message: "Sustitución no encontrada" };
  if (sub.status !== "proposed") {
    return { success: false, message: "La sustitución ya fue procesada" };
  }

  if (!approved) {
    await db
      .update(substitutions)
      .set({ status: "rejected", decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(substitutions.id, subId));
    await notifyBusiness(
      order,
      "❌ Sustitución rechazada",
      `Pedido ${orderRef(order)}: el cliente rechazó ${sub.substituteName} por ${sub.itemName}.`,
    );
    return { success: true, message: "Sustitución rechazada" };
  }

  const delta = Number(sub.priceDelta) || 0;

  if (delta <= 0) {
    return applySubstitution(order, sub);
  }

  // Más cara: el cliente debe pagar la diferencia antes de aplicarla.
  // PaymentIntent independiente (no toca el intent original del pedido).
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, message: "Stripe no configurado" };
  }
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount: delta,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order.id,
        substitutionId: subId,
        isDelta: "true",
        itemName: String(sub.itemName || ""),
        substituteName: String(sub.substituteName || ""),
      },
    });
    await db
      .update(substitutions)
      .set({
        stripePaymentIntentId: intent.id,
        updatedAt: new Date(),
      })
      .where(eq(substitutions.id, subId));

    return {
      success: true,
      message: "Diferencia pendiente de pago",
      needsPayment: true,
      delta,
      clientSecret: intent.client_secret || undefined,
      paymentIntentId: intent.id,
      substitution: { ...sub, stripePaymentIntentId: intent.id },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `No se pudo iniciar el pago de la diferencia: ${err.message}`,
    };
  }
}

/**
 * El cliente ya pagó la diferencia con el Payment Sheet: verificar el
 * intent en Stripe (fuente de verdad) y aplicar la sustitución.
 */
export async function confirmDeltaPayment(
  order: any,
  subId: string,
  paymentIntentId: string,
  userId: string,
): Promise<SubstitutionResult> {
  if (order.userId !== userId) {
    return { success: false, message: "No autorizado" };
  }
  const [sub] = await db
    .select()
    .from(substitutions)
    .where(and(eq(substitutions.id, subId), eq(substitutions.orderId, order.id)))
    .limit(1);
  if (!sub) return { success: false, message: "Sustitución no encontrada" };
  if (sub.status !== "proposed") {
    return { success: false, message: "La sustitución ya fue procesada" };
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return {
        success: false,
        message: "El pago de la diferencia aún no se ha completado",
      };
    }

    // Registro del cobro extra (transacción tipo payment, dedup por
    // orderId + substitutionId en metadata)
    const [existing] = await db
      .select({ metadata: transactions.metadata })
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, order.id),
          eq(transactions.type, "payment"),
        ),
      )
      .limit(100);
    const already = existing.some((tx: any) => {
      try {
        return JSON.parse(tx.metadata || "{}").substitutionId === subId;
      } catch {
        return false;
      }
    });
    if (!already) {
      await db.insert(transactions).values({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId: order.id,
        businessId: order.businessId,
        userId: order.userId,
        amount: intent.amount,
        type: "payment",
        status: "completed",
        metadata: JSON.stringify({
          paymentIntentId: intent.id,
          substitutionId: subId,
          kind: "substitution_delta",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return applySubstitution(order, sub);
  } catch (err: any) {
    return { success: false, message: `Error verificando el pago: ${err.message}` };
  }
}

/** Vía webhook (si el pago del delta llegara antes que la confirmación). */
export async function applyDeltaPaymentFromWebhook(
  paymentIntent: any,
): Promise<{ success: boolean; message: string }> {
  const subId = paymentIntent.metadata?.substitutionId;
  const orderId = paymentIntent.metadata?.orderId;
  if (!subId || !orderId) {
    return { success: false, message: "Metadata de sustitución incompleta" };
  }
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { success: false, message: "Order not found" };
  const result = await confirmDeltaPayment(
    order,
    subId,
    paymentIntent.id,
    order.userId,
  );
  return result;
}
