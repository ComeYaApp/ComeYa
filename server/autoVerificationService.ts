// Auto Verification Service - Sistema Semi-Automático con Anti-Fraude
import { db } from "./db";
import { orders, paymentProofs, users, transactions } from "@shared/schema-mysql";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { logger } from "./logger";

interface VerificationResult {
  autoApprove: boolean;
  reason: string;
  confidence: number;
  riskScore: number;
  checks: {
    referenceFormat: boolean;
    amountMatch: boolean;
    userTrustworthy: boolean;
    timeValid: boolean;
    imageValid: boolean;
    duplicateCheck: boolean;
    velocityCheck: boolean;
  };
}

interface UserStats {
  totalOrders: number;
  successfulOrders: number;
  disputedOrders: number;
  disputeRate: number;
  avgOrderValue: number;
  accountAge: number; // días
  lastOrderDate: Date | null;
}

export class AutoVerificationService {
  private static instance: AutoVerificationService;

  // Configuración de seguridad
  private readonly MIN_CONFIDENCE = 0.75; // 75% confianza mínima para auto-aprobar
  private readonly MAX_RISK_SCORE = 0.3; // 30% riesgo máximo
  private readonly MIN_SUCCESSFUL_ORDERS = 3; // Mínimo 3 pedidos exitosos
  private readonly MAX_DISPUTE_RATE = 0.1; // Máximo 10% de disputas
  private readonly MAX_AMOUNT_TOLERANCE = 500; // ±5 Bs de tolerancia
  private readonly MIN_ACCOUNT_AGE_DAYS = 7; // Cuenta mínima 7 días
  private readonly MAX_ORDERS_PER_HOUR = 5; // Máximo 5 pedidos por hora
  private readonly MAX_ORDERS_PER_DAY = 20; // Máximo 20 pedidos por día

  private constructor() {}

  static getInstance(): AutoVerificationService {
    if (!AutoVerificationService.instance) {
      AutoVerificationService.instance = new AutoVerificationService();
    }
    return AutoVerificationService.instance;
  }

  /**
   * Verifica si un comprobante debe ser auto-aprobado
   */
  async shouldAutoApprove(proofId: string): Promise<VerificationResult> {
    try {
      // Obtener comprobante con orden y usuario
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.id, proofId))
        .limit(1);

      if (!proof) {
        throw new Error("Comprobante no encontrado");
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, proof.orderId))
        .limit(1);

      if (!order) {
        throw new Error("Orden no encontrada");
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, proof.userId))
        .limit(1);

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Ejecutar todas las verificaciones
      const checks = {
        referenceFormat: await this.checkReferenceFormat(proof.referenceNumber),
        amountMatch: await this.checkAmountMatch(proof.amount, order.total),
        userTrustworthy: await this.checkUserTrustworthiness(proof.userId),
        timeValid: await this.checkTimeValidity(proof.submittedAt),
        imageValid: await this.checkImageValidity(proof.proofImageUrl),
        duplicateCheck: await this.checkDuplicateReference(proof.referenceNumber, proof.id),
        velocityCheck: await this.checkVelocity(proof.userId),
      };

      // Calcular confianza y riesgo
      const { confidence, riskScore, reason } = await this.calculateConfidenceAndRisk(
        checks,
        proof,
        order,
        user
      );

      // Decisión final
      const autoApprove =
        confidence >= this.MIN_CONFIDENCE &&
        riskScore <= this.MAX_RISK_SCORE &&
        Object.values(checks).every((check) => check === true);

      logger.info(`🤖 Auto-verification result for proof ${proofId}`, {
        proofId,
        orderId: order.id,
        userId: user.id,
        autoApprove,
        confidence,
        riskScore,
        checks,
      });

      return {
        autoApprove,
        reason,
        confidence,
        riskScore,
        checks,
      };
    } catch (error: any) {
      logger.error("Error in auto-verification:", error);
      return {
        autoApprove: false,
        reason: `Error en verificación: ${error.message}`,
        confidence: 0,
        riskScore: 1,
        checks: {
          referenceFormat: false,
          amountMatch: false,
          userTrustworthy: false,
          timeValid: false,
          imageValid: false,
          duplicateCheck: false,
          velocityCheck: false,
        },
      };
    }
  }

  /**
   * 1. Verificar formato de referencia
   * Debe ser 8-10 dígitos numéricos
   */
  private async checkReferenceFormat(reference: string): Promise<boolean> {
    if (!reference) return false;
    
    // Formato válido: 8-10 dígitos
    const isValid = /^\d{8,10}$/.test(reference);
    
    // No puede ser secuencial (12345678, 11111111, etc)
    const isSequential = /^(\d)\1+$/.test(reference) || 
                        reference === "12345678" || 
                        reference === "87654321";
    
    return isValid && !isSequential;
  }

  /**
   * 2. Verificar que el monto coincida
   * Tolerancia de ±5 Bs
   */
  private async checkAmountMatch(proofAmount: number, orderTotal: number): Promise<boolean> {
    const difference = Math.abs(proofAmount - orderTotal);
    return difference <= this.MAX_AMOUNT_TOLERANCE;
  }

  /**
   * 3. Verificar confiabilidad del usuario
   */
  private async checkUserTrustworthiness(userId: string): Promise<boolean> {
    const stats = await this.getUserStats(userId);

    // Usuario nuevo (menos de 7 días) → requiere verificación manual
    if (stats.accountAge < this.MIN_ACCOUNT_AGE_DAYS) {
      return false;
    }

    // Usuario sin historial → requiere verificación manual
    if (stats.totalOrders === 0) {
      return false;
    }

    // Usuario con menos de 3 pedidos exitosos → requiere verificación manual
    if (stats.successfulOrders < this.MIN_SUCCESSFUL_ORDERS) {
      return false;
    }

    // Usuario con alta tasa de disputas → requiere verificación manual
    if (stats.disputeRate > this.MAX_DISPUTE_RATE) {
      return false;
    }

    return true;
  }

  /**
   * 4. Verificar validez temporal
   * No más de 48 horas desde el envío
   * No en horario sospechoso (2am-6am)
   */
  private async checkTimeValidity(submittedAt: Date): Promise<boolean> {
    const now = new Date();
    const hoursSinceSubmit = (now.getTime() - new Date(submittedAt).getTime()) / (1000 * 60 * 60);

    // No más de 48 horas
    if (hoursSinceSubmit > 48) {
      return false;
    }

    // Verificar hora del día (sospechoso entre 2am-6am)
    const hour = new Date(submittedAt).getHours();
    if (hour >= 2 && hour <= 6) {
      return false; // Requiere verificación manual en horario sospechoso
    }

    return true;
  }

  /**
   * 5. Verificar validez de la imagen
   * Debe existir y tener URL válida
   */
  private async checkImageValidity(imageUrl: string | null): Promise<boolean> {
    if (!imageUrl) return false;

    // Verificar que sea una URL válida
    try {
      new URL(imageUrl);
      return true;
    } catch {
      return false;
    }

    // TODO: Implementar OCR para verificar que la referencia aparezca en la imagen
    // TODO: Verificar que la imagen no sea duplicada (hash)
  }

  /**
   * 6. Verificar que la referencia no esté duplicada
   * CRÍTICO para prevenir fraude
   */
  private async checkDuplicateReference(reference: string, currentProofId: string): Promise<boolean> {
    const duplicates = await db
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.referenceNumber, reference),
          sql`${paymentProofs.id} != ${currentProofId}`
        )
      )
      .limit(1);

    // Si hay duplicados → FRAUDE
    return duplicates.length === 0;
  }

  /**
   * 7. Verificar velocidad de pedidos (Velocity Check)
   * Detecta comportamiento anormal
   */
  private async checkVelocity(userId: string): Promise<boolean> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Contar pedidos en la última hora
    const ordersLastHour = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, oneHourAgo)
        )
      );

    const countLastHour = Number(ordersLastHour[0]?.count || 0);
    if (countLastHour > this.MAX_ORDERS_PER_HOUR) {
      logger.warn(`⚠️ Velocity check failed: ${countLastHour} orders in last hour`, { userId });
      return false;
    }

    // Contar pedidos en el último día
    const ordersLastDay = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, oneDayAgo)
        )
      );

    const countLastDay = Number(ordersLastDay[0]?.count || 0);
    if (countLastDay > this.MAX_ORDERS_PER_DAY) {
      logger.warn(`⚠️ Velocity check failed: ${countLastDay} orders in last day`, { userId });
      return false;
    }

    return true;
  }

  /**
   * Obtener estadísticas del usuario
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return {
        totalOrders: 0,
        successfulOrders: 0,
        disputedOrders: 0,
        disputeRate: 0,
        avgOrderValue: 0,
        accountAge: 0,
        lastOrderDate: null,
      };
    }

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    const totalOrders = userOrders.length;
    const successfulOrders = userOrders.filter((o) => o.status === "completed").length;
    const disputedOrders = userOrders.filter((o) => o.status === "disputed").length;
    const disputeRate = totalOrders > 0 ? disputedOrders / totalOrders : 0;

    const totalValue = userOrders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

    const accountAge = Math.floor(
      (Date.now() - new Date(user.createdAt!).getTime()) / (1000 * 60 * 60 * 24)
    );

    const lastOrderDate = userOrders.length > 0 ? userOrders[0].createdAt : null;

    return {
      totalOrders,
      successfulOrders,
      disputedOrders,
      disputeRate,
      avgOrderValue,
      accountAge,
      lastOrderDate,
    };
  }

  /**
   * Calcular confianza y riesgo
   */
  private async calculateConfidenceAndRisk(
    checks: any,
    proof: any,
    order: any,
    user: any
  ): Promise<{ confidence: number; riskScore: number; reason: string }> {
    let confidence = 1.0;
    let riskScore = 0.0;
    const reasons: string[] = [];

    // Penalizar por cada check fallido
    if (!checks.referenceFormat) {
      confidence -= 0.3;
      riskScore += 0.4;
      reasons.push("Formato de referencia inválido");
    }

    if (!checks.amountMatch) {
      confidence -= 0.4;
      riskScore += 0.5;
      reasons.push("Monto no coincide");
    }

    if (!checks.userTrustworthy) {
      confidence -= 0.3;
      riskScore += 0.3;
      reasons.push("Usuario no confiable");
    }

    if (!checks.timeValid) {
      confidence -= 0.2;
      riskScore += 0.2;
      reasons.push("Tiempo inválido o hora sospechosa");
    }

    if (!checks.imageValid) {
      confidence -= 0.2;
      riskScore += 0.2;
      reasons.push("Imagen inválida");
    }

    if (!checks.duplicateCheck) {
      confidence -= 0.5;
      riskScore += 0.8;
      reasons.push("⚠️ REFERENCIA DUPLICADA - POSIBLE FRAUDE");
    }

    if (!checks.velocityCheck) {
      confidence -= 0.3;
      riskScore += 0.4;
      reasons.push("⚠️ VELOCIDAD ANORMAL - POSIBLE FRAUDE");
    }

    // Obtener estadísticas del usuario para ajustar
    const stats = await this.getUserStats(user.id);

    // Bonus por buen historial
    if (stats.successfulOrders >= 10 && stats.disputeRate === 0) {
      confidence += 0.1;
      riskScore -= 0.1;
      reasons.push("✅ Usuario con excelente historial");
    }

    // Asegurar rangos válidos
    confidence = Math.max(0, Math.min(1, confidence));
    riskScore = Math.max(0, Math.min(1, riskScore));

    const reason = reasons.length > 0 
      ? reasons.join(", ") 
      : "Todas las validaciones pasaron correctamente";

    return { confidence, riskScore, reason };
  }

  /**
   * Registrar intento de fraude
   */
  async logFraudAttempt(userId: string, proofId: string, reason: string): Promise<void> {
    logger.error(`🚨 FRAUD ATTEMPT DETECTED`, {
      userId,
      proofId,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Incrementar contador de fraude en audit_logs
    const { auditLogs } = await import('@shared/schema-mysql');
    await db.insert(auditLogs).values({
      userId,
      action: 'fraud_attempt',
      entityType: 'payment_proof',
      entityId: proofId,
      changes: JSON.stringify({ reason }),
    });

    // Notificar al admin via WebSocket
    try {
      const { notifyAdminFraud } = await import('./websocket');
      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      notifyAdminFraud({ userId, userName: user?.name ?? 'Usuario desconocido', proofId, reason });
    } catch {}

    // Contar intentos recientes del usuario
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFraud = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userId, userId),
        eq(auditLogs.action, 'fraud_attempt'),
        gte(auditLogs.createdAt, since),
      ));

    const fraudCount = Number(recentFraud[0]?.count || 0);

    // Bloquear usuario si tiene 3+ intentos en 7 días
    if (fraudCount >= 3) {
      await db.update(users).set({ isActive: false }).where(eq(users.id, userId));
      logger.error(`🔒 User ${userId} BLOCKED after ${fraudCount} fraud attempts`);
    }
  }
}

export const autoVerificationService = AutoVerificationService.getInstance();
