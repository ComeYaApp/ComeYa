import { db } from "./db";
import { businesses, orders } from "../shared/schema-mysql";
import { eq, and, count, sum } from "drizzle-orm";

// Umbrales de nivel (pedidos completados / mes)
const LEVELS = [
  {
    level: "platinum",
    minOrders: 200,
    minRevenue: 500000_00,
    commission: 0.12,
    badge: "💎",
  },
  {
    level: "gold",
    minOrders: 100,
    minRevenue: 200000_00,
    commission: 0.13,
    badge: "🥇",
  },
  {
    level: "silver",
    minOrders: 50,
    minRevenue: 80000_00,
    commission: 0.14,
    badge: "🥈",
  },
  {
    level: "bronze",
    minOrders: 0,
    minRevenue: 0,
    commission: 0.15,
    badge: "🥉",
  },
] as const;

export type PartnerLevel = (typeof LEVELS)[number]["level"];

export function getLevelInfo(level: PartnerLevel) {
  return LEVELS.find((l) => l.level === level) || LEVELS[3];
}

// Calcula y actualiza el nivel de un negocio basado en sus últimos 30 días
export async function updatePartnerLevel(
  businessId: string,
): Promise<PartnerLevel> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({ orderCount: count(), revenue: sum(orders.total) })
    .from(orders)
    .where(
      and(eq(orders.businessId, businessId), eq(orders.status, "delivered")),
    );

  const orderCount = stats?.orderCount || 0;
  const revenue = Number(stats?.revenue) || 0;

  const newLevel =
    LEVELS.find((l) => orderCount >= l.minOrders && revenue >= l.minRevenue)
      ?.level || "bronze";

  await db
    .update(businesses)
    .set({
      partnerLevel: newLevel,
      partnerLevelUpdatedAt: new Date(),
      totalOrdersCompleted: orderCount,
      totalRevenueGenerated: revenue,
    })
    .where(eq(businesses.id, businessId));

  return newLevel;
}

// Obtener nivel actual con beneficios
export async function getPartnerStatus(businessId: string) {
  const [business] = await db
    .select({
      partnerLevel: businesses.partnerLevel,
      totalOrdersCompleted: businesses.totalOrdersCompleted,
      totalRevenueGenerated: businesses.totalRevenueGenerated,
      partnerLevelUpdatedAt: businesses.partnerLevelUpdatedAt,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new Error("Negocio no encontrado");

  const level = (business.partnerLevel || "bronze") as PartnerLevel;
  const info = getLevelInfo(level);
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.level === level) - 1];

  return {
    level,
    badge: info.badge,
    commission: info.commission,
    totalOrders: business.totalOrdersCompleted || 0,
    totalRevenue: business.totalRevenueGenerated || 0,
    updatedAt: business.partnerLevelUpdatedAt,
    nextLevel: nextLevel
      ? {
          level: nextLevel.level,
          badge: nextLevel.badge,
          ordersNeeded: Math.max(
            0,
            nextLevel.minOrders - (business.totalOrdersCompleted || 0),
          ),
          revenueNeeded: Math.max(
            0,
            nextLevel.minRevenue - (business.totalRevenueGenerated || 0),
          ),
        }
      : null,
  };
}
