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

// Geocodifica una dirección con Google Maps (clave del servidor) y devuelve
// { lat, lng } o null si no se puede. Evita que se guarden direcciones sin
// coordenadas, que luego rompen la navegación del repartidor.
// Usa el servicio cacheado (caché BD + rate limit + límite diario).
async function geocodeAddress(
  street: string,
  city: string,
): Promise<{ lat: string; lng: string } | null> {
  const base = `${street}, ${city || "Soria"}`;
  const query = base.toLowerCase().includes("soria")
    ? base
    : `${base}, Soria, España`;
  const { googleMapsService } = await import(
    "../services/googleMapsService"
  );
  const result = await googleMapsService.geocodeAddress(query);
  return result ? { lat: String(result.lat), lng: String(result.lng) } : null;
}

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

    // Si llegan sin coordenadas, geocodificar para no guardar dirección "ciega"
    let finalLat = latitude ? String(latitude) : null;
    let finalLng = longitude ? String(longitude) : null;
    if (!finalLat || !finalLng) {
      const geo = await geocodeAddress(street, city || "");
      if (geo) {
        finalLat = geo.lat;
        finalLng = geo.lng;
      }
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
      latitude: finalLat,
      longitude: finalLng,
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
