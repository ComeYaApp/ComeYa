import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  ACTIVE_STATUSES,
  computeOrderAlerts,
  minutesSince,
  type OrderAlert,
} from "../utils/opsAlerts";

const router = express.Router();

/** Query única con joins: pedidos activos con negocio, cliente y repartidor. */
async function fetchActiveOrders(limit = 80) {
  const statusList = sql.join(
    ACTIVE_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );

  const [rows] = (await db.execute(sql`
    SELECT
      o.id, o.status, o.total, o.subtotal, o.delivery_fee, o.payment_method,
      o.order_type, o.created_at, o.assigned_at, o.estimated_delivery,
      o.business_response_at, o.driver_picked_up_at, o.driver_arrived_at,
      o.delivery_address,
      o.delivery_latitude, o.delivery_longitude,
      o.delivery_person_id,
      u.name AS customer_name, u.phone AS customer_phone,
      b.id AS business_id, b.name AS business_name, b.type AS business_type,
      b.categories AS business_categories, b.phone AS business_phone,
      b.latitude AS business_lat, b.longitude AS business_lng,
      dd.current_latitude AS driver_lat,
      dd.current_longitude AS driver_lng,
      dd.last_location_update AS driver_last_update,
      dd.vehicle_type AS driver_vehicle,
      dd.rating AS driver_rating,
      du.name AS driver_name, du.phone AS driver_phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN businesses b ON o.business_id = b.id
    LEFT JOIN delivery_drivers dd ON o.delivery_person_id = dd.user_id
    LEFT JOIN users du ON dd.user_id = du.id
    WHERE o.status IN (${statusList})
      AND o.business_id IS NOT NULL
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `)) as any;

  return (rows as any[]).map((r) => {
    const minutesActive = minutesSince(r.created_at);
    const driverLastUpdateMinutes = minutesSince(r.driver_last_update);
    const hasDriver = !!r.delivery_person_id;

    let address: any = r.delivery_address;
    try {
      if (typeof address === "string") address = JSON.parse(address);
    } catch {
      /* dirección en texto plano */
    }

    const alerts = computeOrderAlerts({
      status: r.status,
      minutesActive,
      hasDriver,
      businessResponseAt: r.business_response_at,
      driverLastUpdateMinutes,
    });

    return {
      id: r.id,
      status: r.status,
      orderType: r.order_type,
      total: Number(r.total) || 0,
      subtotal: Number(r.subtotal) || 0,
      deliveryFee: Number(r.delivery_fee) || 0,
      paymentMethod: r.payment_method,
      createdAt: r.created_at,
      assignedAt: r.assigned_at,
      estimatedDelivery: r.estimated_delivery,
      pickedUpAt: r.driver_picked_up_at,
      arrivedAt: r.driver_arrived_at,
      minutesActive,
      alerts,
      customer: {
        name: r.customer_name || "Cliente",
        phone: r.customer_phone || null,
        address:
          typeof address === "object" && address
            ? [address.street, address.city].filter(Boolean).join(", ")
            : address || null,
        lat: r.delivery_latitude ? parseFloat(r.delivery_latitude) : null,
        lng: r.delivery_longitude ? parseFloat(r.delivery_longitude) : null,
      },
      business: r.business_lat
        ? {
            id: r.business_id,
            name: r.business_name || "Negocio",
            type: r.business_type,
            categories: r.business_categories,
            phone: r.business_phone || null,
            lat: parseFloat(r.business_lat),
            lng: parseFloat(r.business_lng),
          }
        : null,
      driver: hasDriver
        ? {
            id: r.delivery_person_id,
            name: r.driver_name || "Repartidor",
            phone: r.driver_phone || null,
            vehicleType: r.driver_vehicle,
            rating: r.driver_rating ? (r.driver_rating / 10).toFixed(1) : null,
            lat: r.driver_lat ? parseFloat(r.driver_lat) : null,
            lng: r.driver_lng ? parseFloat(r.driver_lng) : null,
            lastUpdate: r.driver_last_update,
            lastUpdateMinutes: driverLastUpdateMinutes,
          }
        : null,
      // Compatibilidad con el consumidor anterior del mapa web
      delivery:
        r.delivery_latitude && r.delivery_longitude
          ? {
              lat: parseFloat(r.delivery_latitude),
              lng: parseFloat(r.delivery_longitude),
            }
          : null,
    };
  });
}

// ─── GET /api/admin/tracking/global ──────────────────────────────────────────
// Mapa global de pedidos activos (una sola query con joins).
router.get(
  "/tracking/global",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const orders = await fetchActiveOrders(80);
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error("tracking/global error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export { fetchActiveOrders };
export default router;
