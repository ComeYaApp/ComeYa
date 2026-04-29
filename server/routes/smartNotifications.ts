import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { SmartNotificationService } from '../smartNotificationService';

const router = express.Router();

// Enviar notificación de reactivación (solo admin)
router.post('/reactivation', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const result = await SmartNotificationService.sendReactivationNotification();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar promoción segmentada (solo admin)
router.post('/promotion', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { title, body, target, deepLink } = req.body;
    
    if (!title || !body || !target) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const result = await SmartNotificationService.sendPromotionNotification(
      title,
      body,
      target,
      deepLink
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar recordatorio de hora de comida (cron job)
router.post('/meal-reminder', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const result = await SmartNotificationService.sendMealTimeReminder();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Notificar nuevo negocio (solo admin)
router.post('/new-business', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { businessId, businessName } = req.body;
    
    if (!businessId || !businessName) {
      return res.status(400).json({ error: 'businessId y businessName requeridos' });
    }

    const result = await SmartNotificationService.sendNewBusinessNotification(businessId, businessName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Promoción a usuarios con negocio en favoritos (solo admin)
router.post('/favorite-promo', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { businessId, promotion } = req.body;
    
    if (!businessId || !promotion) {
      return res.status(400).json({ error: 'businessId y promotion requeridos' });
    }

    const result = await SmartNotificationService.sendFavoriteBusinessPromotion(businessId, promotion);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
