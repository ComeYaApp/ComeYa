// Payment Accounts Routes - Get ComeYa receiving accounts
import { Router } from "express";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import { db } from "../db";

const router = Router();

// Get payment receiving accounts (public for users making payments)
router.get("/receiving-accounts", authenticateToken, async (req, res) => {
  try {
    const [rows]: any = await db.execute(
      "SELECT provider, account_data FROM payment_receiving_accounts WHERE is_active = TRUE"
    );

    const accounts: any = {};
    rows.forEach((row: any) => {
      // account_data ya viene como objeto desde MySQL JSON column
      accounts[row.provider] = row.account_data;
    });

    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Error getting payment accounts:", error);
    res.status(500).json({ success: false, error: "Error al obtener cuentas de pago" });
  }
});

// Admin: Get all receiving accounts
router.get("/admin/receiving-accounts", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await db.execute(
      "SELECT id, provider, account_data, is_active, created_at, updated_at FROM payment_receiving_accounts ORDER BY provider"
    );

    const accounts = rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      accountData: row.account_data, // Ya viene como objeto
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Error getting admin payment accounts:", error);
    res.status(500).json({ success: false, error: "Error al obtener cuentas" });
  }
});

// Admin: Update receiving account
router.put("/admin/receiving-accounts/:provider", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    const { accountData, isActive } = req.body;

    await db.execute(
      "UPDATE payment_receiving_accounts SET account_data = ?, is_active = ?, updated_at = NOW() WHERE provider = ?",
      [JSON.stringify(accountData), isActive ?? true, provider]
    );

    res.json({ success: true, message: "Cuenta actualizada correctamente" });
  } catch (error) {
    console.error("Error updating payment account:", error);
    res.status(500).json({ success: false, error: "Error al actualizar cuenta" });
  }
});

export default router;
