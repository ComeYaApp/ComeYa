import { db } from "./db";
import {
  orders,
  businesses,
  products,
  userPreferences,
  aiRecommendations,
} from "@shared/schema-mysql";
import { eq, desc, and, sql, gte } from "drizzle-orm";

export class AIRecommendationsService {
  // Generar recomendaciones personalizadas
  static async generatePersonalizedRecommendations(userId: string) {
    // Obtener historial de pedidos
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(50);

    if (userOrders.length === 0) {
      return this.getDefaultRecommendations(userId);
    }

    // Analizar patrones
    const businessFrequency = this.analyzeBusinessFrequency(userOrders);
    const productFrequency = this.analyzeProductFrequency(userOrders);
    const timePatterns = this.analyzeTimePatterns(userOrders);

    // Generar recomendaciones
    const recommendations = [];

    // 1. Negocios frecuentes
    for (const [businessId, count] of Object.entries(businessFrequency).slice(
      0,
      3,
    )) {
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
      if (business) {
        recommendations.push({
          userId,
          recommendationType: "personalized",
          itemType: "business",
          itemId: businessId,
          confidenceScore: Math.min(95, 60 + (count as number) * 5),
          reason: `Has pedido aquí ${count} veces`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // 2. Productos frecuentes
    for (const [productId, count] of Object.entries(productFrequency).slice(
      0,
      3,
    )) {
      recommendations.push({
        userId,
        recommendationType: "reorder",
        itemType: "product",
        itemId: productId,
        confidenceScore: Math.min(90, 50 + (count as number) * 10),
        reason: `Lo has pedido ${count} veces`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // Guardar recomendaciones
    await db
      .delete(aiRecommendations)
      .where(eq(aiRecommendations.userId, userId));
    if (recommendations.length > 0) {
      await db.insert(aiRecommendations).values(recommendations);
    }

    return recommendations;
  }

  // Obtener recomendaciones trending
  static async getTrendingRecommendations() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Productos más pedidos en las últimas 24h
    const trending = await db
      .select({
        productId: sql`JSON_EXTRACT(items, '$[*].product.id')`,
        count: sql`COUNT(*)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, last24h))
      .groupBy(sql`JSON_EXTRACT(items, '$[*].product.id')`)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    return trending;
  }

  // Obtener recomendaciones del usuario
  static async getUserRecommendations(userId: string) {
    const now = new Date();
    const recommendations = await db
      .select()
      .from(aiRecommendations)
      .where(
        and(
          eq(aiRecommendations.userId, userId),
          gte(aiRecommendations.expiresAt, now),
        ),
      )
      .orderBy(desc(aiRecommendations.confidenceScore));

    // Enriquecer con datos de negocios/productos
    const enriched = [];
    for (const rec of recommendations) {
      let itemData = null;
      if (rec.itemType === "business") {
        const [business] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.id, rec.itemId))
          .limit(1);
        itemData = business;
      } else if (rec.itemType === "product") {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, rec.itemId))
          .limit(1);
        itemData = product;
      }

      if (itemData) {
        enriched.push({
          ...rec,
          itemData,
        });
      }
    }

    return enriched;
  }

  // Actualizar preferencias del usuario
  static async updateUserPreferences(userId: string, preferences: any) {
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userPreferences)
        .set({
          cuisineTypes: preferences.cuisineTypes
            ? JSON.stringify(preferences.cuisineTypes)
            : null,
          priceRange: preferences.priceRange,
          dietaryRestrictions: preferences.dietaryRestrictions
            ? JSON.stringify(preferences.dietaryRestrictions)
            : null,
          preferredOrderTimes: preferences.preferredOrderTimes
            ? JSON.stringify(preferences.preferredOrderTimes)
            : null,
          favoriteCategories: preferences.favoriteCategories
            ? JSON.stringify(preferences.favoriteCategories)
            : null,
          spiceLevel: preferences.spiceLevel,
          healthScore: preferences.healthScore,
        })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        cuisineTypes: preferences.cuisineTypes
          ? JSON.stringify(preferences.cuisineTypes)
          : null,
        priceRange: preferences.priceRange,
        dietaryRestrictions: preferences.dietaryRestrictions
          ? JSON.stringify(preferences.dietaryRestrictions)
          : null,
        preferredOrderTimes: preferences.preferredOrderTimes
          ? JSON.stringify(preferences.preferredOrderTimes)
          : null,
        favoriteCategories: preferences.favoriteCategories
          ? JSON.stringify(preferences.favoriteCategories)
          : null,
        spiceLevel: preferences.spiceLevel,
        healthScore: preferences.healthScore,
      });
    }

    // Regenerar recomendaciones
    await this.generatePersonalizedRecommendations(userId);

    return { success: true };
  }

  // Analizar frecuencia de negocios
  private static analyzeBusinessFrequency(orders: any[]) {
    const frequency: Record<string, number> = {};
    for (const order of orders) {
      frequency[order.businessId] = (frequency[order.businessId] || 0) + 1;
    }
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }

  // Analizar frecuencia de productos
  private static analyzeProductFrequency(orders: any[]) {
    const frequency: Record<string, number> = {};
    for (const order of orders) {
      try {
        const items = JSON.parse(order.items);
        for (const item of items) {
          const productId = item.product?.id || item.productId;
          if (productId) {
            frequency[productId] = (frequency[productId] || 0) + 1;
          }
        }
      } catch (e) {}
    }
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }

  // Analizar patrones de tiempo
  private static analyzeTimePatterns(orders: any[]) {
    const hourFrequency: Record<number, number> = {};
    const dayFrequency: Record<number, number> = {};

    for (const order of orders) {
      const date = new Date(order.createdAt);
      const hour = date.getHours();
      const day = date.getDay();

      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    }

    return { hourFrequency, dayFrequency };
  }

  // Recomendaciones por defecto para nuevos usuarios
  private static async getDefaultRecommendations(userId: string) {
    // Obtener negocios mejor calificados
    const topBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.isActive, true))
      .orderBy(desc(businesses.rating))
      .limit(5);

    const recommendations = topBusinesses.map((business, index) => ({
      userId,
      recommendationType: "trending",
      itemType: "business",
      itemId: business.id,
      confidenceScore: 80 - index * 5,
      reason: "Popular en tu área",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }));

    if (recommendations.length > 0) {
      await db.insert(aiRecommendations).values(recommendations);
    }

    return recommendations;
  }
}
