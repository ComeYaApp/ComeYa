import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { BusinessAnalyticsService } from "../businessAnalyticsService";

const router = express.Router();

// GET /api/analytics/dashboard/:businessId - Dashboard principal
router.get(
  "/dashboard/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const period = (req.query.period as "today" | "week" | "month") || "week";

      const result = await BusinessAnalyticsService.getDashboard(
        businessId,
        period,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Get dashboard error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/analytics/top-products/:businessId - Productos más vendidos
router.get(
  "/top-products/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await BusinessAnalyticsService.getTopProducts(
        businessId,
        limit,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Get top products error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/analytics/peak-hours/:businessId - Horas pico
router.get(
  "/peak-hours/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;

      const result = await BusinessAnalyticsService.getPeakHours(businessId);
      res.json(result);
    } catch (error: any) {
      console.error("Get peak hours error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/analytics/sales-chart/:businessId - Gráfico de ventas
router.get(
  "/sales-chart/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const result = await BusinessAnalyticsService.getSalesChart(
        businessId,
        days,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Get sales chart error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/analytics/reviews/:businessId - Estadísticas de reviews
router.get(
  "/reviews/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;

      const result = await BusinessAnalyticsService.getReviewStats(businessId);
      res.json(result);
    } catch (error: any) {
      console.error("Get review stats error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/analytics/weekly-comparison/:businessId - Comparativa semanal
router.get(
  "/weekly-comparison/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;

      const result =
        await BusinessAnalyticsService.getWeeklyComparison(businessId);
      res.json(result);
    } catch (error: any) {
      console.error("Get weekly comparison error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
