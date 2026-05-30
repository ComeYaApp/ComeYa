import { db } from "./db";
import { coupons } from "@shared/schema-mysql";
import { eq, and, lte, gte, or, isNull } from "drizzle-orm";

interface CouponValidationResult {
  valid: boolean;
  discount: number;
  message?: string;
  coupon?: any;
}

interface CouponValidationContext {
  userId: string;
  orderTotal: number;
  businessId?: string;
  productIds?: string[];
  categories?: string[];
  isFirstOrder?: boolean;
  currentTime?: Date;
}

export class AdvancedCouponService {
  /**
   * Valida un cupón y calcula el descuento aplicable
   */
  static async validateCoupon(
    code: string,
    context: CouponValidationContext,
  ): Promise<CouponValidationResult> {
    try {
      // Buscar cupón
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(
          and(eq(coupons.code, code.toUpperCase()), eq(coupons.isActive, true)),
        )
        .limit(1);

      if (!coupon) {
        return { valid: false, discount: 0, message: "Cupón no válido" };
      }

      // Verificar expiración
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return { valid: false, discount: 0, message: "Cupón expirado" };
      }

      // Verificar límite de usos global
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, discount: 0, message: "Cupón agotado" };
      }

      // Verificar límite de usos por usuario
      if (coupon.maxUsesPerUser) {
        const userUsageCount = await this.getUserCouponUsageCount(
          context.userId,
          coupon.id,
        );
        if (userUsageCount >= coupon.maxUsesPerUser) {
          return {
            valid: false,
            discount: 0,
            message: `Ya usaste este cupón ${coupon.maxUsesPerUser} ${coupon.maxUsesPerUser === 1 ? "vez" : "veces"}`,
          };
        }
      }

      // Verificar monto mínimo
      if (coupon.minOrderAmount && context.orderTotal < coupon.minOrderAmount) {
        return {
          valid: false,
          discount: 0,
          message: `Pedido mínimo de Bs. ${(coupon.minOrderAmount / 100).toFixed(2)}`,
        };
      }

      // Verificar solo nuevos usuarios
      const newUsersOnly = (coupon as any).newUsersOnly;
      if (newUsersOnly) {
        const isNewUser = await this.isNewUser(context.userId);
        if (!isNewUser) {
          return {
            valid: false,
            discount: 0,
            message: "Cupón solo para nuevos usuarios",
          };
        }
      }

      // Verificar solo primera compra
      const firstOrderOnly = (coupon as any).firstOrderOnly;
      if (firstOrderOnly && !context.isFirstOrder) {
        return {
          valid: false,
          discount: 0,
          message: "Cupón solo para primera compra",
        };
      }

      // Verificar negocios válidos
      const validForBusinesses = (coupon as any).validForBusinesses;
      if (validForBusinesses && context.businessId) {
        try {
          const businessIds = JSON.parse(validForBusinesses);
          if (
            Array.isArray(businessIds) &&
            !businessIds.includes(context.businessId)
          ) {
            return {
              valid: false,
              discount: 0,
              message: "Cupón no válido para este negocio",
            };
          }
        } catch (e) {
          console.error("Error parsing validForBusinesses:", e);
        }
      }

      // Verificar categorías válidas
      const validForCategories = (coupon as any).validForCategories;
      if (validForCategories && context.categories) {
        try {
          const allowedCategories = JSON.parse(validForCategories);
          if (Array.isArray(allowedCategories)) {
            const hasValidCategory = context.categories.some((cat) =>
              allowedCategories.includes(cat),
            );
            if (!hasValidCategory) {
              return {
                valid: false,
                discount: 0,
                message: "Cupón no válido para estas categorías",
              };
            }
          }
        } catch (e) {
          console.error("Error parsing validForCategories:", e);
        }
      }

      // Verificar productos válidos
      const validForProducts = (coupon as any).validForProducts;
      if (validForProducts && context.productIds) {
        try {
          const allowedProducts = JSON.parse(validForProducts);
          if (Array.isArray(allowedProducts)) {
            const hasValidProduct = context.productIds.some((pid) =>
              allowedProducts.includes(pid),
            );
            if (!hasValidProduct) {
              return {
                valid: false,
                discount: 0,
                message: "Cupón no válido para estos productos",
              };
            }
          }
        } catch (e) {
          console.error("Error parsing validForProducts:", e);
        }
      }

      // Verificar día de la semana
      const dayOfWeek = (coupon as any).dayOfWeek;
      if (dayOfWeek) {
        try {
          const allowedDays = JSON.parse(dayOfWeek);
          const currentDay = (context.currentTime || new Date()).getDay();
          if (Array.isArray(allowedDays) && !allowedDays.includes(currentDay)) {
            const dayNames = [
              "Domingo",
              "Lunes",
              "Martes",
              "Miércoles",
              "Jueves",
              "Viernes",
              "Sábado",
            ];
            const validDays = allowedDays.map((d) => dayNames[d]).join(", ");
            return {
              valid: false,
              discount: 0,
              message: `Cupón válido solo: ${validDays}`,
            };
          }
        } catch (e) {
          console.error("Error parsing dayOfWeek:", e);
        }
      }

      // Verificar rango horario
      const timeRange = (coupon as any).timeRange;
      if (timeRange) {
        try {
          const range = JSON.parse(timeRange);
          const currentTime = context.currentTime || new Date();
          const currentHour = currentTime.getHours();
          const currentMinute = currentTime.getMinutes();
          const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;

          if (range.start && range.end) {
            if (currentTimeStr < range.start || currentTimeStr > range.end) {
              return {
                valid: false,
                discount: 0,
                message: `Cupón válido de ${range.start} a ${range.end}`,
              };
            }
          }
        } catch (e) {
          console.error("Error parsing timeRange:", e);
        }
      }

      // Calcular descuento
      const discount = this.calculateDiscount(coupon, context.orderTotal);

      return {
        valid: true,
        discount,
        coupon,
        message: `Descuento de Bs. ${(discount / 100).toFixed(2)} aplicado`,
      };
    } catch (error) {
      console.error("Error validating coupon:", error);
      return { valid: false, discount: 0, message: "Error al validar cupón" };
    }
  }

  /**
   * Calcula el descuento basado en el tipo de cupón
   */
  private static calculateDiscount(coupon: any, orderTotal: number): number {
    const type = coupon.type || coupon.discountType;

    switch (type) {
      case "percentage":
        let discount = Math.round((orderTotal * coupon.discountValue) / 100);
        // Aplicar descuento máximo si existe
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
        return discount;

      case "fixed":
        return Math.min(coupon.discountValue, orderTotal);

      case "free_delivery":
        // El descuento será el costo de envío, se maneja en el checkout
        return coupon.discountValue || 2500;

      case "bogo":
        // Buy One Get One - 50% de descuento en el total
        return Math.round(orderTotal * 0.5);

      case "first_order":
        // Descuento especial para primera compra
        return Math.round((orderTotal * coupon.discountValue) / 100);

      default:
        return 0;
    }
  }

  /**
   * Obtiene el número de veces que un usuario ha usado un cupón
   */
  private static async getUserCouponUsageCount(
    userId: string,
    couponId: string,
  ): Promise<number> {
    try {
      const result = await db.execute(
        `SELECT COUNT(*) as count FROM coupon_usage WHERE user_id = ? AND coupon_id = ?`,
        [userId, couponId],
      );
      return (result as any)[0]?.count || 0;
    } catch (error) {
      console.error("Error getting coupon usage count:", error);
      return 0;
    }
  }

  /**
   * Verifica si un usuario es nuevo (sin pedidos completados)
   */
  private static async isNewUser(userId: string): Promise<boolean> {
    try {
      const result = await db.execute(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'delivered'`,
        [userId],
      );
      return ((result as any)[0]?.count || 0) === 0;
    } catch (error) {
      console.error("Error checking if new user:", error);
      return false;
    }
  }

  /**
   * Registra el uso de un cupón
   */
  static async recordCouponUsage(
    couponId: string,
    userId: string,
    orderId: string,
    discountApplied: number,
  ): Promise<void> {
    try {
      // Registrar uso
      await db.execute(
        `INSERT INTO coupon_usage (id, coupon_id, user_id, order_id, discount_applied) 
         VALUES (UUID(), ?, ?, ?, ?)`,
        [couponId, userId, orderId, discountApplied],
      );

      // Incrementar contador de usos
      await db.execute(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`,
        [couponId],
      );
    } catch (error) {
      console.error("Error recording coupon usage:", error);
      throw error;
    }
  }

  /**
   * Obtiene cupones disponibles para un usuario
   */
  static async getAvailableCoupons(userId: string): Promise<any[]> {
    try {
      const now = new Date();

      const availableCoupons = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.isActive, true),
            or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now)),
          ),
        );

      // Filtrar cupones que el usuario puede usar
      const filtered = [];
      for (const coupon of availableCoupons) {
        // Verificar límite de usos por usuario
        if (coupon.maxUsesPerUser) {
          const usageCount = await this.getUserCouponUsageCount(
            userId,
            coupon.id,
          );
          if (usageCount >= coupon.maxUsesPerUser) {
            continue;
          }
        }

        // Verificar límite global
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          continue;
        }

        filtered.push(coupon);
      }

      return filtered;
    } catch (error) {
      console.error("Error getting available coupons:", error);
      return [];
    }
  }
}
