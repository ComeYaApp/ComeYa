import { db } from "./db";
import {
  loyaltyPoints,
  loyaltyTransactions,
  loyaltyRewards,
  loyaltyRedemptions,
  loyaltyChallenges,
  loyaltyChallengeProgress,
  achievements,
  userAchievements,
  users,
  orders,
} from "@shared/schema-mysql";
import { eq, and, desc, gte, sql } from "drizzle-orm";

export class GamificationService {
  // Inicializar puntos de usuario
  static async initializeUserPoints(userId: string) {
    const [existing] = await db
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(loyaltyPoints).values({
        id: crypto.randomUUID(),
        userId,
        currentPoints: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        tier: "bronze",
        pointsToNextTier: 1000,
      });
    }
  }

  // Otorgar puntos
  static async awardPoints(data: {
    userId: string;
    points: number;
    type: string;
    description: string;
    orderId?: string;
  }) {
    const { userId, points, type, description, orderId } = data;

    // Inicializar si no existe
    await this.initializeUserPoints(userId);

    // Obtener puntos actuales
    const [userPoints] = await db
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.userId, userId))
      .limit(1);

    if (!userPoints) return { success: false, error: "Usuario no encontrado" };

    const newPoints = userPoints.currentPoints + points;
    const newTotalEarned = userPoints.totalEarned + points;

    // Actualizar puntos
    await db
      .update(loyaltyPoints)
      .set({
        currentPoints: newPoints,
        totalEarned: newTotalEarned,
      })
      .where(eq(loyaltyPoints.userId, userId));

    // Registrar transacción
    await db.insert(loyaltyTransactions).values({
      id: crypto.randomUUID(),
      userId,
      type,
      points,
      description,
      orderId: orderId || null,
    });

    // Verificar tier
    await this.checkTierUpgrade(userId, newTotalEarned);

    // Verificar achievements
    await this.checkAchievements(userId);

    return { success: true, newPoints, pointsAwarded: points };
  }

  // Verificar upgrade de tier
  private static async checkTierUpgrade(userId: string, totalEarned: number) {
    let newTier = "bronze";
    let pointsToNext = 1000;

    if (totalEarned >= 10000) {
      newTier = "platinum";
      pointsToNext = 0;
    } else if (totalEarned >= 5000) {
      newTier = "gold";
      pointsToNext = 10000 - totalEarned;
    } else if (totalEarned >= 2000) {
      newTier = "silver";
      pointsToNext = 5000 - totalEarned;
    } else {
      pointsToNext = 2000 - totalEarned;
    }

    await db
      .update(loyaltyPoints)
      .set({
        tier: newTier,
        pointsToNextTier: pointsToNext,
        tierUpdatedAt: new Date(),
      })
      .where(eq(loyaltyPoints.userId, userId));
  }

  // Verificar y desbloquear achievements
  private static async checkAchievements(userId: string) {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId));
    const completedOrders = userOrders.filter((o) => o.status === "delivered");
    const orderCount = completedOrders.length;
    const totalSpent = completedOrders.reduce(
      (sum, o) => sum + (o.total || 0),
      0,
    );

    const allAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true));

    for (const achievement of allAchievements) {
      let qualifies = false;
      if (achievement.requirementType === "order_count")
        qualifies = orderCount >= achievement.requirementValue;
      if (achievement.requirementType === "total_spent")
        qualifies = totalSpent >= achievement.requirementValue;
      // review_count se chequea desde reviewService al crear reseña
      if (qualifies) await this.unlockAchievement(userId, achievement.id);
    }
  }

  // Desbloquear achievement por ID
  private static async unlockAchievement(
    userId: string,
    achievementId: string,
  ) {
    const [achievement] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId))
      .limit(1);

    if (!achievement) return;

    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
        ),
      )
      .limit(1);

    if (existing) return;

    await db.insert(userAchievements).values({
      id: crypto.randomUUID(),
      userId,
      achievementId,
    });

    if (achievement.rewardPoints > 0) {
      await this.awardPoints({
        userId,
        points: achievement.rewardPoints,
        type: "achievement",
        description: `Logro desbloqueado: ${achievement.name}`,
      });
    }
  }

  // Obtener puntos del usuario
  static async getUserPoints(userId: string) {
    await this.initializeUserPoints(userId);

    const [points] = await db
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.userId, userId))
      .limit(1);

    return { success: true, points };
  }

  // Obtener leaderboard
  static async getLeaderboard(limit = 50) {
    const topUsers = await db
      .select({
        userId: loyaltyPoints.userId,
        currentPoints: loyaltyPoints.currentPoints,
        totalEarned: loyaltyPoints.totalEarned,
        tier: loyaltyPoints.tier,
        userName: users.name,
        userImage: users.profileImage,
      })
      .from(loyaltyPoints)
      .leftJoin(users, eq(loyaltyPoints.userId, users.id))
      .orderBy(desc(loyaltyPoints.totalEarned))
      .limit(limit);

    return { success: true, leaderboard: topUsers };
  }

  // Obtener achievements del usuario
  static async getUserAchievements(userId: string) {
    const unlocked = await db
      .select({
        achievement: achievements,
        unlockedAt: userAchievements.unlockedAt,
      })
      .from(userAchievements)
      .leftJoin(
        achievements,
        eq(userAchievements.achievementId, achievements.id),
      )
      .where(eq(userAchievements.userId, userId));

    const allAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true));

    const unlockedIds = unlocked.map((u) => u.achievement?.id);
    const locked = allAchievements.filter((a) => !unlockedIds.includes(a.id));

    return {
      success: true,
      unlocked: unlocked.map((u) => ({
        ...u.achievement,
        unlockedAt: u.unlockedAt,
      })),
      locked,
    };
  }

  // Canjear recompensa
  static async redeemReward(userId: string, rewardId: string) {
    const [reward] = await db
      .select()
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.id, rewardId))
      .limit(1);

    if (!reward) {
      return { success: false, error: "Recompensa no encontrada" };
    }

    if (!reward.isAvailable) {
      return { success: false, error: "Recompensa no disponible" };
    }

    const [userPoints] = await db
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.userId, userId))
      .limit(1);

    if (!userPoints || userPoints.currentPoints < reward.pointsCost) {
      return { success: false, error: "Puntos insuficientes" };
    }

    // Descontar puntos
    await db
      .update(loyaltyPoints)
      .set({
        currentPoints: userPoints.currentPoints - reward.pointsCost,
        totalRedeemed: userPoints.totalRedeemed + reward.pointsCost,
      })
      .where(eq(loyaltyPoints.userId, userId));

    // Registrar transacción
    await db.insert(loyaltyTransactions).values({
      id: crypto.randomUUID(),
      userId,
      type: "redemption",
      points: -reward.pointsCost,
      description: `Canjeado: ${reward.title}`,
      rewardId,
    });

    // Crear canje
    const redemptionId = crypto.randomUUID();
    await db.insert(loyaltyRedemptions).values({
      id: redemptionId,
      userId,
      rewardId,
      pointsSpent: reward.pointsCost,
      status: "active",
      expiresAt: reward.expiresAt || null,
    });

    return { success: true, redemptionId };
  }

  // Obtener recompensas disponibles
  static async getAvailableRewards(userId: string) {
    const [userPoints] = await db
      .select()
      .from(loyaltyPoints)
      .where(eq(loyaltyPoints.userId, userId))
      .limit(1);

    const rewards = await db
      .select()
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.isAvailable, true));

    return {
      success: true,
      rewards: rewards.map((r) => ({
        ...r,
        canAfford: userPoints
          ? userPoints.currentPoints >= r.pointsCost
          : false,
      })),
      userPoints: userPoints?.currentPoints || 0,
    };
  }
}
