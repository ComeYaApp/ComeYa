import express from "express";
import { authenticateToken } from "../authMiddleware";
import { ScheduledOrdersService } from "../scheduledOrdersService";

const router = express.Router();

// Crear pedido programado
router.post("/", authenticateToken, async (req, res) => {
  try {
    const result = await ScheduledOrdersService.createScheduledOrder({
      userId: req.user!.id,
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos programados
router.get("/", authenticateToken, async (req, res) => {
  try {
    const scheduled = await ScheduledOrdersService.getUserScheduledOrders(
      req.user!.id,
    );
    res.json({ success: true, scheduledOrders: scheduled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar pedido programado
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await ScheduledOrdersService.cancelScheduledOrder(
      req.params.id,
      req.user!.id,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ejecutar pedidos programados (cron job - solo admin)
router.post("/execute", authenticateToken, async (req, res) => {
  try {
    if (req.user!.role !== "admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const results = await ScheduledOrdersService.executeScheduledOrders();
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
