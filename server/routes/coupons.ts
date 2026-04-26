import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { AdvancedCouponService } from '../advancedCouponService';
import { db } from '../db';
import { coupons } from '@shared/schema-mysql';
import { eq } from 'drizzle-orm';

const router = express.Router();

// GET /api/coupons - Obtener cupones disponibles para el usuario
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const availableCoupons = await AdvancedCouponService.getAvailableCoupons(userId);
    
    res.json({
      success: true,
      coupons: availableCoupons,
    });
  } catch (error: any) {
    console.error('Error getting coupons:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/coupons/validate - Validar un cupón
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { code, orderTotal, businessId, productIds, categories } = req.body;
    const userId = req.user!.id;

    if (!code || !orderTotal) {
      return res.status(400).json({
        success: false,
        error: 'Código de cupón y total del pedido son requeridos',
      });
    }

    // Verificar si es primera orden
    const ordersResult = await db.execute(
      `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'delivered'`,
      [userId]
    );
    const isFirstOrder = ((ordersResult as any)[0]?.count || 0) === 0;

    const result = await AdvancedCouponService.validateCoupon(code, {
      userId,
      orderTotal,
      businessId,
      productIds,
      categories,
      isFirstOrder,
    });

    res.json({
      success: result.valid,
      ...result,
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/coupons/apply - Aplicar cupón a un pedido
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { couponId, orderId, discountApplied } = req.body;
    const userId = req.user!.id;

    if (!couponId || !orderId || discountApplied === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Datos incompletos',
      });
    }

    await AdvancedCouponService.recordCouponUsage(
      couponId,
      userId,
      orderId,
      discountApplied
    );

    res.json({
      success: true,
      message: 'Cupón aplicado exitosamente',
    });
  } catch (error: any) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/coupons/my-usage - Historial de cupones usados
router.get('/my-usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const usage = await db.execute(
      `SELECT cu.*, c.code, c.description, o.created_at as used_at
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       JOIN orders o ON cu.order_id = o.id
       WHERE cu.user_id = ?
       ORDER BY cu.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      usage: usage,
    });
  } catch (error: any) {
    console.error('Error getting coupon usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= ADMIN ROUTES =============

// GET /api/coupons/admin/all - Obtener todos los cupones
router.get('/admin/all', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const allCoupons = await db.select().from(coupons);
    
    res.json({
      success: true,
      coupons: allCoupons,
    });
  } catch (error: any) {
    console.error('Error getting all coupons:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/coupons/admin/create - Crear nuevo cupón
router.post('/admin/create', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const {
      code,
      type,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      maxUses,
      maxUsesPerUser,
      description,
      validForBusinesses,
      validForCategories,
      validForProducts,
      newUsersOnly,
      firstOrderOnly,
      dayOfWeek,
      timeRange,
      expiresAt,
    } = req.body;

    if (!code || !discountValue) {
      return res.status(400).json({
        success: false,
        error: 'Código y valor de descuento son requeridos',
      });
    }

    // Verificar que el código no exista
    const [existing] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()))
      .limit(1);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un cupón con ese código',
      });
    }

    const couponId = crypto.randomUUID();
    
    await db.execute(
      `INSERT INTO coupons (
        id, code, type, discount_type, discount_value, min_order_amount, max_discount,
        max_uses, max_uses_per_user, description, valid_for_businesses, valid_for_categories,
        valid_for_products, new_users_only, first_order_only, day_of_week, time_range, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        couponId,
        code.toUpperCase(),
        type || 'percentage',
        discountType || 'percentage',
        discountValue,
        minOrderAmount || 0,
        maxDiscount || null,
        maxUses || null,
        maxUsesPerUser || 1,
        description || '',
        validForBusinesses ? JSON.stringify(validForBusinesses) : null,
        validForCategories ? JSON.stringify(validForCategories) : null,
        validForProducts ? JSON.stringify(validForProducts) : null,
        newUsersOnly || false,
        firstOrderOnly || false,
        dayOfWeek ? JSON.stringify(dayOfWeek) : null,
        timeRange ? JSON.stringify(timeRange) : null,
        expiresAt || null,
      ]
    );

    res.json({
      success: true,
      message: 'Cupón creado exitosamente',
      couponId,
    });
  } catch (error: any) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/coupons/admin/:id - Actualizar cupón
router.put('/admin/:id', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'description', 'discount_value', 'min_order_amount', 'max_discount',
      'max_uses', 'max_uses_per_user', 'is_active', 'expires_at',
      'valid_for_businesses', 'valid_for_categories', 'valid_for_products',
      'new_users_only', 'first_order_only', 'day_of_week', 'time_range'
    ];

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        setClause.push(`${snakeKey} = ?`);
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos válidos para actualizar',
      });
    }

    values.push(id);
    
    await db.execute(
      `UPDATE coupons SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Cupón actualizado exitosamente',
    });
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/coupons/admin/:id - Eliminar cupón
router.delete('/admin/:id', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(`DELETE FROM coupons WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Cupón eliminado exitosamente' });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/coupons/admin/stats - Estadísticas de cupones
router.get('/admin/stats', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const stats = await db.execute(`
      SELECT 
        COUNT(*) as total_coupons,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_coupons,
        SUM(used_count) as total_uses,
        SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired_coupons
      FROM coupons
    `);

    const topCoupons = await db.execute(`
      SELECT c.code, c.description, c.used_count, 
             COUNT(cu.id) as actual_uses,
             SUM(cu.discount_applied) as total_discount_given
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      GROUP BY c.id
      ORDER BY actual_uses DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: (stats as any)[0],
      topCoupons: topCoupons,
    });
  } catch (error: any) {
    console.error('Error getting coupon stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
