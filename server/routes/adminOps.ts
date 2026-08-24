import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { fetchActiveOrders } from "./adminTracking";
import {
  ACTIVE_STATUSES,
  DRIVER_ONLINE_WINDOW_MIN,
  isDriverOnline,
  minutesSince,
} from "../utils/opsAlerts";

const router = express.Router();

// Caché corta: el panel hace polling y varias pestañas pueden estar abiertas
const CACHE_TTL_MS = 5000;
let cache: { at: number; payload: any } | null = null;

interface KpiRow {
  [key: string]: any;
}

async function fetchKpis() {
  // Conteo de pedidos por estado (agregado en SQL, no en memoria)
  const statusList = sql.join(
    ACTIVE_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );

  const [byStatusRows] = (await db.execute(sql`
    SELECT status, COUNT(*) AS c
    FROM orders
    WHERE status IN (${statusList})
    GROUP BY status
  `)) as any;

  const byStatus: Record<string, number> = {};
  let activeOrders = 0;
  for (const r of byStatusRows as KpiRow[]) {
    byStatus[r.status] = Number(r.c) || 0;
    activeOrders += Number(r.c) || 0;
  }

  // Pedidos activos sin repartidor asignado
  const [noDriverRows] = (await db.execute(sql`
    SELECT COUNT(*) AS c
    FROM orders
    WHERE status IN (${statusList})
      AND (delivery_person_id IS NULL OR delivery_person_id = '')
      AND (order_type IS NULL OR order_type <> 'pickup')
  `)) as any;

  // Métricas de hoy + tiempo medio de entrega REAL (antes era 35 fijo)
  const [todayRows] = (await db.execute(sql`
    SELECT
      COUNT(*) AS orders_today,
      SUM(status = 'delivered') AS delivered_today,
      SUM(status = 'cancelled') AS cancelled_today,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) AS revenue_today
    FROM orders
    WHERE created_at >= CURDATE()
  `)) as any;

  const [avgRows] = (await db.execute(sql`
    SELECT
      AVG(TIMESTAMPDIFF(MINUTE, created_at, delivered_at)) AS avg_total,
      AVG(TIMESTAMPDIFF(MINUTE, driver_picked_up_at, delivered_at)) AS avg_delivery
    FROM orders
    WHERE status = 'delivered'
      AND delivered_at IS NOT NULL
      AND delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      -- Descarta outliers (datos sucios o pedidos cerrados a mano días después)
      AND TIMESTAMPDIFF(MINUTE, created_at, delivered_at) BETWEEN 1 AND 240
  `)) as any;

  // Repartidores: total, disponibles y conectados de verdad
  const [driverRows] = (await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      SUM(is_available = 1) AS available,
      SUM(
        is_available = 1
        AND last_location_update IS NOT NULL
        AND last_location_update >= DATE_SUB(NOW(), INTERVAL ${DRIVER_ONLINE_WINDOW_MIN} MINUTE)
      ) AS online,
      SUM(is_blocked = 1) AS blocked
    FROM delivery_drivers
  `)) as any;

  const [bizRows] = (await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      SUM(is_open = 1) AS open_now,
      SUM(is_paused = 1) AS paused,
      SUM(latitude IS NULL OR longitude IS NULL) AS without_coords
    FROM businesses
    WHERE is_active = 1
  `)) as any;

  const today = (todayRows as KpiRow[])[0] || {};
  const avg = (avgRows as KpiRow[])[0] || {};
  const drivers = (driverRows as KpiRow[])[0] || {};
  const biz = (bizRows as KpiRow[])[0] || {};

  const ordersToday = Number(today.orders_today) || 0;
  const cancelledToday = Number(today.cancelled_today) || 0;

  return {
    activeOrders,
    byStatus,
    ordersWithoutDriver: Number((noDriverRows as KpiRow[])[0]?.c) || 0,
    ordersToday,
    deliveredToday: Number(today.delivered_today) || 0,
    cancelledToday,
    cancellationRate:
      ordersToday > 0 ? Number(((cancelledToday / ordersToday) * 100).toFixed(1)) : 0,
    revenueToday: Number(today.revenue_today) || 0,
    // null cuando aún no hay entregas suficientes (mejor que un valor falso)
    avgTotalMinutes: avg.avg_total != null ? Math.round(Number(avg.avg_total)) : null,
    avgDeliveryMinutes:
      avg.avg_delivery != null ? Math.round(Number(avg.avg_delivery)) : null,
    drivers: {
      total: Number(drivers.total) || 0,
      available: Number(drivers.available) || 0,
      online: Number(drivers.online) || 0,
      blocked: Number(drivers.blocked) || 0,
    },
    businesses: {
      total: Number(biz.total) || 0,
      open: Number(biz.open_now) || 0,
      paused: Number(biz.paused) || 0,
      withoutCoords: Number(biz.without_coords) || 0,
    },
  };
}

async function fetchDriversForMap() {
  const [rows] = (await db.execute(sql`
    SELECT
      dd.user_id AS id, u.name, u.phone,
      dd.vehicle_type, dd.vehicle_plate, dd.rating, dd.total_deliveries,
      dd.is_available, dd.is_blocked,
      dd.current_latitude, dd.current_longitude, dd.last_location_update,
      (
        SELECT o.id FROM orders o
        WHERE o.delivery_person_id = dd.user_id
          AND o.status IN ('assigned_driver','picked_up','on_the_way','in_transit','arriving','ready')
        ORDER BY o.created_at DESC LIMIT 1
      ) AS active_order_id
    FROM delivery_drivers dd
    LEFT JOIN users u ON dd.user_id = u.id
    WHERE dd.current_latitude IS NOT NULL AND dd.current_longitude IS NOT NULL
  `)) as any;

  return (rows as any[]).map((r) => {
    const lastUpdateMinutes = minutesSince(r.last_location_update);
    return {
      id: r.id,
      name: r.name || "Repartidor",
      phone: r.phone || null,
      vehicleType: r.vehicle_type,
      vehiclePlate: r.vehicle_plate,
      rating: r.rating ? (r.rating / 10).toFixed(1) : null,
      totalDeliveries: Number(r.total_deliveries) || 0,
      isAvailable: !!r.is_available,
      isBlocked: !!r.is_blocked,
      // "Conectado" = disponible y con GPS fresco
      isOnline: isDriverOnline(!!r.is_available, lastUpdateMinutes),
      lat: parseFloat(r.current_latitude),
      lng: parseFloat(r.current_longitude),
      lastUpdate: r.last_location_update,
      lastUpdateMinutes,
      staleGps:
        lastUpdateMinutes == null || lastUpdateMinutes >= DRIVER_ONLINE_WINDOW_MIN,
      activeOrderId: r.active_order_id || null,
    };
  });
}

async function fetchBusinessesForMap() {
  // Proyección mínima (antes devolvía todas las columnas de businesses)
  const [rows] = (await db.execute(sql`
    SELECT
      b.id, b.name, b.type, b.categories, b.phone, b.address,
      b.latitude, b.longitude, b.is_open, b.is_paused, b.is_featured,
      b.rating, b.total_orders_completed,
      (
        SELECT COUNT(*) FROM orders o
        WHERE o.business_id = b.id
          AND o.status IN ('pending','accepted','preparing','ready','assigned_driver','picked_up','on_the_way','in_transit','arriving')
      ) AS active_orders
    FROM businesses b
    WHERE b.is_active = 1
      AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
  `)) as any;

  return (rows as any[]).map((r) => ({
    id: r.id,
    name: r.name || "Negocio",
    type: r.type,
    categories: r.categories,
    phone: r.phone || null,
    address: r.address || null,
    lat: parseFloat(r.latitude),
    lng: parseFloat(r.longitude),
    isOpen: !!r.is_open,
    isPaused: !!r.is_paused,
    isFeatured: !!r.is_featured,
    rating: r.rating ? (r.rating / 10).toFixed(1) : null,
    totalOrders: Number(r.total_orders_completed) || 0,
    activeOrders: Number(r.active_orders) || 0,
  }));
}

// ─── GET /api/admin/ops/overview ─────────────────────────────────────────────
// Una sola llamada con todo lo que el centro de operaciones necesita.
router.get(
  "/ops/overview",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
        return res.json({ ...cache.payload, cached: true });
      }

      const [kpis, orders, drivers, businesses] = await Promise.all([
        fetchKpis(),
        fetchActiveOrders(80),
        fetchDriversForMap(),
        fetchBusinessesForMap(),
      ]);

      const alerts = orders
        .filter((o: any) => o.alerts.length > 0)
        .map((o: any) => ({
          orderId: o.id,
          status: o.status,
          businessName: o.business?.name ?? null,
          minutesActive: o.minutesActive,
          alerts: o.alerts,
        }));

      const payload = {
        success: true,
        kpis: { ...kpis, alertCount: alerts.length },
        orders,
        drivers,
        businesses,
        alerts,
        updatedAt: new Date().toISOString(),
      };

      cache = { at: Date.now(), payload };
      res.json(payload);
    } catch (error: any) {
      console.error("ops/overview error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ─── GET /api/admin/ops/nearby-drivers?orderId= ──────────────────────────────
// Repartidores disponibles ordenados por distancia al negocio del pedido,
// para poder asignar/reasignar desde el mapa.
router.get(
  "/ops/nearby-drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const orderId = req.query.orderId as string;
      if (!orderId) {
        return res.status(400).json({ error: "orderId requerido" });
      }

      const [orderRows] = (await db.execute(sql`
        SELECT o.id, o.delivery_person_id,
               b.latitude AS business_lat, b.longitude AS business_lng,
               b.name AS business_name
        FROM orders o
        LEFT JOIN businesses b ON o.business_id = b.id
        WHERE o.id = ${orderId}
        LIMIT 1
      `)) as any;

      const order = (orderRows as any[])[0];
      if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

      const originLat = order.business_lat ? parseFloat(order.business_lat) : null;
      const originLng = order.business_lng ? parseFloat(order.business_lng) : null;

      const allDrivers = await fetchDriversForMap();
      const { haversineMeters } = await import("../trackingPipeline");

      const candidates = allDrivers
        .filter((d: any) => !d.isBlocked)
        .map((d: any) => ({
          ...d,
          distanceKm:
            originLat != null && originLng != null
              ? Number(
                  (
                    haversineMeters(originLat, originLng, d.lat, d.lng) / 1000
                  ).toFixed(2),
                )
              : null,
          busy: !!d.activeOrderId && d.activeOrderId !== orderId,
          isCurrent: d.id === order.delivery_person_id,
        }))
        .sort((a: any, b: any) => {
          // Libres y conectados primero, luego por distancia
          if (a.busy !== b.busy) return a.busy ? 1 : -1;
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
        });

      res.json({
        success: true,
        orderId,
        businessName: order.business_name ?? null,
        currentDriverId: order.delivery_person_id ?? null,
        drivers: candidates.slice(0, 15),
      });
    } catch (error: any) {
      console.error("ops/nearby-drivers error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
