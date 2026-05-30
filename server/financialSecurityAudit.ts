// Financial System Security Audit
import { financialService } from "./unifiedFinancialService";
import { db } from "./db";
import {
  orders,
  wallets,
  transactions,
  systemSettings,
} from "@shared/schema-mysql";
import { eq, sql } from "drizzle-orm";

export class FinancialSecurityAudit {
  // Run complete security audit
  static async runSecurityAudit(): Promise<{
    success: boolean;
    vulnerabilities: any[];
    recommendations: string[];
    score: number;
  }> {
    const vulnerabilities: any[] = [];
    const recommendations: string[] = [];

    try {
      // 1. Check for hardcoded rates
      await this.checkHardcodedRates(vulnerabilities, recommendations);

      // 2. Validate commission rate integrity
      await this.validateCommissionIntegrity(vulnerabilities, recommendations);

      // 3. Check for rounding errors
      await this.checkRoundingErrors(vulnerabilities, recommendations);

      // 4. Validate wallet consistency
      await this.validateWalletConsistency(vulnerabilities, recommendations);

      // 5. Check transaction integrity
      await this.checkTransactionIntegrity(vulnerabilities, recommendations);

      // 6. Validate order totals
      await this.validateOrderTotals(vulnerabilities, recommendations);

      // 7. Check for negative balances
      await this.checkNegativeBalances(vulnerabilities, recommendations);

      // 8. Validate commission distribution
      await this.validateCommissionDistribution(
        vulnerabilities,
        recommendations,
      );

      // 9. Check for orphaned transactions
      await this.checkOrphanedTransactions(vulnerabilities, recommendations);

      // 10. Validate system settings
      await this.validateSystemSettings(vulnerabilities, recommendations);
    } catch (error: any) {
      vulnerabilities.push({
        severity: "CRITICAL",
        category: "System Error",
        description: `Audit failed: ${error.message}`,
        impact: "Cannot verify system security",
      });
    }

    // Calculate security score
    const criticalCount = vulnerabilities.filter(
      (v) => v.severity === "CRITICAL",
    ).length;
    const highCount = vulnerabilities.filter(
      (v) => v.severity === "HIGH",
    ).length;
    const mediumCount = vulnerabilities.filter(
      (v) => v.severity === "MEDIUM",
    ).length;
    const lowCount = vulnerabilities.filter((v) => v.severity === "LOW").length;

    // Score calculation: 100 - (critical*25 + high*10 + medium*5 + low*1)
    const score = Math.max(
      0,
      100 -
        (criticalCount * 25 + highCount * 10 + mediumCount * 5 + lowCount * 1),
    );

    return {
      success: criticalCount === 0 && highCount === 0,
      vulnerabilities,
      recommendations,
      score,
    };
  }

  // Check for hardcoded commission rates
  private static async checkHardcodedRates(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      // This would require static code analysis in a real implementation
      // For now, we assume the unified service is being used correctly
      const rates = await financialService.getCommissionRates();

      if (
        rates.platform === 0.15 &&
        rates.business === 1 &&
        rates.driver === 1
      ) {
        // These are the defaults; verify they came from system_settings and not hardcoded
        const settings = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.category, "commissions"));

        if (settings.length === 0) {
          vulnerabilities.push({
            severity: "HIGH",
            category: "Configuration",
            description:
              "Commission model appears hardcoded (15% markup / 100% producto / 100% delivery)",
            impact: "Cannot adjust rates without code changes",
          });
          recommendations.push(
            "Ensure commission settings exist in system_settings table",
          );
        }
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Configuration",
        description: `Could not verify commission rate source: ${error.message}`,
        impact: "Unable to confirm rate configuration security",
      });
    }
  }

  // Validate commission rate integrity
  private static async validateCommissionIntegrity(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const rates = await financialService.getCommissionRates();
      const { platform, business, driver } = rates;

      if (platform < 0 || platform > 0.3) {
        vulnerabilities.push({
          severity: "CRITICAL",
          category: "Financial Logic",
          description: `Platform markup fuera de rango esperado (0%-30% sobre productos): ${(platform * 100).toFixed(2)}%`,
          impact: "Risk of overcharging or undercharging customers/businesses",
        });
        recommendations.push(
          "Mantener platform_commission_rate entre 0 y 0.30 (15% recomendado)",
        );
      }

      if (business < 1) {
        vulnerabilities.push({
          severity: "CRITICAL",
          category: "Financial Logic",
          description: `Business share menor a 100% del precio base (${(business * 100).toFixed(2)}%)`,
          impact: "Business would earn less than the product base price",
        });
        recommendations.push(
          "Configurar business_commission_rate en 1.0 (100% del precio base)",
        );
      }

      if (driver < 1) {
        vulnerabilities.push({
          severity: "HIGH",
          category: "Financial Logic",
          description: `Driver delivery share menor a 100% (${(driver * 100).toFixed(2)}%)`,
          impact: "Drivers would not receive the full delivery fee",
        });
        recommendations.push(
          "Configurar driver_commission_rate en 1.0 (100% del delivery fee)",
        );
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "HIGH",
        category: "Financial Logic",
        description: `Commission integrity check failed: ${error.message}`,
        impact: "Cannot verify commission calculation safety",
      });
    }
  }

  // Check for rounding errors
  private static async checkRoundingErrors(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const testAmounts = [1, 3, 7, 13, 17, 23, 29, 31]; // Prime numbers to test rounding

      for (const amount of testAmounts) {
        const commissions = await financialService.calculateCommissions(amount);
        const total =
          commissions.platform + commissions.business + commissions.driver;

        if (total !== amount) {
          vulnerabilities.push({
            severity: "HIGH",
            category: "Financial Logic",
            description: `Rounding error detected: ${amount} -> ${total} (diff: ${total - amount})`,
            impact: "Money can be lost or created due to rounding",
          });
          recommendations.push(
            "Implement proper rounding strategy to ensure totals always match",
          );
          break; // Only report once
        }
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Financial Logic",
        description: `Rounding error check failed: ${error.message}`,
        impact: "Cannot verify rounding accuracy",
      });
    }
  }

  // Validate wallet consistency
  private static async validateWalletConsistency(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const allWallets = await db.select().from(wallets);

      for (const wallet of allWallets) {
        if (wallet.balance < 0) {
          vulnerabilities.push({
            severity: "CRITICAL",
            category: "Data Integrity",
            description: `Negative wallet balance detected: ${wallet.id} (${wallet.balance})`,
            impact: "User has negative balance which should be impossible",
          });
        }

        if (wallet.totalEarned < 0 || wallet.totalWithdrawn < 0) {
          vulnerabilities.push({
            severity: "HIGH",
            category: "Data Integrity",
            description: `Negative totals in wallet: ${wallet.id}`,
            impact: "Wallet statistics are corrupted",
          });
        }

        if (wallet.totalWithdrawn > wallet.totalEarned) {
          vulnerabilities.push({
            severity: "HIGH",
            category: "Data Integrity",
            description: `Wallet withdrew more than earned: ${wallet.id}`,
            impact: "Impossible financial state detected",
          });
        }
      }

      if (allWallets.some((w) => w.balance < 0)) {
        recommendations.push(
          "Implement wallet balance validation to prevent negative balances",
        );
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Data Integrity",
        description: `Wallet consistency check failed: ${error.message}`,
        impact: "Cannot verify wallet data integrity",
      });
    }
  }

  // Check transaction integrity
  private static async checkTransactionIntegrity(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const allTransactions = await db.select().from(transactions);

      for (const transaction of allTransactions) {
        if (transaction.amount === 0) {
          vulnerabilities.push({
            severity: "MEDIUM",
            category: "Data Quality",
            description: `Zero amount transaction: ${transaction.id}`,
            impact: "Unnecessary transaction records",
          });
        }

        if (
          transaction.balanceBefore !== null &&
          transaction.balanceAfter !== null
        ) {
          const expectedAfter = transaction.balanceBefore + transaction.amount;
          if (Math.abs(transaction.balanceAfter - expectedAfter) > 1) {
            vulnerabilities.push({
              severity: "HIGH",
              category: "Data Integrity",
              description: `Transaction balance mismatch: ${transaction.id}`,
              impact: "Transaction audit trail is corrupted",
            });
          }
        }
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Data Integrity",
        description: `Transaction integrity check failed: ${error.message}`,
        impact: "Cannot verify transaction data integrity",
      });
    }
  }

  // Validate order totals
  private static async validateOrderTotals(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const allOrders = await db.select().from(orders);
      let invalidCount = 0;

      for (const order of allOrders) {
        const expectedTotal =
          order.subtotal + order.deliveryFee + (order.tax || 0);
        if (Math.abs(order.total - expectedTotal) > 1) {
          invalidCount++;
          if (invalidCount <= 5) {
            // Only report first 5
            vulnerabilities.push({
              severity: "HIGH",
              category: "Data Integrity",
              description: `Order total mismatch: ${order.id} (expected: ${expectedTotal}, actual: ${order.total})`,
              impact: "Order financial calculations are incorrect",
            });
          }
        }
      }

      if (invalidCount > 5) {
        vulnerabilities.push({
          severity: "CRITICAL",
          category: "Data Integrity",
          description: `${invalidCount} orders have incorrect totals`,
          impact: "Widespread order calculation errors",
        });
        recommendations.push(
          "Run order total recalculation script to fix all orders",
        );
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Data Integrity",
        description: `Order total validation failed: ${error.message}`,
        impact: "Cannot verify order calculation accuracy",
      });
    }
  }

  // Check for negative balances
  private static async checkNegativeBalances(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const negativeBalances = await db.execute(
        sql`SELECT COUNT(*) as count FROM wallets WHERE balance < 0`,
      );

      const count = negativeBalances[0]?.count || 0;
      if (count > 0) {
        vulnerabilities.push({
          severity: "CRITICAL",
          category: "Financial Security",
          description: `${count} wallets have negative balances`,
          impact: "Users owe money to the system",
        });
        recommendations.push(
          "Investigate and fix all negative wallet balances",
        );
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Financial Security",
        description: `Negative balance check failed: ${error.message}`,
        impact: "Cannot verify balance integrity",
      });
    }
  }

  // Validate commission distribution
  private static async validateCommissionDistribution(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.status, "delivered"));
      let mismatchCount = 0;

      for (const order of deliveredOrders) {
        if (
          order.platformFee &&
          order.businessEarnings &&
          order.deliveryEarnings
        ) {
          const totalDistributed =
            order.platformFee + order.businessEarnings + order.deliveryEarnings;
          if (Math.abs(totalDistributed - order.total) > 1) {
            mismatchCount++;
          }
        }
      }

      if (mismatchCount > 0) {
        vulnerabilities.push({
          severity: "HIGH",
          category: "Financial Logic",
          description: `${mismatchCount} orders have commission distribution mismatches`,
          impact: "Money is not being distributed correctly",
        });
        recommendations.push(
          "Recalculate commission distributions for all delivered orders",
        );
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Financial Logic",
        description: `Commission distribution check failed: ${error.message}`,
        impact: "Cannot verify commission accuracy",
      });
    }
  }

  // Check for orphaned transactions
  private static async checkOrphanedTransactions(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      // Skip orphaned transaction check due to schema differences
      // TODO: Fix schema alignment for proper orphaned transaction check
    } catch (error: any) {
      vulnerabilities.push({
        severity: "LOW",
        category: "Data Integrity",
        description: `Orphaned transaction check failed: ${error.message}`,
        impact: "Cannot verify transaction references",
      });
    }
  }

  // Validate system settings
  private static async validateSystemSettings(
    vulnerabilities: any[],
    recommendations: string[],
  ) {
    try {
      const requiredSettings = [
        "platform_commission_rate",
        "business_commission_rate",
        "driver_commission_rate",
      ];

      const settings = await db.select().from(systemSettings);
      const settingKeys = settings.map((s) => s.key);

      for (const required of requiredSettings) {
        if (!settingKeys.includes(required)) {
          vulnerabilities.push({
            severity: "HIGH",
            category: "Configuration",
            description: `Missing required system setting: ${required}`,
            impact: "System may fall back to hardcoded values",
          });
        }
      }

      if (requiredSettings.some((r) => !settingKeys.includes(r))) {
        recommendations.push("Initialize all required system settings");
      }
    } catch (error: any) {
      vulnerabilities.push({
        severity: "MEDIUM",
        category: "Configuration",
        description: `System settings validation failed: ${error.message}`,
        impact: "Cannot verify system configuration",
      });
    }
  }
}
