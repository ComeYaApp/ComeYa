import express from "express";
import { authenticateToken } from "../authMiddleware";
import { AIRecommendationsService } from "../aiRecommendationsService";

const router = express.Router();

// Obtener recomendaciones personalizadas
router.get("/personalized", authenticateToken, async (req, res) => {
  try {
    const recommendations =
      await AIRecommendationsService.getUserRecommendations(req.user!.id);
    res.json({ success: true, recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener trending
router.get("/trending", authenticateToken, async (req, res) => {
  try {
    const trending =
      await AIRecommendationsService.getTrendingRecommendations();
    res.json({ success: true, trending });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generar recomendaciones
router.post("/generate", authenticateToken, async (req, res) => {
  try {
    const recommendations =
      await AIRecommendationsService.generatePersonalizedRecommendations(
        req.user!.id,
      );
    res.json({ success: true, recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar preferencias
router.put("/preferences", authenticateToken, async (req, res) => {
  try {
    const result = await AIRecommendationsService.updateUserPreferences(
      req.user!.id,
      req.body,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
