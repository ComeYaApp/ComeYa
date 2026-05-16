// System Settings Service - Admin Configuration
import { db } from "./db";
import { systemSettings, auditLogs } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Default system settings
const DEFAULT_SETTINGS = [
  // Commissions
  {
    key: "platform_commission_rate",
    value: "0.15",
    type: "number",
    category: "commissions",
    description: "Markup de la plataforma sobre productos (15%)",
    isPublic: false,
  },
  {
    key: "business_commission_rate",
    value: "1.00",
    type: "number",
    category: "commissions",
    description: "Porcentaje del precio base de productos que recibe el negocio (100%)",
    isPublic: false,
  },
  {
    key: "driver_commission_rate",
    value: "1.00",
    type: "number",
    category: "commissions",
    description: "Porcentaje de la tarifa de entrega que recibe el repartidor (100%)",
    isPublic: false,
  },
  // Payments
  {
    key: "min_withdrawal_amount",
    value: "10000",
    type: "number",
    category: "payments",
    description: "Monto mínimo de retiro (centavos)",
    isPublic: false,
  },
  {
    key: "fund_hold_duration_hours",
    value: "0",
    type: "number",
    category: "payments",
    description: "Horas de retención de fondos (0 = pago inmediato)",
    isPublic: false,
  },
  {
    key: "max_daily_transactions",
    value: "100",
    type: "number",
    category: "payments",
    description: "Máximo de transacciones diarias por usuario",
    isPublic: false,
  },
  {
    key: "max_transaction_amount",
    value: "1000000",
    type: "number",
    category: "payments",
    description: "Monto máximo por transacción (centavos)",
    isPublic: false,
  },
  // Operations
  {
    key: "delivery_base_fee",
    value: "300",
    type: "number",
    category: "operations",
    description: "Tarifa base de entrega (centavos de euro)",
    isPublic: true,
  },
  {
    key: "delivery_fee_per_km",
    value: "50",
    type: "number",
    category: "operations",
    description: "Tarifa por kilómetro (centavos de euro)",
    isPublic: true,
  },
  {
    key: "delivery_min_fee",
    value: "300",
    type: "number",
    category: "operations",
    description: "Tarifa mínima de entrega (centavos de euro)",
    isPublic: true,
  },
  {
    key: "delivery_max_fee",
    value: "500",
    type: "number",
    category: "operations",
    description: "Tarifa máxima de entrega (centavos de euro)",
    isPublic: true,
  },
  {
    key: "business_default_delivery_fee",
    value: "300",
    type: "number",
    category: "operations",
    description: "Tarifa de entrega por defecto para nuevos negocios (centavos de euro)",
    isPublic: true,
  },
  {
    key: "business_default_min_order",
    value: "1000",
    type: "number",
    category: "operations",
    description: "Pedido mínimo por defecto para nuevos negocios (centavos de euro)",
    isPublic: true,
  },
  {
    key: "max_delivery_radius_km",
    value: "10",
    type: "number",
    category: "operations",
    description: "Radio máximo de entrega (km)",
    isPublic: true,
  },
  {
    key: "delivery_average_speed_kmh",
    value: "20",
    type: "number",
    category: "operations",
    description: "Velocidad promedio de repartidores (km/h)",
    isPublic: false,
  },
  {
    key: "delivery_stop_time_minutes",
    value: "10",
    type: "number",
    category: "operations",
    description: "Tiempo promedio por parada de entrega (minutos)",
    isPublic: false,
  },
  {
    key: "order_regret_period_seconds",
    value: "60",
    type: "number",
    category: "operations",
    description: "Período de arrepentimiento (segundos)",
    isPublic: true,
  },
  {
    key: "pending_order_call_minutes",
    value: "3",
    type: "number",
    category: "operations",
    description: "Minutos antes de llamar al negocio",
    isPublic: false,
  },
  {
    key: "max_simultaneous_orders",
    value: "10",
    type: "number",
    category: "operations",
    description: "Máximo de pedidos simultáneos por negocio",
    isPublic: false,
  },
  // Security
  {
    key: "max_login_attempts",
    value: "5",
    type: "number",
    category: "security",
    description: "Intentos máximos de login",
    isPublic: false,
  },
  {
    key: "rate_limit_requests_per_minute",
    value: "60",
    type: "number",
    category: "security",
    description: "Límite de requests por minuto",
    isPublic: false,
  },
  {
    key: "driver_max_strikes",
    value: "3",
    type: "number",
    category: "security",
    description: "Strikes máximos antes de bloqueo",
    isPublic: false,
  },
  // App Settings
  {
    key: "app_maintenance_mode",
    value: "false",
    type: "boolean",
    category: "app",
    description: "Modo mantenimiento",
    isPublic: true,
  },
  {
    key: "app_version_required",
    value: "1.0.0",
    type: "string",
    category: "app",
    description: "Versión mínima requerida",
    isPublic: true,
  },
  {
    key: "support_phone",
    value: "+34612345678",
    type: "string",
    category: "app",
    description: "Teléfono de soporte",
    isPublic: true,
  },
  {
    key: "support_email",
    value: "soporte@comeya.es",
    type: "string",
    category: "app",
    description: "Email de soporte",
    isPublic: true,
  },
  {
    key: "privacy_contact_email",
    value: "privacidad@comeya.es",
    type: "string",
    category: "app",
    description: "Email de contacto para solicitudes de privacidad (RGPD)",
    isPublic: true,
  },
  {
    key: "privacy_policy_url",
    value: "https://app.comeya.es/privacy-policy",
    type: "string",
    category: "app",
    description: "URL pública de la Política de Privacidad",
    isPublic: true,
  },
  {
    key: "company_name",
    value: "ComeYa",
    type: "string",
    category: "app",
    description: "Nombre de la empresa/plataforma",
    isPublic: true,
  },
  {
    key: "app_store_url_android",
    value: "",
    type: "string",
    category: "app",
    description: "URL de la app en Google Play Store",
    isPublic: true,
  },
  // Twilio Configuration
  {
    key: "twilio_phone_number",
    value: process.env.TWILIO_PHONE_NUMBER || "",
    type: "string",
    category: "twilio",
    description: "Número de teléfono Twilio",
    isPublic: false,
  },
  {
    key: "twilio_studio_flow_sid",
    value: process.env.TWILIO_STUDIO_FLOW_SID || "",
    type: "string",
    category: "twilio",
    description: "Twilio Studio Flow SID para llamadas",
    isPublic: false,
  },
];

// Initialize default settings
export async function initializeDefaultSettings() {
  try {
    for (const setting of DEFAULT_SETTINGS) {
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, setting.key))
        .limit(1);

      if (!existing) {
        await db.insert(systemSettings).values(setting);
      }
    }

    console.log("✅ Default settings initialized");
    return { success: true };
  } catch (error: any) {
    console.error("Error initializing settings:", error);
    return { success: false, error: error.message };
  }
}

// Get all settings (admin only)
export async function getAllSettings() {
  try {
    const settings = await db.select().from(systemSettings);
    return { success: true, settings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get settings by category
export async function getSettingsByCategory(category: string) {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, category));

    return { success: true, settings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get public settings (for clients)
export async function getPublicSettings() {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.isPublic, true));

    return { success: true, settings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get single setting
export async function getSetting(key: string) {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!setting) {
      return { success: false, error: "Setting not found" };
    }

    return { success: true, setting };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Update setting
export async function updateSetting(params: {
  key: string;
  value: string;
  updatedBy: string;
}) {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, params.key))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Setting not found" };
    }

    // Validate value based on type
    if (existing.type === "number" && isNaN(parseFloat(params.value))) {
      return { success: false, error: "Invalid number value" };
    }

    if (
      existing.type === "boolean" &&
      !["true", "false"].includes(params.value)
    ) {
      return { success: false, error: "Invalid boolean value" };
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

    // Audit log
    await db.insert(auditLogs).values({
      userId: params.updatedBy,
      action: "update_setting",
      entityType: "system_setting",
      entityId: params.key,
      changes: JSON.stringify({
        key: params.key,
        oldValue: existing.value,
        newValue: params.value,
      }),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Create custom setting
export async function createSetting(params: {
  key: string;
  value: string;
  type: string;
  category: string;
  description?: string;
  isPublic?: boolean;
  createdBy: string;
}) {
  try {
    // Check if exists
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, params.key))
      .limit(1);

    if (existing) {
      return { success: false, error: "Setting already exists" };
    }

    await db.insert(systemSettings).values({
      key: params.key,
      value: params.value,
      type: params.type,
      category: params.category,
      description: params.description,
      isPublic: params.isPublic || false,
      updatedBy: params.createdBy,
    });

    // Audit log
    await db.insert(auditLogs).values({
      userId: params.createdBy,
      action: "create_setting",
      entityType: "system_setting",
      entityId: params.key,
      changes: JSON.stringify(params),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete setting
export async function deleteSetting(key: string, deletedBy: string) {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Setting not found" };
    }

    await db.delete(systemSettings).where(eq(systemSettings.key, key));

    // Audit log
    await db.insert(auditLogs).values({
      userId: deletedBy,
      action: "delete_setting",
      entityType: "system_setting",
      entityId: key,
      changes: JSON.stringify(existing),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get setting value (helper)
export async function getSettingValue(key: string, defaultValue: any = null) {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!setting) return defaultValue;

    // Parse based on type
    switch (setting.type) {
      case "number":
        return parseFloat(setting.value);
      case "boolean":
        return setting.value === "true";
      case "json":
        return JSON.parse(setting.value);
      default:
        return setting.value;
    }
  } catch (error) {
    return defaultValue;
  }
}
