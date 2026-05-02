import express from 'express';
import { authenticateToken } from '../authMiddleware';
import { GiftCardService } from '../giftCardService';

const router = express.Router();

router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const { amount, recipientEmail, recipientPhone, message, design, paymentMethod } = req.body;
    // paymentMethod: 'stripe' = activa inmediatamente tras pago
    // paymentMethod: 'bizum_manual' | 'sepa' = queda pending_payment hasta que admin apruebe
    const result = await GiftCardService.purchaseGiftCard({
      purchasedBy: req.user!.id,
      amount: Math.round(amount * 100),
      recipientEmail,
      recipientPhone,
      message,
      design,
      activateImmediately: false, // siempre false aquí; Stripe activa via webhook
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gift-cards/:giftCardId/stripe-success — llamado tras pago Stripe confirmado
router.post('/:giftCardId/stripe-success', authenticateToken, async (req, res) => {
  try {
    const { db } = await import('../db');
    const { giftCards } = await import('@shared/schema-mysql');
    const { eq } = await import('drizzle-orm');
    const { getStripe } = await import('../stripeClient');

    const [gc] = await db.select().from(giftCards)
      .where(eq(giftCards.id, req.params.giftCardId)).limit(1);

    if (!gc) return res.status(404).json({ success: false, error: 'Gift card no encontrada' });
    if (gc.purchasedBy !== req.user!.id) return res.status(403).json({ success: false, error: 'No autorizado' });
    if (gc.status === 'active') return res.json({ success: true, message: 'Ya estaba activa' });
    if (gc.status !== 'pending_payment') return res.status(400).json({ success: false, error: 'Estado inválido' });

    // Verificar que el paymentIntent de Stripe realmente se completó
    const { paymentIntentId } = req.body;
    if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== 'succeeded') {
        return res.status(400).json({ success: false, error: 'El pago no se ha completado' });
      }
    }

    const result = await GiftCardService.activateGiftCard(req.params.giftCardId, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gift-cards/:giftCardId/payment-proof
router.post('/:giftCardId/payment-proof', authenticateToken, async (req, res) => {
  try {
    const { giftCardId } = req.params;
    const { paymentProvider, proofImageUrl, referenceNumber, amount } = req.body;
    if (!paymentProvider || !proofImageUrl || !amount) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }
    const result = await GiftCardService.submitPaymentProof({
      giftCardId,
      userId: req.user!.id,
      paymentProvider,
      proofImageUrl,
      referenceNumber,
      amount: Math.round(amount * 100),
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Código requerido' });
    res.json(await GiftCardService.validateGiftCard(code));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { code, orderId, amountToUse } = req.body;
    if (!code || !orderId || !amountToUse) return res.status(400).json({ success: false, error: 'Datos incompletos' });
    res.json(await GiftCardService.redeemGiftCard({ code, orderId, userId: req.user!.id, amountToUse: Math.round(amountToUse * 100) }));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/my-cards', authenticateToken, async (req, res) => {
  try {
    res.json(await GiftCardService.getUserGiftCards(req.user!.id));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/designs', async (req, res) => {
  try {
    res.json(await GiftCardService.getDesigns());
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:giftCardId/history', authenticateToken, async (req, res) => {
  try {
    res.json(await GiftCardService.getTransactionHistory(req.params.giftCardId));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
