// Enhanced System Settings Service with Financial Validation
import { db } from "./db";
import { systemSettings, auditLogs } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { financialService } from "./unifiedFinancialService";

// Update setting with financial validation
export async function updateCommissionSetting(params: {
  key: string;
  value: string;
  updatedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, params.key))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Setting not found" };
    }

    // Validate commission rate
    const newRate = parseFloat(params.value);
    if (isNaN(newRate) || newRate < 0 || newRate > 1) {
      return {
        success: false,
        error: "Commission rate must be between 0 and 1",
      };
    }

    // Get all commission rates to validate total
    const allCommissionSettings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, "commissions"));

    let totalRate = 0;
    for (const setting of allCommissionSettings) {
      if (setting.key === params.key) {
        totalRate += newRate; // Use new value
      } else {
        totalRate += parseFloat(setting.value);
      }
    }

    // Validate total is 100%
    if (Math.abs(totalRate - 1.0) > 0.001) {
      return {
        success: false,
        error: `Commission rates must sum to 100%. Current total would be: ${(totalRate * 100).toFixed(2)}%`,
      };
    }

    // Update setting
    await db
      .update(systemSettings)
      .set({
        value: params.value,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, params.key));

    // Clear financial service cache
    financialService.clearCache();

    // Audit log
    await db.insert(auditLogs).values({
      userId: params.updatedBy,
      action: "update_commission_setting",
      entityType: "system_setting",
      entityId: params.key,
      changes: JSON.stringify({
        key: params.key,
        oldValue: existing.value,
        newValue: params.value,
        totalRate: totalRate,
      }),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get commission rates (wrapper for unified service)
export async function getCommissionRates() {
  return await financialService.getCommissionRates();
}
