import cron from "node-cron";
import { cashSecurityService } from "./cashSecurityService";

export function initializeCashSecurityCron() {
  // Revisar deudas de efectivo diariamente a las 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("🔍 [CRON] Ejecutando revisión diaria de efectivo...");
    try {
      await cashSecurityService.checkOverdueCashDebts();
      console.log("✅ [CRON] Revisión de efectivo completada");
    } catch (error) {
      console.error("❌ [CRON] Error en revisión de efectivo:", error);
    }
  });

  // Revisar cada 6 horas (adicional para mayor seguridad)
  cron.schedule("0 */6 * * *", async () => {
    console.log("🔍 [CRON] Revisión de efectivo cada 6 horas...");
    try {
      const stats = await cashSecurityService.getCashStats();
      console.log("📊 [CRON] Estadísticas:", stats);
    } catch (error) {
      console.error("❌ [CRON] Error obteniendo estadísticas:", error);
    }
  });

  console.log("✅ Cron jobs de seguridad de efectivo iniciados");
  console.log("   - Revisión diaria: 9:00 AM");
  console.log("   - Estadísticas: Cada 6 horas");
}
