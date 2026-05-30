// Admin Exchange Rate Routes
import express from "express";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import { exchangeRateService } from "../exchangeRateService";

const router = express.Router();

// Get current exchange rate (admin only)
router.get(
  "/exchange-rate",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await exchangeRateService.getCurrentRate();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Update manual exchange rate (admin only)
router.post(
  "/exchange-rate",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { rate } = req.body;

      if (!rate || typeof rate !== "number") {
        return res
          .status(400)
          .json({ success: false, message: "Tasa inválida" });
      }

      const result = await exchangeRateService.updateManualRate(
        rate,
        req.user!.id,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Toggle auto-update (admin only)
router.post(
  "/exchange-rate/auto-update",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ success: false, message: "Valor inválido" });
      }

      const result = await exchangeRateService.toggleAutoUpdate(
        enabled,
        req.user!.id,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Force update from alcambio.app (admin only)
router.post(
  "/exchange-rate/force-update",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await exchangeRateService.forceUpdate();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
