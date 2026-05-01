import { db } from './db';
import { subscriptions, subscriptionBenefits, users } from '@shared/schema-mysql';
import { eq, and } from 'drizzle-orm';

export class SubscriptionService {
  // Planes disponibles
  static readonly PLANS = {
    free: {
      name: 'Free',
      price: 0,
      benefits: {
        freeDelivery: false,
        discountPercentage: 0,
        prioritySupport: false,
        exclusiveDeals: false,
        noMinimumOrder: false,
      },
    },
    premium: {
      name: 'Premium',
      price: 1500, // Bs. 15/mes en centavos
      benefits: {
        freeDelivery: true,
        discountPercentage: 10,
        prioritySupport: true,
        exclusiveDeals: true,
        noMinimumOrder: false,
      },
    },
    business: {
      name: 'Business',
      price: 3000, // Bs. 30/mes en centavos
      benefits: {
        freeDelivery: true,
        discountPercentage: 15,
        prioritySupport: true,
        exclusiveDeals: true,
        noMinimumOrder: true,
      },
    },
  };

  // Obtener suscripción del usuario
  static async getUserSubscription(userId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return {
        plan: 'free',
        status: 'active',
        benefits: this.PLANS.free.benefits,
      };
    }

    // Verificar si está vencida (usando currentPeriodEnd)
    const now = new Date();
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now && subscription.status === 'active') {
      await db
        .update(subscriptions)
        .set({ status: 'expired' })
        .where(eq(subscriptions.id, subscription.id));

      return {
        plan: 'free',
        status: 'expired',
        benefits: this.PLANS.free.benefits,
      };
    }

    const planBenefits = this.PLANS[subscription.plan as keyof typeof this.PLANS]?.benefits || this.PLANS.free.benefits;

    return {
      ...subscription,
      benefits: planBenefits,
    };
  }

  // Iniciar suscripción — crea registro pending_payment, el usuario debe pagar y subir comprobante
  static async initSubscription(userId: string, plan: 'premium' | 'business', billingCycle: 'monthly' | 'yearly' = 'monthly') {
    const planData = this.PLANS[plan];
    if (!planData) throw new Error('Plan inválido');

    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

    if (existing) {
      await db.update(subscriptions).set({
        plan,
        status: 'pending_payment',
        price: planData.price,
        billingCycle,
        autoRenew: true,
      }).where(eq(subscriptions.id, existing.id));
      return { success: true, subscriptionId: existing.id, amount: planData.price, plan };
    } else {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      await db.insert(subscriptions).values({
        id,
        userId,
        plan,
        status: 'pending_payment' as any,
        price: planData.price,
        billingCycle,
        autoRenew: true,
      });
      return { success: true, subscriptionId: id, amount: planData.price, plan };
    }
  }

  // Crear o actualizar suscripción
  static async subscribe(userId: string, plan: 'premium' | 'business', billingCycle: 'monthly' | 'yearly' = 'monthly') {
    const planData = this.PLANS[plan];
    if (!planData) {
      throw new Error('Plan inválido');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Verificar si ya tiene suscripción
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existing) {
      // Actualizar suscripción existente
      await db
        .update(subscriptions)
        .set({
          plan,
          status: 'active',
          price: planData.price,
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          autoRenew: true,
        })
        .where(eq(subscriptions.id, existing.id));

      return { success: true, subscriptionId: existing.id };
    } else {
      // Crear nueva suscripción
      await db.insert(subscriptions).values({
        userId,
        plan,
        status: 'active',
        price: planData.price,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        autoRenew: true,
      });

      return { success: true, message: 'Suscripción creada' };
    }
  }

  // Cancelar suscripción
  static async cancelSubscription(userId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      throw new Error('No tienes suscripción activa');
    }

    await db
      .update(subscriptions)
      .set({
        autoRenew: false,
        cancelledAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return { success: true, message: 'Suscripción cancelada. Seguirás teniendo acceso hasta el final del período' };
  }

  // Aplicar beneficios de suscripción a un pedido
  static async applySubscriptionBenefits(userId: string, orderTotal: number, deliveryFee: number) {
    const subscription = await this.getUserSubscription(userId);

    if (subscription.plan === 'free' || subscription.status !== 'active') {
      return {
        discount: 0,
        deliveryFee,
        appliedBenefits: [],
      };
    }

    const benefits = subscription.benefits;
    const appliedBenefits: string[] = [];
    let finalDeliveryFee = deliveryFee;
    let discount = 0;

    // Envío gratis
    if (benefits.freeDelivery) {
      finalDeliveryFee = 0;
      appliedBenefits.push('Envío gratis');
    }

    // Descuento porcentual
    if (benefits.discountPercentage > 0) {
      discount = Math.round(orderTotal * (benefits.discountPercentage / 100));
      appliedBenefits.push(`${benefits.discountPercentage}% descuento`);
    }

    return {
      discount,
      deliveryFee: finalDeliveryFee,
      appliedBenefits,
    };
  }

  // Renovar suscripciones vencidas (cron job)
  static async renewSubscriptions() {
    const now = new Date();
    
    const expiredSubs = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.autoRenew, true)
        )
      );

    const renewed = [];
    
    for (const sub of expiredSubs) {
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
        const newPeriodEnd = new Date(sub.currentPeriodEnd);
        
        if (sub.billingCycle === 'monthly') {
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
}
