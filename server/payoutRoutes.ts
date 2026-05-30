import { Router } from "express";
import { authenticateToken, requireRole } from "./authMiddleware";
import {
  getPendingPayouts,
  markPayoutPaid,
  getPayoutHistory,
  savePaymentAccount,
  getUserPaymentAccounts,
  deletePaymentAccount,
} from "./payoutService";

const router = Router();

// ── Cuentas de pago (todos los roles) ────────────────────────────────────────

// GET /api/payouts/accounts — mis cuentas configuradas
router.get("/accounts", authenticateToken, async (req, res) => {
  try {
    const accounts = await getUserPaymentAccounts(req.user!.id);
    res.json({ success: true, accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payouts/accounts — guardar cuenta
router.post("/accounts", authenticateToken, async (req, res) => {
  try {
    await savePaymentAccount(req.user!.id, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/payouts/accounts/:id — eliminar cuenta
router.delete("/accounts/:id", authenticateToken, async (req, res) => {
  try {
    await deletePaymentAccount(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/payouts/history — historial de pagos recibidos (negocio/driver)
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const history = await getPayoutHistory(req.user!.id);
    res.json({ success: true, payouts: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/payouts/pending — pagos pendientes de enviar
router.get(
  "/pending",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const pending = await getPendingPayouts();
      res.json({ success: true, payouts: pending });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/payouts/:id/paid — marcar como pagado
router.post(
  "/:id/paid",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      await markPayoutPaid(req.params.id, req.user!.id, req.body.notes);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
