// Payout Service - Reemplaza wallets/retiros con contabilidad simple
// Flujo: pedido entregado → se crean payouts pendientes → admin los marca como pagados
import { db } from "./db";
import {
  orders,
  payouts,
  paymentAccounts,
  transactions,
} from "../shared/schema-mysql";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "./logger";

// Al confirmar un pago (comprobante verificado), crear los payouts pendientes
export async function createPayoutsForOrder(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Pedido no encontrado");

  // Evitar duplicados
  const existing = await db
    .select()
    .from(payouts)
    .where(eq(payouts.orderId, orderId));
  if (existing.length > 0) return;

  const inserts = [];

  // Payout al negocio
  if (order.businessEarnings && order.businessEarnings > 0) {
    const account = await getDefaultAccount(order.businessId);
    inserts.push({
      orderId,
      recipientId: order.businessId,
      recipientType: "business" as const,
      amount: order.businessEarnings,
      method: account?.method || null,
      accountSnapshot: account ? JSON.stringify(account) : null,
      status: "pending" as const,
    });
  }

  // Payout al repartidor
  if (
    order.deliveryPersonId &&
    order.deliveryEarnings &&
    order.deliveryEarnings > 0
  ) {
    const account = await getDefaultAccount(order.deliveryPersonId);
    inserts.push({
      orderId,
      recipientId: order.deliveryPersonId,
      recipientType: "driver" as const,
      amount: order.deliveryEarnings,
      method: account?.method || null,
      accountSnapshot: account ? JSON.stringify(account) : null,
      status: "pending" as const,
    });
  }

  if (inserts.length > 0) {
    await db.insert(payouts).values(inserts);
    logger.info(`💰 Payouts created for order ${orderId}`, {
      count: inserts.length,
    });
  }
}

// Admin marca un payout como pagado
export async function markPayoutPaid(
  payoutId: string,
  adminId: string,
  notes?: string,
): Promise<void> {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);
  if (!payout) throw new Error("Payout no encontrado");
  if (payout.status === "paid") throw new Error("Ya fue marcado como pagado");

  await db
    .update(payouts)
    .set({
      status: "paid",
      paidBy: adminId,
      paidAt: new Date(),
      notes: notes || null,
    })
    .where(eq(payouts.id, payoutId));

  // Registrar en transactions como historial contable
  await db.insert(transactions).values({
    orderId: payout.orderId,
    userId: payout.recipientId,
    type: "payout_paid",
    amount: payout.amount,
    description: `Pago enviado por admin - Pedido #${payout.orderId.slice(-6)}`,
    status: "completed",
    metadata: JSON.stringify({
      payoutId,
      adminId,
      method: payout.method,
      notes,
    }),
  });

  logger.info(`✅ Payout ${payoutId} marked as paid by admin ${adminId}`);
}

// Obtener payouts pendientes (panel admin)
export async function getPendingPayouts() {
  const rows = await db.execute(
    db
      .select({
        id: payouts.id,
        orderId: payouts.orderId,
        recipientId: payouts.recipientId,
        recipientType: payouts.recipientType,
        amount: payouts.amount,
        method: payouts.method,
        accountSnapshot: payouts.accountSnapshot,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .where(eq(payouts.status, "pending"))
      .toSQL(),
  );
  return rows;
}

// Historial de pagos de un negocio o driver
export async function getPayoutHistory(recipientId: string) {
  return db.select().from(payouts).where(eq(payouts.recipientId, recipientId));
}

// Obtener cuenta por defecto de un usuario
async function getDefaultAccount(userId: string) {
  const [account] = await db
    .select()
    .from(paymentAccounts)
    .where(
      and(
        eq(paymentAccounts.userId, userId),
        eq(paymentAccounts.isDefault, true),
      ),
    )
    .limit(1);
  return account || null;
}

// Guardar/actualizar cuenta de pago (España: Bizum, IBAN, Tarjeta, PayPal)
export async function savePaymentAccount(
  userId: string,
  data: {
    method: string; // bizum | transferencia | tarjeta | paypal
    isDefault?: boolean;
    label?: string;
    // Bizum — teléfono
    pagoMovilPhone?: string;
    // Transferencia SEPA — IBAN y titular
    binanceId?: string; // campo reutilizado: almacena IBAN
    zelleEmail?: string; // campo reutilizado: almacena titular IBAN o email PayPal
    // Tarjeta
    zinliEmail?: string; // campo reutilizado: almacena titular tarjeta
    zellePhone?: string; // campo reutilizado: almacena últimos 4 dígitos tarjeta
  },
) {
  if (data.isDefault) {
    await db
      .update(paymentAccounts)
      .set({ isDefault: false })
      .where(
        and(
          eq(paymentAccounts.userId, userId),
          eq(paymentAccounts.method, data.method),
        ),
      );
  }

  await db.insert(paymentAccounts).values({
    userId,
    method: data.method,
    isDefault: data.isDefault ?? false,
    label: data.label || null,
    pagoMovilPhone: data.pagoMovilPhone || null,
    binanceId: data.binanceId || null,
    zelleEmail: data.zelleEmail || null,
    zinliEmail: data.zinliEmail || null,
    zellePhone: data.zellePhone || null,
    // No usados en España
    pagoMovilBank: null,
    pagoMovilCedula: null,
    binanceEmail: null,
  });
}

// Obtener todas las cuentas de un usuario
export async function getUserPaymentAccounts(userId: string) {
  return db
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.userId, userId));
}

// Eliminar cuenta
export async function deletePaymentAccount(accountId: string, userId: string) {
  await db
    .delete(paymentAccounts)
    .where(
      and(
        eq(paymentAccounts.id, accountId),
        eq(paymentAccounts.userId, userId),
      ),
    );
}
