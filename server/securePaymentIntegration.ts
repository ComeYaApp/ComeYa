import { Router } from 'express';
import { authenticateToken } from './authMiddleware';
import { requireRole } from './authMiddleware';
import { cashSecurityService } from './cashSecurityService';
import { db } from './db';
import { orders, wallets } from '../shared/schema-mysql';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Middleware: Validar efectivo antes de aceptar pedido
export async function validateCashAcceptance(req: any, res: any, next: any) {
  try {
    const orderId = req.params.id || req.body.orderId;
    
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Solo validar si es pago en efectivo
    if (order.paymentMethod === 'cash') {
      const canAccept = await cashSecurityService.canAcceptCashOrder(req.user!.id);
      
      if (!canAccept.allowed) {
        return res.status(403).json({ 
          error: canAccept.reason,
          code: 'CASH_LIMIT_EXCEEDED',
          action: 'LIQUIDATE_CASH'
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('Error validando efectivo:', error);
    res.status(500).json({ error: error.message });
  }
}

// GET /api/driver/cash-status - Estado de efectivo del driver
router.get('/driver/cash-status', authenticateToken, async (req, res) => {
  try {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.user!.id))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet no encontrada' });
    }

    const oldestOrder = await cashSecurityService.getOldestCashOrder(req.user!.id);
    const hasOverdue = await cashSecurityService.hasOverdueDebt(req.user!.id);

    let daysRemaining = null;
    if (oldestOrder) {
      const daysPending = Math.floor(
        (Date.now() - new Date(oldestOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      daysRemaining = 7 - daysPending;
    }

    res.json({
      success: true,
      cashOwed: wallet.cashOwed / 100,
      hasOverdue,
      daysRemaining,
      canAcceptCash: !hasOverdue && wallet.cashOwed < 50000,
      maxCashLimit: 500,
      liquidationDeadline: 7
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/cash-stats - Estadísticas de efectivo (Admin)
router.get('/admin/cash-stats', 
  authenticateToken,
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const stats = await cashSecurityService.getCashStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/admin/check-cash-debts - Ejecutar revisión manual
router.post('/admin/check-cash-debts',
  authenticateToken,
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      await cashSecurityService.checkOverdueCashDebts();
      res.json({ success: true, message: 'Revisión completada' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
