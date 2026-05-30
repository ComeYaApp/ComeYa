import express from "express";
import { authenticateToken, requireRole, auditAction } from "../authMiddleware";

const router = express.Router();

// Get wallet balance
router.get("/balance", authenticateToken, async (req, res) => {
  try {
    const { wallets, businesses, transactions, orders } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");
    const { cashSettlementService } = await import("../cashSettlementService");
    const { financialService } = await import("../unifiedFinancialService");

    if (req.user!.role === "business_owner" || req.user!.role === "business") {
      const ownerBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.ownerId, req.user!.id));

      for (const business of ownerBusinesses) {
        const [legacyWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, business.id))
          .limit(1);

        if (!legacyWallet) {
          continue;
        }

        const hasLegacyBalance =
          legacyWallet.balance !== 0 || legacyWallet.totalEarned !== 0;

        const [ownerWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, req.user!.id))
          .limit(1);

        if (hasLegacyBalance) {
          if (ownerWallet) {
            await db
              .update(wallets)
              .set({
                balance: ownerWallet.balance + legacyWallet.balance,
                totalEarned: ownerWallet.totalEarned + legacyWallet.totalEarned,
              })
              .where(eq(wallets.userId, req.user!.id));
          } else {
            await db.insert(wallets).values({
              userId: req.user!.id,
              balance: legacyWallet.balance,
              pendingBalance: 0,
              totalEarned: legacyWallet.totalEarned,
              totalWithdrawn: 0,
              cashOwed: 0,
              cashPending: 0,
            });
          }

          await db
            .update(wallets)
            .set({
              balance: 0,
              totalEarned: 0,
            })
            .where(eq(wallets.userId, business.id));
        }

        await db
          .update(transactions)
          .set({ userId: req.user!.id })
          .where(eq(transactions.userId, business.id));

        const deliveredOrders = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.businessId, business.id),
              eq(orders.status, "delivered"),
            ),
          );

        for (const order of deliveredOrders) {
          const isCashOrder = order.paymentMethod === "cash";
          if (isCashOrder && !order.cashSettled) {
            continue;
          }

          const [existingBusinessTx] = await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.orderId, order.id),
                eq(transactions.userId, req.user!.id),
              ),
            )
            .limit(1);

          if (existingBusinessTx) {
            continue;
          }

          const commissions = await financialService.calculateCommissions(
            order.total,
            order.deliveryFee,
            order.productosBase || order.subtotal,
            order.nemyCommission || undefined,
          );

          await db
            .update(orders)
            .set({
              platformFee: order.platformFee ?? commissions.platform,
              businessEarnings: order.businessEarnings ?? commissions.business,
            })
            .where(eq(orders.id, order.id));

          if (!isCashOrder) {
            const [ownerWallet] = await db
              .select()
              .from(wallets)
              .where(eq(wallets.userId, req.user!.id))
              .limit(1);

            if (ownerWallet) {
              await db
                .update(wallets)
                .set({
                  balance: ownerWallet.balance + commissions.business,
                  totalEarned: ownerWallet.totalEarned + commissions.business,
                })
                .where(eq(wallets.userId, req.user!.id));
            } else {
              await db.insert(wallets).values({
                userId: req.user!.id,
                balance: commissions.business,
                pendingBalance: 0,
                totalEarned: commissions.business,
                totalWithdrawn: 0,
                cashOwed: 0,
                cashPending: 0,
              });
            }
          }

          await db.insert(transactions).values({
            userId: req.user!.id,
            type: isCashOrder ? "cash_settlement" : "order_payment",
            amount: commissions.business,
            status: "completed",
            description: `${isCashOrder ? "Efectivo liquidado" : "Pago por pedido"} #${order.id.slice(-8)}`,
            orderId: order.id,
          });
        }
      }
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.user!.id))
      .limit(1);

    if (!wallet) {
      await db.insert(wallets).values({
        userId: req.user!.id,
        balance: 0,
        pendingBalance: 0,
        cashOwed: 0,
        cashPending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });

      const [createdWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, req.user!.id))
        .limit(1);

      if (!createdWallet) {
        return res.status(500).json({ error: "Failed to create wallet" });
      }

      return res.json({
        success: true,
        wallet: {
          id: createdWallet.id,
          balance: createdWallet.balance,
          pendingBalance: createdWallet.pendingBalance,
          cashOwed: createdWallet.cashOwed || 0,
          cashPending: createdWallet.cashPending || 0,
          availableBalance:
            createdWallet.balance - (createdWallet.cashOwed || 0),
          totalEarned: createdWallet.totalEarned,
          totalWithdrawn: createdWallet.totalWithdrawn,
          pendingCashOrders: [],
        },
      });
    }

    // Obtener deuda detallada si es repartidor
    let pendingCashOrders = [];
    if (req.user!.role === "delivery_driver" && wallet.cashOwed > 0) {
      const debtInfo = await cashSettlementService.getDriverDebt(req.user!.id);
      pendingCashOrders = debtInfo.pendingOrders;
    }

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        cashOwed: wallet.cashOwed || 0,
        cashPending: wallet.cashPending || 0,
        availableBalance: wallet.balance - (wallet.cashOwed || 0),
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        pendingCashOrders,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get wallet transactions
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { transactions, businesses, wallets } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    if (req.user!.role === "business_owner" || req.user!.role === "business") {
      const ownerBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.ownerId, req.user!.id));

      for (const business of ownerBusinesses) {
        const [legacyWallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, business.id))
          .limit(1);

        if (
          legacyWallet &&
          (legacyWallet.balance !== 0 || legacyWallet.totalEarned !== 0)
        ) {
          const [ownerWallet] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.userId, req.user!.id))
            .limit(1);

          if (ownerWallet) {
            await db
              .update(wallets)
              .set({
                balance: ownerWallet.balance + legacyWallet.balance,
                totalEarned: ownerWallet.totalEarned + legacyWallet.totalEarned,
              })
              .where(eq(wallets.userId, req.user!.id));
          } else {
            await db.insert(wallets).values({
              userId: req.user!.id,
              balance: legacyWallet.balance,
              pendingBalance: 0,
              totalEarned: legacyWallet.totalEarned,
              totalWithdrawn: 0,
              cashOwed: 0,
              cashPending: 0,
            });
          }

          await db
            .update(wallets)
            .set({
              balance: 0,
              totalEarned: 0,
            })
            .where(eq(wallets.userId, business.id));
        }

        await db
          .update(transactions)
          .set({ userId: req.user!.id })
          .where(eq(transactions.userId, business.id));
      }
    }

    const walletTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, req.user!.id))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    res.json({ success: true, transactions: walletTransactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request withdrawal
router.post(
  "/withdraw",
  authenticateToken,
  auditAction("request_withdrawal", "withdrawal"),
  async (req, res) => {
    try {
      const { financialService } = await import("../unifiedFinancialService");

      // Validar permisos usando servicio centralizado
      const canWithdraw = await financialService.canUserWithdraw(
        req.user!.id,
        req.user!.role,
      );
      if (!canWithdraw.allowed) {
        return res.status(403).json({ error: canWithdraw.reason });
      }

      const { requestWithdrawal } = await import("../withdrawalService");

      const result = await requestWithdrawal({
        userId: req.user!.id,
        amount: req.body.amount,
        method: req.body.method,
        bankAccount: req.body.bankAccount,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get withdrawal history
router.get("/withdrawals", authenticateToken, async (req, res) => {
  try {
    const { getWithdrawalHistory } = await import("../withdrawalService");
    const result = await getWithdrawalHistory(req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel withdrawal
router.post(
  "/withdrawals/:id/cancel",
  authenticateToken,
  auditAction("cancel_withdrawal", "withdrawal"),
  async (req, res) => {
    try {
      const { cancelWithdrawal } = await import("../withdrawalService");
      const result = await cancelWithdrawal(req.params.id, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
