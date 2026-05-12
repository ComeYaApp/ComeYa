// Fund Release Service
// Lógica dual:
//   - Si negocio/repartidor tiene Stripe Connect activo → transfer automático inmediato
//   - Si no → payout manual en tabla payouts + notificación push al admin
import { db } from "./db";
import { orders, businesses, deliveryDrivers, payouts, transactions } from "@shared/schema-mysql";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { sendPushToUser } from "./enhancedPushService";

interface FundReleaseResult {
  success: boolean;
  message: string;
  orderId?: string;
  amountReleased?: number;
}

// ── Stripe helper ─────────────────────────────────────────────────────────────
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try { return require("stripe")(key); } catch { return null; }
}

async function stripeTransfer(
  stripe: any,
  amount: number,
  stripeAccountId: string,
  orderId: string,
  description: string
): Promise<string | null> {
  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: "eur",
      destination: stripeAccountId,
      transfer_group: orderId,
      description,
    });
    return transfer.id;
  } catch (err: any) {
    logger.error(`Stripe transfer failed: ${err.message}`, { orderId, stripeAccountId });
    return null;
  }
}

// ── Obtener stripeAccountId del negocio ───────────────────────────────────────
async function getBusinessStripeAccount(businessId: string): Promise<{ accountId: string | null; ownerId: string | null }> {
  const [biz] = await db.select({
    stripeAccountId: businesses.stripeAccountId,
    stripeAccountStatus: businesses.stripeAccountStatus,
    ownerId: businesses.ownerId,
  }).from(businesses).where(eq(businesses.id, businessId)).limit(1);

  if (!biz) return { accountId: null, ownerId: null };
  const active = biz.stripeAccountStatus === "active" && biz.stripeAccountId;
  return { accountId: active ? biz.stripeAccountId! : null, ownerId: biz.ownerId ?? null };
}

// ── Obtener stripeAccountId del repartidor ────────────────────────────────────
async function getDriverStripeAccount(driverId: string): Promise<{ accountId: string | null; userId: string | null }> {
  const [driver] = await db.select({
    stripeAccountId: deliveryDrivers.stripeAccountId,
    stripeAccountStatus: deliveryDrivers.stripeAccountStatus,
    userId: deliveryDrivers.userId,
  }).from(deliveryDrivers).where(eq(deliveryDrivers.id, driverId)).limit(1);

  if (!driver) return { accountId: null, userId: null };
  const active = driver.stripeAccountStatus === "active" && driver.stripeAccountId;
  return { accountId: active ? driver.stripeAccountId! : null, userId: driver.userId ?? null };
}

// ── Notificar al admin de payout manual pendiente ─────────────────────────────
async function notifyAdminManualPayout(orderId: string, recipientName: string, amount: number, type: "business" | "driver") {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { sql } = await import("drizzle-orm");
    const admins = await db.select({ id: users.id }).from(users)
      .where(sql`role IN ('admin', 'super_admin')`);

    const amountEur = (amount / 100).toFixed(2);
    const label = type === "business" ? "negocio" : "repartidor";

    for (const admin of admins) {
      await sendPushToUser(admin.id, {
        title: `💸 Payout pendiente — ${label}`,
        body: `${recipientName} debe recibir €${amountEur} por pedido #${orderId.slice(-6)}`,
        data: { screen: "AdminPayouts", orderId },
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.error("Error notifying admin of manual payout:", err);
  }
}

// ── Notificar al negocio/repartidor que recibirá su pago ─────────────────────
async function notifyRecipientPayout(userId: string, amount: number, orderId: string, method: "stripe" | "manual") {
  const amountEur = (amount / 100).toFixed(2);
  const msg = method === "stripe"
    ? `€${amountEur} transferidos automáticamente a tu cuenta bancaria`
    : `€${amountEur} pendientes de transferencia manual por el pedido #${orderId.slice(-6)}`;

  await sendPushToUser(userId, {
    title: method === "stripe" ? "✅ Pago recibido" : "⏳ Pago en proceso",
    body: msg,
    data: { screen: "Wallet", orderId },
  }).catch(() => {});
}

// ── Core: liberar fondos de una orden ────────────────────────────────────────
async function releaseFunds(order: any): Promise<void> {
  const stripe = getStripe();

  // Evitar duplicados
  const existing = await db.select().from(payouts).where(eq(payouts.orderId, order.id));
  if (existing.length > 0) return;

  const businessEarnings = order.businessEarnings ?? order.subtotal ?? 0;
  const deliveryEarnings = order.deliveryEarnings ?? order.deliveryFee ?? 0;

  const inserts: any[] = [];
  const orderUpdates: any = {
    fundsReleased: true,
    fundsReleasedAt: new Date(),
    updatedAt: new Date(),
  };

  // ── Pago al negocio ──────────────────────────────────────────────────────
  if (businessEarnings > 0) {
    const { accountId, ownerId } = await getBusinessStripeAccount(order.businessId);

    if (stripe && accountId) {
      // Stripe automático
      const transferId = await stripeTransfer(stripe, businessEarnings, accountId, order.id, `Pago negocio pedido #${order.id.slice(-6)}`);
      if (transferId) {
        orderUpdates.businessTransferId = transferId;
        inserts.push({
          orderId: order.id,
          recipientId: order.businessId,
          recipientType: "business" as const,
          amount: businessEarnings,
          method: "stripe",
          status: "stripe_auto" as const,
          stripeTransferId: transferId,
          paidAt: new Date(),
          notes: `Transfer automático Stripe: ${transferId}`,
        });
        if (ownerId) await notifyRecipientPayout(ownerId, businessEarnings, order.id, "stripe");
        logger.info(`✅ Stripe transfer to business: ${transferId}`, { orderId: order.id, amount: businessEarnings });
      } else {
        // Stripe falló → fallback a manual
        inserts.push({ orderId: order.id, recipientId: order.businessId, recipientType: "business" as const, amount: businessEarnings, method: "stripe_failed_manual", status: "pending" as const });
        if (ownerId) {
          await notifyAdminManualPayout(order.id, order.businessName || "Negocio", businessEarnings, "business");
          await notifyRecipientPayout(ownerId, businessEarnings, order.id, "manual");
        }
      }
    } else {
      // Sin Stripe → manual
      inserts.push({ orderId: order.id, recipientId: order.businessId, recipientType: "business" as const, amount: businessEarnings, method: "manual", status: "pending" as const });
      if (ownerId) {
        await notifyAdminManualPayout(order.id, order.businessName || "Negocio", businessEarnings, "business");
        await notifyRecipientPayout(ownerId, businessEarnings, order.id, "manual");
      }
    }
  }

  // ── Pago al repartidor ───────────────────────────────────────────────────
  if (order.deliveryPersonId && deliveryEarnings > 0) {
    const { accountId, userId } = await getDriverStripeAccount(order.deliveryPersonId);

    if (stripe && accountId) {
      const transferId = await stripeTransfer(stripe, deliveryEarnings, accountId, order.id, `Pago repartidor pedido #${order.id.slice(-6)}`);
      if (transferId) {
        orderUpdates.driverTransferId = transferId;
        inserts.push({
          orderId: order.id,
          recipientId: order.deliveryPersonId,
          recipientType: "driver" as const,
          amount: deliveryEarnings,
          method: "stripe",
          status: "stripe_auto" as const,
          stripeTransferId: transferId,
          paidAt: new Date(),
          notes: `Transfer automático Stripe: ${transferId}`,
        });
        if (userId) await notifyRecipientPayout(userId, deliveryEarnings, order.id, "stripe");
        logger.info(`✅ Stripe transfer to driver: ${transferId}`, { orderId: order.id, amount: deliveryEarnings });
      } else {
        inserts.push({ orderId: order.id, recipientId: order.deliveryPersonId, recipientType: "driver" as const, amount: deliveryEarnings, method: "stripe_failed_manual", status: "pending" as const });
        if (userId) {
          await notifyAdminManualPayout(order.id, "Repartidor", deliveryEarnings, "driver");
          await notifyRecipientPayout(userId, deliveryEarnings, order.id, "manual");
        }
      }
    } else {
      inserts.push({ orderId: order.id, recipientId: order.deliveryPersonId, recipientType: "driver" as const, amount: deliveryEarnings, method: "manual", status: "pending" as const });
      if (userId) {
        await notifyAdminManualPayout(order.id, "Repartidor", deliveryEarnings, "driver");
        await notifyRecipientPayout(userId, deliveryEarnings, order.id, "manual");
      }
    }
  }

  if (inserts.length > 0) await db.insert(payouts).values(inserts);
  await db.update(orders).set(orderUpdates).where(eq(orders.id, order.id));

  logger.info(`💰 Funds released for order ${order.id}`, {
    businessEarnings,
    deliveryEarnings,
    payouts: inserts.map(i => ({ type: i.recipientType, method: i.method, status: i.status })),
  });
}

// ── Clase pública ─────────────────────────────────────────────────────────────
export class FundReleaseService {
  private static instance: FundReleaseService;
  private constructor() {}

  static getInstance(): FundReleaseService {
    if (!FundReleaseService.instance) FundReleaseService.instance = new FundReleaseService();
    return FundReleaseService.instance;
  }

  async releaseOnCustomerConfirmation(orderId: string, customerId: string): Promise<FundReleaseResult> {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { success: false, message: "Pedido no encontrado" };
      if (order.userId !== customerId) return { success: false, message: "No autorizado" };
      if (order.status !== "delivered") return { success: false, message: "El pedido aún no ha sido entregado" };
      if (order.fundsReleased) return { success: false, message: "Los fondos ya fueron liberados" };

      await db.update(orders).set({
        confirmedByCustomer: true,
        confirmedByCustomerAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(orders.id, orderId));

      await releaseFunds(order);

      return { success: true, message: "Entrega confirmada. Los pagos han sido procesados.", orderId: order.id, amountReleased: order.total };
    } catch (error: any) {
      logger.error("Error releasing funds on customer confirmation:", error);
      return { success: false, message: error.message };
    }
  }

  async releaseOrderFunds(orderId: string): Promise<FundReleaseResult> {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { success: false, message: "Pedido no encontrado" };
      if (order.fundsReleased) return { success: false, message: "Los fondos ya fueron liberados" };

      await releaseFunds(order);

      return { success: true, message: "Fondos liberados exitosamente", orderId: order.id, amountReleased: order.total };
    } catch (error: any) {
      logger.error("Error releasing order funds:", error);
      return { success: false, message: error.message };
    }
  }

  async autoReleaseFunds(): Promise<{ released: number; failed: number }> {
    const deliveredAt24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ordersToRelease = await db.select().from(orders).where(
      and(eq(orders.status, "delivered"), eq(orders.fundsReleased, false), lt(orders.deliveredAt, deliveredAt24hAgo))
    );

    let released = 0, failed = 0;
    for (const order of ordersToRelease) {
      try {
        await releaseFunds(order);
        released++;
        logger.info(`⏰ Auto-released funds: Order ${order.id}`);
      } catch (err: any) {
        failed++;
        logger.error(`Failed to auto-release funds for order ${order.id}:`, err);
      }
    }
    logger.info(`🔄 Auto-release batch: ${released} released, ${failed} failed`);
    return { released, failed };
  }

  async disputeOrder(orderId: string, customerId: string, reason: string): Promise<FundReleaseResult> {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { success: false, message: "Pedido no encontrado" };
      if (order.userId !== customerId) return { success: false, message: "No autorizado" };
      if (order.fundsReleased) return { success: false, message: "Los fondos ya fueron liberados. Contacta soporte." };

      await db.update(orders).set({ status: "disputed", cancellationReason: reason, updatedAt: new Date() }).where(eq(orders.id, orderId));
      logger.warn(`⚠️ Order disputed: ${orderId}`, { customerId, reason });

      return { success: true, message: "Disputa registrada. Un administrador revisará tu caso.", orderId: order.id };
    } catch (error: any) {
      logger.error("Error disputing order:", error);
      return { success: false, message: error.message };
    }
  }
}

export const fundReleaseService = FundReleaseService.getInstance();
