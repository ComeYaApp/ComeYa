import { db } from "./db";
import {
  loyaltyPoints,
  loyaltyTransactions,
  loyaltyRewards,
  loyaltyRedemptions,
  loyaltyChallenges,
  loyaltyChallengeProgress,
} from "@shared/schema-mysql";
import { eq, and, desc } from "drizzle-orm";

export class LoyaltyService {
  /**
   * Obtener o crear puntos de lealtad para un usuario
   */
  static async getOrCreateLoyaltyPoints(userId: string) {
    try {
      const [existing] = await db
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.userId, userId))
        .limit(1);

      if (existing) return existing;

      const newPoints = {
        id: crypto.randomUUID(),
        userId,
        currentPoints: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        tier: "bronze" as const,
        pointsToNextTier: 1000,
      };

      await db.insert(loyaltyPoints).values(newPoints);
      return newPoints;
    } catch (error) {
      console.error("Error getting/creating loyalty points:", error);
      throw error;
    }
  }

  /**
   * Agregar puntos por pedido completado
   */
  static async awardPointsForOrder(
    userId: string,
    orderId: string,
    orderTotal: number,
  ) {
    try {
      // 1 punto por cada euro gastado (orderTotal en centimos)
      const points = Math.floor(orderTotal / 100);

      if (points <= 0) return;

      await this.addPoints(
        userId,
        points,
        "earned",
        `Pedido completado #${orderId.slice(-6)}`,
        orderId,
      );

      // Actualizar progreso de challenges
      await this.updateChallengeProgress(userId, "orders", 1);
      await this.updateChallengeProgress(userId, "spending", orderTotal);
    } catch (error) {
      console.error("Error awarding points for order:", error);
      throw error;
    }
  }

  /**
   * Agregar puntos
   */
  static async addPoints(
    userId: string,
    points: number,
    type: string,
    description: string,
    orderId?: string,
    rewardId?: string,
  ) {
    try {
      const userPoints = await this.getOrCreateLoyaltyPoints(userId);

      const newCurrent = userPoints.currentPoints + points;
      const newTotal = userPoints.totalEarned + points;

      // Actualizar puntos
      await db
        .update(loyaltyPoints)
        .set({
          currentPoints: newCurrent,
          totalEarned: newTotal,
        })
        .where(eq(loyaltyPoints.userId, userId));

      // Registrar transacción
      await db.insert(loyaltyTransactions).values({
        id: crypto.randomUUID(),
        userId,
        type,
        points,
        description,
        orderId,
        rewardId,
      });

      // Actualizar tier si es necesario
      await this.updateTier(userId, newTotal);

      return newCurrent;
    } catch (error) {
      console.error("Error adding points:", error);
      throw error;
    }
  }

  /**
   * Actualizar tier basado en puntos totales
   */
  static async updateTier(userId: string, totalEarned: number) {
    try {
      let newTier = "bronze";
      let pointsToNext = 1000;

      if (totalEarned >= 10000) {
        newTier = "diamond";
        pointsToNext = 0;
      } else if (totalEarned >= 5000) {
        newTier = "platinum";
        pointsToNext = 10000 - totalEarned;
      } else if (totalEarned >= 2500) {
        newTier = "gold";
        pointsToNext = 5000 - totalEarned;
      } else if (totalEarned >= 1000) {
        newTier = "silver";
        pointsToNext = 2500 - totalEarned;
      } else {
        pointsToNext = 1000 - totalEarned;
      }

      await db
        .update(loyaltyPoints)
        .set({
          tier: newTier,
          tierUpdatedAt: new Date(),
          pointsToNextTier,
        })
        .where(eq(loyaltyPoints.userId, userId));
    } catch (error) {
      console.error("Error updating tier:", error);
      throw error;
    }
  }

  /**
   * Canjear recompensa
   */
  static async redeemReward(userId: string, rewardId: string) {
    try {
      const [reward] = await db
        .select()
        .from(loyaltyRewards)
        .where(eq(loyaltyRewards.id, rewardId))
        .limit(1);

      if (!reward || !reward.isAvailable) {
        throw new Error("Recompensa no disponible");
      }

      const userPoints = await this.getOrCreateLoyaltyPoints(userId);

      if (userPoints.currentPoints < reward.pointsCost) {
        throw new Error("Puntos insuficientes");
      }

      // Verificar tier mínimo
      if (reward.minTier) {
        const tiers = ["bronze", "silver", "gold", "platinum", "diamond"];
        const userTierIndex = tiers.indexOf(userPoints.tier);
        const minTierIndex = tiers.indexOf(reward.minTier);
        if (userTierIndex < minTierIndex) {
          throw new Error(`Requiere tier ${reward.minTier} o superior`);
        }
      }

      // Verificar límite de canjes
      if (
        reward.maxRedemptions &&
        reward.currentRedemptions >= reward.maxRedemptions
      ) {
        throw new Error("Límite de canjes alcanzado");
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
        type: "redeemed",
        points: -reward.pointsCost,
        description: `Canjeado: ${reward.title}`,
        rewardId,
      });

      // Crear canje
      const redemptionId = crypto.randomUUID();
      const expiresAt =
        reward.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días por defecto

      await db.insert(loyaltyRedemptions).values({
        id: redemptionId,
        userId,
        rewardId,
        pointsSpent: reward.pointsCost,
        status: "active",
        expiresAt,
      });

      // Actualizar contador de canjes
      await db
        .update(loyaltyRewards)
        .set({ currentRedemptions: reward.currentRedemptions + 1 })
        .where(eq(loyaltyRewards.id, rewardId));

      return { redemptionId, reward };
    } catch (error) {
      console.error("Error redeeming reward:", error);
      throw error;
    }
  }

  /**
   * Obtener historial de transacciones
   */
  static async getTransactionHistory(userId: string, limit = 50) {
    try {
      return await db
        .select()
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.userId, userId))
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting transaction history:", error);
      return [];
    }
  }

  /**
   * Obtener recompensas disponibles para un usuario
   */
  static async getAvailableRewards(userId: string) {
    try {
      const userPoints = await this.getOrCreateLoyaltyPoints(userId);

      const allRewards = await db
        .select()
        .from(loyaltyRewards)
        .where(eq(loyaltyRewards.isAvailable, true));

      return allRewards.filter((reward) => {
        // Verificar tier mínimo
        if (reward.minTier) {
          const tiers = ["bronze", "silver", "gold", "platinum", "diamond"];
          const userTierIndex = tiers.indexOf(userPoints.tier);
          const minTierIndex = tiers.indexOf(reward.minTier);
          if (userTierIndex < minTierIndex) return false;
        }

        // Verificar límite de canjes
        if (
          reward.maxRedemptions &&
          reward.currentRedemptions >= reward.maxRedemptions
        ) {
          return false;
        }

        return true;
      });
    } catch (error) {
      console.error("Error getting available rewards:", error);
      return [];
    }
  }

  /**
   * Actualizar progreso de challenges
   */
  static async updateChallengeProgress(
    userId: string,
    type: string,
    increment: number,
  ) {
    try {
      // Obtener challenges activos del tipo especificado
      const activeChallenges = await db
        .select()
        .from(loyaltyChallenges)
        .where(
          and(
            eq(loyaltyChallenges.isActive, true),
            eq(loyaltyChallenges.type, type),
          ),
        );

      for (const challenge of activeChallenges) {
        // Verificar si ya expiró
        if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
          continue;
        }

        // Obtener o crear progreso
        const [progress] = await db
          .select()
          .from(loyaltyChallengeProgress)
          .where(
            and(
              eq(loyaltyChallengeProgress.userId, userId),
              eq(loyaltyChallengeProgress.challengeId, challenge.id),
            ),
          )
          .limit(1);

        if (progress) {
          if (!progress.completed) {
            const newProgress = Math.min(
              progress.progress + increment,
              challenge.target,
            );
            const completed = newProgress >= challenge.target;

            await db
              .update(loyaltyChallengeProgress)
              .set({
                progress: newProgress,
                completed,
                completedAt: completed ? new Date() : null,
              })
              .where(eq(loyaltyChallengeProgress.id, progress.id));
          }
        } else {
          // Crear nuevo progreso
          const newProgress = Math.min(increment, challenge.target);
          const completed = newProgress >= challenge.target;

          await db.insert(loyaltyChallengeProgress).values({
            id: crypto.randomUUID(),
            userId,
            challengeId: challenge.id,
            progress: newProgress,
            completed,
            completedAt: completed ? new Date() : null,
          });
        }
      }
    } catch (error) {
      console.error("Error updating challenge progress:", error);
    }
  }

  /**
   * Reclamar recompensa de challenge completado
   */
  static async claimChallengeReward(userId: string, challengeId: string) {
    try {
      const [progress] = await db
        .select()
        .from(loyaltyChallengeProgress)
        .where(
          and(
            eq(loyaltyChallengeProgress.userId, userId),
            eq(loyaltyChallengeProgress.challengeId, challengeId),
          ),
        )
        .limit(1);

      if (!progress || !progress.completed || progress.claimed) {
        throw new Error("Challenge no completado o ya reclamado");
      }

      const [challenge] = await db
        .select()
        .from(loyaltyChallenges)
        .where(eq(loyaltyChallenges.id, challengeId))
        .limit(1);

      if (!challenge) {
        throw new Error("Challenge no encontrado");
      }

      // Marcar como reclamado
      await db
        .update(loyaltyChallengeProgress)
        .set({
          claimed: true,
          claimedAt: new Date(),
        })
        .where(eq(loyaltyChallengeProgress.id, progress.id));

      // Agregar puntos
      await this.addPoints(
        userId,
        challenge.rewardPoints,
        "bonus",
        `Challenge completado: ${challenge.title}`,
      );

      return challenge.rewardPoints;
    } catch (error) {
      console.error("Error claiming challenge reward:", error);
      throw error;
    }
  }

  /**
   * Obtener challenges del usuario con progreso
   */
  static async getUserChallenges(userId: string) {
    try {
      const activeChallenges = await db
        .select()
        .from(loyaltyChallenges)
        .where(eq(loyaltyChallenges.isActive, true));

      const result = [];

      for (const challenge of activeChallenges) {
        const [progress] = await db
          .select()
          .from(loyaltyChallengeProgress)
          .where(
            and(
              eq(loyaltyChallengeProgress.userId, userId),
              eq(loyaltyChallengeProgress.challengeId, challenge.id),
            ),
          )
          .limit(1);

        result.push({
          ...challenge,
          progress: progress?.progress || 0,
          completed: progress?.completed || false,
          claimed: progress?.claimed || false,
        });
      }

      return result;
    } catch (error) {
      console.error("Error getting user challenges:", error);
      return [];
    }
  }
}
