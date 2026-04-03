// Fund Release Routes
import { Router } from "express";
import { fundReleaseService } from "../fundReleaseService";
import { authenticateToken } from "../authMiddleware";
import { requireRole } from "../authMiddleware";
import { createPayoutsForOrder } from "../payoutService";

const router = Router();

// Customer confirms delivery and releases funds
router.post("/confirm-delivery", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId es requerido",
      });
    }

    const result = await fundReleaseService.releaseOnCustomerConfirmation(
      orderId,
      req.user!.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Cliente confirmó entrega → crear payouts para negocio y repartidor
    await createPayoutsForOrder(orderId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customer disputes order
router.post("/dispute", authenticateToken, async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        error: "orderId y reason son requeridos",
      });
    }

    const result = await fundReleaseService.disputeOrder(
      orderId,
      req.user!.id,
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders pending fund release (Admin)
router.get("/pending", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const orders = await fundReleaseService.getPendingReleaseOrders();
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manually trigger auto-release (Admin/Cron)
router.post("/auto-release", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const result = await fundReleaseService.autoReleaseFunds();
    res.json({
      success: true,
      message: `Auto-release completado: ${result.released} liberados, ${result.failed} fallidos`,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
