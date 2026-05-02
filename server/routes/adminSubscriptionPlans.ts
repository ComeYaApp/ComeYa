import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { db } from '../db';
import { subscriptionPlans, subscriptionBenefits } from '@shared/schema-mysql';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const router = express.Router();

// GET /api/admin/subscription-plans
router.get('/subscription-plans', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);
    const benefits = await db.select().from(subscriptionBenefits);
    const result = plans.map(plan => ({
      ...plan,
      benefits: benefits.filter(b => b.plan === plan.planKey),
    }));
    res.json({ success: true, plans: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/subscription-plans/:planKey
router.put('/subscription-plans/:planKey', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { planKey } = req.params;
    const { name, description, price, isActive, color } = req.body;
    await db.update(subscriptionPlans)
      .set({ name, description, price, isActive, color, updatedAt: new Date() })
      .where(eq(subscriptionPlans.planKey, planKey));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/subscription-benefits
router.post('/subscription-benefits', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { plan, benefitType, benefitValue, description } = req.body;
    if (!plan || !benefitType) return res.status(400).json({ error: 'plan y benefitType son requeridos' });
    const id = randomUUID();
    await db.insert(subscriptionBenefits).values({
      id, plan, benefitType,
      benefitValue: parseInt(benefitValue) || 0,
      description,
    });
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/subscription-benefits/:id
router.put('/subscription-benefits/:id', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { benefitType, benefitValue, description } = req.body;
    await db.update(subscriptionBenefits)
      .set({ benefitType, benefitValue: parseInt(benefitValue) || 0, description })
      .where(eq(subscriptionBenefits.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/subscription-benefits/:id
router.delete('/subscription-benefits/:id', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    await db.delete(subscriptionBenefits).where(eq(subscriptionBenefits.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
