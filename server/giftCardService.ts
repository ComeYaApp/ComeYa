import { db } from './db';
import { giftCards, giftCardTransactions, giftCardDesigns } from '@shared/schema-mysql';
import { eq, and } from 'drizzle-orm';

export class GiftCardService {
  // Generar código único
  private static generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Comprar gift card
  static async purchaseGiftCard(data: {
    purchasedBy: string;
    amount: number;
    recipientEmail?: string;
    recipientPhone?: string;
    message?: string;
    design?: string;
  }) {
    const {
      purchasedBy,
      amount,
      recipientEmail,
      recipientPhone,
      message,
      design = 'default',
    } = data;

    if (amount < 1000) {
      return { success: false, error: 'Monto mínimo: Bs.10' };
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 año

    const giftCardId = crypto.randomUUID();

    await db.insert(giftCards).values({
      id: giftCardId,
      code,
      amount,
      balance: amount,
      status: 'active',
      purchasedBy,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      message: message || null,
      design,
      expiresAt,
    });

    // Registrar transacción
    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId,
      amount,
      balanceAfter: amount,
    });

    return {
      success: true,
      giftCard: {
        id: giftCardId,
        code,
        amount: amount / 100,
        expiresAt,
      },
    };
  }

  // Validar y obtener gift card
  static async validateGiftCard(code: string) {
    const [giftCard] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.code, code.toUpperCase()))
      .limit(1);

    if (!giftCard) {
      return { success: false, error: 'Tarjeta no encontrada' };
    }

    if (giftCard.status !== 'active') {
      return { success: false, error: 'Tarjeta no activa' };
    }

    if (giftCard.expiresAt && new Date() > new Date(giftCard.expiresAt)) {
      await db
        .update(giftCards)
        .set({ status: 'expired' })
        .where(eq(giftCards.id, giftCard.id));
      return { success: false, error: 'Tarjeta expirada' };
    }

    if (giftCard.balance <= 0) {
      return { success: false, error: 'Tarjeta sin saldo' };
    }

    return {
      success: true,
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        balance: giftCard.balance / 100,
        amount: giftCard.amount / 100,
      },
    };
  }

  // Canjear gift card en pedido
  static async redeemGiftCard(data: {
    code: string;
    orderId: string;
    userId: string;
    amountToUse: number;
  }) {
    const { code, orderId, userId, amountToUse } = data;

    const validation = await this.validateGiftCard(code);
    if (!validation.success) {
      return validation;
    }

    const [giftCard] = await db
      .select()
      .from(giftCards)
      .where(eq(giftCards.code, code.toUpperCase()))
      .limit(1);

    if (!giftCard) {
      return { success: false, error: 'Tarjeta no encontrada' };
    }

    if (amountToUse > giftCard.balance) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    const newBalance = giftCard.balance - amountToUse;

    // Actualizar saldo
    await db
      .update(giftCards)
      .set({
        balance: newBalance,
        redeemedAt: new Date(),
        status: newBalance === 0 ? 'redeemed' : 'active',
      })
      .where(eq(giftCards.id, giftCard.id));

    // Registrar transacción
    await db.insert(giftCardTransactions).values({
      id: crypto.randomUUID(),
      giftCardId: giftCard.id,
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
      console.error('getUserGiftCards error:', error?.message);
      return { success: true, purchased: [], redeemed: [] };
    }
  }

  // Obtener diseños disponibles
  static async getDesigns() {
    try {
      const designs = await db
        .select()
        .from(giftCardDesigns)
        .where(eq(giftCardDesigns.isActive, true))
        .orderBy(giftCardDesigns.displayOrder);
      return { success: true, designs };
    } catch (error: any) {
      console.error('getDesigns error:', error?.message);
      return { success: true, designs: [] };
    }
  }

  // Obtener historial de transacciones
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
