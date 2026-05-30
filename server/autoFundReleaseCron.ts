// Auto Fund Release Cron - Libera fondos automáticamente después de 24h
import cron from "node-cron";
import { fundReleaseService } from "./fundReleaseService";
import { logger } from "./logger";

// Run every hour
export const autoFundReleaseCron = cron.schedule(
  "0 * * * *", // Every hour at minute 0
  async () => {
    try {
      logger.info("🔄 Starting auto fund release job...");

      const result = await fundReleaseService.autoReleaseFunds();

      logger.info(
        `✅ Auto fund release completed: ${result.released} released, ${result.failed} failed`,
      );
    } catch (error) {
      logger.error("❌ Error in auto fund release cron:", error);
    }
  },
  {
    scheduled: false, // Don't start automatically
    timezone: "America/Caracas",
  },
);

// Start the cron job
export function startAutoFundReleaseCron() {
  autoFundReleaseCron.start();
  logger.info("⏰ Auto fund release cron started (runs every hour)");
}

// Stop the cron job
export function stopAutoFundReleaseCron() {
  autoFundReleaseCron.stop();
  logger.info("⏸️ Auto fund release cron stopped");
}
