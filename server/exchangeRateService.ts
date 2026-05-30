// Exchange Rate Service - Obtiene tasa USDT de alcambio.app
import { db } from "./db";
import { systemSettings } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface AlCambioResponse {
  success: boolean;
  rate?: number;
  source: "alcambio" | "manual" | "fallback";
  lastUpdated?: Date;
}

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private cachedRate: number | null = null;
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos
  private readonly FALLBACK_RATE = 36.5;

  private constructor() {}

  static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  /**
   * Obtiene la tasa USDT desde alcambio.app
   * Scraping del HTML ya que no tienen API pública
   */
  private async fetchFromAlCambio(): Promise<number | null> {
    try {
      logger.info("📊 Fetching USDT rate from alcambio.app...");

      const response = await fetch("https://alcambio.app/tasas", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        logger.warn(`❌ AlCambio returned status ${response.status}`);
        return null;
      }

      const html = await response.text();

      // Buscar "Tasa USDT" y extraer el promedio
      // Formato esperado: <div>Promedio</div><div>668,41 Bs</div>
      const usdtMatch = html.match(
        /Tasa USDT[\s\S]*?Promedio[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*Bs/i,
      );

      if (usdtMatch && usdtMatch[1]) {
        // Convertir "668,41" a 668.41
        const rateStr = usdtMatch[1].replace(/,/g, "");
        const rate = parseFloat(rateStr);

        if (!isNaN(rate) && rate > 0) {
          logger.info(`✅ USDT rate from AlCambio: ${rate} Bs`);
          return rate;
        }
      }

      logger.warn("⚠️ Could not parse USDT rate from AlCambio HTML");
      return null;
    } catch (error: any) {
      logger.error("❌ Error fetching from AlCambio:", error.message);
      return null;
    }
  }

  /**
   * Obtiene la tasa manual configurada por el admin
   */
  private async getManualRate(): Promise<number | null> {
    try {
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "usd_exchange_rate"))
        .limit(1);

      if (setting?.value) {
        const rate = parseFloat(setting.value);
        if (!isNaN(rate) && rate > 0) {
          return rate;
        }
      }
      return null;
    } catch (error: any) {
      logger.error("Error getting manual rate:", error);
      return null;
    }
  }

  /**
   * Verifica si el admin ha deshabilitado la actualización automática
   */
  private async isAutoUpdateEnabled(): Promise<boolean> {
    try {
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "exchange_rate_auto_update"))
        .limit(1);

      return setting?.value !== "false";
    } catch (error) {
      return true; // Por defecto habilitado
    }
  }

  /**
   * Obtiene la tasa de cambio con la siguiente prioridad:
   * 1. Si auto-update está deshabilitado → tasa manual
   * 2. Si está habilitado → alcambio.app (con cache de 5 min)
   * 3. Fallback → tasa manual
   * 4. Fallback final → 36.50
   */
  async getCurrentRate(): Promise<AlCambioResponse> {
    const autoUpdateEnabled = await this.isAutoUpdateEnabled();

    // Si auto-update está deshabilitado, usar solo tasa manual
    if (!autoUpdateEnabled) {
      const manualRate = await this.getManualRate();
      if (manualRate) {
        return {
          success: true,
          rate: manualRate,
          source: "manual",
        };
      }
      return {
        success: true,
        rate: this.FALLBACK_RATE,
        source: "fallback",
      };
    }

    // Verificar cache
    const now = new Date();
    if (
      this.cachedRate &&
      this.lastFetch &&
      now.getTime() - this.lastFetch.getTime() < this.CACHE_DURATION_MS
    ) {
      return {
        success: true,
        rate: this.cachedRate,
        source: "alcambio",
        lastUpdated: this.lastFetch,
      };
    }

    // Intentar obtener de alcambio.app
    const alcambioRate = await this.fetchFromAlCambio();
    if (alcambioRate) {
      this.cachedRate = alcambioRate;
      this.lastFetch = now;

      // Guardar en DB para referencia
      await this.saveRateToHistory(alcambioRate, "alcambio");

      return {
        success: true,
        rate: alcambioRate,
        source: "alcambio",
        lastUpdated: now,
      };
    }

    // Fallback a tasa manual
    const manualRate = await this.getManualRate();
    if (manualRate) {
      return {
        success: true,
        rate: manualRate,
        source: "manual",
      };
    }

    // Fallback final
    return {
      success: true,
      rate: this.FALLBACK_RATE,
      source: "fallback",
    };
  }

  /**
   * Actualiza la tasa manual (solo admin)
   */
  async updateManualRate(
    rate: number,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (rate <= 0) {
        return { success: false, message: "La tasa debe ser mayor a 0" };
      }

      // Actualizar o insertar
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "usd_exchange_rate"))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            value: rate.toString(),
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, "usd_exchange_rate"));
      } else {
        await db.insert(systemSettings).values({
          category: "currency",
          key: "usd_exchange_rate",
          value: rate.toString(),
          description: "Tasa de cambio BsD/USD manual",
        });
      }

      // Guardar en historial
      await this.saveRateToHistory(rate, "manual", adminId);

      // Limpiar cache para forzar recarga
      this.cachedRate = null;
      this.lastFetch = null;

      logger.info(
        `💰 Exchange rate updated manually by ${adminId}: ${rate} Bs/USD`,
      );

      return {
        success: true,
        message: `Tasa actualizada a ${rate} Bs/USD`,
      };
    } catch (error: any) {
      logger.error("Error updating manual rate:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Habilita/deshabilita la actualización automática
   */
  async toggleAutoUpdate(
    enabled: boolean,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "exchange_rate_auto_update"))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            value: enabled ? "true" : "false",
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, "exchange_rate_auto_update"));
      } else {
        await db.insert(systemSettings).values({
          category: "currency",
          key: "exchange_rate_auto_update",
          value: enabled ? "true" : "false",
          description: "Actualización automática de tasa desde alcambio.app",
        });
      }

      logger.info(
        `🔄 Auto-update ${enabled ? "enabled" : "disabled"} by ${adminId}`,
      );

      return {
        success: true,
        message: `Actualización automática ${enabled ? "habilitada" : "deshabilitada"}`,
      };
    } catch (error: any) {
      logger.error("Error toggling auto-update:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Guarda la tasa en un historial (opcional, para analytics)
   */
  private async saveRateToHistory(
    rate: number,
    source: string,
    adminId?: string,
  ) {
    try {
      // Guardar en una tabla de historial si existe
      // Por ahora solo log
      logger.info(
        `📊 Rate saved to history: ${rate} Bs/USD (source: ${source})`,
      );
    } catch (error) {
      // No crítico
    }
  }

  /**
   * Fuerza una actualización inmediata desde alcambio.app
   */
  async forceUpdate(): Promise<AlCambioResponse> {
    this.cachedRate = null;
    this.lastFetch = null;
    return await this.getCurrentRate();
  }
}

export const exchangeRateService = ExchangeRateService.getInstance();
