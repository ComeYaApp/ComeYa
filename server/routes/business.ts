import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, desc } from "drizzle-orm";
import { getPartnerStatus, updatePartnerLevel } from "../partnerLevelService";
import { CONFIG } from "../config";

const router = express.Router();

// ─── RUTAS ESPECÍFICAS (deben ir ANTES de /:id) ───────────────────────────────

// GET /api/business/partner-level — nivel del partner actual
router.get("/partner-level", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });
    const status = await getPartnerStatus(business.id);
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/business/partner-level/recalculate — recalcular nivel (admin o cron)
router.post("/partner-level/recalculate", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.body;
    const newLevel = await updatePartnerLevel(businessId);
    res.json({ success: true, level: newLevel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/featured
router.get("/featured", async (req, res) => {
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const [rows] = await db.execute(sql`SELECT * FROM businesses WHERE is_featured = 1 AND is_active = 1 LIMIT 10`) as any;
    res.json({ success: true, businesses: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/nearby
router.get("/nearby", async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const allBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.isActive, true));
    res.json({ success: true, businesses: allBusinesses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// GET /api/business/dashboard
router.get("/dashboard", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const businessOrders = await db.select().from(orders).where(eq(orders.businessId, business.id)).orderBy(desc(orders.createdAt));

    const today = new Date();
    const todayOrders = businessOrders.filter(o => new Date(o.createdAt).toDateString() === today.toDateString());
    const pendingOrders = businessOrders.filter(o => o.status === "pending");
    const todayRevenue = todayOrders.filter(o => o.status === "delivered").reduce((sum, o) => sum + (o.subtotal || 0), 0);

    res.json({
      success: true,
      dashboard: {
        business,
        isOpen: business.isOpen || false,
        pendingOrders: pendingOrders.length,
        todayOrders: todayOrders.length,
        todayRevenue: Math.round(todayRevenue / 100),
        totalOrders: businessOrders.length,
        recentOrders: businessOrders.slice(0, 10).map(o => ({
          ...o,
          subtotal: Math.round((o.subtotal || 0) / 100),
          deliveryFee: Math.round((o.deliveryFee || 0) / 100),
          total: Math.round((o.total || 0) / 100),
        })),
      },
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/stats
router.get("/stats", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses, orders, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const businessOrders = await db.select().from(orders).where(eq(orders.businessId, business.id));

    const today = new Date();
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const revenue = (list: any[]) => list.filter(o => o.status === "delivered").reduce((s, o) => s + (o.subtotal || 0), 0);

    const todayOrders  = businessOrders.filter(o => new Date(o.createdAt).toDateString() === today.toDateString());
    const weekOrders   = businessOrders.filter(o => new Date(o.createdAt) >= thisWeek);
    const monthOrders  = businessOrders.filter(o => new Date(o.createdAt) >= thisMonth);
    const completedOrders = businessOrders.filter(o => o.status === "delivered");
    const cancelledOrders = businessOrders.filter(o => o.status === "cancelled");

    const totalRevenue = revenue(businessOrders);
    const avgValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

    // Top products
    const [topProductRows] = await db.execute(sql`
      SELECT 
        p.name,
        SUM(JSON_EXTRACT(oi.value, '$.quantity')) as quantity,
        SUM(JSON_EXTRACT(oi.value, '$.quantity') * JSON_EXTRACT(oi.value, '$.price')) as revenue
      FROM orders o
      CROSS JOIN JSON_TABLE(
        o.items,
        '$[*]' COLUMNS(
          value JSON PATH '$'
        )
      ) oi
      JOIN products p ON p.id = JSON_EXTRACT(oi.value, '$.productId')
      WHERE o.business_id = ${business.id}
        AND o.status = 'delivered'
      GROUP BY p.id, p.name
      ORDER BY quantity DESC
      LIMIT 5
    `) as any;

    const topProducts = topProductRows.map((row: any) => ({
      name: row.name,
      quantity: parseInt(row.quantity) || 0,
      revenue: (parseInt(row.revenue) || 0) / 100,
    }));

    res.json({
      success: true,
      revenue: {
        today: Math.round(revenue(todayOrders) / 100),
        week: Math.round(revenue(weekOrders) / 100),
        month: Math.round(revenue(monthOrders) / 100),
        total: Math.round(totalRevenue / 100),
      },
      orders: {
        total: businessOrders.length,
        completed: completedOrders.length,
        cancelled: cancelledOrders.length,
        avgValue: Math.round(avgValue / 100),
      },
      topProducts,
    });
  } catch (error: any) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/limits
router.get("/limits", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  res.json({
    success: true,
    limits: {
      maxProducts: 100,
      maxCategories: 20,
      maxImages: 10,
      maxOrdersPerHour: 50,
      maxDeliveryRadius: 10,
      minOrderAmount: 1000,
      maxOrderAmount: 100000,
    },
  });
});

// GET /api/business/active-deliveries — mapa de supervisión para el dueño
router.get("/active-deliveries", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, orders, users, deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql, inArray } = await import("drizzle-orm");

    // Obtener negocios del owner
    const ownerBusinesses = await db.select({ id: businesses.id, name: businesses.name, latitude: businesses.latitude, longitude: businesses.longitude })
      .from(businesses).where(eq(businesses.ownerId, req.user!.id));
    if (!ownerBusinesses.length) return res.json({ success: true, deliveries: [], stats: {} });

    const businessIds = ownerBusinesses.map(b => b.id);

    // Pedidos activos
    const [rows] = await db.execute(sql`
      SELECT
        o.id, o.status, o.subtotal, o.delivery_fee, o.total, o.created_at, o.updated_at,
        o.business_id, o.delivery_address, o.items, o.payment_method,
        u.name  AS customer_name,  u.phone AS customer_phone,
        d.id    AS driver_id,       d.name  AS driver_name,  d.phone AS driver_phone,
        d.current_latitude AS driver_lat, d.current_longitude AS driver_lng,
        d.vehicle_type, d.rating AS driver_rating,
        b.name  AS business_name
      FROM orders o
      LEFT JOIN users u  ON o.user_id = u.id
      LEFT JOIN delivery_drivers d ON o.driver_id = d.id
      LEFT JOIN businesses b ON o.business_id = b.id
      WHERE o.business_id IN (${sql.join(businessIds.map(id => sql`${id}`), sql`, `)})
        AND o.status IN ('pending','accepted','preparing','ready','on_the_way')
      ORDER BY o.created_at DESC
    `) as any;

    const deliveries = rows.map((r: any) => {
      let address: any = null;
      try { address = typeof r.delivery_address === 'string' ? JSON.parse(r.delivery_address) : r.delivery_address; } catch {}
      const minutesActive = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
      return {
        orderId:       r.id,
        status:        r.status,
        subtotal:      r.subtotal,
        deliveryFee:   r.delivery_fee,
        total:         r.total,
        paymentMethod: r.payment_method,
        minutesActive,
        businessId:    r.business_id,
        businessName:  r.business_name,
        customer: {
          name:  r.customer_name,
          phone: r.customer_phone,
          lat:   address?.latitude  ? parseFloat(address.latitude)  : null,
          lng:   address?.longitude ? parseFloat(address.longitude) : null,
          address: address?.street || address?.formatted || address?.address || null,
        },
        driver: r.driver_id ? {
          id:          r.driver_id,
          name:        r.driver_name,
          phone:       r.driver_phone,
          lat:         r.driver_lat  ? parseFloat(r.driver_lat)  : null,
          lng:         r.driver_lng  ? parseFloat(r.driver_lng)  : null,
          vehicleType: r.vehicle_type,
          rating:      r.driver_rating ? (r.driver_rating / 10).toFixed(1) : null,
        } : null,
      };
    });

    // Stats rápidas
    const stats = {
      totalActive:   deliveries.length,
      pending:       deliveries.filter((d: any) => d.status === 'pending').length,
      preparing:     deliveries.filter((d: any) => ['accepted','preparing'].includes(d.status)).length,
      onTheWay:      deliveries.filter((d: any) => d.status === 'on_the_way').length,
      avgMinutes:    deliveries.length ? Math.round(deliveries.reduce((s: number, d: any) => s + d.minutesActive, 0) / deliveries.length) : 0,
      pendingRevenue: deliveries.reduce((s: number, d: any) => s + (d.subtotal || 0), 0),
    };

    res.json({ success: true, deliveries, businesses: ownerBusinesses, stats });
  } catch (err: any) {
    console.error('active-deliveries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/business/my-businesses
router.get("/my-businesses", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { inArray } = await import("drizzle-orm");

    const ownerBusinesses = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id));
    
    // Obtener órdenes de TODOS los negocios del usuario
    const businessIds = ownerBusinesses.map(b => b.id);
    const allOrders = businessIds.length > 0
      ? await db.select().from(orders).where(inArray(orders.businessId, businessIds))
      : [];

    const result = ownerBusinesses.map(business => {
      const bOrders = allOrders.filter(o => o.businessId === business.id);
      const deliveredOrders = bOrders.filter(o => o.status === "delivered");
      const pendingOrders = bOrders.filter(o => ["pending", "accepted", "preparing"].includes(o.status));
      
      return {
        ...business,
        stats: {
          pendingOrders: pendingOrders.length,
          totalOrders: deliveredOrders.length,
          totalRevenue: deliveredOrders.reduce((s, o) => s + (o.subtotal || 0), 0),
        },
      };
    });

    res.json({ success: true, businesses: result });
  } catch (error: any) {
    console.error("My businesses error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/orders
router.get("/orders", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses, orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const [orderRows] = await db.execute(sql`
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.business_id = ${business.id}
      ORDER BY o.created_at DESC
    `) as any;

    const formattedOrders = orderRows.map((row: any) => {
      let addressObj = null;
      if (row.delivery_address) {
        try {
          addressObj = JSON.parse(row.delivery_address);
        } catch {
          addressObj = { street: row.delivery_address };
        }
      }
      
      return {
        id: row.id,
        userId: row.user_id,
        businessId: row.business_id,
        businessName: row.business_name,
        businessImage: row.business_image,
        items: row.items,
        status: row.status,
        subtotal: row.subtotal,
        deliveryFee: row.delivery_fee,
        total: row.total,
        paymentMethod: row.payment_method,
        deliveryAddress: row.delivery_address,
        notes: row.notes,
        createdAt: row.created_at,
        customer: row.customer_name ? {
          name: row.customer_name,
          phone: row.customer_phone,
        } : null,
        address: addressObj,
      };
    });

    res.json({ success: true, orders: formattedOrders });
  } catch (error: any) {
    console.error("Business orders error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/products
router.get("/products", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const businessProducts = await db.select().from(products).where(eq(products.businessId, business.id));

    res.json({ success: true, products: businessProducts });
  } catch (error: any) {
    console.error("Business products error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/payouts
router.get("/payouts", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses, payouts } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { desc } = await import("drizzle-orm");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const businessPayouts = await db
      .select()
      .from(payouts)
      .where(eq(payouts.recipientId, business.id))
      .orderBy(desc(payouts.createdAt));

    res.json({ success: true, payouts: businessPayouts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/finances
router.get("/finances", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId, period = "week" } = req.query;
    const { businesses, orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    // Calcular fecha de inicio según el período
    const today = new Date();
    let startDate: Date;
    
    switch (period) {
      case "week":
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "all":
      default:
        startDate = new Date(0); // Desde el inicio
        break;
    }

    // Obtener transacciones (pedidos)
    const [transactionRows] = await db.execute(sql`
      SELECT 
        o.id,
        o.subtotal,
        o.delivery_fee,
        o.total,
        o.status,
        o.payment_method,
        o.delivery_address,
        o.notes,
        o.created_at,
        u.name as customer_name,
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.business_id = ${business.id}
        AND o.created_at >= ${startDate.toISOString()}
      ORDER BY o.created_at DESC
    `) as any;

    const transactions = transactionRows.map((row: any) => {
      let address = null;
      if (row.delivery_address) {
        try { address = JSON.parse(row.delivery_address); } catch { address = { street: row.delivery_address }; }
      }
      return {
        id: row.id,
        orderId: row.id,
        subtotal: row.subtotal || 0,
        deliveryFee: row.delivery_fee || 0,
        total: row.total || 0,
        status: row.status,
        paymentMethod: row.payment_method,
        deliveryAddress: address,
        notes: row.notes,
        createdAt: row.created_at,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
      };
    });

    // Calcular resumen
    const completedOrders = transactions.filter((t: any) => t.status === "delivered");
    const pendingOrders = transactions.filter((t: any) =>
      ["pending", "accepted", "preparing", "on_the_way"].includes(t.status)
    );

    const completedAmount = completedOrders.reduce((sum: number, t: any) => sum + (t.subtotal || 0), 0);
    const pendingAmount = pendingOrders.reduce((sum: number, t: any) => sum + (t.subtotal || 0), 0);

    res.json({
      success: true,
      transactions,
      summary: {
        totalEarnings: completedAmount + pendingAmount,
        completedAmount,
        pendingAmount,
        transactionCount: transactions.length,
      },
    });
  } catch (error: any) {
    console.error("Business finances error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/hours
router.get("/hours", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId } = req.query;
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    // Horarios por defecto si no existen
    const defaultHours = {
      monday: { open: "09:00", close: "22:00", closed: false },
      tuesday: { open: "09:00", close: "22:00", closed: false },
      wednesday: { open: "09:00", close: "22:00", closed: false },
      thursday: { open: "09:00", close: "22:00", closed: false },
      friday: { open: "09:00", close: "22:00", closed: false },
      saturday: { open: "09:00", close: "22:00", closed: false },
      sunday: { open: "09:00", close: "22:00", closed: false },
    };

    const hours = business.openingHours ? JSON.parse(business.openingHours as any) : defaultHours;

    res.json({ success: true, hours });
  } catch (error: any) {
    console.error("Business hours error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/hours
router.put("/hours", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businessId, hours } = req.body;
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = businessId
      ? await db.select().from(businesses).where(and(eq(businesses.id, businessId as string), eq(businesses.ownerId, req.user!.id))).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    await db.update(businesses).set({ openingHours: JSON.stringify(hours) }).where(eq(businesses.id, business.id));

    res.json({ success: true, message: "Horarios actualizados" });
  } catch (error: any) {
    console.error("Update hours error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/business/products
router.post("/products", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");
    const { name, description, price, image } = req.body;

    const [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    let imageUrl = null;
    if (image && image.startsWith('data:image/')) {
      const productId = crypto.randomUUID();
      imageUrl = await CloudinaryService.uploadImage(image, 'products', `product-${productId}`);
    }

    const newProduct = {
      id: crypto.randomUUID(),
      businessId: business.id,
      name,
      description: description || null,
      price,
      image: imageUrl,
      isAvailable: true,
      createdAt: new Date(),
    };

    await db.insert(products).values(newProduct);
    res.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error("Create product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/products/:id
router.put("/products/:id", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    const [product] = await db.select().from(products).where(eq(products.id, req.params.id)).limit(1);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const [business] = await db.select().from(businesses).where(and(eq(businesses.id, product.businessId), eq(businesses.ownerId, req.user!.id))).limit(1);
    if (!business) return res.status(403).json({ error: "No autorizado" });

    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.price !== undefined) updates.price = req.body.price;
    if (req.body.image !== undefined) {
      if (req.body.image && req.body.image.startsWith('data:image/')) {
        // Eliminar imagen anterior
        if (product.image && product.image.includes('cloudinary')) {
          const oldPublicId = CloudinaryService.extractPublicId(product.image);
          if (oldPublicId) await CloudinaryService.deleteImage(oldPublicId).catch(() => {});
        }
        // Subir nueva
        updates.image = await CloudinaryService.uploadImage(req.body.image, 'products', `product-${req.params.id}`);
      } else {
        updates.image = req.body.image;
      }
    }

    await db.update(products).set(updates).where(eq(products.id, req.params.id));
    res.json({ success: true, message: "Producto actualizado" });
  } catch (error: any) {
    console.error("Update product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/products/:id/availability
router.put("/products/:id/availability", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { isAvailable } = req.body;

    const [product] = await db.select().from(products).where(eq(products.id, req.params.id)).limit(1);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const [business] = await db.select().from(businesses).where(and(eq(businesses.id, product.businessId), eq(businesses.ownerId, req.user!.id))).limit(1);
    if (!business) return res.status(403).json({ error: "No autorizado" });

    await db.update(products).set({ isAvailable }).where(eq(products.id, req.params.id));
    res.json({ success: true, message: "Disponibilidad actualizada" });
  } catch (error: any) {
    console.error("Update availability error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/business/products/:id
router.delete("/products/:id", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [product] = await db.select().from(products).where(eq(products.id, req.params.id)).limit(1);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const [business] = await db.select().from(businesses).where(and(eq(businesses.id, product.businessId), eq(businesses.ownerId, req.user!.id))).limit(1);
    if (!business) return res.status(403).json({ error: "No autorizado" });

    await db.delete(products).where(eq(products.id, req.params.id));
    res.json({ success: true, message: "Producto eliminado" });
  } catch (error: any) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/orders/:id/status
router.put("/orders/:id/status", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const [business] = await db.select().from(businesses).where(and(eq(businesses.id, order.businessId), eq(businesses.ownerId, req.user!.id))).limit(1);
    if (!business && req.user!.role !== "admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updates: any = { status, updatedAt: new Date() };
    if (status === "accepted") updates.businessResponseAt = new Date();
    if (status === "preparing") updates.assignedAt = new Date();

    await db.update(orders).set(updates).where(eq(orders.id, req.params.id));
    res.json({ success: true, message: "Estado actualizado" });
  } catch (error: any) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── RUTAS GENERALES ──────────────────────────────────────────────────────────

// GET /api/business
router.get("/", async (req, res) => {
  try {
    const { queryWithRetry } = await import("../dbHelper");
    
    console.log('📍 GET /api/businesses called');
    
    const rows = await queryWithRetry(
      'SELECT * FROM businesses WHERE is_active = 1'
    );
    
    console.log(`✅ Found ${rows.length} active businesses`);
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ success: true, businesses: rows });
    
  } catch (error: any) {
    console.error('❌ Error in /api/businesses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch businesses',
      details: error.message,
      code: error.code
    });
  }
});

// POST /api/business
router.post("/", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");
    const { name, description, type, image, address, phone, categories, latitude, longitude } = req.body;

    if (!name) return res.status(400).json({ error: "El nombre del negocio es requerido" });

    let imageUrl = null;
    if (image && image.startsWith('data:image/')) {
      const businessId = crypto.randomUUID();
      imageUrl = await CloudinaryService.uploadImage(image, 'businesses', `business-${businessId}`);
    }

    const newBusiness = {
      id: crypto.randomUUID(),
      ownerId: req.user!.id,
      name,
      description: description || null,
      type: type || "restaurant",
      image: imageUrl,
      address: address || null,
      phone: phone || null,
      categories: categories || null,
      latitude: latitude || null,
      longitude: longitude || null,
      isActive: true,
      isOpen: false,
      rating: 0,
      totalRatings: 0,
      deliveryTime: CONFIG.DEFAULT_DELIVERY_TIME,
      deliveryFee: CONFIG.DEFAULT_DELIVERY_FEE,
      minOrder: 1000,
      createdAt: new Date(),
    };

    await db.insert(businesses).values(newBusiness);
    res.json({ success: true, business: newBusiness });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── RUTAS CON PARÁMETRO (deben ir AL FINAL) ──────────────────────────────────

// GET /api/business/:id  (usa SQL raw para evitar mismatch camelCase/snake_case)
router.get("/:id", async (req, res) => {
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const [bizRows] = await db.execute(sql`
      SELECT * FROM businesses WHERE id = ${req.params.id} LIMIT 1
    `) as any;
    const business = bizRows[0] as any;

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });
    if (!business.is_active) return res.status(404).json({ error: "Negocio no encontrado" });

    const [productRows] = await db.execute(sql`
      SELECT * FROM products
      WHERE business_id = ${req.params.id}
        AND (is_available = 1 OR is_available = true)
    `) as any;

    res.json({ success: true, business: { ...business, products: productRows } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/:id
router.put("/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");

    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, req.params.id), eq(businesses.ownerId, req.user!.id)))
      .limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const allowed = ["name", "description", "type", "image", "address", "phone", "categories", "isOpen", "deliveryTime", "deliveryFee", "minOrder", "latitude", "longitude"];
    const updates: any = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === 'image' && req.body[field] && req.body[field].startsWith('data:image/')) {
          // Eliminar imagen anterior
          if (business.image && business.image.includes('cloudinary')) {
            const oldPublicId = CloudinaryService.extractPublicId(business.image);
            if (oldPublicId) await CloudinaryService.deleteImage(oldPublicId).catch(() => {});
          }
          // Subir nueva
          updates.image = await CloudinaryService.uploadImage(req.body[field], 'businesses', `business-${req.params.id}`);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    await db.update(businesses).set(updates).where(eq(businesses.id, req.params.id));
    res.json({ success: true, message: "Negocio actualizado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/business/:id/geocode — geocodificar negocio por su dirección
router.post("/:id/geocode", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const [business] = await db.select().from(businesses)
      .where(and(eq(businesses.id, req.params.id), eq(businesses.ownerId, req.user!.id)))
      .limit(1);
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });
    if (!business.address) return res.status(400).json({ error: "El negocio no tiene dirección" });

    const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
    if (!GMAPS_KEY) return res.status(500).json({ error: "Google Maps API key no configurada" });

    const query = encodeURIComponent(`${business.address}, Soria, España`);
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GMAPS_KEY}`);
    const geoData = await geoRes.json();

    if (geoData.status !== "OK" || !geoData.results[0]) {
      return res.status(400).json({ error: "No se pudo geocodificar la dirección" });
    }

    const { lat, lng } = geoData.results[0].geometry.location;
    await db.update(businesses)
      .set({ latitude: String(lat), longitude: String(lng) })
      .where(eq(businesses.id, req.params.id));

    res.json({ success: true, latitude: lat, longitude: lng });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business/:id/toggle-status
router.put("/:id/toggle-status", authenticateToken, requireRole("business_owner", "admin", "super_admin"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, req.params.id), eq(businesses.ownerId, req.user!.id)))
      .limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    const newStatus = !business.isOpen;
    await db.update(businesses).set({ isOpen: newStatus }).where(eq(businesses.id, req.params.id));
    
    res.json({ success: true, isOpen: newStatus, message: newStatus ? "Negocio abierto" : "Negocio cerrado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── STRIPE CONNECT ENDPOINTS ────────────────────────────────────────────────

// POST /api/business/stripe/connect
router.post("/stripe/connect", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    // Si ya tiene cuenta, retornar link de onboarding
    if (business.stripeAccountId) {
      const accountLink = await stripe.accountLinks.create({
        account: business.stripeAccountId,
        refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/business/stripe/refresh`,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/business/stripe/success`,
        type: "account_onboarding",
      });

      return res.json({ 
        success: true, 
        onboardingUrl: accountLink.url,
        accountId: business.stripeAccountId 
      });
    }

    // Crear nueva cuenta de Stripe Connect
    const account = await stripe.accounts.create({
      type: "express",
      country: "ES",
      email: req.user!.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: business.name,
        product_description: business.description || "Negocio local",
      },
    });

    // Guardar stripe_account_id
    await db.update(businesses)
      .set({ stripeAccountId: account.id })
      .where(eq(businesses.id, business.id));

    // Crear link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/business/stripe/refresh`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/business/stripe/success`,
      type: "account_onboarding",
    });

    res.json({ 
      success: true, 
      onboardingUrl: accountLink.url,
      accountId: account.id 
    });
  } catch (error: any) {
    console.error("Stripe connect error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/stripe/status
router.get("/stripe/status", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business || !business.stripeAccountId) {
      return res.json({ 
        success: true, 
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false
      });
    }

    const account = await stripe.accounts.retrieve(business.stripeAccountId);

    res.json({
      success: true,
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      accountId: account.id,
    });
  } catch (error: any) {
    console.error("Stripe status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/stripe/dashboard-link
router.get("/stripe/dashboard-link", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business?.stripeAccountId) {
      return res.status(404).json({ error: "Cuenta de Stripe no conectada" });
    }

    const loginLink = await stripe.accounts.createLoginLink(business.stripeAccountId);

    res.json({ 
      success: true, 
      url: loginLink.url 
    });
  } catch (error: any) {
    console.error("Stripe dashboard link error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/business/stripe/disconnect
router.delete("/stripe/disconnect", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    // Eliminar stripeAccountId de la base de datos
    await db.update(businesses)
      .set({ stripeAccountId: null })
      .where(eq(businesses.id, business.id));

    res.json({ 
      success: true, 
      message: "Cuenta de Stripe desconectada" 
    });
  } catch (error: any) {
    console.error("Stripe disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
