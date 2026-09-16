// Comunicaciones del administrador: envío masivo de notificaciones por rol.
// El admin elige a quién llega cada promoción/oferta/novedad: clientes,
// negocios y/o repartidores (feedback del cliente). Las preferencias de
// notificación de cada usuario se respetan para categorías no operativas.
import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { users } from "@shared/schema-mysql";
import { inArray } from "drizzle-orm";

const router = express.Router();

const ROLE_BY_TARGET: Record<string, string[]> = {
  clients: ["customer"],
  businesses: ["business_owner"],
  drivers: ["delivery_driver"],
};

router.post(
  "/broadcast",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { targets, title, body, data, category } = req.body || {};
      const selected: string[] = (Array.isArray(targets) ? targets : []).filter(
        (t: string) => Object.keys(ROLE_BY_TARGET).includes(t),
      );
      if (selected.length === 0) {
        return res.status(400).json({
          error: "Elige al menos un público: clientes, negocios o repartidores",
        });
      }
      if (!title || !body) {
        return res.status(400).json({ error: "Título y mensaje son obligatorios" });
      }

      const roles = selected.flatMap((t) => ROLE_BY_TARGET[t]);
      const audience = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role as any, roles));

      const pushCategory =
        category === "orders" ? "orders" : category === "news" ? "news" : "promotions";

      const { sendPushToUser } = await import("../enhancedPushService");
      const payload = {
        title: String(title).slice(0, 100),
        body: String(body).slice(0, 300),
        data: data && typeof data === "object" ? data : {},
        category: pushCategory,
      };

      // Envío en lotes para no saturar la API de Expo con miles de pushes
      let sent = 0;
      const BATCH = 25;
      for (let i = 0; i < audience.length; i += BATCH) {
        const batch = audience.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map((u: { id: string }) => sendPushToUser(u.id, payload as any)),
        );
        sent += batch.length;
      }

      res.json({
        success: true,
        sent: audience.length,
        targets: selected,
        message: `Notificación enviada a ${audience.length} usuarios (${selected.join(", ")})`,
      });
    } catch (error: any) {
      console.error("Broadcast error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
