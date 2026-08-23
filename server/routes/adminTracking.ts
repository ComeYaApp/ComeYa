import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

router.get(
  "/tracking/global",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      // Una sola query con joins (antes eran 3 queries por pedido, N+1)
      const [rows] = (await db.execute(sql`
        SELECT
          o.id, o.order_number, o.status,
          o.delivery_latitude, o.delivery_longitude,
          b.name AS business_name, b.type AS business_type,
          b.categories AS business_categories,
          b.latitude AS business_lat, b.longitude AS business_lng,
          dd.current_latitude AS driver_lat,
          dd.current_longitude AS driver_lng,
          dd.vehicle_type AS driver_vehicle,
          du.name AS driver_name
        FROM orders o
        LEFT JOIN businesses b ON o.business_id = b.id
        LEFT JOIN delivery_drivers dd ON o.delivery_person_id = dd.user_id
        LEFT JOIN users du ON dd.user_id = du.id
        WHERE o.status NOT IN ('delivered', 'cancelled', 'refunded')
          AND o.business_id IS NOT NULL
        ORDER BY o.created_at DESC
        LIMIT 50
      `)) as any;

      const ordersResult = (rows as any[]).map((r) => {
        const item: any = {
          id: r.id,
          orderNumber: r.order_number,
          status: r.status,
          business: null,
          delivery: null,
          driver: null,
        };

        if (r.business_lat && r.business_lng) {
          item.business = {
            name: r.business_name || "Negocio",
            type: r.business_type,
            categories: r.business_categories,
            lat: parseFloat(r.business_lat),
            lng: parseFloat(r.business_lng),
          };
        }

        if (r.delivery_latitude && r.delivery_longitude) {
          item.delivery = {
            lat: parseFloat(r.delivery_latitude),
            lng: parseFloat(r.delivery_longitude),
          };
        }

        if (r.driver_lat && r.driver_lng) {
          item.driver = {
            name: r.driver_name || "Repartidor",
            vehicleType: r.driver_vehicle,
            lat: parseFloat(r.driver_lat),
            lng: parseFloat(r.driver_lng),
          };
        }

        return item;
      });

      res.json({ success: true, orders: ordersResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
