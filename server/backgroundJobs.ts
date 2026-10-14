import { db } from "./db";
import { orders, deliveryDrivers, withdrawals } from "@shared/schema-mysql";
import { eq, and, lt, lte, sql } from "drizzle-orm";
import { releasePendingFunds } from "./commissionService";
import { logger } from "./logger";
import { geocodeMissingCoordinatesJob } from "./geocodeService";

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

  // Recurrencias semanales vencidas → materializar su scheduled order y
  // adelantar la siguiente ejecución
  try {
    const { RecurringOrdersService } = await import(
      "./recurringOrdersService"
    );
    const executed = await RecurringOrdersService.executeDueRecurring();
    if (executed > 0) {
      logger.info(`Materialized ${executed} recurring orders`);
    }
  } catch (error) {
    logger.error("Execute recurring orders job failed", error);
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

// Reconciliador de ALERTAS DE OPERACIÓN: deriva del estado real de los
// pedidos las alertas (sin repartidor, negocio sin responder, GPS congelado,
// demasiado tiempo), crea UN aviso persistente por pedido+alerta (dedupe con
// entityKey) y resuelve los que ya no aplican. Antes las alertas solo se
// pintaban si el admin miraba el mapa, y el evento "order_stuck" nunca se
// emitía.
export async function reconcileOpsAlertsJob() {
  try {
    const { ACTIVE_STATUSES, computeOrderAlerts, minutesSince } = await import(
      "./utils/opsAlerts"
    );
    const {
      recordAdminNotification,
      resolveAdminNotificationsByEntity,
      getActiveAdminAlertMutes,
    } = await import("./adminNotificationService");

    const statusList = ACTIVE_STATUSES.join("','");
    const [rows]: any = await db.execute(
      sql.raw(`
        SELECT o.id, o.business_name, o.status, o.created_at,
               o.delivery_person_id, o.business_response_at,
               dd.last_location_update,
               (SELECT COUNT(*) FROM order_issues oi WHERE oi.order_id = o.id AND oi.status IN ('open','in_review')) AS open_issues
        FROM orders o
        LEFT JOIN delivery_drivers dd ON dd.user_id = o.delivery_person_id
        WHERE o.status IN ('${statusList}')
          AND (o.deleted_at IS NULL)
        LIMIT 300
      `),
    );

    const mutes = await getActiveAdminAlertMutes();
    const activeKeys: string[] = [];

    const ALERT_META: Record<
      string,
      { severity: "critical" | "high" | "medium"; title: string }
    > = {
      no_driver: { severity: "high", title: "⏰ Pedido sin repartidor" },
      no_response: { severity: "medium", title: "🔕 El negocio no responde" },
      stale_gps: { severity: "high", title: "📡 GPS del repartidor sin señal" },
      too_long: { severity: "medium", title: "🕐 Pedido abierto demasiado tiempo" },
    };

    for (const row of (rows as any[]) || []) {
      const minutesActive = minutesSince(row.created_at);
      const driverLastUpdateMinutes = minutesSince(row.last_location_update);
      const alerts = computeOrderAlerts({
        status: row.status,
        minutesActive,
        hasDriver: !!row.delivery_person_id,
        businessResponseAt: row.business_response_at,
        driverLastUpdateMinutes,
      });

      for (const alert of alerts) {
        const entityKey = `ops_${alert.type}:${row.id}`;
        activeKeys.push(entityKey);
        if (mutes.has(`${row.id}:${alert.type}`)) continue;

        const meta = ALERT_META[alert.type] || {
          severity: "medium" as const,
          title: "⚠️ Alerta de operación",
        };
        const biz = row.business_name || "Negocio";
        const bodies: Record<string, string> = {
          no_driver: `${biz} lleva ${minutesActive} min sin que nadie recoja el pedido`,
          no_response: `${biz}: pedido sin confirmar hace ${minutesActive} min`,
          stale_gps: `Pedido para ${biz}: GPS del repartidor sin actualizar hace ${driverLastUpdateMinutes ?? "?"} min`,
          too_long: `${biz}: pedido abierto hace ${minutesActive} min`,
        };

        await recordAdminNotification({
          type: `ops_${alert.type}`,
          severity: meta.severity,
          title: meta.title,
          body: bodies[alert.type] || alert.message,
          section: "operations",
          data: { orderId: row.id, alertType: alert.type },
          entityKey,
          dedupeActive: true,
          // Push solo para "sin repartidor" (lo más accionable); el resto
          // queda en el centro de avisos para no saturar
          push: alert.type === "no_driver",
        });

        if (alert.type === "no_driver") {
          try {
            const { notifyAdminOrderStuck } = await import("./websocket");
            notifyAdminOrderStuck({
              orderId: row.id,
              businessName: biz,
              minutesWaiting: minutesActive || 0,
            });
          } catch {
            /* socket no inicializado */
          }
          logger.warn(`⏰ Pedido sin repartidor: ${row.id} (${minutesActive} min)`);
        }
      }
    }

    // Auto-resolver: avisos de ops abiertos cuya condición ya desapareció
    const resolved = await resolveAdminNotificationsByEntity("ops_", activeKeys);
    if (resolved > 0) {
      logger.info(`✅ Alertas de operación resueltas: ${resolved}`);
    }
  } catch (error) {
    logger.error("Reconcile ops alerts job failed", error);
  }
}

export function startBackgroundJobs() {
  // Antes se desactivaban fuera de NODE_ENV=production: en despliegues sin
  // esa variable los pedidos programados nunca se ejecutaban. Opt-out
  // explícito con DISABLE_BACKGROUND_JOBS=true.
  if (process.env.DISABLE_BACKGROUND_JOBS === "true") {
    logger.warn("Background jobs disabled (DISABLE_BACKGROUND_JOBS)");
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
  // Alertas de operación (sin repartidor, GPS, negocio sin responder) cada minuto
  setInterval(reconcileOpsAlertsJob, 60 * 1000);
  // Garantía de coordenadas: rellena lat/lng de negocios y direcciones
  // que aún no los tengan (creados sin geocodificación o con la API caída)
  setInterval(geocodeMissingCoordinatesJob, 30 * 60 * 1000);

  releaseFundsJob();
  processPendingWithdrawalsJob();
  executeScheduledOrdersJob();
  unblockExpiredDriversJob();
  geocodeMissingCoordinatesJob();
  reconcileOpsAlertsJob();

  logger.info("Background jobs started");
}

export function stopBackgroundJobs() {
  logger.info("Stopping background jobs");
}
