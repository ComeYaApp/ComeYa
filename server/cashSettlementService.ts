// Cash Settlement Service - Liquidación de Efectivo
import { db } from "./db";
import { orderRefFromId } from "./orderNumberService";
import {
  wallets,
  transactions,
  orders,
  businesses,
} from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

export class CashSettlementService {
  // Registrar deuda de efectivo al entregar pedido
  async registerCashDebt(
    orderId: string,
    driverId: string,
    businessId: string,
    total: number,
    deliveryFee: number,
  ): Promise<void> {
    const commissions = await financialService.calculateCommissions(
      total,
      deliveryFee,
    );

    const [business] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    const businessOwnerId = business?.ownerId || businessId;

    await db.transaction(async (tx) => {
      // Obtener wallet del repartidor
      let [driverWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, driverId))
        .limit(1);

      if (!driverWallet) {
        await tx.insert(wallets).values({
          userId: driverId,
          balance: 0,
          pendingBalance: 0,
          cashOwed: 0,
          cashPending: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });
        [driverWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, driverId))
          .limit(1);
      }

      // Registrar deuda del repartidor (debe entregar business + platform)
      const debtAmount = commissions.business + commissions.platform;

      await tx
        .update(wallets)
        .set({
          balance: driverWallet.balance + commissions.driver,
          cashOwed: driverWallet.cashOwed + debtAmount,
          totalEarned: driverWallet.totalEarned + commissions.driver,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, driverId));

      // Registrar efectivo pendiente del negocio
      let [businessWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, businessOwnerId))
        .limit(1);

      if (!businessWallet) {
        await tx.insert(wallets).values({
          userId: businessOwnerId,
          balance: 0,
          pendingBalance: 0,
          cashOwed: 0,
          cashPending: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });
        [businessWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, businessOwnerId))
          .limit(1);
      }

      await tx
        .update(wallets)
        .set({
          cashPending: businessWallet.cashPending + commissions.business,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, businessOwnerId));

      // Crear transacciones de tracking
      await tx.insert(transactions).values([
        {
          walletId: driverWallet.id,
          userId: driverId,
          orderId,
          type: "delivery_payment",
          amount: commissions.driver,
          balanceBefore: driverWallet.balance,
          balanceAfter: driverWallet.balance + commissions.driver,
          description: `Delivery en efectivo - Pedido #${orderId.slice(-8)}`,
          status: "completed",
        },
        {
          walletId: driverWallet.id,
          userId: driverId,
          orderId,
          type: "cash_debt",
          amount: -debtAmount,
          balanceBefore: driverWallet.cashOwed,
          balanceAfter: driverWallet.cashOwed + debtAmount,
          description: `Efectivo a liquidar - Pedido #${orderId.slice(-8)}`,
          status: "pending",
        },
      ]);
    });
  }

  // Descuento automático de futuras ganancias con tarjeta
  async autoDeductCashDebt(
    driverId: string,
    orderId: string,
    earnings: number,
  ): Promise<{ netEarnings: number; debtPaid: number }> {
    const [driverWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);

    if (!driverWallet || driverWallet.cashOwed === 0) {
      return { netEarnings: earnings, debtPaid: 0 };
    }

    const debtPayment = Math.min(earnings, driverWallet.cashOwed);
    const netEarnings = earnings - debtPayment;

    await db.transaction(async (tx) => {
      // Actualizar wallet
      await tx
        .update(wallets)
        .set({
          balance: driverWallet.balance + netEarnings,
          cashOwed: driverWallet.cashOwed - debtPayment,
          totalEarned: driverWallet.totalEarned + earnings,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, driverId));

      // Registrar descuento
      await tx.insert(transactions).values({
        walletId: driverWallet.id,
        userId: driverId,
        orderId,
        type: "cash_debt_payment",
        amount: -debtPayment,
        balanceBefore: driverWallet.cashOwed,
        balanceAfter: driverWallet.cashOwed - debtPayment,
        description: `Descuento automático de deuda - Pedido ${await orderRefFromId(orderId)}`,
        status: "completed",
      });

      // Liberar fondos a negocios
      if (debtPayment > 0) {
        await this.settleCashToBusinesses(tx, driverId, debtPayment);
      }
    });

    return { netEarnings, debtPaid: debtPayment };
  }

  // Liberar fondos al negocio cuando se liquida efectivo
  private async settleCashToBusinesses(
    tx: any,
    driverId: string,
    amount: number,
  ): Promise<void> {
    // Obtener pedidos en efectivo pendientes de liquidar
    const cashOrders = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, driverId),
          eq(orders.paymentMethod, "cash"),
          eq(orders.status, "delivered"),
          eq(orders.cashSettled, false),
        ),
      )
      .orderBy(orders.deliveredAt);

    let remainingAmount = amount;

    for (const order of cashOrders) {
      if (remainingAmount <= 0) break;

      const commissions = await financialService.calculateCommissions(
        order.total,
        order.deliveryFee,
      );

      const orderDebt = commissions.business + commissions.platform;

      if (remainingAmount >= orderDebt) {
        // Liquidar orden completa
        const [business] = await tx
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq(businesses.id, order.businessId))
          .limit(1);

        const businessOwnerId = business?.ownerId || order.businessId;

        const [businessWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, businessOwnerId))
          .limit(1);

        if (businessWallet) {
          await tx
            .update(wallets)
            .set({
              cashPending: businessWallet.cashPending - commissions.business,
              updatedAt: new Date(),
            })
            .where(eq(wallets.userId, businessOwnerId));

          // Registrar transacción al negocio
          await tx.insert(transactions).values({
            walletId: businessWallet.id,
            userId: businessOwnerId,
            orderId: order.id,
            type: "cash_settlement",
            amount: commissions.business,
            balanceBefore: businessWallet.balance,
            balanceAfter: businessWallet.balance,
            description: `Efectivo liquidado - Pedido #${order.id.slice(-8)}`,
            status: "completed",
          });
        }

        // Marcar orden como liquidada
        await tx
          .update(orders)
          .set({
            cashSettled: true,
            cashSettledAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        remainingAmount -= orderDebt;
      }
    }
  }

  // Obtener deuda pendiente del repartidor
  async getDriverDebt(driverId: string): Promise<{
    totalDebt: number;
    pendingOrders: Array<{
      orderId: string;
      amount: number;
      deliveredAt: Date;
      businessName: string;
    }>;
  }> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);

    if (!wallet || wallet.cashOwed === 0) {
      return { totalDebt: 0, pendingOrders: [] };
    }

    const cashOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, driverId),
          eq(orders.paymentMethod, "cash"),
          eq(orders.status, "delivered"),
          eq(orders.cashSettled, false),
        ),
      )
      .orderBy(orders.deliveredAt);

    const pendingOrders = await Promise.all(
      cashOrders.map(async (order) => {
        const commissions = await financialService.calculateCommissions(
          order.total,
          order.deliveryFee,
        );
        return {
          orderId: order.id,
          amount: commissions.business + commissions.platform,
          deliveredAt: order.deliveredAt!,
          businessName: order.businessName,
        };
      }),
    );

    return {
      totalDebt: wallet.cashOwed,
      pendingOrders,
    };
  }
}

export const cashSettlementService = new CashSettlementService();
