import express from "express";
import { authenticateToken } from "../authMiddleware";
import { GamificationService } from "../gamificationService";

const router = express.Router();

// GET /api/gamification/points - Obtener puntos del usuario
router.get("/points", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getUserPoints(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error("Get points error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gamification/leaderboard - Obtener leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await GamificationService.getLeaderboard(limit);
    res.json(result);
  } catch (error: any) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gamification/achievements - Obtener achievements del usuario
router.get("/achievements", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getUserAchievements(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error("Get achievements error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gamification/rewards - Obtener recompensas disponibles
router.get("/rewards", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getAvailableRewards(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error("Get rewards error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gamification/redeem/:rewardId - Canjear recompensa
router.post("/redeem/:rewardId", authenticateToken, async (req, res) => {
  try {
    const { rewardId } = req.params;
    const result = await GamificationService.redeemReward(
      req.user!.id,
      rewardId,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Redeem reward error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
