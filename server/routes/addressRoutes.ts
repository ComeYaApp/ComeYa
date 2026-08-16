import { Router } from "express";
import { db } from "../db";
import { addresses } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../authMiddleware";
import crypto from "crypto";

// Router de direcciones del usuario autenticado.
// La app llama a /api/addresses (los handlers bajo /api/users/:id/addresses
// existen desde antes, pero estas rutas cortas faltaban y la pantalla de
// direcciones daba 404).
const router = Router();

// GET /api/addresses — direcciones del usuario autenticado
router.get("/", authenticateToken, async (req, res) => {
  try {
    const list = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, (req as any).user.id));
    res.json({ success: true, addresses: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/addresses — crear dirección para el usuario autenticado
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { label, street, city, state, zipCode, latitude, longitude, isDefault } =
      req.body;
    if (!label || !street) {
      return res.status(400).json({ error: "label y street son requeridos" });
    }

    if (isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
    }

    const id = crypto.randomUUID();
    await db.insert(addresses).values({
      id,
      userId,
      label,
      street,
      city: city || "",
      state: state || "",
      zipCode: zipCode || null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      isDefault: isDefault || false,
    });

    const [saved] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, id))
      .limit(1);
    res.json({ success: true, address: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/addresses/:id/default — marcar como predeterminada (propietario)
router.patch(
  "/:id/default",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const [existing] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, req.params.id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Dirección no encontrada" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "No autorizado" });
      }
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
      await db
        .update(addresses)
        .set({ isDefault: true })
        .where(eq(addresses.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// DELETE /api/addresses/:id — eliminar (propietario)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const [existing] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, req.params.id))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Dirección no encontrada" });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    await db.delete(addresses).where(eq(addresses.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
