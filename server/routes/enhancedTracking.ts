import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { EnhancedTrackingService } from "../enhancedTrackingService";

const router = express.Router();

// Actualizar ubicación del repartidor (solo repartidores)
router.post(
  "/location/update",
  authenticateToken,
  requireRole("delivery_driver"),
  async (req, res) => {
    try {
      const { latitude, longitude, heading, speed } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitud y longitud requeridas" });
      }

      const result = await EnhancedTrackingService.updateDriverLocation(
        req.user!.id,
        latitude,
        longitude,
        heading,
        speed,
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Obtener ubicación del repartidor para un pedido
router.get("/location/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.getDriverLocation(
      req.params.orderId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ETA dinámico
router.get("/eta/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.calculateDynamicETA(
      req.params.orderId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener hitos del pedido
router.get("/milestones/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.getOrderMilestones(
      req.params.orderId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
