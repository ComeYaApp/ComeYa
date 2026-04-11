import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { getDeliveryConfig, clearDeliveryConfigCache } from "../services/deliveryConfigService";
import { db } from "../db";
import { systemSettings } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

router.get("/config", async (req, res) => {
  try {
    const config = await getDeliveryConfig();
    // Devolver en euros para el frontend
    res.json({
      success: true,
      config: {
        tier1:      config.tier1      / 100,
        tier2:      config.tier2      / 100,
        tier3:      config.tier3      / 100,
        extraPerKm: config.extraPerKm / 100,
        speedKmPerMin:  config.speedKmPerMin,
        defaultPrepTime: config.defaultPrepTime,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/config", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { tier1, tier2, tier3, extraPerKm } = req.body;

    const updates = [
      { key: "delivery_tier1",        value: tier1?.toString(),      category: "delivery", description: "Tarifa 1-2 km (EUR)" },
      { key: "delivery_tier2",        value: tier2?.toString(),      category: "delivery", description: "Tarifa 2-3 km (EUR)" },
      { key: "delivery_tier3",        value: tier3?.toString(),      category: "delivery", description: "Tarifa 3-4 km (EUR)" },
      { key: "delivery_extra_per_km", value: extraPerKm?.toString(), category: "delivery", description: "Extra por km >4 km (EUR)" },
    ];

    for (const u of updates) {
      if (u.value !== undefined) {
        const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, u.key)).limit(1);
        if (existing.length > 0) {
          await db.update(systemSettings).set({ value: u.value, updatedBy: req.user!.id }).where(eq(systemSettings.key, u.key));
        } else {
          await db.insert(systemSettings).values({ key: u.key, value: u.value, type: "number", category: u.category, description: u.description, isPublic: false });
        }
      }
    }

    clearDeliveryConfigCache();
    const newConfig = await getDeliveryConfig();

    res.json({
      success: true,
      config: {
        tier1:      newConfig.tier1      / 100,
        tier2:      newConfig.tier2      / 100,
        tier3:      newConfig.tier3      / 100,
        extraPerKm: newConfig.extraPerKm / 100,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
