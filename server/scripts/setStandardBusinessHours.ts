import { db } from "../db";
import { businesses } from "@shared/schema-mysql";
import { BusinessHoursService } from "../businessHoursService";
import { eq } from "drizzle-orm";

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

async function setStandardBusinessHours() {
  try {
    console.log(
      "🕐 Estableciendo horarios estándar para todos los negocios...",
    );

    const allBusinesses = await db.select().from(businesses);
    console.log(`📊 Encontrados ${allBusinesses.length} negocios`);

    for (const business of allBusinesses) {
      // Establecer horarios estándar
      await db
        .update(businesses)
        .set({
          openingHours: JSON.stringify(STANDARD_HOURS),
        })
        .where(eq(businesses.id, business.id));

      console.log(`✅ ${business.name}: Horarios actualizados`);
    }

    console.log(
      "\n🔄 Actualizando estado de apertura de todos los negocios...",
    );
    await BusinessHoursService.updateAllBusinessStatuses();

    console.log("\n✅ ¡Proceso completado!");
    console.log("📋 Horarios establecidos:");
    console.log("   Lunes a Sábado: 9:00 AM - 6:00 PM");
    console.log("   Domingo: Cerrado");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

setStandardBusinessHours();
