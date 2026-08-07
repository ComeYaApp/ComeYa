import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { EnhancedReviewService } from "../enhancedReviewService";

const router = express.Router();

// POST /api/reviews - Crear review mejorada
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
      tipAmount,
    } = req.body;

    const result = await EnhancedReviewService.createReview({
      userId: req.user!.id,
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
      tipAmount: tipAmount || 0,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Create review error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reviews/tags - Obtener tags disponibles
router.get("/tags", async (req, res) => {
  try {
    const result = await EnhancedReviewService.getTags();
    res.json(result);
  } catch (error: any) {
    console.error("Get tags error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reviews/business/:businessId - Obtener reviews de un negocio
router.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await EnhancedReviewService.getBusinessReviews(
      businessId,
      limit,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get business reviews error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reviews/:reviewId/respond - Responder a una review (solo dueño)
router.post(
  "/:reviewId/respond",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { businessId, responseText } = req.body;

      if (!responseText || responseText.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Respuesta requerida" });
      }

      const result = await EnhancedReviewService.respondToReview(
        reviewId,
        businessId,
        req.user!.id,
        responseText,
      );

      res.json(result);
    } catch (error: any) {
      console.error("Respond to review error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
