import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, desc } from "drizzle-orm";

const router = express.Router();

// Get user wallet
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { wallets, transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    // Get or create wallet
    let [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.user!.id))
      .limit(1);

    if (!wallet) {
      // Create wallet if it doesn't exist
      const newWallet = {
        id: crypto.randomUUID(),
        userId: req.user!.id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        createdAt: new Date(),
      };

      await db.insert(wallets).values(newWallet);
      wallet = newWallet;
    }

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, req.user!.id))
      .orderBy(desc(transactions.createdAt))
      .limit(10);

    res.json({
      success: true,
      wallet: {
        ...wallet,
        balancePesos: wallet.balance / 100,
        pendingBalancePesos: wallet.pendingBalance / 100,
        totalEarnedPesos: wallet.totalEarned / 100,
      },
      transactions: recentTransactions.map((t) => ({
        ...t,
        amountPesos: t.amount / 100,
      })),
    });
  } catch (error: any) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get wallet transactions
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, req.user!.id))
      .orderBy(desc(transactions.createdAt));

    res.json({
      success: true,
      transactions: userTransactions.map((t) => ({
        ...t,
        amountPesos: t.amount / 100,
      })),
    });
  } catch (error: any) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get wallet balance
router.get("/balance", authenticateToken, async (req, res) => {
  try {
    const { wallets } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.user!.id))
      .limit(1);

    if (!wallet) {
      return res.json({
        success: true,
        balance: 0,
        balancePesos: 0,
        pendingBalance: 0,
        pendingBalancePesos: 0,
      });
    }

    res.json({
      success: true,
      balance: wallet.balance,
      balancePesos: wallet.balance / 100,
      pendingBalance: wallet.pendingBalance,
      pendingBalancePesos: wallet.pendingBalance / 100,
    });
  } catch (error: any) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Request withdrawal (drivers and business owners)
router.post("/withdraw", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    // Check if user can withdraw
    if (!["delivery_driver", "business_owner"].includes(req.user!.role)) {
      return res.status(403).json({ error: "No autorizado para retiros" });
    }

    const { wallets, transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.user!.id))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: "Wallet no encontrada" });
    }

    const amountCentavos = Math.round(amount * 100);

    if (wallet.balance < amountCentavos) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    // Create withdrawal transaction
    const withdrawalTransaction = {
      id: crypto.randomUUID(),
      userId: req.user!.id,
      type: "withdrawal" as const,
      amount: -amountCentavos,
      description: `Retiro de $${amount}`,
      status: "pending" as const,
      createdAt: new Date(),
    };

    await db.insert(transactions).values(withdrawalTransaction);

    // Update wallet balance
    await db
      .update(wallets)
      .set({
        balance: wallet.balance - amountCentavos,
        pendingBalance: wallet.pendingBalance + amountCentavos,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, req.user!.id));

    res.json({
      success: true,
      message: "Solicitud de retiro creada",
      transaction: {
        ...withdrawalTransaction,
        amountPesos: withdrawalTransaction.amount / 100,
      },
    });
  } catch (error: any) {
    console.error("Withdraw error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get withdrawal history
router.get("/withdrawals", authenticateToken, async (req, res) => {
  try {
    const { transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const withdrawals = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, req.user!.id))
      .orderBy(desc(transactions.createdAt));

    const withdrawalTransactions = withdrawals.filter(
      (t) => t.type === "withdrawal",
    );

    res.json({
      success: true,
      withdrawals: withdrawalTransactions.map((t) => ({
        ...t,
        amountPesos: Math.abs(t.amount) / 100,
      })),
    });
  } catch (error: any) {
    console.error("Get withdrawals error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
