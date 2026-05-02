import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { CONFIG } from "../config";

const router = express.Router();

// Get business dashboard
router.get("/dashboard", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.businessId, business.id))
      .orderBy(desc(orders.createdAt));

    const pendingOrders = businessOrders.filter(o => o.status === "pending");
    const todayOrders = businessOrders.filter(o => {
      const today = new Date();
      const orderDate = new Date(o.createdAt);
      return orderDate.toDateString() === today.toDateString();
    });

    const todayRevenue = todayOrders
      .filter(o => o.status === "delivered")
      .reduce((sum, o) => {
        const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
        const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
        return sum + productBase;
      }, 0);

    res.json({
      success: true,
      dashboard: {
        business,
        pendingOrders: pendingOrders.length,
        todayOrders: todayOrders.length,
        todayRevenue: Math.round(todayRevenue),
        totalOrders: businessOrders.length,
        recentOrders: businessOrders.slice(0, 10),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business stats
router.get("/stats", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    // Get the specific business (first one if no businessId provided)
    const requestedBusinessId = req.query.businessId as string | undefined;
    
    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    if (ownerBusinesses.length === 0) {
      return res.status(404).json({ error: "No businesses found" });
    }

    let targetBusiness;
    if (requestedBusinessId) {
      targetBusiness = ownerBusinesses.find(b => b.id === requestedBusinessId);
      if (!targetBusiness) {
        return res.status(403).json({ error: "No tienes acceso a este negocio" });
      }
    } else {
      targetBusiness = ownerBusinesses[0]; // Default to first business
    }
    
    const businessOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.businessId, targetBusiness.id));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const deliveredOrders = businessOrders.filter(o => o.status === "delivered");
    const cancelledOrders = businessOrders.filter(o => o.status === "cancelled");
    
    const todayOrders = deliveredOrders.filter(o => new Date(o.createdAt) >= startOfToday);
    const weekOrders = deliveredOrders.filter(o => new Date(o.createdAt) >= startOfWeek);
    const monthOrders = deliveredOrders.filter(o => new Date(o.createdAt) >= startOfMonth);

    // Negocio gana solo el valor base de productos (sin markup ni delivery)
    // Fórmula: (total - deliveryFee) / 1.15
    const todayRevenue = todayOrders.reduce((sum, o) => {
      const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
      const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
      return sum + productBase;
    }, 0);
    const weekRevenue = weekOrders.reduce((sum, o) => {
      const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
      const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
      return sum + productBase;
    }, 0);
    const monthRevenue = monthOrders.reduce((sum, o) => {
      const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
      const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
      return sum + productBase;
    }, 0);
    const totalRevenue = deliveredOrders.reduce((sum, o) => {
      const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
      const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
      return sum + productBase;
    }, 0);

    const avgValue = deliveredOrders.length > 0 ? Math.round(totalRevenue / deliveredOrders.length) : 0;

    console.log('📊 BUSINESS STATS DEBUG:');
    console.log('  Business ID:', targetBusiness.id);
    console.log('  Business Name:', targetBusiness.name);
    console.log('  Total Revenue:', totalRevenue, '=', (totalRevenue/100).toFixed(2));
    console.log('  Delivered Orders:', deliveredOrders.length);
    console.log('  Avg Value:', avgValue, '=', (avgValue/100).toFixed(2));

    res.json({
      success: true,
      businessId: targetBusiness.id,
      businessName: targetBusiness.name,
      revenue: {
        today: Math.round(todayRevenue),
        week: Math.round(weekRevenue),
        month: Math.round(monthRevenue),
        total: Math.round(totalRevenue),
      },
      orders: {
        total: businessOrders.length,
        completed: deliveredOrders.length,
        cancelled: cancelledOrders.length,
        avgValue: avgValue,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business orders
router.get("/orders", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses, orders, users, addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc, inArray } = await import("drizzle-orm");

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    if (ownerBusinesses.length === 0) {
      return res.status(404).json({ error: "No businesses found for this user" });
    }

    const businessIds = ownerBusinesses.map(b => b.id);

    const businessOrders = await db
      .select()
      .from(orders)
      .where(inArray(orders.businessId, businessIds))
      .orderBy(desc(orders.createdAt));

    // Filter out pending orders that haven't been confirmed by customer yet
    const filteredOrders = businessOrders.filter(order => {
      if (order.status === 'pending' && !order.regretPeriodConfirmed) {
        return false; // Don't show pending orders still in regret period
      }
      return true;
    });

    const enrichedOrders = await Promise.all(
      filteredOrders.map(async (order) => {
        let customer = null;
        if (order.userId) {
          const customerResult = await db
            .select({ id: users.id, name: users.name, phone: users.phone })
            .from(users)
            .where(eq(users.id, order.userId))
            .limit(1);
          customer = customerResult[0] || null;
        }

        let address = null;
        if (order.addressId) {
          const addressResult = await db
            .select()
            .from(addresses)
            .where(eq(addresses.id, order.addressId))
            .limit(1);
          address = addressResult[0] || null;
        }

        const business = ownerBusinesses.find(b => b.id === order.businessId);

        return {
          ...order,
          customer,
          address,
          businessName: business?.name || 'Negocio',
        };
      })
    );

    res.json({ success: true, orders: enrichedOrders });
  } catch (error: any) {
    console.error("Error loading business orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get my businesses
router.get("/my-businesses", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses, orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, inArray } = await import("drizzle-orm");

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    const businessIds = ownerBusinesses.map(b => b.id);
    
    let allOrders: any[] = [];
    if (businessIds.length > 0) {
      allOrders = await db
        .select()
        .from(orders)
        .where(inArray(orders.businessId, businessIds));
    }

    const businessesWithStats = ownerBusinesses.map(business => {
      const businessOrders = allOrders.filter(o => o.businessId === business.id);
      const today = new Date();
      const todayOrders = businessOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate.toDateString() === today.toDateString();
      });
      const todayRevenue = todayOrders
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => {
          const subtotalWithMarkup = (o.total || 0) - (o.deliveryFee || 0);
          const productBase = Math.round(subtotalWithMarkup / await CONFIG.commissionDivisor());
          return sum + productBase;
        }, 0);
      const pendingOrders = businessOrders.filter(o => 
        ["pending", "confirmed", "preparing"].includes(o.status)
      );

      return {
        ...business,
        stats: {
          pendingOrders: pendingOrders.length,
          todayOrders: todayOrders.length,
          todayRevenue: todayRevenue,
          totalOrders: businessOrders.length,
        },
      };
    });

    res.json({ success: true, businesses: businessesWithStats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business products
router.get("/products", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { products, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const requestedBusinessId = req.query.businessId as string | undefined;

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    if (ownerBusinesses.length === 0) {
      return res.status(404).json({ error: "No businesses found" });
    }

    const ownerBusinessIds = ownerBusinesses.map(b => b.id);

    let targetBusinessId: string;
    if (requestedBusinessId) {
      if (!ownerBusinessIds.includes(requestedBusinessId)) {
        return res.status(403).json({ error: "No tienes acceso a este negocio" });
      }
      targetBusinessId = requestedBusinessId;
    } else {
      targetBusinessId = ownerBusinesses[0].id;
    }

    const businessProducts = await db
      .select()
      .from(products)
      .where(eq(products.businessId, targetBusinessId));

    res.json({ success: true, products: businessProducts, businessId: targetBusinessId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.put("/orders/:id/status", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { status } = req.body;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    const ownerBusinessIds = ownerBusinesses.map(b => b.id);

    if (!ownerBusinessIds.includes(order.businessId)) {
      return res.status(403).json({ error: "No tienes acceso a este pedido" });
    }

    await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Order status updated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
router.post("/products", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { products, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const { randomUUID } = await import("crypto");

    const { businessId, name, description, price, image, category, isAvailable } = req.body;

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    const ownerBusinessIds = ownerBusinesses.map(b => b.id);

    if (!ownerBusinessIds.includes(businessId)) {
      return res.status(403).json({ error: "No tienes acceso a este negocio" });
    }

    const productData = {
      id: randomUUID(),
      businessId,
      name,
      description: description || null,
      price: parseInt(price) || 0,
      image: image || null,
      category: category || null,
      isAvailable: isAvailable !== false,
    };

    await db.insert(products).values(productData);
    res.json({ success: true, productId: productData.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.put("/products/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { products, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, req.params.id))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    const ownerBusinessIds = ownerBusinesses.map(b => b.id);

    if (!ownerBusinessIds.includes(product.businessId)) {
      return res.status(403).json({ error: "No tienes acceso a este producto" });
    }

    await db
      .update(products)
      .set(req.body)
      .where(eq(products.id, req.params.id));

    res.json({ success: true, message: "Product updated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete("/products/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { products, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, req.params.id))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id));

    const ownerBusinessIds = ownerBusinesses.map(b => b.id);

    if (!ownerBusinessIds.includes(product.businessId)) {
      return res.status(403).json({ error: "No tienes acceso a este producto" });
    }

    await db.delete(products).where(eq(products.id, req.params.id));
    res.json({ success: true, message: "Product deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle business status (pause/resume)
router.put("/:id/toggle-status", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, req.params.id),
          eq(businesses.ownerId, req.user!.id)
        )
      )
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    await db
      .update(businesses)
      .set({ isActive: !business.isActive })
      .where(eq(businesses.id, req.params.id));

    res.json({ 
      success: true, 
      isActive: !business.isActive,
      message: !business.isActive ? "Negocio activado" : "Negocio pausado"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business hours (simplified - auto-detect business)
router.get("/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const defaultHours = [
      { day: "Lunes", isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { day: "Martes", isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { day: "Miércoles", isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { day: "Jueves", isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { day: "Viernes", isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { day: "Sábado", isOpen: true, openTime: "09:00", closeTime: "14:00" },
      { day: "Domingo", isOpen: false, openTime: "09:00", closeTime: "14:00" },
    ];

    const hours = business.openingHours ? JSON.parse(business.openingHours) : defaultHours;
    res.json({ success: true, hours });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update business hours (simplified - auto-detect business)
router.put("/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    await db
      .update(businesses)
      .set({ openingHours: JSON.stringify(req.body.hours) })
      .where(eq(businesses.id, business.id));

    res.json({ success: true, message: "Horarios actualizados" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business hours
router.get("/:id/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, req.params.id),
          eq(businesses.ownerId, req.user!.id)
        )
      )
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const hours = business.openingHours ? JSON.parse(business.openingHours) : {};
    res.json({ success: true, hours });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set business hours
router.put("/:id/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");

    const [business] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, req.params.id),
          eq(businesses.ownerId, req.user!.id)
        )
      )
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    await db
      .update(businesses)
      .set({ openingHours: JSON.stringify(req.body.hours) })
      .where(eq(businesses.id, req.params.id));

    res.json({ success: true, message: "Horarios actualizados" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
