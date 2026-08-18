import { db } from "./db";
import { users } from "@shared/schema-mysql";
import { eq, and, isNull, ne } from "drizzle-orm";

// Puntos que recibe quien invitó cuando su invitado completa el primer pedido
export const REFERRAL_REWARD_POINTS = 500;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `CY${suffix}`;
}

export class ReferralService {
  /**
   * Obtener el código de referido del usuario, generándolo si no existe.
   */
  static async getOrCreateReferralCode(userId: string): Promise<string> {
    const [user] = await db
      .select({ referralCode: users.referralCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.referralCode) return user.referralCode;

    // Reintentar si el código generado colisiona (índice único)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        await db
          .update(users)
          .set({ referralCode: code })
          .where(eq(users.id, userId));
        return code;
      } catch (error: any) {
        if (error?.errno === 1062 || error?.code === "ER_DUP_ENTRY") continue;
        throw error;
      }
    }
    throw new Error("No se pudo generar un código de referido único");
  }

  /**
   * Validar un código de referido y devolver el id del invitador.
   * Devuelve null si el código no existe o coincide con el propio usuario.
   */
  static async resolveReferralCode(
    code: string,
    selfUserId?: string,
  ): Promise<string | null> {
    if (!code) return null;
    const [inviter] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code.toUpperCase()))
      .limit(1);
    if (!inviter) return null;
    if (selfUserId && inviter.id === selfUserId) return null;
    return inviter.id;
  }

  /**
   * Otorgar la recompensa al invitador cuando su invitado completa su primer
   * pedido. Idempotente: una vez recompensado, no vuelve a otorgar.
   */
  static async processReferralRewardForOrder(
    buyerId: string,
    orderId: string,
  ): Promise<void> {
    try {
      const [buyer] = await db
        .select({
          referredBy: users.referredBy,
          referralRewardedAt: users.referralRewardedAt,
        })
        .from(users)
        .where(eq(users.id, buyerId))
        .limit(1);
      if (!buyer?.referredBy || buyer.referralRewardedAt) return;

      // Idempotencia por pedido: si ya existe recompensa de este pedido, salir
      const { loyaltyTransactions } = await import("@shared/schema-mysql");
      const [existingReward] = await db
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.orderId, orderId),
            eq(loyaltyTransactions.type, "referral"),
          ),
        )
        .limit(1);
      if (existingReward) return;

      // Marcar como recompensado (la condición isNull evita duplicados en
      // llamadas concurrentes)
      await db
        .update(users)
        .set({ referralRewardedAt: new Date() })
        .where(and(eq(users.id, buyerId), isNull(users.referralRewardedAt)));

      const { LoyaltyService } = await import("./loyaltyService");
      await LoyaltyService.addPoints(
        buyer.referredBy,
        REFERRAL_REWARD_POINTS,
        "referral",
        `Recompensa por invitar a un amigo (pedido #${orderId.slice(-6)})`,
        orderId,
      );

      // Notificar al invitador
      try {
        const { sendPushToUser } = await import("./enhancedPushService");
        await sendPushToUser(buyer.referredBy, {
          title: "🎉 ¡Invitación exitosa!",
          body: `Tu invitado completó su primer pedido. Has ganado ${REFERRAL_REWARD_POINTS} puntos.`,
          data: { screen: "Gamification" },
          category: "orders",
        });
      } catch (pushError) {
        console.error("Error sending referral push:", pushError);
      }
    } catch (error) {
      console.error("Error processing referral reward:", error);
    }
  }

  /**
   * Resumen de referidos para la pantalla "Invita y Gana".
   */
  static async getReferralSummary(userId: string) {
    const referralCode = await this.getOrCreateReferralCode(userId);

    const invited = await db
      .select({
        id: users.id,
        name: users.name,
        rewarded: users.referralRewardedAt,
      })
      .from(users)
      .where(and(eq(users.referredBy, userId), ne(users.id, userId)));

    const completed = invited.filter((u: any) => !!u.rewarded).length;

    return {
      referralCode,
      shareLink: `https://app.comeya.es?ref=${referralCode}`,
      rewardPoints: REFERRAL_REWARD_POINTS,
      invitedCount: invited.length,
      completedCount: completed,
    };
  }
}
