import { db } from "./db";
import { orders, wallets, users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

interface WithdrawalLimits {
  minAmount: number;
  maxDaily: number;
  maxPerTransaction: number;
}

const ROLE_WITHDRAWAL_LIMITS: Record<string, WithdrawalLimits> = {
  business_owner: {
    minAmount: 10000, // $100 MXN
    maxDaily: 5000000, // $50,000 MXN
    maxPerTransaction: 5000000,
  },
  delivery_driver: {
    minAmount: 5000, // $50 MXN
    maxDaily: 1000000, // $10,000 MXN
    maxPerTransaction: 500000, // $5,000 MXN
  },
  customer: {
    minAmount: 0,
    maxDaily: 0,
    maxPerTransaction: 0,
  },
};

export class FinancialIntegrity {
  // Validar pedido completo
  static async validateOrder(order: {
    subtotal: number;
    deliveryFee: number;
    total: number;
    platformFee?: number;
    businessEarnings?: number;
    deliveryEarnings?: number;
    productosBase?: number | null;
    nemyCommission?: number | null;
  }): Promise<ValidationResult> {
    // 1. Validar total del pedido
    const subtotalTotal = order.subtotal + order.deliveryFee;
    const hasMarkup =
      order.productosBase !== undefined &&
      order.productosBase !== null &&
      order.nemyCommission !== undefined &&
      order.nemyCommission !== null;
    const markupTotal = hasMarkup
      ? (order.productosBase || 0) +
        (order.nemyCommission || 0) +
        order.deliveryFee
      : subtotalTotal;

    if (order.total !== subtotalTotal && order.total !== markupTotal) {
      return {
        valid: false,
        error: "Total del pedido inválido",
        details: {
          expected: hasMarkup ? markupTotal : subtotalTotal,
          received: order.total,
          subtotal: order.subtotal,
          productosBase: order.productosBase,
          nemyCommission: order.nemyCommission,
          deliveryFee: order.deliveryFee,
        },
      };
    }

    // 2. Validar comisiones si existen
    if (
      order.platformFee !== undefined &&
      order.businessEarnings !== undefined &&
      order.deliveryEarnings !== undefined
    ) {
      const commissionTotal =
        order.platformFee + order.businessEarnings + order.deliveryEarnings;

      if (commissionTotal !== order.total) {
        return {
          valid: false,
          error: "Comisiones no suman el total del pedido",
          details: {
            platform: order.platformFee,
            business: order.businessEarnings,
            driver: order.deliveryEarnings,
            commissionTotal,
            orderTotal: order.total,
            difference: order.total - commissionTotal,
          },
        };
      }

      // Validar que las comisiones sean correctas según rates
      const expectedCommissions = await financialService.calculateCommissions(
        order.total,
        order.deliveryFee || 0,
        order.productosBase || undefined,
        order.nemyCommission || undefined,
      );

      if (
        order.platformFee !== expectedCommissions.platform ||
        order.businessEarnings !== expectedCommissions.business ||
        order.deliveryEarnings !== expectedCommissions.driver
      ) {
        return {
          valid: false,
          error: "Comisiones no coinciden con rates del sistema",
          details: {
            expected: expectedCommissions,
            received: {
              platform: order.platformFee,
              business: order.businessEarnings,
              driver: order.deliveryEarnings,
            },
          },
        };
      }
    }

    return { valid: true };
  }

  // Validar transacción de wallet
  static async validateWalletTransaction(
    userId: string,
    amount: number,
    type: string,
  ): Promise<ValidationResult> {
    // Obtener wallet
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      return { valid: false, error: "Wallet no existe para este usuario" };
    }

    // Validar balance suficiente para retiros/débitos
    if (amount < 0) {
      const newBalance = wallet.balance + amount;
      if (newBalance < 0) {
        return {
          valid: false,
          error: "Balance insuficiente",
          details: {
            currentBalance: wallet.balance,
            requestedAmount: Math.abs(amount),
            shortfall: Math.abs(newBalance),
          },
        };
      }
    }

    // Validar límites por rol para retiros
    if (type === "withdrawal") {
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return { valid: false, error: "Usuario no encontrado" };
      }

      const limits =
        ROLE_WITHDRAWAL_LIMITS[user.role] || ROLE_WITHDRAWAL_LIMITS.customer;
      const withdrawalAmount = Math.abs(amount);

      if (withdrawalAmount < limits.minAmount) {
        return {
          valid: false,
          error: `Monto mínimo de retiro: $${(limits.minAmount / 100).toFixed(2)} MXN`,
          details: { minAmount: limits.minAmount, requested: withdrawalAmount },
        };
      }

      if (withdrawalAmount > limits.maxPerTransaction) {
        return {
          valid: false,
          error: `Monto máximo por transacción: $${(limits.maxPerTransaction / 100).toFixed(2)} MXN`,
          details: {
            maxAmount: limits.maxPerTransaction,
            requested: withdrawalAmount,
          },
        };
      }
    }

    return { valid: true };
  }

  // Validar que comisiones del sistema sumen 100%
  static async validateSystemCommissionRates(): Promise<ValidationResult> {
    try {
      const rates = await financialService.getCommissionRates();
      const total = rates.platform + rates.business + rates.driver;

      if (Math.abs(total - 1.0) > 0.001) {
        return {
          valid: false,
          error: "Comisiones del sistema no suman 100%",
          details: {
            platform: `${(rates.platform * 100).toFixed(2)}%`,
            business: `${(rates.business * 100).toFixed(2)}%`,
            driver: `${(rates.driver * 100).toFixed(2)}%`,
            total: `${(total * 100).toFixed(2)}%`,
          },
        };
      }

      return { valid: true, details: rates };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  // Reconciliar pedido - verificar integridad financiera
  static async reconcileOrder(orderId: string): Promise<ValidationResult> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { valid: false, error: "Pedido no encontrado" };
    }

    // Validar estructura del pedido
    const orderForValidation =
      order.status === "delivered"
        ? order
        : {
            ...order,
            platformFee: undefined,
            businessEarnings: undefined,
            deliveryEarnings: undefined,
          };
    const orderValidation = await this.validateOrder(orderForValidation);
    if (!orderValidation.valid) {
      return orderValidation;
    }

    // Si el pedido está entregado, validar que las comisiones estén calculadas
    if (order.status === "delivered") {
      if (
        !order.platformFee ||
        !order.businessEarnings ||
        !order.deliveryEarnings
      ) {
        return {
          valid: false,
          error: "Pedido entregado sin comisiones calculadas",
          details: { orderId, status: order.status },
        };
      }
    }

    return { valid: true };
  }

  // Obtener límites de retiro para un usuario
  static async getWithdrawalLimits(userId: string): Promise<WithdrawalLimits> {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return ROLE_WITHDRAWAL_LIMITS.customer;
    }

    return ROLE_WITHDRAWAL_LIMITS[user.role] || ROLE_WITHDRAWAL_LIMITS.customer;
  }
}
