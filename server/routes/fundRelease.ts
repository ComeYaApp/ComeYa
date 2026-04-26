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
    // Solo el cliente puede confirmar la entrega
    if (req.user!.role !== "customer" && req.user!.role !== "admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Solo el cliente puede confirmar la entrega" });
    }

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

    // Disputa registrada → strike automático al repartidor
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (order?.deliveryPersonId) {
        const { addStrike } = await import("../strikeService");
        await addStrike(
          order.deliveryPersonId,
          `Disputa del cliente: ${reason}`,
          orderId
        );
      }
    } catch (strikeErr) {
      console.error("Error adding strike on dispute:", strikeErr);
      // No bloqueamos la respuesta si falla el strike
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
