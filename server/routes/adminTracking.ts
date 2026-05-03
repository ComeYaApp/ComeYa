import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { db } from '../db';
import { orders, users, businesses, deliveryDrivers } from '@shared/schema-mysql';
import { eq, and, inArray, sql } from 'drizzle-orm';

const router = express.Router();

// GET /api/admin/tracking/global - obtener todos los pedidos activos con tracking
router.get('/tracking/global', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const activeOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        businessId: orders.businessId,
        bName: businesses.name,
        bLat: businesses.latitude,
        bLng: businesses.longitude,
        deliveryLat: orders.deliveryLatitude,
        deliveryLng: orders.deliveryLongitude,
        deliveryPersonId: orders.deliveryPersonId,
        dName: users.name,
        dLat: deliveryDrivers.currentLatitude,
        dLng: deliveryDrivers.currentLongitude,
        estimatedDeliveryTime: orders.estimatedDeliveryTime,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .leftJoin(deliveryDrivers, eq(orders.deliveryPersonId, deliveryDrivers.userId))
      .where(
        and(
          inArray(orders.status, ['pending', 'preparing', 'on_the_way', 'arrived']),
          sql`${orders.businessId} IS NOT NULL`
        )
      )
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(100);

    const result = activeOrders.map((o: any) => {
      const business = o.bLat && o.bLng ? {
        name: o.bName || 'Negocio',
        lat: parseFloat(o.bLat),
        lng: parseFloat(o.bLng),
      } : null;

      const delivery = o.deliveryLat && o.deliveryLng ? {
        lat: parseFloat(o.deliveryLat),
        lng: parseFloat(o.deliveryLng),
      } : null;

      const driver = o.dLat && o.dLng && o.dName ? {
        name: o.dName,
        lat: parseFloat(o.dLat),
        lng: parseFloat(o.dLng),
      } : null;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        business,
        delivery,
        driver,
        estimatedDeliveryTime: o.estimatedDeliveryTime,
        createdAt: o.createdAt,
      };
    });

    res.json({ success: true, orders: result });
  } catch (error: any) {
    console.error('[adminTracking] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;