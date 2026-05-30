// Financial Audit Routes - Admin only
import { Router } from "express";
import { financialAuditService } from "./financialAuditService";
import { authenticateToken } from "./authMiddleware";
import { requireRole } from "./authMiddleware";

const router = Router();

// GET /api/audit/full - Ejecutar auditoría completa
router.get(
  "/full",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const report = await financialAuditService.runFullAudit();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/audit/commission-rates - Verificar tasas de comisión
router.get(
  "/commission-rates",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditCommissionRates();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/audit/order-totals - Verificar totales de pedidos
router.get(
  "/order-totals",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditOrderTotals();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/audit/wallet-balances - Verificar balances de wallets
router.get(
  "/wallet-balances",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditWalletBalances();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
