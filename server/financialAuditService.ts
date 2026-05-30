// Financial Audit Service - Blindaje económico nivel bancario
import { db } from "./db";
import { orders, wallets, transactions, payments } from "@shared/schema-mysql";
import { eq, sql } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

interface AuditResult {
  passed: boolean;
  rule: string;
  details: string;
  severity: "critical" | "warning" | "info";
  affectedEntities?: string[];
  expectedValue?: number;
  actualValue?: number;
}

interface FullAuditReport {
  timestamp: Date;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: AuditResult[];
  systemHealth: "healthy" | "warning" | "critical";
}

export class FinancialAuditService {
  // REGLA 1: Comisiones suman 100%
  async auditCommissionRates(): Promise<AuditResult> {
    try {
      const rates = await financialService.getCommissionRates();
      const total = rates.platform + rates.business + rates.driver;
      const passed = Math.abs(total - 1.0) < 0.001;

      return {
        passed,
        rule: "Commission Rates Sum to 100%",
        details: passed
          ? `✓ Rates valid: Platform ${(rates.platform * 100).toFixed(1)}% + Business ${(rates.business * 100).toFixed(1)}% + Driver ${(rates.driver * 100).toFixed(1)}% = 100%`
          : `✗ Rates invalid: Total = ${(total * 100).toFixed(2)}%`,
        severity: passed ? "info" : "critical",
        expectedValue: 1.0,
        actualValue: total,
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Commission Rates Sum to 100%",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 2: Total pedido = subtotal + deliveryFee + tax
  async auditOrderTotals(): Promise<AuditResult> {
    try {
      const allOrders = await db.select().from(orders);
      const invalidOrders: string[] = [];

      for (const order of allOrders) {
        // Nueva lógica: total = costo producto + 15% comisión MOUZO + costo delivery
        const nemyCommission = Math.round(order.subtotal * 0.15);
        const expectedTotal =
          order.subtotal + nemyCommission + order.deliveryFee;
        if (order.total !== expectedTotal) {
          invalidOrders.push(
            `${order.id.slice(-6)}: expected ${expectedTotal}, got ${order.total}`,
          );
        }
      }

      return {
        passed: invalidOrders.length === 0,
        rule: "Order Totals Match Calculation",
        details:
          invalidOrders.length === 0
            ? `✓ All ${allOrders.length} orders have correct totals`
            : `✗ ${invalidOrders.length}/${allOrders.length} orders with incorrect totals`,
        severity: invalidOrders.length === 0 ? "info" : "critical",
        affectedEntities: invalidOrders.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Order Totals Match Calculation",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 3: Comisiones distribuidas = total pedido
  async auditCommissionDistribution(): Promise<AuditResult> {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.status, "delivered"));

      const invalidOrders: string[] = [];

      for (const order of deliveredOrders) {
        if (
          order.platformFee &&
          order.businessEarnings &&
          order.deliveryEarnings
        ) {
          const distributed =
            order.platformFee + order.businessEarnings + order.deliveryEarnings;

          if (distributed !== order.total) {
            invalidOrders.push(
              `${order.id.slice(-6)}: total ${order.total}, distributed ${distributed}`,
            );
          }
        }
      }

      return {
        passed: invalidOrders.length === 0,
        rule: "Commission Distribution Equals Order Total",
        details:
          invalidOrders.length === 0
            ? `✓ All ${deliveredOrders.length} delivered orders correctly distributed`
            : `✗ ${invalidOrders.length}/${deliveredOrders.length} orders with distribution errors`,
        severity: invalidOrders.length === 0 ? "info" : "critical",
        affectedEntities: invalidOrders.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Commission Distribution Equals Order Total",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 4: Balance wallet = suma transacciones
  async auditWalletBalances(): Promise<AuditResult> {
    try {
      const allWallets = await db.select().from(wallets);
      const invalidWallets: string[] = [];

      for (const wallet of allWallets) {
        const txs = await db
          .select()
          .from(transactions)
          .where(eq(transactions.walletId, wallet.id));

        const calculatedBalance = txs.reduce((sum, tx) => sum + tx.amount, 0);

        if (wallet.balance !== calculatedBalance) {
          invalidWallets.push(
            `${wallet.userId.slice(-6)}: expected ${calculatedBalance}, got ${wallet.balance}`,
          );
        }
      }

      return {
        passed: invalidWallets.length === 0,
        rule: "Wallet Balances Match Transaction History",
        details:
          invalidWallets.length === 0
            ? `✓ All ${allWallets.length} wallets have correct balances`
            : `✗ ${invalidWallets.length}/${allWallets.length} wallets with balance mismatches`,
        severity: invalidWallets.length === 0 ? "info" : "critical",
        affectedEntities: invalidWallets.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Wallet Balances Match Transaction History",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 5: Transacciones tienen balanceBefore/After consistentes
  async auditTransactionChain(): Promise<AuditResult> {
    try {
      const allWallets = await db.select().from(wallets);
      const invalidChains: string[] = [];

      for (const wallet of allWallets) {
        const txs = await db
          .select()
          .from(transactions)
          .where(eq(transactions.walletId, wallet.id))
          .orderBy(transactions.createdAt);

        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          const expectedAfter = (tx.balanceBefore || 0) + tx.amount;

          if (tx.balanceAfter !== expectedAfter) {
            invalidChains.push(
              `Wallet ${wallet.userId.slice(-6)}, tx ${i + 1}: chain broken`,
            );
            break;
          }
        }
      }

      return {
        passed: invalidChains.length === 0,
        rule: "Transaction Chains Are Consistent",
        details:
          invalidChains.length === 0
            ? `✓ All wallet transaction chains are valid`
            : `✗ ${invalidChains.length} wallets with broken transaction chains`,
        severity: invalidChains.length === 0 ? "info" : "critical",
        affectedEntities: invalidChains.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Transaction Chains Are Consistent",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 6: Pagos Stripe coinciden con orders
  async auditStripePayments(): Promise<AuditResult> {
    try {
      const allPayments = await db.select().from(payments);
      const invalidPayments: string[] = [];

      for (const payment of allPayments) {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, payment.orderId))
          .limit(1);

        if (!order) {
          invalidPayments.push(
            `Payment ${payment.id.slice(-6)}: order not found`,
          );
          continue;
        }

        if (payment.amount !== order.total) {
          invalidPayments.push(
            `Payment ${payment.id.slice(-6)}: amount ${payment.amount} != order ${order.total}`,
          );
        }
      }

      return {
        passed: invalidPayments.length === 0,
        rule: "Stripe Payments Match Order Totals",
        details:
          invalidPayments.length === 0
            ? `✓ All ${allPayments.length} payments match their orders`
            : `✗ ${invalidPayments.length}/${allPayments.length} payments with mismatches`,
        severity: invalidPayments.length === 0 ? "info" : "warning",
        affectedEntities: invalidPayments.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Stripe Payments Match Order Totals",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 7: Transacciones coinciden con comisiones del pedido
  async auditTransactionAmounts(): Promise<AuditResult> {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.status, "delivered"));

      const invalidTransactions: string[] = [];

      for (const order of deliveredOrders) {
        if (!order.deliveryPersonId || !order.deliveryEarnings) continue;

        const driverTxs = await db
          .select()
          .from(transactions)
          .where(eq(transactions.orderId, order.id));

        const driverTx = driverTxs.find(
          (tx) => tx.userId === order.deliveryPersonId,
        );

        if (driverTx && driverTx.amount !== order.deliveryEarnings) {
          invalidTransactions.push(
            `Order ${order.id.slice(-6)}: driver tx ${driverTx.amount} != expected ${order.deliveryEarnings}`,
          );
        }
      }

      return {
        passed: invalidTransactions.length === 0,
        rule: "Transaction Amounts Match Order Commissions",
        details:
          invalidTransactions.length === 0
            ? `✓ All transactions match their order commissions`
            : `✗ ${invalidTransactions.length} transactions with incorrect amounts`,
        severity: invalidTransactions.length === 0 ? "info" : "critical",
        affectedEntities: invalidTransactions.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Transaction Amounts Match Order Commissions",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // REGLA 8: Ganancias del repartidor = deliveryEarnings (no deliveryFee)
  async auditDriverEarningsCalculation(): Promise<AuditResult> {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.status, "delivered"));

      const invalidEarnings: string[] = [];
      const rates = await financialService.getCommissionRates();

      for (const order of deliveredOrders) {
        if (!order.deliveryPersonId) continue;

        const expectedEarnings = Math.round(order.deliveryFee * rates.driver);

        if (order.deliveryEarnings !== expectedEarnings) {
          invalidEarnings.push(
            `Order ${order.id.slice(-6)}: deliveryEarnings ${order.deliveryEarnings} != expected ${expectedEarnings} (${(rates.driver * 100).toFixed(0)}% of ${order.deliveryFee})`,
          );
        }
      }

      return {
        passed: invalidEarnings.length === 0,
        rule: "Driver Earnings = 15% of Delivery Fee",
        details:
          invalidEarnings.length === 0
            ? `✓ All ${deliveredOrders.length} orders have correct driver earnings (15% of deliveryFee)`
            : `✗ ${invalidEarnings.length}/${deliveredOrders.length} orders with incorrect driver earnings`,
        severity: invalidEarnings.length === 0 ? "info" : "critical",
        affectedEntities: invalidEarnings.slice(0, 10),
      };
    } catch (error: any) {
      return {
        passed: false,
        rule: "Driver Earnings = 15% of Delivery Fee",
        details: `✗ Error: ${error.message}`,
        severity: "critical",
      };
    }
  }

  // Ejecutar auditoría completa
  async runFullAudit(): Promise<FullAuditReport> {
    const results: AuditResult[] = [];

    // Ejecutar todas las reglas
    results.push(await this.auditCommissionRates());
    results.push(await this.auditOrderTotals());
    results.push(await this.auditCommissionDistribution());
    results.push(await this.auditWalletBalances());
    results.push(await this.auditTransactionChain());
    results.push(await this.auditStripePayments());
    results.push(await this.auditTransactionAmounts());
    results.push(await this.auditDriverEarningsCalculation()); // Nueva regla

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter(
      (r) => !r.passed && r.severity === "critical",
    ).length;
    const warnings = results.filter(
      (r) => !r.passed && r.severity === "warning",
    ).length;

    let systemHealth: "healthy" | "warning" | "critical" = "healthy";
    if (failed > 0) systemHealth = "critical";
    else if (warnings > 0) systemHealth = "warning";

    return {
      timestamp: new Date(),
      totalChecks: results.length,
      passed,
      failed,
      warnings,
      results,
      systemHealth,
    };
  }
}

export const financialAuditService = new FinancialAuditService();
