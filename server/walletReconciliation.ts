import { db, rawDb } from "./db";
import { wallets, transactions, orders } from "@shared/schema-mysql";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export async function reconcileWalletBalance(userId: string) {
  try {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);
    if (!wallet) return { success: false, error: "Wallet not found" };

    const [result] = await rawDb.execute(
      "SELECT SUM(CASE WHEN type IN ('payment','commission') THEN amount ELSE -amount END) as calculated FROM transactions WHERE userId = ? AND status = 'completed'",
      [userId],
    );

    const calculatedBalance = parseFloat(result[0]?.calculated || "0");

    if (Math.abs(calculatedBalance - wallet.balance) > 0.01) {
      await db
        .update(wallets)
        .set({ balance: calculatedBalance })
        .where(eq(wallets.userId, userId));
      logger.warn("Wallet reconciled", {
        userId,
        old: wallet.balance,
        new: calculatedBalance,
      });
    }

    return { success: true, balance: calculatedBalance };
  } catch (error: any) {
    logger.error("Reconciliation failed", error);
    return { success: false, error: error.message };
  }
}

export async function generateFinancialReport(startDate: Date, endDate: Date) {
  try {
    const [orders] = await rawDb.execute(
      "SELECT COUNT(*) as total, SUM(total) as revenue, SUM(platformFee) as platformEarnings FROM orders WHERE status = 'delivered' AND createdAt BETWEEN ? AND ?",
      [startDate, endDate],
    );

    const [withdrawals] = await rawDb.execute(
      "SELECT COUNT(*) as total, SUM(amount) as totalAmount FROM withdrawals WHERE status = 'completed' AND createdAt BETWEEN ? AND ?",
      [startDate, endDate],
    );

    return {
      success: true,
      report: {
        orders: orders[0],
        withdrawals: withdrawals[0],
        period: { start: startDate, end: endDate },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
