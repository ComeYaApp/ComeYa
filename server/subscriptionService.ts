import { db } from './db';
import { subscriptions, subscriptionBenefits, subscriptionPlans, users } from '@shared/schema-mysql';
import { eq, and } from 'drizzle-orm';

export class SubscriptionService {
  // Planes hardcoded como fallback si la BD no tiene datos
  static readonly PLANS_FALLBACK = {
    free:     { name: 'Free',     price: 0,    benefits: { freeDelivery: false, discountPercentage: 0,  prioritySupport: false, exclusiveDeals: false, noMinimumOrder: false } },
    premium:  { name: 'Premium',  price: 1500, benefits: { freeDelivery: true,  discountPercentage: 10, prioritySupport: true,  exclusiveDeals: true,  noMinimumOrder: false } },
    business: { name: 'Business', price: 3000, benefits: { freeDelivery: true,  discountPercentage: 15, prioritySupport: true,  exclusiveDeals: true,  noMinimumOrder: true  } },
  };

  // Leer planes desde BD (con fallback)
  static async getPlansFromDB() {
    try {
      const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);
      const benefits = await db.select().from(subscriptionBenefits);

      if (!plans.length) return this.PLANS_FALLBACK;

      const result: Record<string, any> = {};
      for (const plan of plans) {
        const planBenefits = benefits.filter(b => b.plan === plan.planKey);
        const discountBenefit = planBenefits.find(b => b.benefitType === 'discount');
        result[plan.planKey] = {
          name: plan.name,
          price: plan.price,
          description: plan.description,
          color: plan.color,
          icon: plan.icon,
          benefits: {
            freeDelivery:       planBenefits.some(b => b.benefitType === 'free_delivery' && (b.benefitValue ?? 0) > 0),
            discountPercentage: discountBenefit ? (discountBenefit.benefitValue ?? 0) : 0,
            prioritySupport:    planBenefits.some(b => b.benefitType === 'priority_support' && (b.benefitValue ?? 0) > 0),
            exclusiveDeals:     planBenefits.some(b => b.benefitType === 'exclusive_deals' && (b.benefitValue ?? 0) > 0),
            noMinimumOrder:     planBenefits.some(b => b.benefitType === 'no_minimum' && (b.benefitValue ?? 0) > 0),
          },
          benefitsList: planBenefits.map(b => ({ id: b.id, type: b.benefitType, value: b.benefitValue, description: b.description })),
        };
      }
      return result;
    } catch {
      return this.PLANS_FALLBACK;
    }
  }

  // Compatibilidad: PLANS como getter que devuelve fallback (para código que lo usa síncronamente)
  static get PLANS() { return this.PLANS_FALLBACK; }

  // Obtener suscripción del usuario
  static async getUserSubscription(userId: string) {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

    if (!subscription || subscription.status === 'pending_payment') {
      return { plan: subscription?.plan || 'free', status: subscription?.status || 'active', benefits: this.PLANS_FALLBACK.free.benefits };
    }

    const now = new Date();
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now && subscription.status === 'active') {
      await db.update(subscriptions).set({ status: 'expired' }).where(eq(subscriptions.id, subscription.id));
      return { plan: 'free', status: 'expired', benefits: this.PLANS_FALLBACK.free.benefits };
    }

    const plans = await this.getPlansFromDB();
    const planData = plans[subscription.plan as string] || plans['free'];
    const planBenefits = subscription.status === 'active' ? planData.benefits : this.PLANS_FALLBACK.free.benefits;

    return { ...subscription, benefits: planBenefits, planDetails: planData };
  }

  // Iniciar suscripción — crea registro pending_payment, el usuario debe pagar y subir comprobante
  static async initSubscription(userId: string, plan: 'premium' | 'business', billingCycle: 'monthly' | 'yearly' = 'monthly') {
    const plans = await this.getPlansFromDB();
    const planData = plans[plan];
    if (!planData) throw new Error('Plan inválido');

    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

    if (existing) {
      // Si ya está activa con ese plan, no hacer nada
      if (existing.status === 'active' && existing.plan === plan) {
        return { success: true, subscriptionId: existing.id, amount: planData.price, plan, alreadyActive: true };
      }
      // Actualizar a pending_payment con el nuevo plan
      await db.update(subscriptions).set({
        plan,
        status: 'pending_payment' as any,
        price: planData.price,
        billingCycle,
        autoRenew: true,
      }).where(eq(subscriptions.id, existing.id));
      return { success: true, subscriptionId: existing.id, amount: planData.price, plan };
    } else {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      await db.insert(subscriptions).values({
        id, userId, plan,
        status: 'pending_payment' as any,
        price: planData.price,
        billingCycle,
        autoRenew: true,
      });
      return { success: true, subscriptionId: id, amount: planData.price, plan };
    }
  }

  // ELIMINADO: subscribe() activaba sin cobrar. Usar initSubscription() + confirmación de pago.
  // El método se mantiene solo para compatibilidad interna pero lanza error si se llama directamente.
  static async subscribe(_userId: string, _plan: string, _billingCycle?: string): Promise<never> {
    throw new Error('Uso incorrecto: usa initSubscription() y confirma el pago antes de activar.');
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
