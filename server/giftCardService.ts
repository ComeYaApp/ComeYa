import { db } from './db';
import { giftCards, giftCardTransactions, giftCardDesigns, paymentProofs } from '@shared/schema-mysql';
import { eq, and, or } from 'drizzle-orm';

export class GiftCardService {
  static readonly EXPIRY_DAYS = 365;

  private static generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Crear gift card en estado pending_payment
  static async purchaseGiftCard(data: {
    purchasedBy: string;
    amount: number;
    recipientEmail?: string;
    recipientPhone?: string;
    message?: string;
    design?: string;
  }) {
    const { purchasedBy, amount, recipientEmail, recipientPhone, message, design = 'default' } = data;

    if (amount < 1000) return { success: false, error: 'Monto mínimo: €10' };

    const code = this.generateCode();
    const giftCardId = crypto.randomUUID();

    await db.insert(giftCards).values({
      id: giftCardId,
      code,
      amount,
      balance: 0, // saldo 0 hasta que admin active
      status: 'pending_payment',
      purchasedBy,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      message: message || null,
      design,
      expiresAt: null, // se asigna al activar
    });

    return { success: true, giftCard: { id: giftCardId, code, amount: amount / 100 } };
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
    const { giftCardId, userId, paymentProvider, proofImageUrl, referenceNumber, amount } = data;

    const [gc] = await db.select().from(giftCards).where(eq(giftCards.id, giftCardId)).limit(1);
    if (!gc) return { success: false, error: 'Gift card no encontrada' };
    if (gc.purchasedBy !== userId) return { success: false, error: 'No autorizado' };
    if (gc.status !== 'pending_payment') return { success: false, error: 'Esta gift card ya tiene pago registrado' };

    await db.insert(paymentProofs).values({
      id: crypto.randomUUID(),
      orderId: null as any,
      giftCardId,
      userId,
      paymentProvider,
      proofImageUrl,
      referenceNumber: referenceNumber || null,
      amount,
      status: 'pending',
    });

    return { success: true, message: 'Comprobante enviado. El admin lo verificará pronto.' };
  }

  // Admin: obtener gift cards pendientes de activación
  static async getPendingGiftCards() {
    const pending = await db
      .select()
      .from(giftCards)
      .where(or(eq(giftCards.status, 'pending_payment'), eq(giftCards.status, 'pending_verification')));

    return { success: true, giftCards: pending.map(gc => ({ ...gc, amount: gc.amount / 100 })) };
  }

  // Admin: activar gift card tras verificar pago
  static async activateGiftCard(giftCardId: string, adminId: string) {
    const [gc] = await db.select().from(giftCards).where(eq(giftCards.id, giftCardId)).limit(1);
    if (!gc) return { success: false, error: 'Gift card no encontrada' };

    const expiresAt = new Date(Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.update(giftCards).set({
      status: 'active',
      balance: gc.amount,
      expiresAt,
    }).where(eq(giftCards.id, giftCardId));

    // Marcar comprobante como verificado
    await db.update(paymentProofs).set({
      status: 'approved',
      verifiedBy: adminId,
      verifiedAt: new Date(),
    }).where(and(eq(paymentProofs.giftCardId, giftCardId), eq(paymentProofs.status, 'pending')));

    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId,
      amount: gc.amount,
      balanceAfter: gc.amount,
    });

    return { success: true, message: 'Gift card activada', expiresAt };
  }

  // Admin: rechazar gift card
  static async rejectGiftCard(giftCardId: string, adminId: string, reason: string) {
    await db.update(giftCards).set({ status: 'rejected' }).where(eq(giftCards.id, giftCardId));

    await db.update(paymentProofs).set({
      status: 'rejected',
      verifiedBy: adminId,
      verifiedAt: new Date(),
      verificationNotes: reason,
    }).where(and(eq(paymentProofs.giftCardId, giftCardId), eq(paymentProofs.status, 'pending')));

    return { success: true, message: 'Gift card rechazada' };
  }

  // Validar gift card en checkout
  static async validateGiftCard(code: string) {
    const [gc] = await db.select().from(giftCards).where(eq(giftCards.code, code.toUpperCase())).limit(1);
    if (!gc) return { success: false, error: 'Tarjeta no encontrada' };
    if (gc.status !== 'active') return { success: false, error: gc.status === 'pending_payment' ? 'Tarjeta pendiente de activación' : 'Tarjeta no activa' };
    if (gc.expiresAt && new Date() > new Date(gc.expiresAt)) {
      await db.update(giftCards).set({ status: 'expired' }).where(eq(giftCards.id, gc.id));
      return { success: false, error: 'Tarjeta expirada' };
    }
    if (gc.balance <= 0) return { success: false, error: 'Tarjeta sin saldo' };

    return { success: true, giftCard: { id: gc.id, code: gc.code, balance: gc.balance / 100, amount: gc.amount / 100, expiresAt: gc.expiresAt } };
  }

  // Canjear gift card en pedido
  static async redeemGiftCard(data: { code: string; orderId: string; userId: string; amountToUse: number }) {
    const { code, orderId, amountToUse } = data;

    const validation = await this.validateGiftCard(code);
    if (!validation.success) return validation;

    const [gc] = await db.select().from(giftCards).where(eq(giftCards.code, code.toUpperCase())).limit(1);
    if (!gc || amountToUse > gc.balance) return { success: false, error: 'Saldo insuficiente' };

    const newBalance = gc.balance - amountToUse;

    await db.update(giftCards).set({
      balance: newBalance,
      redeemedAt: new Date(),
      status: newBalance === 0 ? 'redeemed' : 'active',
    }).where(eq(giftCards.id, gc.id));

    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId: gc.id,
      orderId,
      amount: -amountToUse,
      balanceAfter: newBalance,
    });

    return { success: true, amountRedeemed: amountToUse / 100, remainingBalance: newBalance / 100 };
  }

  // Obtener gift cards del usuario
  static async getUserGiftCards(userId: string) {
    try {
      const purchased = await db.select().from(giftCards).where(eq(giftCards.purchasedBy, userId));
      return {
        success: true,
        purchased: purchased.map(gc => ({ ...gc, amount: gc.amount / 100, balance: gc.balance / 100 })),
        redeemed: [],
      };
    } catch (error: any) {
      return { success: true, purchased: [], redeemed: [] };
    }
  }

  static async getDesigns() {
    try {
      const designs = await db.select().from(giftCardDesigns).where(eq(giftCardDesigns.isActive, true)).orderBy(giftCardDesigns.displayOrder);
      return { success: true, designs };
    } catch {
      return { success: true, designs: [] };
    }
  }

  static async getTransactionHistory(giftCardId: string) {
    const transactions = await db.select().from(giftCardTransactions).where(eq(giftCardTransactions.giftCardId, giftCardId));
    return { success: true, transactions: transactions.map(t => ({ ...t, amount: t.amount / 100, balanceAfter: t.balanceAfter / 100 })) };
  }
}
