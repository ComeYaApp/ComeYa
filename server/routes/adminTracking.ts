import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { db } from '../db';
import { orders, users, businesses, deliveryDrivers } from '@shared/schema-mysql';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

router.get('/tracking/global', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(50);

    const result = [];
    
    for (const order of allOrders) {
      if (!order.businessId) continue;
      if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'refunded') continue;

      const item: any = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        business: null,
        delivery: null,
        driver: null,
      };

      // Get business
      const [biz] = await db
        .select({ name: businesses.name, latitude: businesses.latitude, longitude: businesses.longitude })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      
      if (biz && biz.latitude && biz.longitude) {
        item.business = {
          name: biz.name || 'Negocio',
          lat: parseFloat(biz.latitude),
          lng: parseFloat(biz.longitude),
        };
      }

      // Get delivery location
      if (order.deliveryLatitude && order.deliveryLongitude) {
        item.delivery = {
          lat: parseFloat(order.deliveryLatitude),
          lng: parseFloat(order.deliveryLongitude),
        };
      }

      // Get driver
      if (order.deliveryPersonId) {
        const [driverRec] = await db
          .select({ currentLatitude: deliveryDrivers.currentLatitude, currentLongitude: deliveryDrivers.currentLongitude })
          .from(deliveryDrivers)
          .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
          .limit(1);
        
        if (driverRec && driverRec.currentLatitude && driverRec.currentLongitude) {
          const [driverUser] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, order.deliveryPersonId))
            .limit(1);
          
          item.driver = {
            name: driverUser?.name || 'Repartidor',
            lat: parseFloat(driverRec.currentLatitude),
            lng: parseFloat(driverRec.currentLongitude),
          };
        }
      }

      result.push(item);
    }

    res.json({ success: true, orders: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;