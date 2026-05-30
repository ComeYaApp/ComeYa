// Digital Payment Routes — Stripe, Bizum (Stripe), PayPal
// Los pagos son 100% automáticos via webhooks. No hay verificación manual.
import { Router } from "express";
import { digitalPaymentService } from "../digitalPaymentService";
import { authenticateToken, requireRole } from "../authMiddleware";

const router = Router();

// GET /api/digital-payments/methods — métodos de pago activos
router.get("/methods", authenticateToken, async (req, res) => {
  try {
    const methods = await digitalPaymentService.getActivePaymentMethods();
    res.json({ success: true, methods });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/digital-payments/metrics — métricas de pagos (admin)
router.get(
  "/metrics",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const metrics = await digitalPaymentService.getPaymentMetrics();
      res.json({ success: true, ...metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
