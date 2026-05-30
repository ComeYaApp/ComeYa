import express from "express";
import { authenticateToken } from "./authMiddleware";

const router = express.Router();

console.log("🔧 Favorites routes loaded");

// Get user favorites
router.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("🔍 GETTING FAVORITES FOR:", userId);

    const { favorites, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: favorites.id,
        userId: favorites.userId,
        businessId: favorites.businessId,
        productId: favorites.productId,
        businessName: businesses.name,
        businessImage: businesses.image,
        businessType: businesses.type,
        businessRating: businesses.rating,
      })
      .from(favorites)
      .leftJoin(businesses, eq(favorites.businessId, businesses.id))
      .where(eq(favorites.userId, userId));

    const mapped = rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      businessId: row.businessId,
      productId: row.productId,
      business: row.businessId
        ? {
            id: row.businessId,
            name: row.businessName,
            image: row.businessImage,
            type: row.businessType,
            rating: ((row.businessRating || 0) / 10).toFixed(1),
          }
        : null,
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add favorite
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { favorites } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { v4: uuidv4 } = await import("uuid");
    const { and, eq } = await import("drizzle-orm");

    const { userId, businessId, productId } = req.body;

    const existing = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          businessId
            ? eq(favorites.businessId, businessId)
            : eq(favorites.productId, productId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, favorite: existing[0] });
    }

    const newFavorite = {
      id: uuidv4(),
      userId,
      businessId: businessId || null,
      productId: productId || null,
    };

    await db.insert(favorites).values(newFavorite);

    res.json({ success: true, favorite: newFavorite });
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

// Remove favorite
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { favorites } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");

    await db.delete(favorites).where(eq(favorites.id, req.params.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check if item is favorited
router.get("/check/:userId/:itemId", authenticateToken, async (req, res) => {
  try {
    const { favorites } = await import("@shared/schema-mysql");
    const { db } = await import("./db");
    const { and, eq, or } = await import("drizzle-orm");

    const { userId, itemId } = req.params;

    const [favorite] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          or(eq(favorites.businessId, itemId), eq(favorites.productId, itemId)),
        ),
      )
      .limit(1);

    res.json({ isFavorite: !!favorite, favoriteId: favorite?.id });
  } catch (error: any) {
    console.error("Error checking favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
