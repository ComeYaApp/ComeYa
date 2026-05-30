import { Router } from "express";
import { db } from "./db";
import { businesses } from "@shared/schema-mysql";
import { BusinessHoursService } from "./businessHoursService";
import { eq } from "drizzle-orm";

const router = Router();

// Horarios estándar de oficina: Lunes a Sábado 9:00 AM - 6:00 PM
const STANDARD_HOURS = {
  0: { isOpen: false, openTime: "09:00", closeTime: "18:00" }, // Domingo - cerrado
  1: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Lunes
  2: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Martes
  3: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Miércoles
  4: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Jueves
  5: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Viernes
  6: { isOpen: true, openTime: "09:00", closeTime: "18:00" }, // Sábado
};

router.post("/set-standard-hours", async (req, res) => {
  try {
    console.log(
      "🕐 Estableciendo horarios estándar para todos los negocios...",
    );

    const allBusinesses = await db.select().from(businesses);
    console.log(`📊 Encontrados ${allBusinesses.length} negocios`);

    const results = [];
    for (const business of allBusinesses) {
      // Establecer horarios estándar
      await db
        .update(businesses)
        .set({
          openingHours: JSON.stringify(STANDARD_HOURS),
        })
        .where(eq(businesses.id, business.id));

      console.log(`✅ ${business.name}: Horarios actualizados`);
      results.push({ id: business.id, name: business.name, status: "updated" });
    }

    console.log(
      "\n🔄 Actualizando estado de apertura de todos los negocios...",
    );
    await BusinessHoursService.updateAllBusinessStatuses();

    res.json({
      success: true,
      message: "Horarios estándar establecidos correctamente",
      schedule: "Lunes a Sábado: 9:00 AM - 6:00 PM, Domingo: Cerrado",
      businesses: results,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Error al establecer horarios" });
  }
});

router.post("/update-business-statuses", async (req, res) => {
  try {
    console.log("🔄 Actualizando estado de apertura de todos los negocios...");
    await BusinessHoursService.updateAllBusinessStatuses();

    res.json({
      success: true,
      message: "Estados de negocios actualizados correctamente",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Error al actualizar estados" });
  }
});

export default router;
