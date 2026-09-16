import { db } from "./db";
import {
  giftCards,
  giftCardTransactions,
  giftCardDesigns,
  paymentProofs,
} from "@shared/schema-mysql";
import { eq, and, or } from "drizzle-orm";

export class GiftCardService {
  static readonly EXPIRY_DAYS = 30;

  private static generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += "-";
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Crear gift card tras pago confirmado (llamado desde webhook Stripe o aprobación manual)
  static async purchaseGiftCard(data: {
    purchasedBy: string;
    amount: number;
    recipientEmail?: string;
    recipientPhone?: string;
    message?: string;
    design?: string;
    activateImmediately?: boolean; // true = pago Stripe ya confirmado
  }) {
    const {
      purchasedBy,
      amount,
      recipientEmail,
      recipientPhone,
      message,
      design = "default",
      activateImmediately = false,
    } = data;

    if (amount < 1000) return { success: false, error: "Monto mínimo: €10" };

    const code = this.generateCode();
    const giftCardId = crypto.randomUUID();
    const expiresAt = activateImmediately
      ? new Date(Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(giftCards).values({
      id: giftCardId,
      code,
      amount,
      balance: activateImmediately ? amount : 0,
      status: activateImmediately ? "active" : "pending_payment",
      purchasedBy,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      message: message || null,
      design,
      expiresAt,
    });

    if (activateImmediately) {
      await db.insert(giftCardTransactions).values({
        id: crypto.randomUUID(),
        giftCardId,
        amount,
        balanceAfter: amount,
      });
    }

    return {
      success: true,
      giftCard: {
        id: giftCardId,
        code,
        amount: amount / 100,
        status: activateImmediately ? "active" : "pending_payment",
        expiresAt,
      },
    };
  }

  // Subir comprobante de pago para una gift card
  static async submitPaymentProof(data: {
    giftCardId: string;
    userId: string;
    paymentProvider: string;
    proofImageUrl: string;
    referenceNumber?: string;
    amount: number;
  }) {
    const {
      giftCardId,
      userId,
      paymentProvider,
      proofImageUrl,
      referenceNumber,
      amount,
    } = data;

    const [gc] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.id, giftCardId))
      .limit(1);
    if (!gc) return { success: false, error: "Gift card no encontrada" };
    if (gc.purchasedBy !== userId)
      return { success: false, error: "No autorizado" };
    if (gc.status !== "pending_payment")
      return {
        success: false,
        error: "Esta gift card ya tiene pago registrado",
      };

    await db.insert(paymentProofs).values({
      id: crypto.randomUUID(),
      orderId: null as any,
      giftCardId,
      userId,
      paymentProvider,
      proofImageUrl,
      referenceNumber: referenceNumber || null,
      amount,
      status: "pending",
    });

    return {
      success: true,
      message: "Comprobante enviado. El admin lo verificará pronto.",
    };
  }

  // Admin: obtener gift cards pendientes de activación
  static async getPendingGiftCards() {
    const pending = await db
      .select()
      .from(giftCards)
      .where(
        or(
          eq(giftCards.status, "pending_payment"),
          eq(giftCards.status, "pending_verification"),
        ),
      );

    return {
      success: true,
      giftCards: pending.map((gc) => ({ ...gc, amount: gc.amount / 100 })),
    };
  }

  // Admin: activar gift card tras verificar pago
  static async activateGiftCard(giftCardId: string, adminId: string) {
    const [gc] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.id, giftCardId))
      .limit(1);
    if (!gc) return { success: false, error: "Gift card no encontrada" };

    const expiresAt = new Date(
      Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await db
      .update(giftCards)
      .set({
        status: "active",
        balance: gc.amount,
        expiresAt,
      })
      .where(eq(giftCards.id, giftCardId));

    // Marcar comprobante como verificado
    await db
      .update(paymentProofs)
      .set({
        status: "approved",
        verifiedBy: adminId,
        verifiedAt: new Date(),
      })
      .where(
        and(
          eq(paymentProofs.giftCardId, giftCardId),
          eq(paymentProofs.status, "pending"),
        ),
      );

    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId,
      amount: gc.amount,
      balanceAfter: gc.amount,
    });

    // Notificar al comprador que su gift card quedó activa + enviar el código
    // por email (comprador y destinatario): antes el código solo era visible
    // en la app y nunca se enviaba por correo.
    try {
      const { sendPushToUser } = await import("./enhancedPushService");
      if (gc.purchasedBy) {
        await sendPushToUser(gc.purchasedBy, {
          title: "🎁 Gift Card activada",
          body: `Tu tarjeta de ${(gc.amount / 100).toFixed(2)} € ya está lista para usar o regalar.`,
          data: { screen: "GiftCards" },
        });
      }
    } catch (err) {
      console.error("Error notifying gift card activation:", err);
    }
    await this.emailCode(gc);

    return { success: true, message: "Gift card activada", expiresAt };
  }

  // Envía el código por email al comprador y, si se indicó, al destinatario
  static async emailCode(gc: any) {
    try {
      const { sendGiftCardCodeEmail } = await import("./emailService");
      const emails = new Set<string>();
      if (gc.recipientEmail) emails.add(String(gc.recipientEmail));
      try {
        const { users } = await import("@shared/schema-mysql");
        const [buyer] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, gc.purchasedBy))
          .limit(1);
        if (buyer?.email) emails.add(String(buyer.email));
      } catch {}
      for (const to of emails) {
        await sendGiftCardCodeEmail({
          to,
          code: gc.code,
          amountEuros: (gc.amount / 100).toFixed(2),
          message: gc.message,
        });
      }
    } catch (err) {
      console.error("Error emailing gift card code:", err);
    }
  }

  // Activación desde el webhook de Stripe (payment_intent.succeeded con
  // metadata.giftCardId): el cliente ya no depende de llamar a
  // /stripe-success, que se perdía si la app se cerraba justo al pagar.
  static async activateFromStripeWebhook(giftCardId: string) {
    const [gc] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.id, giftCardId))
      .limit(1);
    if (!gc) return { success: false, error: "Gift card no encontrada" };
    if (gc.status === "active") return { success: true, message: "Ya activa" };

    const expiresAt = new Date(
      Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );
    await db
      .update(giftCards)
      .set({ status: "active", balance: gc.amount, expiresAt })
      .where(eq(giftCards.id, giftCardId));

    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId,
      amount: gc.amount,
      balanceAfter: gc.amount,
    });

    const activated = { ...gc, status: "active" };
    await this.emailCode(activated);
    try {
      const { sendPushToUser } = await import("./enhancedPushService");
      await sendPushToUser(gc.purchasedBy, {
        title: "🎁 Gift Card activada",
        body: `Tu tarjeta de ${(gc.amount / 100).toFixed(2)} € ya está lista para usar o regalar.`,
        data: { screen: "GiftCards" },
      });
    } catch {}

    return { success: true, message: "Gift card activada desde webhook" };
  }

  // Admin: rechazar gift card
  static async rejectGiftCard(
    giftCardId: string,
    adminId: string,
    reason: string,
  ) {
    await db
      .update(giftCards)
      .set({ status: "rejected" })
      .where(eq(giftCards.id, giftCardId));

    await db
      .update(paymentProofs)
      .set({
        status: "rejected",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        verificationNotes: reason,
      })
      .where(
        and(
          eq(paymentProofs.giftCardId, giftCardId),
          eq(paymentProofs.status, "pending"),
        ),
      );

    return { success: true, message: "Gift card rechazada" };
  }

  // Validar gift card en checkout
  static async validateGiftCard(code: string) {
    const [gc] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.code, code.toUpperCase()))
      .limit(1);
    if (!gc) return { success: false, error: "Tarjeta no encontrada" };
    if (gc.status !== "active")
      return {
        success: false,
        error:
          gc.status === "pending_payment"
            ? "Tarjeta pendiente de activación"
            : "Tarjeta no activa",
      };
    if (gc.expiresAt && new Date() > new Date(gc.expiresAt)) {
      await db
        .update(giftCards)
        .set({ status: "expired" })
        .where(eq(giftCards.id, gc.id));
      return { success: false, error: "Tarjeta expirada" };
    }
    if (gc.balance <= 0) return { success: false, error: "Tarjeta sin saldo" };

    return {
      success: true,
      giftCard: {
        id: gc.id,
        code: gc.code,
        balance: gc.balance / 100,
        amount: gc.amount / 100,
        expiresAt: gc.expiresAt,
      },
    };
  }

  // Canjear gift card en pedido.
  // El descuento de saldo es ATÓMICO (UPDATE condicional con saldo >= importe):
  // dos pedidos simultáneos no pueden gastar dos veces el mismo saldo.
  static async redeemGiftCard(data: {
    code: string;
    orderId: string;
    userId: string;
    amountToUse: number;
  }) {
    const { code, orderId, amountToUse } = data;

    const validation = await this.validateGiftCard(code);
    if (!validation.success) return validation;

    const [gc] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.code, code.toUpperCase()))
      .limit(1);
    if (!gc) return { success: false, error: "Tarjeta no encontrada" };

    const result = await db.execute(
      `UPDATE gift_cards
         SET balance = balance - ?,
             redeemed_at = ?,
             status = IF(balance - ? <= 0, 'redeemed', 'active'),
             updated_at = NOW()
       WHERE id = ? AND status = 'active' AND balance >= ?`,
      [amountToUse, new Date(), amountToUse, gc.id, amountToUse],
    );
    const affected = Number((result as any)[0]?.affectedRows ?? 0);
    if (affected === 0) {
      return { success: false, error: "Saldo insuficiente o tarjeta ya usada" };
    }

    const [updated] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.id, gc.id))
      .limit(1);
    const newBalance = updated?.balance ?? Math.max(0, gc.balance - amountToUse);

    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId: gc.id,
      orderId,
      amount: -amountToUse,
      balanceAfter: newBalance,
    });

    return {
      success: true,
      amountRedeemed: amountToUse / 100,
      remainingBalance: newBalance / 100,
    };
  }

  // Obtener gift cards del usuario
  static async getUserGiftCards(userId: string) {
    try {
      const purchased = await db
        .select()
        .from(giftCards)
        .where(eq(giftCards.purchasedBy, userId));
      return {
        success: true,
        purchased: purchased.map((gc) => ({
          ...gc,
          amount: gc.amount / 100,
          balance: gc.balance / 100,
        })),
        redeemed: [],
      };
    } catch (error: any) {
      return { success: true, purchased: [], redeemed: [] };
    }
  }

  static async getDesigns() {
    try {
      const designs = await db
        .select()
        .from(giftCardDesigns)
        .where(eq(giftCardDesigns.isActive, true))
        .orderBy(giftCardDesigns.displayOrder);
      return { success: true, designs };
    } catch {
      return { success: true, designs: [] };
    }
  }

  static async getTransactionHistory(giftCardId: string) {
    const transactions = await db
      .select()
      .from(giftCardTransactions)
      .where(eq(giftCardTransactions.giftCardId, giftCardId));
    return {
      success: true,
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amount / 100,
        balanceAfter: t.balanceAfter / 100,
      })),
    };
  }
}
