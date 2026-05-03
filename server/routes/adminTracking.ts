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
        businessName: businesses.name,
        businessLatitude: businesses.latitude,
        businessLongitude: businesses.longitude,
        deliveryLatitude: orders.deliveryLatitude,
        deliveryLongitude: orders.deliveryLongitude,
        deliveryPersonId: orders.deliveryPersonId,
        driverName: users.name,
        driverLatitude: deliveryDrivers.currentLatitude,
        driverLongitude: deliveryDrivers.currentLongitude,
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

    const result = activeOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      business: o.businessName ? {
        name: o.businessName,
        lat: o.businessLatitude ? parseFloat(o.businessLatitude) : null,
        lng: o.businessLongitude ? parseFloat(o.businessLongitude) : null,
      } : null,
      delivery: o.deliveryLatitude && o.deliveryLongitude ? {
        lat: parseFloat(o.deliveryLatitude),
        lng: parseFloat(o.deliveryLongitude),
      } : null,
      driver: o.driverName ? {
        name: o.driverName,
        lat: o.driverLatitude ? parseFloat(o.driverLatitude) : null,
        lng: o.driverLongitude ? parseFloat(o.driverLongitude) : null,
      } : null,
      estimatedDeliveryTime: o.estimatedDeliveryTime,
      createdAt: o.createdAt,
    }));

    res.json({ success: true, orders: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;