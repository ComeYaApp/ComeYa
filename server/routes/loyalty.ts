import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { LoyaltyService } from "../loyaltyService";
import { db } from "../db";
import { loyaltyRewards, loyaltyChallenges } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

// GET /api/loyalty/points - Obtener puntos del usuario
router.get("/points", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const points = await LoyaltyService.getOrCreateLoyaltyPoints(userId);

    res.json({
      success: true,
      points,
    });
  } catch (error: any) {
    console.error("Error getting loyalty points:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/loyalty/history - Historial de transacciones
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await LoyaltyService.getTransactionHistory(userId, limit);

    res.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error("Error getting transaction history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/loyalty/rewards - Recompensas disponibles
router.get("/rewards", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rewards = await LoyaltyService.getAvailableRewards(userId);

    res.json({
      success: true,
      rewards,
    });
  } catch (error: any) {
    console.error("Error getting available rewards:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/loyalty/redeem - Canjear recompensa
router.post("/redeem", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { rewardId } = req.body;

    if (!rewardId) {
      return res.status(400).json({
        success: false,
        error: "rewardId requerido",
      });
    }

    const result = await LoyaltyService.redeemReward(userId, rewardId);

    res.json({
      success: true,
      redemptionId: result.redemptionId,
      reward: result.reward,
      message: "Recompensa canjeada exitosamente",
    });
  } catch (error: any) {
    console.error("Error redeeming reward:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/loyalty/challenges - Desafíos del usuario con progreso
router.get("/challenges", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const challenges = await LoyaltyService.getUserChallenges(userId);

    res.json({
      success: true,
      challenges,
    });
  } catch (error: any) {
    console.error("Error getting challenges:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/loyalty/challenges/:id/claim - Reclamar recompensa de challenge
router.post("/challenges/:id/claim", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const challengeId = req.params.id;

    const pointsAwarded = await LoyaltyService.claimChallengeReward(
      userId,
      challengeId,
    );

    res.json({
      success: true,
      pointsAwarded,
      message: `Has ganado ${pointsAwarded} puntos`,
    });
  } catch (error: any) {
    console.error("Error claiming challenge reward:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/loyalty/dashboard - Dashboard completo de lealtad
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [points, rewards, challenges, history] = await Promise.all([
      LoyaltyService.getOrCreateLoyaltyPoints(userId),
      LoyaltyService.getAvailableRewards(userId),
      LoyaltyService.getUserChallenges(userId),
      LoyaltyService.getTransactionHistory(userId, 10),
    ]);

    res.json({
      success: true,
      dashboard: {
        points,
        rewards,
        challenges,
        recentActivity: history,
      },
    });
  } catch (error: any) {
    console.error("Error getting loyalty dashboard:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= ADMIN ROUTES =============

// GET /api/loyalty/admin/rewards - Todas las recompensas (admin)
router.get(
  "/admin/rewards",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const allRewards = await db.select().from(loyaltyRewards);

      res.json({
        success: true,
        rewards: allRewards,
      });
    } catch (error: any) {
      console.error("Error getting all rewards:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/loyalty/admin/rewards - Crear recompensa (admin)
router.post(
  "/admin/rewards",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        pointsCost,
        type,
        value,
        minTier,
        maxRedemptions,
        expiresAt,
        imageUrl,
        terms,
      } = req.body;

      if (!title || !pointsCost || !type || !value) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: title, pointsCost, type, value",
        });
      }

      const rewardId = crypto.randomUUID();

      await db.insert(loyaltyRewards).values({
        id: rewardId,
        title,
        description,
        pointsCost,
        type,
        value,
        minTier,
        maxRedemptions,
        expiresAt,
        imageUrl,
        terms,
        isAvailable: true,
        currentRedemptions: 0,
      });

      res.json({
        success: true,
        rewardId,
        message: "Recompensa creada exitosamente",
      });
    } catch (error: any) {
      console.error("Error creating reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// PUT /api/loyalty/admin/rewards/:id - Actualizar recompensa (admin)
router.put(
  "/admin/rewards/:id",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      await db
        .update(loyaltyRewards)
        .set(updates)
        .where(eq(loyaltyRewards.id, id));

      res.json({
        success: true,
        message: "Recompensa actualizada exitosamente",
      });
    } catch (error: any) {
      console.error("Error updating reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// DELETE /api/loyalty/admin/rewards/:id - Eliminar recompensa (admin)
router.delete(
  "/admin/rewards/:id",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      await db
        .update(loyaltyRewards)
        .set({ isAvailable: false })
        .where(eq(loyaltyRewards.id, id));

      res.json({
        success: true,
        message: "Recompensa desactivada exitosamente",
      });
    } catch (error: any) {
      console.error("Error deleting reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/loyalty/admin/challenges - Todos los challenges (admin)
router.get(
  "/admin/challenges",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const allChallenges = await db.select().from(loyaltyChallenges);

      res.json({
        success: true,
        challenges: allChallenges,
      });
    } catch (error: any) {
      console.error("Error getting all challenges:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/loyalty/admin/challenges - Crear challenge (admin)
router.post(
  "/admin/challenges",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        type,
        target,
        rewardPoints,
        startsAt,
        expiresAt,
      } = req.body;

      if (!title || !type || !target || !rewardPoints) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: title, type, target, rewardPoints",
        });
      }

      const challengeId = crypto.randomUUID();

      await db.insert(loyaltyChallenges).values({
        id: challengeId,
        title,
        description,
        type,
        target,
        rewardPoints,
        startsAt,
        expiresAt,
        isActive: true,
      });

      res.json({
        success: true,
        challengeId,
        message: "Challenge creado exitosamente",
      });
    } catch (error: any) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/loyalty/admin/stats - Estadísticas de lealtad (admin)
router.get(
  "/admin/stats",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const stats = await db.execute(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(current_points) as total_points_in_circulation,
        SUM(total_earned) as total_points_earned,
        SUM(total_redeemed) as total_points_redeemed,
        SUM(CASE WHEN tier = 'bronze' THEN 1 ELSE 0 END) as bronze_users,
        SUM(CASE WHEN tier = 'silver' THEN 1 ELSE 0 END) as silver_users,
        SUM(CASE WHEN tier = 'gold' THEN 1 ELSE 0 END) as gold_users,
        SUM(CASE WHEN tier = 'platinum' THEN 1 ELSE 0 END) as platinum_users,
        SUM(CASE WHEN tier = 'diamond' THEN 1 ELSE 0 END) as diamond_users
      FROM loyalty_points
    `);

      const rewardStats = await db.execute(`
      SELECT 
        COUNT(*) as total_rewards,
        SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as active_rewards,
        SUM(current_redemptions) as total_redemptions
      FROM loyalty_rewards
    `);

      res.json({
        success: true,
        stats: {
          users: (stats as any)[0],
          rewards: (rewardStats as any)[0],
        },
      });
    } catch (error: any) {
      console.error("Error getting loyalty stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
