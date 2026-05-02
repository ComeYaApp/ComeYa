import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { SubscriptionService } from '../subscriptionService';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Obtener suscripción del usuario
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await SubscriptionService.getUserSubscription(req.user!.id);
    res.json({ success: true, subscription });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener planes disponibles
router.get('/plans', async (req, res) => {
  res.json({
    success: true,
    plans: SubscriptionService.PLANS,
  });
});

// Iniciar suscripción — crea registro pending_payment y devuelve subscriptionId para pagar
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    if (!['premium', 'business'].includes(plan)) {
      return res.status(400).json({ error: 'Plan inválido' });
    }
    const result = await SubscriptionService.initSubscription(req.user!.id, plan, billingCycle || 'monthly');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Subir comprobante de pago de suscripción
router.post('/submit-proof', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, imageUrl, referenceNumber, senderName, amount, paymentMethod } = req.body;
    const userId = req.user!.id;

    if (!subscriptionId || !imageUrl || !referenceNumber) {
      return res.status(400).json({ error: 'subscriptionId, imageUrl y referenceNumber son requeridos' });
    }

    const { db } = await import('../db');
    const { subscriptions, paymentProofs } = await import('../../shared/schema-mysql');
    const { sql: drizzleSql } = await import('drizzle-orm');
    const { v4: uuidv4 } = await import('uuid');

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!sub || sub.userId !== userId) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }

    // Detectar comprobante duplicado
    const [existing] = await db.select().from(paymentProofs)
      .where(drizzleSql`reference_number = ${referenceNumber.trim()}`).limit(1);
    if (existing) {
      return res.status(409).json({ error: 'Este comprobante ya fue enviado anteriormente' });
    }

    const proofId = uuidv4();
    // Guardamos en payment_proofs usando orderId = subscriptionId (prefijado con 'sub_' para distinguir)
    await db.insert(paymentProofs).values({
      id: proofId,
      orderId: `sub_${subscriptionId}`,
      userId,
      paymentProvider: paymentMethod || 'bizum',
      proofImageUrl: imageUrl,
      referenceNumber: referenceNumber.trim(),
      amount: amount || sub.price,
      status: 'pending',
      submittedAt: new Date(),
    });

    if (senderName) {
      await db.execute(
        drizzleSql`UPDATE payment_proofs SET verification_notes = ${`Remitente: ${senderName} | Suscripción: ${sub.plan}`} WHERE id = ${proofId}`
      );
    }

    // Notificar admin
    try {
      const { notifyAdminNewProof } = await import('../websocket');
      const { users } = await import('../../shared/schema-mysql');
      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      notifyAdminNewProof({
        proofId,
        orderId: `sub_${subscriptionId}`,
        userName: u?.name ?? 'Cliente',
        amount: amount || sub.price,
        method: paymentMethod || 'bizum',
      });
    } catch {}

    res.json({ success: true, proofId, message: 'Comprobante recibido. Tu suscripción se activará tras la verificación.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: aprobar comprobante de suscripción
router.post('/proofs/:proofId/approve', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { proofId } = req.params;
    const { db } = await import('../db');
    const { paymentProofs, subscriptions } = await import('../../shared/schema-mysql');
    const { sql: drizzleSql } = await import('drizzle-orm');

    const [proof] = await db.select().from(paymentProofs)
      .where(drizzleSql`id = ${proofId}`).limit(1);
    if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado' });

    const subscriptionId = proof.orderId?.replace('sub_', '');
    if (!subscriptionId) return res.status(400).json({ error: 'No es un comprobante de suscripción' });

    await db.execute(
      drizzleSql`UPDATE payment_proofs SET status = 'approved', verified_by = ${req.user!.id}, verified_at = NOW() WHERE id = ${proofId}`
    );

    // Activar suscripción
    const now = new Date();
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (sub) {
      const periodEnd = new Date(now);
      sub.billingCycle === 'yearly' ? periodEnd.setFullYear(periodEnd.getFullYear() + 1) : periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.update(subscriptions).set({
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).where(eq(subscriptions.id, subscriptionId));
    }

    // Notificar al usuario
    try {
      const { sendPushToUser } = await import('../enhancedPushService');
      await sendPushToUser(proof.userId, {
        title: '✅ Suscripción activada',
        body: `Tu plan ${sub?.plan || 'Premium'} ya está activo. ¡Disfruta los beneficios!`,
        data: { screen: 'Subscriptions' },
      });
    } catch {}

    res.json({ success: true, message: 'Suscripción activada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: rechazar comprobante de suscripción
router.post('/proofs/:proofId/reject', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { proofId } = req.params;
    const { reason } = req.body;
    const { db } = await import('../db');
    const { paymentProofs } = await import('../../shared/schema-mysql');
    const { sql: drizzleSql } = await import('drizzle-orm');

    const [proof] = await db.select().from(paymentProofs)
      .where(drizzleSql`id = ${proofId}`).limit(1);
    if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado' });

    await db.execute(
      drizzleSql`UPDATE payment_proofs SET status = 'rejected', verified_by = ${req.user!.id}, verified_at = NOW(), verification_notes = ${reason || 'Rechazado por admin'} WHERE id = ${proofId}`
    );

    try {
      const { sendPushToUser } = await import('../enhancedPushService');
      await sendPushToUser(proof.userId, {
        title: '❌ Comprobante rechazado',
        body: reason || 'Tu comprobante de suscripción no pudo ser verificado. Contacta soporte.',
        data: { screen: 'Subscriptions' },
      });
    } catch {}

    res.json({ success: true, message: 'Comprobante rechazado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions/cancel-pending — cancelar pago pendiente
router.post('/cancel-pending', authenticateToken, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { subscriptions } = await import('../../shared/schema-mysql');
    const { eq, and } = await import('drizzle-orm');
    const { sql: drizzleSql } = await import('drizzle-orm');

    await db.update(subscriptions)
      .set({ status: 'cancelled' as any, cancelledAt: new Date() })
      .where(drizzleSql`user_id = ${req.user!.id} AND status = 'pending_payment'`);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar suscripción
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.cancelSubscription(req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
