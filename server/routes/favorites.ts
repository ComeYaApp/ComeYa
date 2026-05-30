import express from "express";
import { authenticateToken } from "../authMiddleware";
import { FavoritesService } from "../favoritesService";

const router = express.Router();

// Agregar favorito
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.body;
    const result = await FavoritesService.addFavorite(
      req.user!.id,
      itemType,
      itemId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar favorito
router.delete("/:itemType/:itemId", authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    const result = await FavoritesService.removeFavorite(
      req.user!.id,
      itemType as any,
      itemId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener favoritos
router.get("/", authenticateToken, async (req, res) => {
  try {
    const favorites = await FavoritesService.getUserFavorites(req.user!.id);
    res.json({ success: true, favorites });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar si es favorito
router.get("/check/:itemType/:itemId", authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    const isFavorite = await FavoritesService.isFavorite(
      req.user!.id,
      itemType as any,
      itemId,
    );
    res.json({ success: true, isFavorite });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
