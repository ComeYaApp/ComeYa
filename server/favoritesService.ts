import { db } from "./db";
import { userFavorites, businesses, products } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";

export class FavoritesService {
  // Agregar favorito
  static async addFavorite(
    userId: string,
    itemType: "business" | "product",
    itemId: string,
  ) {
    try {
      await db.insert(userFavorites).values({
        userId,
        itemType,
        itemId,
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return { success: false, error: "Ya está en favoritos" };
      }
      throw error;
    }
  }

  // Eliminar favorito
  static async removeFavorite(
    userId: string,
    itemType: "business" | "product",
    itemId: string,
  ) {
    await db
      .delete(userFavorites)
      .where(
        and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.itemType, itemType),
          eq(userFavorites.itemId, itemId),
        ),
      );
    return { success: true };
  }

  // Obtener favoritos del usuario
  static async getUserFavorites(userId: string) {
    const favorites = await db
      .select()
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId));

    const businessIds = favorites
      .filter((f) => f.itemType === "business")
      .map((f) => f.itemId);
    const productIds = favorites
      .filter((f) => f.itemType === "product")
      .map((f) => f.itemId);

    const favoriteBusinesses =
      businessIds.length > 0
        ? await db
            .select()
            .from(businesses)
            .where(eq(businesses.id, businessIds[0]))
        : [];

    const favoriteProducts =
      productIds.length > 0
        ? await db.select().from(products).where(eq(products.id, productIds[0]))
        : [];

    return {
      businesses: favoriteBusinesses,
      products: favoriteProducts,
      total: favorites.length,
    };
  }

  // Verificar si es favorito
  static async isFavorite(
    userId: string,
    itemType: "business" | "product",
    itemId: string,
  ) {
    const [favorite] = await db
      .select()
      .from(userFavorites)
      .where(
        and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.itemType, itemType),
          eq(userFavorites.itemId, itemId),
        ),
      )
      .limit(1);

    return !!favorite;
  }
}
