// Digital Payment Service - Integrado con UnifiedFinancialService
import { db } from "./db";
import { orders, paymentMethods, paymentProofs, systemSettings, users, businesses } from "@shared/schema-mysql";
import { eq, and, count, sum, gte } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";
import { autoVerificationService } from "./autoVerificationService";
import { logger } from "./logger";
import { notifyPagoMovilStatus, sendPushToUser } from "./enhancedPushService";
import { createPayoutsForOrder } from "./payoutService";

interface PaymentProofData {
  orderId: string;
  userId: string;
  paymentProvider: string;
  referenceNumber: string;
  proofImageUrl?: string;
  amount: number;
}

interface PaymentVerificationResult {
  success: boolean;
  message: string;
  orderId?: string;
}

export class DigitalPaymentService {
  private static instance: DigitalPaymentService;

  private constructor() {}

  static getInstance(): DigitalPaymentService {
    if (!DigitalPaymentService.instance) {
      DigitalPaymentService.instance = new DigitalPaymentService();
    }
    return DigitalPaymentService.instance;
  }

  // Get active payment methods
  async getActivePaymentMethods() {
    try {
      const methods = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.isActive, true));
      
      return methods;
    } catch (error: any) {
      logger.error("Error getting active payment methods:", error);
      return [];
    }
  }

  // Submit payment proof (Pago Móvil, Binance Pay, Zinli, Zelle)
  async submitPaymentProof(data: PaymentProofData): Promise<{ success: boolean; proofId?: string; message: string }> {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, data.orderId))
        .limit(1);

      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }

      if (order.status !== "pending") {
        return { success: false, message: "El pedido ya fue procesado" };
      }

      // Verify payment method requires manual verification
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(and(
          eq(paymentMethods.provider, data.paymentProvider),
          eq(paymentMethods.isActive, true)
        ))
        .limit(1);

      if (!method) {
        return { success: false, message: "Método de pago no disponible" };
      }

      if (!method.requiresManualVerification) {
        return { success: false, message: "Este método no requiere comprobante" };
      }

      // Create payment proof with UUID
      const proofId = crypto.randomUUID();
      
      await db.insert(paymentProofs).values({
        id: proofId,
        orderId: data.orderId,
        userId: data.userId,
        paymentProvider: data.paymentProvider,
        referenceNumber: data.referenceNumber,
        proofImageUrl: data.proofImageUrl,
        amount: data.amount,
        status: "pending",
        submittedAt: new Date(),
      });

      // Fetch the created proof
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.id, proofId))
        .limit(1);

      logger.info(`💳 Payment proof submitted: Order ${data.orderId} - ${data.paymentProvider}`, {
        orderId: data.orderId,
        provider: data.paymentProvider,
        reference: data.referenceNumber,
      });

      // 🤖 INTENTAR AUTO-VERIFICACIÓN (DESACTIVADO EN DESARROLLO)
      const SKIP_AUTO_VERIFICATION = process.env.NODE_ENV === 'development';
      
      if (!SKIP_AUTO_VERIFICATION) {
        const autoVerification = await autoVerificationService.shouldAutoApprove(proof.id);

        if (autoVerification.autoApprove) {
          // ✅ AUTO-APROBAR
          logger.info(`🤖 Auto-approving payment proof ${proof.id}`, {
            proofId: proof.id,
            confidence: autoVerification.confidence,
            riskScore: autoVerification.riskScore,
          });

          // Verificar automáticamente
          const verificationResult = await this.verifyPaymentProof(
            proof.id,
            "SYSTEM_AUTO",
            true,
            `Auto-aprobado (Confianza: ${(autoVerification.confidence * 100).toFixed(0)}%, Riesgo: ${(autoVerification.riskScore * 100).toFixed(0)}%)`
          );

          if (verificationResult.success) {
            return {
              success: true,
              proofId: proof.id,
              message: "¡Pago verificado automáticamente! Tu pedido está confirmado.",
            };
          }
        } else {
          // ⚠️ REQUIERE VERIFICACIÓN MANUAL
          logger.warn(`⚠️ Payment proof ${proof.id} requires manual verification`, {
            proofId: proof.id,
            reason: autoVerification.reason,
            confidence: autoVerification.confidence,
            riskScore: autoVerification.riskScore,
          });

          // Si el riesgo es muy alto, registrar como posible fraude
          if (autoVerification.riskScore > 0.7) {
            await autoVerificationService.logFraudAttempt(
              data.userId,
              proof.id,
              autoVerification.reason
            );
          }
        }
      } else {
        logger.info(`⏭️ Skipping auto-verification in development mode`);
      }

      // Update order status to pending (waiting for payment verification)
      await db
        .update(orders)
        .set({
          paymentMethod: data.paymentProvider,
          paymentProvider: data.paymentProvider,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, data.orderId));

      return {
        success: true,
        proofId: proof.id,
        message: "Comprobante enviado. Será verificado en breve.",
      };
    } catch (error: any) {
      logger.error("Error submitting payment proof:", error);
      return { success: false, message: error.message };
    }
  }

  // Verify payment proof (Admin only)
  async verifyPaymentProof(
    proofId: string,
    adminId: string,
    approved: boolean,
    notes?: string
  ): Promise<PaymentVerificationResult> {
    try {
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.id, proofId))
        .limit(1);

      if (!proof) {
        return { success: false, message: "Comprobante no encontrado" };
      }

      if (proof.status !== "pending") {
        return { success: false, message: "Este comprobante ya fue procesado" };
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, proof.orderId))
        .limit(1);

      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }

      if (approved) {
        // Approve payment and process order
        await db.transaction(async (tx) => {
          // Update proof status
          await tx
            .update(paymentProofs)
            .set({
              status: "approved",
              verifiedBy: adminId,
              verifiedAt: new Date(),
              verificationNotes: notes,
            })
            .where(eq(paymentProofs.id, proofId));

          // Update order to accepted (ready for business to prepare)
          await tx
            .update(orders)
            .set({
              status: "accepted",
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(orders.id, proof.orderId));
        });

        logger.info(`✅ Payment verified: Order ${order.id}`, {
          orderId: order.id,
          provider: proof.paymentProvider,
        });

        // Push notification al cliente
        await notifyPagoMovilStatus(proof.userId, 'verified', order.id);

        // Push notification al negocio para que empiece a preparar
        const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
        if (biz?.ownerId) {
          await sendPushToUser(biz.ownerId, {
            title: "💳 Pago confirmado — ¡A preparar!",
            body: `Pedido #${order.id.slice(-6)} pagado. Empieza la preparación.`,
            data: { orderId: order.id, screen: "BusinessOrders" },
          });
        }

        return {
          success: true,
          message: "Pago verificado y pedido activado",
          orderId: order.id,
        };
      } else {
        // Reject payment
        await db.transaction(async (tx) => {
          await tx
            .update(paymentProofs)
            .set({
              status: "rejected",
              verifiedBy: adminId,
              verifiedAt: new Date(),
              verificationNotes: notes || "Comprobante rechazado",
            })
            .where(eq(paymentProofs.id, proofId));

          await tx
            .update(orders)
            .set({
              status: "payment_failed",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, proof.orderId));
        });

        logger.warn(`❌ Payment proof rejected: Order ${order.id}`, {
          orderId: order.id,
          provider: proof.paymentProvider,
          reason: notes,
        });

        // Push notification al cliente
        await notifyPagoMovilStatus(proof.userId, 'rejected', order.id, notes);

        return {
          success: true,
          message: "Comprobante rechazado",
          orderId: order.id,
        };
      }
    } catch (error: any) {
      logger.error("Error verifying payment proof:", error);
      return { success: false, message: error.message };
    }
  }

  // Process PayPal payment (automatic)
  async processPayPalPayment(orderId: string, paypalTransactionId: string): Promise<PaymentVerificationResult> {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }

      // Get PayPal settings
      const settings = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.category, "payment_providers"));

      const paypalClientId = settings.find(s => s.key === "paypal_client_id")?.value;
      const paypalSecret = settings.find(s => s.key === "paypal_secret")?.value;

      if (!paypalClientId || !paypalSecret) {
        return { success: false, message: "PayPal no configurado" };
      }

      // TODO: Verify PayPal transaction with PayPal API
      // For now, we'll trust the transaction ID

      await db.transaction(async (tx) => {
        // Update order
        await tx
          .update(orders)
          .set({
            status: "confirmed",
            paymentMethod: "paypal",
            paymentProvider: "paypal",
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));

        // Calculate commissions
        const commissions = await financialService.calculateCommissions(
          order.totalAmount,
          order.deliveryFee || 0
        );

        // Get PayPal commission (5%)
        const [paypalMethod] = await tx
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.provider, "paypal"))
          .limit(1);

        const paypalFee = paypalMethod ? Math.round(order.totalAmount * (paypalMethod.commissionPercentage / 100)) : 0;

        // Get business owner ID
        const [business] = await tx.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
        
        if (!business?.ownerId) {
          throw new Error(`Business owner not found for business ${order.businessId}`);
        }

        // Distribute funds (deducting PayPal fee from business)
        await financialService.updateWalletBalance(
          business.ownerId,
          commissions.business - paypalFee,
          "order_payment",
          order.id,
          `Pago de pedido #${order.id.slice(-6)} - PayPal (${paypalMethod?.commissionPercentage}% fee)`
        );

        if (order.driverId) {
          await financialService.updateWalletBalance(
            order.driverId,
            commissions.driver,
            "delivery_payment",
            order.id,
            `Entrega de pedido #${order.id.slice(-6)}`
          );
        }

        // Platform gets commission + PayPal fee
        const [adminUser] = await tx
          .select()
          .from(await import("@shared/schema-mysql").then(m => m.users))
          .where(eq((await import("@shared/schema-mysql").then(m => m.users)).role, "admin"))
          .limit(1);

        if (adminUser) {
          await financialService.updateWalletBalance(
            adminUser.id,
            commissions.platform + paypalFee,
            "platform_commission",
            order.id,
            `Comisión ComeYa + PayPal fee - Pedido #${order.id.slice(-6)}`
          );
        }

        logger.info(`✅ PayPal payment processed: Order ${order.id}`, {
          orderId: order.id,
          transactionId: paypalTransactionId,
          commissions,
          paypalFee,
        });
      });

      return {
        success: true,
        message: "Pago con PayPal procesado exitosamente",
        orderId: order.id,
      };
    } catch (error: any) {
      logger.error("Error processing PayPal payment:", error);
      return { success: false, message: error.message };
    }
  }

  // Get pending payment proofs (Admin)
  async getPendingPaymentProofs() {
    const proofs = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.status, "pending"))
      .orderBy(paymentProofs.submittedAt);

    // Convert relative URLs to absolute
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    return proofs.map(proof => ({
      ...proof,
      proofImageUrl: proof.proofImageUrl?.startsWith('http') 
        ? proof.proofImageUrl 
        : `${backendUrl}${proof.proofImageUrl}`,
    }));
  }

  // Métricas genéricas de pagos (todos los métodos)
  async getPaymentMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [all, pending, approved, rejected, todayApproved, todayRejected] = await Promise.all([
      db.select({ count: count() }).from(paymentProofs),
      db.select({ count: count() }).from(paymentProofs).where(eq(paymentProofs.status, 'pending')),
      db.select({ count: count(), total: sum(paymentProofs.amount) }).from(paymentProofs).where(eq(paymentProofs.status, 'approved')),
      db.select({ count: count() }).from(paymentProofs).where(eq(paymentProofs.status, 'rejected')),
      db.select({ count: count(), total: sum(paymentProofs.amount) }).from(paymentProofs).where(and(eq(paymentProofs.status, 'approved'), gte(paymentProofs.verifiedAt, today))),
      db.select({ count: count() }).from(paymentProofs).where(and(eq(paymentProofs.status, 'rejected'), gte(paymentProofs.verifiedAt, today))),
    ]);

    // Agrupar por proveedor
    const byProvider = await db
      .select({ provider: paymentProofs.paymentProvider, count: count(), total: sum(paymentProofs.amount) })
      .from(paymentProofs)
      .where(eq(paymentProofs.status, 'approved'))
      .groupBy(paymentProofs.paymentProvider);

    // Convertir array a Record<string, {count, amount}>
    const totalByMethod: Record<string, { count: number; amount: number }> = {};
    byProvider.forEach(item => {
      totalByMethod[item.provider] = {
        count: item.count,
        amount: item.total || 0,
      };
    });

    return {
      totalByMethod,
      pendingProofs: pending[0].count,
      approvedToday: todayApproved[0].count,
      rejectedToday: todayRejected[0].count,
      totalRevenue: approved[0].total || 0,
    };
  }

  // Get payment proof by order ID
  async getPaymentProofByOrderId(orderId: string) {
    const [proof] = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.orderId, orderId))
      .limit(1);

    return proof;
  }
}

export const digitalPaymentService = DigitalPaymentService.getInstance();
