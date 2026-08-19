import { db } from "./db";
import {
  subscriptions,
  subscriptionBenefits,
  subscriptionPlans,
  users,
  orders,
} from "@shared/schema-mysql";
import { eq, and, gte } from "drizzle-orm";

export class SubscriptionService {
  // Planes hardcoded como fallback si la BD no tiene datos.
  // Estructura Soria 2026. Precios en céntimos: 499 = 4,99 €, etc.
  static readonly PLANS_FALLBACK = {
    free: {
      name: "Free",
      price: 0,
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    soria_local: {
      name: "Plan Soria Local",
      price: 499, // 4,99 €/mes
      benefits: {
        freeDelivery: true,
        discountPercentage: 50,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    impulso_local: {
      name: "Impulso Local",
      price: 2900, // 29 €/mes + comisión 10%
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    top_soria: {
      name: "Top Soria",
      price: 7900, // 79 €/mes
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: true,
        exclusiveDeals: true,
        noMinimumOrder: false,
      },
    },
    premium_soria: {
      name: "Premium Soria",
      price: 9900, // 99 €/mes
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: true,
        exclusiveDeals: true,
        noMinimumOrder: false,
      },
    },
    logistica_local: {
      name: "Logística Local (B2B)",
      price: 3900, // 39 €/mes + 3,50 € por entrega
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    escaparate_soria: {
      name: "Escaparate Soria",
      price: 1900, // 19 €/mes + comisión 8%
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    express_semana: {
      name: "Express Semanal (Eventos)",
      price: 4900, // 49 €/semana
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: true,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
  };

  // Leer planes desde BD (con fallback)
  static async getPlansFromDB() {
    try {
      const plans = await db
        .select()
        .from(subscriptionPlans)
        .orderBy(subscriptionPlans.displayOrder);
      const benefits = await db.select().from(subscriptionBenefits);

      if (!plans.length) return this.PLANS_FALLBACK;

      const result: Record<string, any> = {};
      for (const plan of plans) {
        const planBenefits = benefits.filter((b: typeof benefits[0]) => b.plan === plan.planKey);
        const discountBenefit = planBenefits.find(
          (b: typeof planBenefits[0]) => b.benefitType === "discount",
        );
        const active = (b: (typeof planBenefits)[0]) =>
          (b.benefitValue ?? 0) > 0;
        result[plan.planKey] = {
          name: plan.name,
          price: plan.price, // en centavos
          description: plan.description,
          color: plan.color,
          icon: plan.icon,
          billingCycle: plan.billingCycle || "monthly",
          benefits: {
            freeDelivery: planBenefits.some(
              (b: typeof planBenefits[0]) => b.benefitType === "free_delivery" && active(b),
            ),
            discountPercentage: discountBenefit
              ? (discountBenefit.benefitValue ?? 0)
              : 0,
            prioritySupport: planBenefits.some(
              (b: typeof planBenefits[0]) => b.benefitType === "priority_support" && active(b),
            ),
            exclusiveDeals: planBenefits.some(
              (b: typeof planBenefits[0]) => b.benefitType === "exclusive_deals" && active(b),
            ),
            noMinimumOrder: planBenefits.some(
              (b: typeof planBenefits[0]) => b.benefitType === "no_minimum" && active(b),
            ),
          },
          benefitsList: planBenefits.map((b: typeof planBenefits[0]) => ({
            id: b.id,
            type: b.benefitType,
            value: b.benefitValue,
            description: b.description,
          })),
        };
      }
      return result;
    } catch {
      return this.PLANS_FALLBACK;
    }
  }

  // Compatibilidad: PLANS como getter que devuelve fallback
  static get PLANS() {
    return this.PLANS_FALLBACK;
  }

  // Suscripción ACTIVA del usuario (status active y período vigente), o null
  static async getActiveSubscription(userId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (
      !subscription ||
      subscription.status !== "active" ||
      (subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd < new Date())
    ) {
      return null;
    }
    return subscription;
  }

  // Tasa de comisión de la plataforma para un negocio (0-1).
  // Prioridad: suscripción activa (impulso_local 10%, escaparate_soria 8%),
  // luego comisión personalizada del admin, luego 15% por defecto.
  static async getBusinessCommissionRate(businessId: string): Promise<number> {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
      if (!business) return 0.15;

      if (business.ownerId) {
        const sub = await this.getActiveSubscription(business.ownerId);
        if (sub?.plan === "impulso_local") return 0.1;
        if (sub?.plan === "escaparate_soria") return 0.08;
      }

      if (
        (business as any).customCommission != null &&
        (business as any).customCommission > 0
      ) {
        return (business as any).customCommission / 100;
      }
      return 0.15;
    } catch {
      return 0.15;
    }
  }

  // Efectos al activar un plan (Top/Premium → negocio destacado)
  static async applyPlanActivationSideEffects(
    userId: string,
    plan: string,
  ): Promise<void> {
    try {
      if (!["top_soria", "premium_soria", "express_semana"].includes(plan)) {
        return;
      }
      const { businesses } = await import("@shared/schema-mysql");
      await db
        .update(businesses)
        .set({ isFeatured: true })
        .where(eq(businesses.ownerId, userId));
    } catch (err) {
      console.error("Error applying plan activation side effects:", err);
    }
  }

  // Revertir efectos del plan al expirar o cancelar (quitar destacado)
  static async removePlanSideEffects(
    userId: string,
    plan: string,
  ): Promise<void> {
    try {
      if (!["top_soria", "premium_soria", "express_semana"].includes(plan)) {
        return;
      }
      const { businesses } = await import("@shared/schema-mysql");
      await db
        .update(businesses)
        .set({ isFeatured: false })
        .where(eq(businesses.ownerId, userId));
    } catch (err) {
      console.error("Error removing plan side effects:", err);
    }
  }

  // Obtener suscripción del usuario
  static async getUserSubscription(userId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      throw new Error("No se encontró suscripción para el usuario");
    }

    // Si está pendiente pero existe, devolver datos reales
    if (subscription.status === "pending_payment") {
      return {
        ...subscription,
        benefits: this.PLANS_FALLBACK[subscription.plan as keyof typeof this.PLANS_FALLBACK]?.benefits || this.PLANS_FALLBACK.free.benefits,
      };
    }

    const now = new Date();
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < now &&
      subscription.status === "active"
    ) {
      await db
        .update(subscriptions)
        .set({ status: "expired" })
        .where(eq(subscriptions.id, subscription.id));
      // El plan dejó de estar activo: quitar el destacado de sus negocios
      await this.removePlanSideEffects(userId, subscription.plan);
      return {
        plan: "free",
        status: "expired",
        benefits: this.PLANS_FALLBACK.free.benefits,
      };
    }

    const plans = await this.getPlansFromDB();
    const planData = (plans as any)[subscription.plan] || (plans as any)["free"] || this.PLANS_FALLBACK.free;
    const planBenefits =
      subscription.status === "active"
        ? planData.benefits
        : this.PLANS_FALLBACK.free.benefits;

    return { ...subscription, benefits: planBenefits, planDetails: planData };
  }

  // Iniciar suscripción — crea registro pending_payment, el usuario debe pagar y subir comprobante
  static async initSubscription(
    userId: string,
    plan: "premium" | "business",
    billingCycle: "monthly" | "yearly" = "monthly",
  ) {
    const plans = await this.getPlansFromDB();
    const planData = (plans as any)[plan];
    if (!planData) throw new Error("Plan inválido");

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "weekly") {
      periodEnd.setDate(periodEnd.getDate() + 7);
    } else if (billingCycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    if (existing) {
      // Si ya está activa con ese plan, no hacer nada
      if (existing.status === "active" && existing.plan === plan) {
        return {
          success: true,
          subscriptionId: existing.id,
          amount: planData.price,
          plan,
          alreadyActive: true,
        };
      }
      // Actualizar a pending_payment con el nuevo plan
      await db
        .update(subscriptions)
        .set({
          plan,
          status: "pending_payment" as any,
          price: planData.price,
          billingCycle,
          autoRenew: true,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null as any,
        })
        .where(eq(subscriptions.id, existing.id));
      return {
        success: true,
        subscriptionId: existing.id,
        amount: planData.price,
        plan,
      };
    } else {
      const { randomUUID } = await import("crypto");
      const id = randomUUID();
      await db.insert(subscriptions).values({
        id,
        userId,
        plan,
        status: "pending_payment" as any,
        price: planData.price,
        billingCycle,
        autoRenew: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      return {
        success: true,
        subscriptionId: id,
        amount: planData.price,
        plan,
      };
    }
  }

  // ELIMINADO: subscribe() activaba sin cobrar. Usar initSubscription() + confirmación de pago.
  static async subscribe(
    _userId: string,
    _plan: string,
    _billingCycle?: string,
  ): Promise<never> {
    throw new Error(
      "Uso incorrecto: usa initSubscription() y confirma el pago antes de activar.",
    );
  }

  // Cancelar suscripción
  static async cancelSubscription(userId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      throw new Error("No tienes ninguna suscripción");
    }

    if (subscription.status !== "active") {
      throw new Error(
        "Solo puedes cancelar una suscripción activa. Estado actual: " + subscription.status,
      );
    }

    // Si ya estaba marcada para cancelar, informar al usuario
    if (!subscription.autoRenew && subscription.cancelledAt) {
      return {
        success: true,
        alreadyCancelled: true,
        message: "Tu suscripción ya estaba programada para cancelarse al final del período",
        periodEnd: subscription.currentPeriodEnd,
      };
    }

    await db
      .update(subscriptions)
      .set({
        autoRenew: false,
        cancelledAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return {
      success: true,
      message: "Suscripción cancelada. Seguirás teniendo acceso hasta el final del período",
      periodEnd: subscription.currentPeriodEnd,
    };
  }

  static async applySubscriptionBenefits(
    userId: string,
    orderTotal: number,
    deliveryFee: number,
  ) {
    try {
      const subscription = await this.getUserSubscription(userId);

      if (subscription.plan === "free" || subscription.status !== "active") {
        return {
          discount: 0,
          deliveryFee,
          appliedBenefits: [],
          freeDelivery: false,
          discountPercentage: 0,
        };
      }

      // Leer beneficios directamente de BD
      const benefits = await db
        .select()
        .from(subscriptionBenefits)
        .where(eq(subscriptionBenefits.plan, subscription.plan));

      const appliedBenefits: string[] = [];
      let finalDeliveryFee = deliveryFee;
      let discount = 0;
      let discountPercentage = 0;
      let freeDelivery = false;

      // Reglas específicas por plan
      if (subscription.plan === "soria_local") {
        // 4 envíos gratis al mes en pedidos > 15 €; del 5º en adelante 50% del envío
        const minOrderBenefit = benefits.find(
          (b) => b.benefitType === "min_order",
        );
        const minOrder = minOrderBenefit?.benefitValue ?? 1500;
        if (orderTotal >= minOrder) {
          const periodStart = subscription.currentPeriodStart || new Date(0);
          const ordersThisPeriod = await db
            .select()
            .from(orders)
            .where(
              and(
                eq(orders.userId, userId),
                gte(orders.createdAt, periodStart),
              ),
            );
          const freeLimit =
            benefits.find((b) => b.benefitType === "free_delivery")
              ?.benefitValue ?? 4;
          if (ordersThisPeriod.length < freeLimit) {
            finalDeliveryFee = 0;
            freeDelivery = true;
            appliedBenefits.push("Envío gratis (Plan Soria Local)");
          } else {
            finalDeliveryFee = Math.round(deliveryFee * 0.5);
            appliedBenefits.push("50% de descuento en el envío (Plan Soria Local)");
          }
        }
      }

      for (const b of benefits) {
        const val = b.benefitValue ?? 0;
        if (val <= 0) continue;

        switch (b.benefitType) {
          case "free_delivery":
            if (subscription.plan === "soria_local") break; // gestionado arriba
            finalDeliveryFee = 0;
            freeDelivery = true;
            appliedBenefits.push(b.description || "Envío gratis");
            break;
          case "min_order":
            break; // solo informativo
          case "discount":
          case "discount_percentage":
            if (subscription.plan === "soria_local") break; // descuento de envío gestionado arriba
            discountPercentage = val;
            discount = Math.round(orderTotal * (val / 100));
            appliedBenefits.push(b.description || `${val}% descuento`);
            break;
          case "priority_support":
          case "exclusive_deals":
          case "no_minimum":
          case "analytics":
          case "featured":
          case "priority":
          case "commission_rate":
          case "flat_delivery_fee":
          case "delivery_window":
          case "image_design":
          default:
            if (b.description) appliedBenefits.push(b.description);
            break;
        }
      }

      return {
        discount,
        deliveryFee: finalDeliveryFee,
        appliedBenefits,
        freeDelivery,
        discountPercentage,
      };
    } catch {
      // Si no hay suscripción, devolver sin beneficios
      return {
        discount: 0,
        deliveryFee,
        appliedBenefits: [],
        freeDelivery: false,
        discountPercentage: 0,
      };
    }
  }

  // Renovar suscripciones vencidas (cron job)
  static async renewSubscriptions() {
    const now = new Date();

    const expiredSubs = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.autoRenew, true),
        ),
      );

    const renewed = [];

    for (const sub of expiredSubs) {
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
        const newPeriodEnd = new Date(sub.currentPeriodEnd);

        if (sub.billingCycle === "monthly") {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        } else {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        }

        await db
          .update(subscriptions)
          .set({
            currentPeriodStart: sub.currentPeriodEnd,
            currentPeriodEnd: newPeriodEnd,
          })
          .where(eq(subscriptions.id, sub.id));

        renewed.push(sub.id);
      }
    }

    return { success: true, renewed: renewed.length };
  }

  // Descuento de comisión para dueños de negocio con suscripción Business
  static async getBusinessCommissionDiscount(userId: string) {
    const BASE = 0.15;
    try {
      const sub = await this.getUserSubscription(userId);
      if (sub.plan == "free" || sub.status != "active") {
        return { commissionRate: BASE, baseRate: BASE, discountPercent: 0, plan: sub.plan };
      }
      const benefits = await db
        .select()
        .from(subscriptionBenefits)
        .where(eq(subscriptionBenefits.plan, sub.plan));
      let discountPercent = 0;
      for (const b of benefits) {
        if (b.benefitType == "reduced_commission" && b.benefitValue && b.benefitValue > 0) {
          discountPercent = b.benefitValue;
          break;
        }
      }
      return {
        commissionRate: BASE - (BASE * discountPercent) / 100,
        baseRate: BASE,
        discountPercent,
        plan: sub.plan,
      };
    } catch {
      return { commissionRate: BASE, baseRate: BASE, discountPercent: 0, plan: "free" };
    }
  }

  // Obtener beneficios para negocios
  static async getBusinessBenefits(userId: string) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (subscription.plan === "free" || subscription.status !== "active") {
        return {
          commissionDiscount: 0,
          featuredListing: false,
          analyticsAccess: false,
          prioritySupport: false,
          promotionalTools: false,
          plan: "free",
        };
      }
      const benefits = await db
        .select()
        .from(subscriptionBenefits)
        .where(eq(subscriptionBenefits.plan, subscription.plan));
      const result = {
        commissionDiscount: 0,
        featuredListing: false,
        analyticsAccess: false,
        prioritySupport: false,
        promotionalTools: false,
        plan: subscription.plan,
      };
      for (const b of benefits) {
        switch (b.benefitType) {
          case "reduced_commission":
            result.commissionDiscount = b.benefitValue ?? 0;
            break;
          case "featured_listing":
            result.featuredListing = (b.benefitValue ?? 0) > 0;
            break;
          case "analytics_access":
            result.analyticsAccess = (b.benefitValue ?? 0) > 0;
            break;
          case "priority_support":
            result.prioritySupport = (b.benefitValue ?? 0) > 0;
            break;
          case "promotional_tools":
            result.promotionalTools = (b.benefitValue ?? 0) > 0;
            break;
        }
      }
      return result;
    } catch {
      return {
        commissionDiscount: 0,
        featuredListing: false,
        analyticsAccess: false,
        prioritySupport: false,
        promotionalTools: false,
        plan: "free",
      };
    }
  }
}
