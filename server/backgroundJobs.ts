import { db } from "./db";
import { orders, deliveryDrivers, withdrawals } from "@shared/schema-mysql";
import { eq, and, lt, lte } from "drizzle-orm";
import { releasePendingFunds } from "./commissionService";
import { logger } from "./logger";

export async function releaseFundsJob() {
  try {
    logger.info("Running release funds job");
    const { getSettingValue } = await import("./systemSettingsService");
    const holdHours = await getSettingValue("fund_hold_duration_hours", 0);

    if (holdHours === 0) {
      logger.info("Immediate payment enabled");
      return;
    }

    const holdTime = new Date(Date.now() - holdHours * 60 * 60 * 1000);
    const ordersToRelease = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.status, "delivered"), lte(orders.deliveredAt!, holdTime)),
      );

    logger.info(`Releasing funds for ${ordersToRelease.length} orders`);

    for (const order of ordersToRelease) {
      try {
        await releasePendingFunds(order.id);
      } catch (error) {
        logger.error("Failed to release funds", error, { orderId: order.id });
      }
    }
  } catch (error) {
    logger.error("Release funds job failed", error);
  }
}

export async function cleanupStrikesJob() {
  try {
    logger.info("Running cleanup strikes job");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await db
      .update(deliveryDrivers)
      .set({ strikes: 0 })
      .where(
        and(
          lte(deliveryDrivers.lastLocationUpdate!, thirtyDaysAgo),
          eq(deliveryDrivers.strikes, 1),
        ),
      );

    logger.info("Strikes cleaned up");
  } catch (error) {
    logger.error("Cleanup strikes job failed", error);
  }
}

export async function deactivateInactiveDriversJob() {
  try {
    logger.info("Running deactivate inactive drivers job");
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    await db
      .update(deliveryDrivers)
      .set({ isAvailable: false })
      .where(
        and(
          eq(deliveryDrivers.isAvailable, true),
          lte(deliveryDrivers.lastLocationUpdate!, sixtyDaysAgo),
        ),
      );

    logger.info("Inactive drivers deactivated");
  } catch (error) {
    logger.error("Deactivate drivers job failed", error);
  }
}

export async function processPendingWithdrawalsJob() {
  try {
    // Los retiros se aprueban manualmente desde el panel del admin
    // (Finanzas → Payouts). No se auto-procesan transferencias.
    const pending = await db
      .select({ id: withdrawals.id })
      .from(withdrawals)
      .where(eq(withdrawals.status, "pending"))
      .limit(1);
    if (pending.length > 0) {
      logger.info(
        `Hay ${pending.length} retiro(s) pendiente(s) de aprobación manual`,
      );
    }
  } catch (error) {
    logger.error("Process withdrawals job failed", error);
  }
}

export async function cleanupAuditLogsJob() {
  try {
    logger.info("Running cleanup audit logs job");
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { auditLogs } = await import("@shared/schema-mysql");

    await db.delete(auditLogs).where(lt(auditLogs.createdAt, ninetyDaysAgo));
    logger.info("Audit logs cleaned up");
  } catch (error) {
    logger.error("Cleanup audit logs job failed", error);
  }
}

export async function updateBusinessStatsJob() {
  try {
    logger.info("Running update business stats job");
    // TODO: Implement business stats update
    logger.info("Business stats updated");
  } catch (error) {
    logger.error("Update business stats job failed", error);
  }
}

// Ejecutar pedidos programados cuya hora llegó (los convierte en pedidos reales)
export async function executeScheduledOrdersJob() {
  try {
    const { ScheduledOrdersService } = await import(
      "./scheduledOrdersService"
    );
    const results = await ScheduledOrdersService.executeScheduledOrders();
    const executed = (results as any[]).filter((r) => r.success).length;
    if (executed > 0) {
      logger.info(`Executed ${executed} scheduled orders`);
    }
  } catch (error) {
    logger.error("Execute scheduled orders job failed", error);
  }
}

// Desbloquear repartidores cuyo periodo de bloqueo por strikes terminó
export async function unblockExpiredDriversJob() {
  try {
    const now = new Date();
    await db
      .update(deliveryDrivers)
      .set({ isBlocked: false })
      .where(
        and(
          eq(deliveryDrivers.isBlocked, true),
          lt(deliveryDrivers.blockedUntil!, now),
        ),
      );
    logger.info("Unblocked expired driver blocks checked");
  } catch (error) {
    logger.error("Unblock expired drivers job failed", error);
  }
}

export function startBackgroundJobs() {
  if (process.env.NODE_ENV !== "production") {
    logger.warn("Background jobs disabled in development");
    return;
  }

  logger.info("Starting background jobs");

  setInterval(releaseFundsJob, 60 * 60 * 1000);
  setInterval(cleanupStrikesJob, 24 * 60 * 60 * 1000);
  setInterval(deactivateInactiveDriversJob, 24 * 60 * 60 * 1000);
  setInterval(processPendingWithdrawalsJob, 5 * 60 * 1000);
  setInterval(cleanupAuditLogsJob, 7 * 24 * 60 * 60 * 1000);
  setInterval(updateBusinessStatsJob, 6 * 60 * 60 * 1000);
  setInterval(executeScheduledOrdersJob, 5 * 60 * 1000);
  setInterval(unblockExpiredDriversJob, 60 * 60 * 1000);

  releaseFundsJob();
  processPendingWithdrawalsJob();
  executeScheduledOrdersJob();
  unblockExpiredDriversJob();

  logger.info("Background jobs started");
}

export function stopBackgroundJobs() {
  logger.info("Stopping background jobs");
}
