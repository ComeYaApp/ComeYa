import { db } from "./db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export class WeeklySettlementService {
  private static getRows(result: any): any[] {
    if (Array.isArray(result)) {
      return Array.isArray(result[0]) ? result[0] : result;
    }

    return result?.rows || [];
  }

  /**
   * FLUJO RESTRICTIVO VIERNES: Cierra la semana y crea liquidaciones
   * Se ejecuta cada viernes a las 11:59 PM
   * BLOQUEA inmediatamente a drivers con deuda para forzar liquidación
   */
  static async closeWeek() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);

    const weekEnd = new Date(today);

    // Obtener todos los drivers con cash_owed > 0
    const driversWithDebt = await db.execute(sql`
      SELECT w.user_id, w.cash_owed, u.name, u.phone
      FROM wallets w
      JOIN users u ON w.user_id = u.id
      WHERE w.cash_owed > 0
    `);

    let settlementsCreated = 0;

    const driverRows = this.getRows(driversWithDebt);
    for (const driver of driverRows as any[]) {
      // Crear liquidación semanal
      await db.execute(sql`
        INSERT INTO weekly_settlements 
        (id, driver_id, week_start, week_end, amount_owed, status, created_at, deadline)
        VALUES (UUID(), ${driver.user_id}, ${weekStart.toISOString().split("T")[0]}, 
                ${weekEnd.toISOString().split("T")[0]}, ${driver.cash_owed}, 'pending', NOW(), 
                DATE_ADD(NOW(), INTERVAL 48 HOUR))
      `);

      // FLUJO RESTRICTIVO: Bloquear inmediatamente para forzar liquidación
      await db.execute(sql`
        UPDATE users 
        SET is_active = 0, blocked_reason = CONCAT('Deuda semanal: $', ${(driver.cash_owed / 100).toFixed(2)}, '. Liquida antes del lunes.')
        WHERE id = ${driver.user_id}
      `);

      await db.execute(sql`
        UPDATE delivery_drivers 
        SET is_available = 0 
        WHERE user_id = ${driver.user_id}
      `);

      settlementsCreated++;

      logger.info(
        `🚫 Driver ${driver.name} bloqueado por deuda: $${(driver.cash_owed / 100).toFixed(2)}`,
      );
    }

    // Registrar cierre de semana en audit log (esquema real de audit_logs)
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
      VALUES ('system', 'weekly_close', 'settlement',
        ${JSON.stringify({ settlements_created: settlementsCreated, drivers_blocked: settlementsCreated })},
        NOW())
    `);

    console.log(
      `✅ FLUJO RESTRICTIVO: Semana cerrada. ${settlementsCreated} drivers bloqueados hasta liquidar.`,
    );
    return {
      success: true,
      count: settlementsCreated,
      blocked: settlementsCreated,
    };
  }

  /**
   * BLOQUEO LUNES: Bloquea drivers que no pagaron en 48 horas
   * Se ejecuta cada lunes a las 12:00 AM
   * Garantiza que cuentas se bloqueen si no liquidan
   */
  static async blockUnpaidDrivers() {
    const now = new Date();

    // Obtener liquidaciones vencidas (más de 48 horas)
    const overdueSettlements = await db.execute(sql`
      SELECT DISTINCT ws.driver_id, ws.amount_owed, u.name, u.phone
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.status = 'pending' 
      AND ws.deadline < NOW()
      AND u.is_active = 1
    `);

    let driversBlocked = 0;

    const overdueRows = this.getRows(overdueSettlements);
    for (const settlement of overdueRows as any[]) {
      // Bloquear driver definitivamente
      await db.execute(sql`
        UPDATE users 
        SET is_active = 0, 
            blocked_reason = CONCAT('Deuda vencida: $', ${(settlement.amount_owed / 100).toFixed(2)}, '. Contacta soporte para reactivar.'),
            blocked_at = NOW()
        WHERE id = ${settlement.driver_id}
      `);

      await db.execute(sql`
        UPDATE delivery_drivers 
        SET is_available = 0, 
            blocked_reason = 'Deuda vencida sin liquidar'
        WHERE user_id = ${settlement.driver_id}
      `);

      // Marcar liquidaciones como vencidas
      await db.execute(sql`
        UPDATE weekly_settlements 
        SET status = 'overdue', 
            notes = 'Driver bloqueado por falta de pago'
        WHERE driver_id = ${settlement.driver_id} AND status = 'pending'
      `);

      driversBlocked++;

      logger.error(
        `🚫 Driver ${settlement.name} BLOQUEADO por deuda vencida: $${(settlement.amount_owed / 100).toFixed(2)}`,
      );
    }

    // Registrar bloqueos en audit log (esquema real de audit_logs)
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
      VALUES ('system', 'monday_block', 'settlement',
        ${JSON.stringify({ drivers_blocked: driversBlocked })},
        NOW())
    `);

    console.log(
      `🚫 BLOQUEO LUNES: ${driversBlocked} drivers bloqueados por falta de pago.`,
    );
    return { success: true, blocked: driversBlocked };
  }

  /**
   * Obtener liquidación pendiente del driver
   */
  static async getDriverPendingSettlement(driverId: string) {
    const result = await db.execute(sql`
      SELECT * FROM weekly_settlements 
      WHERE driver_id = ${driverId} 
      AND status IN ('pending', 'submitted')
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    const rows = this.getRows(result);
    return rows[0] || null;
  }

  /**
   * Driver sube comprobante de pago
   */
  static async submitPaymentProof(settlementId: string, proofUrl: string) {
    await db.execute(sql`
      UPDATE weekly_settlements 
      SET status = 'submitted', 
          payment_proof_url = ${proofUrl},
          submitted_at = NOW()
      WHERE id = ${settlementId}
    `);

    return { success: true };
  }

  /**
   * Admin aprueba liquidación - marca payout como pagado y desbloquea driver
   */
  static async approveSettlement(settlementId: string, adminId: string) {
    const result = await db.execute(sql`
      SELECT ws.driver_id, ws.amount_owed, u.name
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.id = ${settlementId}
    `);

    const rows = this.getRows(result);
    const settlement = rows[0] as any;

    if (!settlement) throw new Error("Liquidación no encontrada");

    await db.execute(sql`
      UPDATE weekly_settlements 
      SET status = 'approved', approved_at = NOW(), approved_by = ${adminId}
      WHERE id = ${settlementId}
    `);

    await db.execute(sql`
      UPDATE wallets 
      SET cash_owed = GREATEST(0, cash_owed - ${settlement.amount_owed})
      WHERE user_id = ${settlement.driver_id}
    `);

    // Desbloquear driver
    await db.execute(sql`
      UPDATE users SET is_active = 1, blocked_reason = NULL WHERE id = ${settlement.driver_id}
    `);
    await db.execute(sql`
      UPDATE delivery_drivers SET is_available = 1, blocked_reason = NULL WHERE user_id = ${settlement.driver_id}
    `);

    logger.info(
      `✅ Liquidación aprobada: ${settlement.name} - $${(settlement.amount_owed / 100).toFixed(2)}`,
    );
    return { success: true };
  }

  /**
   * Admin rechaza liquidación
   */
  static async rejectSettlement(
    settlementId: string,
    adminId: string,
    notes: string,
  ) {
    await db.execute(sql`
      UPDATE weekly_settlements 
      SET status = 'rejected', 
          approved_by = ${adminId},
          notes = ${notes},
          approved_at = NOW()
      WHERE id = ${settlementId}
    `);

    return { success: true };
  }

  /**
   * Obtener todas las liquidaciones pendientes (Admin)
   */
  static async getAllPendingSettlements() {
    const result = await db.execute(sql`
      SELECT ws.*, u.name as driver_name, u.phone as driver_phone
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.status IN ('pending', 'submitted')
      ORDER BY ws.created_at DESC
    `);

    return this.getRows(result);
  }

  /**
   * Calcular ganancias semanales del driver para transferencia Stripe
   */
  static async calculateDriverWeeklyEarnings(
    driverId: string,
  ): Promise<number> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await db.execute(sql`
      SELECT COALESCE(SUM(delivery_earnings), 0) as total_earnings
      FROM orders 
      WHERE delivery_person_id = ${driverId}
      AND status = 'delivered'
      AND delivered_at >= ${weekAgo.toISOString()}
      AND payment_method = 'card'
    `);

    const earnings = (result.rows[0] as any)?.total_earnings || 0;
    return Math.max(0, earnings);
  }

  /**
   * Obtener historial completo de transacciones para auditoría
   */
  static async getTransactionHistory(driverId?: string, limit: number = 100) {
    let query = sql`
      SELECT 
        t.id,
        t.type,
        t.amount,
        t.description,
        t.status,
        t.created_at,
        t.order_id,
        u.name as user_name,
        o.total as order_total,
        o.payment_method
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN orders o ON t.order_id = o.id
    `;

    if (driverId) {
      query = sql`${query} WHERE t.user_id = ${driverId}`;
    }

    query = sql`${query} ORDER BY t.created_at DESC LIMIT ${limit}`;

    const result = await db.execute(query);
    return result.rows;
  }
}
