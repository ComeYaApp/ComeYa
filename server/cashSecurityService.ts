import { db } from "./db";
import { wallets, users, orders } from "../shared/schema-mysql";
import { eq, and, gt, lt } from "drizzle-orm";

// Configuración de límites
const MAX_CASH_OWED = 50000; // $500 MXN máximo en efectivo pendiente
const LIQUIDATION_DEADLINE_DAYS = 7; // 7 días para liquidar
const WARNING_THRESHOLD_DAYS = 5; // Advertencia a los 5 días

export class CashSecurityService {
  // Validar si el driver puede aceptar pedidos en efectivo
  async canAcceptCashOrder(
    driverId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);

    if (!wallet) {
      await db.insert(wallets).values({
        userId: driverId,
        balance: 0,
        pendingBalance: 0,
        cashOwed: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      return { allowed: true };
    }

    // Verificar límite de efectivo pendiente
    if (wallet.cashOwed >= MAX_CASH_OWED) {
      return {
        allowed: false,
        reason: `Debes liquidar tu efectivo pendiente ($${(wallet.cashOwed / 100).toFixed(2)}) antes de aceptar más pedidos en efectivo`,
      };
    }

    // Verificar si tiene deuda vencida
    const hasOverdueDebt = await this.hasOverdueDebt(driverId);
    if (hasOverdueDebt) {
      return {
        allowed: false,
        reason: "Tienes efectivo vencido sin liquidar. Contacta a soporte.",
      };
    }

    return { allowed: true };
  }

  // Verificar si tiene deuda vencida
  async hasOverdueDebt(driverId: string): Promise<boolean> {
    const oldestCashOrder = await this.getOldestCashOrder(driverId);

    if (!oldestCashOrder) {
      return false;
    }

    const daysPending = this.daysSince(oldestCashOrder.createdAt);
    return daysPending > LIQUIDATION_DEADLINE_DAYS;
  }

  // Obtener el pedido en efectivo más antiguo sin liquidar
  async getOldestCashOrder(driverId: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, driverId),
          eq(orders.paymentMethod, "cash"),
          eq(orders.status, "delivered"),
          eq(orders.cashSettled, false),
        ),
      )
      .orderBy(orders.deliveredAt)
      .limit(1);

    return order;
  }

  // Calcular días desde una fecha
  private daysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Bloquear driver por efectivo vencido
  async blockDriverForOverdueCash(driverId: string): Promise<void> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);

    if (!wallet || wallet.cashOwed === 0) {
      return;
    }

    await db
      .update(users)
      .set({
        isActive: false,
        blockedReason: `Efectivo pendiente sin liquidar: $${(wallet.cashOwed / 100).toFixed(2)}. Contacta a soporte.`,
      })
      .where(eq(users.id, driverId));

    console.log(
      `🚫 Driver ${driverId} bloqueado por efectivo vencido: $${(wallet.cashOwed / 100).toFixed(2)}`,
    );
  }

  // Enviar advertencia antes del bloqueo
  async sendWarningForPendingCash(driverId: string): Promise<void> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);

    if (!wallet || wallet.cashOwed === 0) {
      return;
    }

    const oldestOrder = await this.getOldestCashOrder(driverId);
    if (!oldestOrder) {
      return;
    }

    const daysPending = this.daysSince(oldestOrder.createdAt);
    const daysRemaining = LIQUIDATION_DEADLINE_DAYS - daysPending;

    console.log(
      `⚠️ Advertencia enviada a driver ${driverId}: ${daysRemaining} días para liquidar $${(wallet.cashOwed / 100).toFixed(2)}`,
    );

    // Aquí integrarías Twilio para enviar SMS
    // await sendSMS(driver.phone, `Tienes ${daysRemaining} días para liquidar $${wallet.cashOwed / 100} en efectivo.`);
  }

  // Cron job: Revisar deudas vencidas (ejecutar diariamente)
  async checkOverdueCashDebts(): Promise<void> {
    console.log("🔍 Revisando deudas de efectivo vencidas...");

    const driversWithDebt = await db
      .select()
      .from(wallets)
      .where(gt(wallets.cashOwed, 0));

    for (const wallet of driversWithDebt) {
      const oldestOrder = await this.getOldestCashOrder(wallet.userId);

      if (!oldestOrder) {
        continue;
      }

      const daysPending = this.daysSince(oldestOrder.createdAt);

      // Bloquear si pasó el deadline
      if (daysPending > LIQUIDATION_DEADLINE_DAYS) {
        await this.blockDriverForOverdueCash(wallet.userId);
      }
      // Advertir si está cerca del deadline
      else if (daysPending >= WARNING_THRESHOLD_DAYS) {
        await this.sendWarningForPendingCash(wallet.userId);
      }
    }

    console.log("✅ Revisión de deudas completada");
  }

  // Obtener estadísticas de efectivo
  async getCashStats() {
    const driversWithDebt = await db
      .select()
      .from(wallets)
      .where(gt(wallets.cashOwed, 0));

    const totalCashOwed = driversWithDebt.reduce(
      (sum, w) => sum + w.cashOwed,
      0,
    );
    const driversCount = driversWithDebt.length;

    const overdueDrivers = [];
    for (const wallet of driversWithDebt) {
      const hasOverdue = await this.hasOverdueDebt(wallet.userId);
      if (hasOverdue) {
        overdueDrivers.push(wallet.userId);
      }
    }

    return {
      totalCashOwed: totalCashOwed / 100,
      driversWithDebt: driversCount,
      overdueDrivers: overdueDrivers.length,
      averageDebt: driversCount > 0 ? totalCashOwed / driversCount / 100 : 0,
    };
  }
}

export const cashSecurityService = new CashSecurityService();
