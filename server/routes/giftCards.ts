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
    const result = await GiftCardService.activateGiftCard(req.params.giftCardId, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gift-cards/:giftCardId/payment-proof
router.post('/:giftCardId/payment-proof', authenticateToken, async (req, res) => {
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
