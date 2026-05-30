// Unified Financial Service - Single Source of Truth for All Financial Operations
import { db } from "./db";
import { systemSettings, wallets, transactions } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { SubscriptionService } from "./subscriptionService";
import { logger } from "./logger";

interface CommissionRates {
  platform: number;
  business: number;
  driver: number;
}

export class UnifiedFinancialService {
  private static instance: UnifiedFinancialService;
  private cachedRates: CommissionRates | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): UnifiedFinancialService {
    if (!UnifiedFinancialService.instance) {
      UnifiedFinancialService.instance = new UnifiedFinancialService();
    }
    return UnifiedFinancialService.instance;
  }

  // Get commission rates with caching and validation
  async getCommissionRates(): Promise<CommissionRates> {
    const now = Date.now();

    if (this.cachedRates && now < this.cacheExpiry) {
      return this.cachedRates;
    }

    try {
      const settings = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.category, "commissions"));

      const platformRate = parseFloat(
        settings.find((s) => s.key === "platform_commission_rate")?.value ||
          "0.15",
      );
      const businessRate = parseFloat(
        settings.find((s) => s.key === "business_commission_rate")?.value ||
          "1.00",
      );
      const driverRate = parseFloat(
        settings.find((s) => s.key === "driver_commission_rate")?.value ||
          "1.00",
      );

      // Validate ranges for the new model: 15% markup sobre productos, 100% del producto al negocio, 100% del delivery al driver
      if (platformRate < 0 || platformRate > 1) {
        throw new Error(
          `Platform commission (markup) must be between 0% and 100% of products. Current: ${(platformRate * 100).toFixed(2)}%`,
        );
      }
      if (businessRate <= 0 || businessRate > 1) {
        throw new Error(
          `Business share must be between 0 and 1 (representa % del precio base de productos). Current: ${businessRate}`,
        );
      }
      if (driverRate <= 0 || driverRate > 1) {
        throw new Error(
          `Driver share must be between 0 and 1 (representa % de la tarifa de entrega). Current: ${driverRate}`,
        );
      }

      this.cachedRates = {
        platform: platformRate,
        business: businessRate,
        driver: driverRate,
      };
      this.cacheExpiry = now + this.CACHE_DURATION;

      return this.cachedRates;
    } catch (error) {
      console.error("Error getting commission rates:", error);
      throw error;
    }
  }

  // Calculate commissions - Modelo: 100% producto al negocio, 15% del producto a MOUZO, 100% delivery fee al driver
  async calculateCommissions(
    totalAmount: number,
    deliveryFee: number = 0,
    productosBase?: number,
    nemyCommission?: number,
    businessOwnerId?: string,
  ): Promise<{
    platform: number;
    business: number;
    driver: number;
    total: number;
  }> {
    const safeTotal = Math.max(0, totalAmount || 0);
    const safeDeliveryFee = Math.max(0, deliveryFee || 0);

    // Si nos dan productosBase o nemyCommission, respetarlos para backwards compatibility
    let productBase =
      productosBase && productosBase > 0
        ? productosBase
        : safeTotal - safeDeliveryFee;

    // Si el total ya incluye comisión MOUZO, removerla para aislar el producto
    if (!productosBase || productosBase <= 0) {
      const baseWithoutDelivery = safeTotal - safeDeliveryFee;
      productBase =
        baseWithoutDelivery > 0 ? Math.round(baseWithoutDelivery / 1.15) : 0;
    }

    const platformAmount =
      nemyCommission && nemyCommission > 0
        ? nemyCommission
        : Math.round(
            productBase *
              (await this.getBusinessCommissionRate(businessOwnerId)),
          );

    const businessAmount = productBase;
    const driverAmount = safeDeliveryFee;

    // Ajustar pequeños desfaces de redondeo para que la suma sea el total original
    let distributedTotal = platformAmount + businessAmount + driverAmount;
    if (distributedTotal !== safeTotal) {
      const delta = safeTotal - distributedTotal;
      // Ajustar al negocio para mantener driver y plataforma intactos
      distributedTotal += delta;
      productBase += delta;
    }

    return {
      platform: platformAmount,
      business: productBase,
      driver: driverAmount,
      total: platformAmount + productBase + driverAmount,
    };
  }

  // Update cash owed (for cash deliveries) with COMPLETE AUDIT TRAIL
  async updateCashOwed(
    userId: string,
    amount: number,
    orderId?: string,
    description?: string,
  ): Promise<void> {
    return await db.transaction(async (tx) => {
      let [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId}`);
      }

      const newCashOwed = wallet.cashOwed + amount;

      await tx
        .update(wallets)
        .set({
          cashOwed: newCashOwed,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      // Record transaction for tracking with COMPLETE DETAILS
      await tx.insert(transactions).values({
        walletId: wallet.id,
        userId,
        orderId,
        type: "cash_debt",
        amount,
        balanceBefore: wallet.cashOwed,
        balanceAfter: newCashOwed,
        description: description || `Cash debt from order`,
        status: "completed",
        createdAt: new Date(),
        metadata: JSON.stringify({
          previousDebt: wallet.cashOwed,
          newDebt: newCashOwed,
          debtIncrease: amount,
          timestamp: new Date().toISOString(),
          source: "cash_delivery_system",
        }),
      });

      // Log for audit trail
      logger.warn(
        `💵 Cash debt updated: User ${userId} - $${(amount / 100).toFixed(2)} - Total debt: $${(newCashOwed / 100).toFixed(2)}`,
        {
          userId,
          amount,
          orderId,
          previousDebt: wallet.cashOwed,
          newDebt: newCashOwed,
        },
      );
    });
  }

  // Atomic wallet update with validation and COMPLETE TRANSACTION LOGGING
  async updateWalletBalance(
    userId: string,
    amount: number,
    type: string,
    orderId?: string,
    description?: string,
    usePendingBalance: boolean = false, // NEW: Use pending balance instead of available
  ): Promise<void> {
    return await db.transaction(async (tx) => {
      // First, verify user exists
      const { users } = await import("@shared/schema-mysql");
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Get or create wallet
      let [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet) {
        // Create wallet if it doesn't exist
        await tx.insert(wallets).values({
          userId,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });

        [wallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .limit(1);
      }

      if (!wallet) {
        throw new Error(`Failed to create wallet for user ${userId}`);
      }

      // Determine which balance to update
      const targetBalance = usePendingBalance
        ? wallet.pendingBalance
        : wallet.balance;
      const newBalance = targetBalance + amount;

      // Validate balance won't go negative
      if (newBalance < 0) {
        throw new Error(
          `Insufficient balance. Current: ${targetBalance}, Requested: ${amount}`,
        );
      }

      // Update wallet
      if (usePendingBalance) {
        await tx
          .update(wallets)
          .set({
            pendingBalance: newBalance,
            totalEarned:
              amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId));
      } else {
        await tx
          .update(wallets)
          .set({
            balance: newBalance,
            totalEarned:
              amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId));
      }

      // Record transaction with COMPLETE DETAILS for audit
      await tx.insert(transactions).values({
        walletId: wallet.id,
        userId,
        orderId,
        type,
        amount,
        balanceBefore: targetBalance,
        balanceAfter: newBalance,
        description: description || `${type} transaction`,
        status: "completed",
        createdAt: new Date(),
        metadata: JSON.stringify({
          userType: user.role,
          userName: user.name,
          timestamp: new Date().toISOString(),
          source: "unified_financial_service",
          isPending: usePendingBalance,
        }),
      });

      // Log for audit trail
      const balanceType = usePendingBalance ? "pending" : "available";
      logger.info(
        `💰 Wallet updated (${balanceType}): ${user.name} (${userId}) - ${type} - $${(amount / 100).toFixed(2)}`,
        {
          userId,
          type,
          amount,
          orderId,
          balanceBefore: targetBalance,
          balanceAfter: newBalance,
          isPending: usePendingBalance,
        },
      );
    });
  }

  // Validate order total calculation
  validateOrderTotal(
    subtotal: number,
    deliveryFee: number,
    tax: number,
    total: number,
  ): boolean {
    const calculatedTotal = subtotal + deliveryFee + tax;
    return calculatedTotal === total;
  }

  // Convert between pesos and centavos safely
  pesosTocentavos(pesos: number): number {
    return Math.round(pesos * 100);
  }

  centavosToPesos(centavos: number): number {
    return Math.round(centavos) / 100;
  }

  // Clear cache (for testing or admin updates)
  clearCache(): void {
    this.cachedRates = null;
    this.cacheExpiry = 0;
  }

  // Get or create wallet for any user
  async getWallet(userId: string) {
    let [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      await db.insert(wallets).values({
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        cashOwed: 0,
      });

      [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);
    }

    return wallet;
  }

  // Check if user can withdraw
  async canUserWithdraw(
    userId: string,
    userRole: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Only business_owner, delivery_driver, and admin can withdraw
    if (!["business_owner", "delivery_driver", "admin"].includes(userRole)) {
      return {
        allowed: false,
        reason: "Solo negocios, repartidores y administradores pueden retirar",
      };
    }

    const wallet = await this.getWallet(userId);
    const MINIMUM_WITHDRAWAL = 5000; // $50 MXN
    const availableBalance = wallet.balance - (wallet.cashOwed || 0);

    if (availableBalance < MINIMUM_WITHDRAWAL) {
      return {
        allowed: false,
        reason: `Saldo mínimo para retiro: $${MINIMUM_WITHDRAWAL / 100} MXN`,
      };
    }

    if (wallet.cashOwed > 0) {
      return {
        allowed: false,
        reason: "Debes liquidar tu efectivo pendiente antes de retirar",
      };
    }

    return { allowed: true };
  }

  // Get available payment methods by role
  async getPaymentMethods(userId: string, userRole: string) {
    const methods = [];

    // Card - available for all
    methods.push({
      id: "card",
      name: "Tarjeta",
      icon: "card-outline",
      available: true,
    });

    // Cash - available for all
    methods.push({
      id: "cash",
      name: "Efectivo",
      icon: "cash-outline",
      available: true,
    });

    // Wallet - available for all with balance
    const wallet = await this.getWallet(userId);
    methods.push({
      id: "wallet",
      name: "Billetera MOUZO",
      icon: "wallet-outline",
      available: wallet.balance > 0,
      balance: wallet.balance,
    });

    return methods;
  }

  // Universal payment processor
  async processPayment(options: {
    userId: string;
    userRole: string;
    orderId: string;
    amount: number;
    method: "card" | "cash" | "wallet";
    businessId: string;
    driverId?: string;
  }) {
    const { userId, orderId, amount, method, businessId, driverId } = options;

    try {
      switch (method) {
        case "card":
          const { createPaymentIntent } = await import("./paymentService");
          return await createPaymentIntent({
            orderId,
            amount,
            customerId: userId,
            businessId,
            driverId,
          });

        case "cash":
          const { processCashPayment } = await import("./cashPaymentService");
          return await processCashPayment({
            orderId,
            customerId: userId,
            businessId,
            cashReceived: amount,
            orderTotal: amount,
          });

        case "wallet":
          return await this.processWalletPayment(
            userId,
            orderId,
            amount,
            businessId,
            driverId,
          );

        default:
          return { success: false, error: "Método de pago no soportado" };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Process wallet payment
  private async processWalletPayment(
    userId: string,
    orderId: string,
    amount: number,
    businessId: string,
    driverId?: string,
  ) {
    return await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (!wallet || wallet.balance < amount) {
        throw new Error("Saldo insuficiente en billetera");
      }

      // Deduct from wallet
      await tx
        .update(wallets)
        .set({
          balance: wallet.balance - amount,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      // Create payment record
      const { payments } = await import("@shared/schema-mysql");
      await tx.insert(payments).values({
        orderId,
        customerId: userId,
        businessId,
        driverId,
        amount,
        currency: "MXN",
        status: "succeeded",
        paymentMethod: "wallet",
        processedAt: new Date(),
      });

      // Create transaction record
      await tx.insert(transactions).values({
        walletId: wallet.id,
        userId,
        orderId,
        type: "wallet_payment",
        amount: -amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance - amount,
        description: `Pago con billetera - Pedido #${orderId.slice(-6)}`,
        status: "completed",
      });

      // Update order
      const { orders } = await import("@shared/schema-mysql");
      await tx
        .update(orders)
        .set({
          status: "paid",
          paymentMethod: "wallet",
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      return { success: true, message: "Pago procesado con billetera" };
    });
  }

  async getBusinessCommissionRate(ownerId?: string): Promise<number> {
    if (!ownerId) return 0.15;
    try {
      const discount =
        await SubscriptionService.getBusinessCommissionDiscount(ownerId);
      return discount.commissionRate;
    } catch {
      return 0.15;
    }
  }
}

// Export singleton instance
export const financialService = UnifiedFinancialService.getInstance();
