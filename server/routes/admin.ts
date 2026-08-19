import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, desc, sql } from "drizzle-orm";

const router = express.Router();

// Get dashboard stats
router.get(
  "/dashboard",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      // Get basic counts
      const [userCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM users`,
      );
      const [businessCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM businesses WHERE is_active = 1`,
      );
      const [orderCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM orders`,
      );
      const [driverCount] = await db.execute(
        sql`SELECT COUNT(*) as count FROM users WHERE role = 'delivery_driver' AND is_active = 1`,
      );

      // Get today's stats
      const [todayOrders] = await db.execute(sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE DATE(created_at) = CURDATE()
    `);

      // Get pending orders
      const [pendingOrders] = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE status IN ('pending', 'confirmed', 'preparing')
    `);

      res.json({
        success: true,
        dashboard: {
          totalUsers: userCount.count,
          totalBusinesses: businessCount.count,
          totalOrders: orderCount.count,
          totalDrivers: driverCount.count,
          todayOrders: todayOrders.count,
          todayRevenue: Math.round(todayOrders.revenue || 0),
          pendingOrders: pendingOrders.count,
        },
      });
    } catch (error: any) {
      console.error("Get admin dashboard error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all users
router.get(
  "/users",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json({ success: true, users: allUsers });
    } catch (error: any) {
      console.error("Get users error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Update user status
router.patch(
  "/users/:id/status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ error: "Estado requerido" });
      }

      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      await db
        .update(users)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.params.id));

      res.json({
        success: true,
        message: `Usuario ${isActive ? "activado" : "desactivado"}`,
      });
    } catch (error: any) {
      console.error("Update user status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all businesses
router.get(
  "/businesses",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses, users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const allBusinesses = await db
        .select({
          business: businesses,
          owner: {
            id: users.id,
            name: users.name,
            phone: users.phone,
          },
        })
        .from(businesses)
        .leftJoin(users, eq(businesses.ownerId, users.id))
        .orderBy(desc(businesses.createdAt));

      res.json({ success: true, businesses: allBusinesses });
    } catch (error: any) {
      console.error("Get businesses error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Update business status
router.patch(
  "/businesses/:id/status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ error: "Estado requerido" });
      }

      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, req.params.id))
        .limit(1);

      if (!business) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }

      await db
        .update(businesses)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, req.params.id));

      res.json({
        success: true,
        message: `Negocio ${isActive ? "activado" : "desactivado"}`,
      });
    } catch (error: any) {
      console.error("Update business status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Update business custom commission
router.put(
  "/businesses/:id/commission",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { customCommission } = req.body;

      // Validate commission value
      if (customCommission !== null && customCommission !== undefined) {
        const commission = Number(customCommission);
        if (isNaN(commission) || commission < 0 || commission > 100) {
          return res
            .status(400)
            .json({ error: "La comisión debe ser un número entre 0 y 100" });
        }
      }

      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, req.params.id))
        .limit(1);

      if (!business) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }

      await db
        .update(businesses)
        .set({
          customCommission:
            customCommission === null ? null : Number(customCommission),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, req.params.id));

      res.json({
        success: true,
        message:
          customCommission === null
            ? "Se usará la comisión global del sistema"
            : `Comisión personalizada establecida en ${customCommission}%`,
      });
    } catch (error: any) {
      console.error("Update business commission error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all orders
router.get(
  "/orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, businesses, users } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");

      const raw = await db
        .select({
          order: orders,
          businessName: businesses.name,
          customerName: users.name,
          customerPhone: users.phone,
        })
        .from(orders)
        .leftJoin(businesses, eq(orders.businessId, businesses.id))
        .leftJoin(users, eq(orders.userId, users.id))
        .orderBy(desc(orders.createdAt))
        .limit(100);

      const flat = raw.map((r) => ({
        ...r.order,
        businessName: r.businessName || r.order.businessName || "Negocio",
        customerName: r.customerName || "Cliente",
        customerPhone: r.customerPhone || "",
      }));

      res.json({ success: true, orders: flat });
    } catch (error: any) {
      console.error("Get orders error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get system stats
router.get(
  "/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      // Revenue stats
      const [totalRevenue] = await db.execute(sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders 
      WHERE status = 'delivered'
    `);

      const [monthlyRevenue] = await db.execute(sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders 
      WHERE status = 'delivered' 
      AND MONTH(created_at) = MONTH(CURDATE())
      AND YEAR(created_at) = YEAR(CURDATE())
    `);

      // Order stats by status
      const orderStats = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `);

      // Top businesses
      const topBusinesses = await db.execute(sql`
      SELECT b.name, COUNT(o.id) as orderCount, COALESCE(SUM(o.total), 0) as revenue
      FROM businesses b
      LEFT JOIN orders o ON b.id = o.businessId AND o.status = 'delivered'
      WHERE b.is_active = 1
      GROUP BY b.id, b.name
      ORDER BY orderCount DESC
      LIMIT 10
    `);

      res.json({
        success: true,
        stats: {
          revenue: {
            total: Math.round(totalRevenue.total || 0),
            monthly: Math.round(monthlyRevenue.total || 0),
          },
          orders: orderStats,
          topBusinesses: topBusinesses,
        },
      });
    } catch (error: any) {
      console.error("Get system stats error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Dashboard metrics (alias detallado)
router.get(
  "/dashboard/metrics",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");
      const [users] = await db.execute(
        sql`SELECT COUNT(*) as count FROM users`,
      );
      const [businesses] = await db.execute(
        sql`SELECT COUNT(*) as count FROM businesses WHERE is_active = 1`,
      );
      const [orders] = await db.execute(
        sql`SELECT COUNT(*) as count FROM orders`,
      );
      const [drivers] = await db.execute(
        sql`SELECT COUNT(*) as count FROM users WHERE role = 'delivery_driver' AND is_active = 1`,
      );
      const [today] = await db.execute(
        sql`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE DATE(created_at)=CURDATE()`,
      );
      const [pending] = await db.execute(
        sql`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending','confirmed','preparing')`,
      );
      res.json({
        success: true,
        totalUsers: users.count,
        totalBusinesses: businesses.count,
        totalOrders: orders.count,
        totalDrivers: drivers.count,
        todayOrders: today.count,
        todayRevenue: Math.round(today.revenue || 0),
        pendingOrders: pending.count,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.get(
  "/dashboard/active-orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, businesses, users } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { inArray } = await import("drizzle-orm");
      const activeOrders = await db
        .select({
          order: orders,
          business: { id: businesses.id, name: businesses.name },
          customer: { id: users.id, name: users.name },
        })
        .from(orders)
        .leftJoin(businesses, eq(orders.businessId, businesses.id))
        .leftJoin(users, eq(orders.userId, users.id))
        .where(
          inArray(orders.status, [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "on_the_way",
          ]),
        )
        .orderBy(desc(orders.createdAt))
        .limit(50);
      res.json({ success: true, orders: activeOrders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

router.get(
  "/dashboard/online-drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { and } = await import("drizzle-orm");
      const drivers = await db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
          isActive: users.isActive,
        })
        .from(users)
        .where(
          and(eq(users.role, "delivery_driver"), eq(users.isActive, true)),
        );
      res.json({ success: true, drivers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Update user (full)
router.put(
  "/users/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { name, email, phone, role } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone) updates.phone = phone;
      if (role) updates.role = role;
      await db.update(users).set(updates).where(eq(users.id, req.params.id));
      res.json({ success: true, message: "Usuario actualizado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Drivers
router.get(
  "/drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users, deliveryDrivers } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const driverUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "delivery_driver"))
        .orderBy(desc(users.createdAt));
      const enriched = await Promise.all(
        driverUsers.map(async (u) => {
          const [dd] = await db
            .select()
            .from(deliveryDrivers)
            .where(eq(deliveryDrivers.userId, u.id))
            .limit(1);
          return {
            ...u,
            currentLatitude: dd?.currentLatitude ?? null,
            currentLongitude: dd?.currentLongitude ?? null,
            vehicleType: dd?.vehicleType ?? null,
            vehiclePlate: dd?.vehiclePlate ?? null,
            isBlocked: dd?.isBlocked ?? false,
            totalDeliveries: dd?.totalDeliveries ?? 0,
            rating: dd?.rating ?? null,
          };
        }),
      );
      res.json({ success: true, drivers: enriched });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Finance
// Coupons
router.get(
  "/coupons",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    res.json({ success: true, coupons: [] });
  },
);

// Zones
router.get(
  "/zones",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    res.json({ success: true, zones: [] });
  },
);

// Business products (admin)
router.get(
  "/businesses/:id/products",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { products } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const list = await db
        .select()
        .from(products)
        .where(eq(products.businessId, req.params.id));
      res.json({ success: true, products: list });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Audit logs
router.get(
  "/logs",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");
      const logs = await db.execute(sql`
      SELECT 
        id,
        user_id as userId,
        action,
        entity_type as entityType,
        entity_id as entityId,
        changes,
        ip_address as ipAddress,
        user_agent as userAgent,
        created_at as createdAt
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);
      res.json({ success: true, logs });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// System Settings
router.get(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const settings = await db
        .select()
        .from(systemSettings)
        .orderBy(systemSettings.category, systemSettings.key);
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error("Get settings error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.put(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key y value requeridos" });
      }
      const { systemSettings } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      await db
        .update(systemSettings)
        .set({ value: String(value), updatedAt: new Date() })
        .where(eq(systemSettings.key, key));
      res.json({ success: true, message: "Configuración actualizada" });
    } catch (error: any) {
      console.error("Update setting error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

router.post(
  "/settings/initialize",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const defaultSettings = [
        {
          key: "comeya_commission",
          value: "15",
          type: "number",
          category: "commissions",
          description: "Comision ComeYa (%)",
          isPublic: false,
        },
        {
          key: "business_commission",
          value: "100",
          type: "number",
          category: "commissions",
          description: "Comision Negocio (%)",
          isPublic: false,
        },
        {
          key: "driver_commission",
          value: "100",
          type: "number",
          category: "commissions",
          description: "Comision Repartidor (%)",
          isPublic: false,
        },
        {
          key: "regret_period_seconds",
          value: "60",
          type: "number",
          category: "operations",
          description: "Periodo arrepentimiento (seg)",
          isPublic: true,
        },
        {
          key: "business_call_delay_minutes",
          value: "3",
          type: "number",
          category: "operations",
          description: "Retraso llamada negocio (min)",
          isPublic: false,
        },
        {
          key: "fund_hold_hours",
          value: "1",
          type: "number",
          category: "operations",
          description: "Retencion de fondos (horas)",
          isPublic: false,
        },
        {
          key: "bizum_phone",
          value: "",
          type: "string",
          category: "payments",
          description: "Telefono Bizum ComeYa",
          isPublic: true,
        },
        {
          key: "comeya_iban",
          value: "",
          type: "string",
          category: "payments",
          description: "IBAN ComeYa",
          isPublic: true,
        },
        {
          key: "paypal_email",
          value: "",
          type: "string",
          category: "payments",
          description: "Email PayPal ComeYa",
          isPublic: true,
        },
        {
          key: "stripe_enabled",
          value: "true",
          type: "boolean",
          category: "payments",
          description: "Stripe habilitado",
          isPublic: false,
        },
      ];

      for (const setting of defaultSettings) {
        await db
          .insert(systemSettings)
          .values(setting)
          .onDuplicateKeyUpdate({ set: { description: setting.description } });
      }

      res.json({ success: true, message: "Configuraciones inicializadas" });
    } catch (error: any) {
      console.error("Initialize settings error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// System health check
router.get(
  "/health",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");

      // Test database connection
      await db.execute(sql`SELECT 1`);

      const checks = [
        {
          service: "Database",
          status: "healthy",
          message: "Connection successful",
        },
        {
          service: "Stripe",
          status: process.env.STRIPE_SECRET_KEY ? "healthy" : "warning",
          message: process.env.STRIPE_SECRET_KEY
            ? "Configured"
            : "Not configured",
        },
        {
          service: "SMS",
          status: process.env.TWILIO_ACCOUNT_SID ? "healthy" : "warning",
          message: process.env.TWILIO_ACCOUNT_SID
            ? "Configured"
            : "Not configured",
        },
      ];

      const overallStatus = checks.every((c) => c.status === "healthy")
        ? "healthy"
        : "warning";

      res.json({
        success: true,
        health: {
          status: overallStatus,
          timestamp: new Date().toISOString(),
          checks,
        },
      });
    } catch (error: any) {
      console.error("Health check error:", error);
      res.status(500).json({
        success: false,
        health: {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error.message,
        },
      });
    }
  },
);

// POST /api/admin/businesses/geocode — geocodificar negocios sin coordenadas
router.post(
  "/businesses/geocode",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db } = await import("../db");
      const GMAPS_KEY =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
        "";
      if (!GMAPS_KEY)
        return res
          .status(500)
          .json({ error: "Google Maps API key no configurada" });

      const [rows] = (await db.execute(sql`
      SELECT id, name, address FROM businesses
      WHERE is_active = 1 AND (latitude IS NULL OR longitude IS NULL) AND address IS NOT NULL
    `)) as any;

      const businesses = rows as any[];
      let updated = 0;
      let failed = 0;

      for (const biz of businesses) {
        try {
          const query = encodeURIComponent(`${biz.address}, Soria, España`);
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GMAPS_KEY}`;
          const geoRes = await fetch(url);
          const geoData = await geoRes.json();
          if (geoData.status === "OK" && geoData.results[0]) {
            const { lat, lng } = geoData.results[0].geometry.location;
            await db.execute(
              sql`UPDATE businesses SET latitude = ${String(lat)}, longitude = ${String(lng)} WHERE id = ${biz.id}`,
            );
            updated++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      res.json({ success: true, total: businesses.length, updated, failed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// PUT /api/admin/businesses/:id — actualizar negocio (admin)
router.put(
  "/businesses/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const allowed = [
        "name",
        "description",
        "isActive",
        "isOpen",
        "latitude",
        "longitude",
        "address",
        "phone",
      ];
      const updates: any = { updatedAt: new Date() };
      for (const field of allowed) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      await db
        .update(businesses)
        .set(updates)
        .where(eq(businesses.id, req.params.id));
      res.json({ success: true, message: "Negocio actualizado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
