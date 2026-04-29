import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, inArray } from "drizzle-orm";
import { sendOrderStatusNotification } from "../enhancedPushService";

const router = express.Router();

// GET /api/delivery/config — redirige a deliveryConfigRoutes
// (el PUT /config está en deliveryConfigRoutes.ts con la lógica de tramos)
router.get("/config", (req, res) => {
  res.json({
    success: true,
    config: { tier1: 2.50, tier2: 4.00, tier3: 5.00, extraPerKm: 1.00 },
  });
});

// Get delivery zones (public)
router.get("/zones", async (req, res) => {
  try {
    const zones = [
      {
        id: "zone-centro",
        name: "Centro",
        description: "Centro de San Cristóbal",
        deliveryFee: 2500,
        maxDeliveryTime: 30,
        isActive: true,
        centerLatitude: "20.6736",
        centerLongitude: "-104.3647",
        radiusKm: 3,
      },
      {
        id: "zone-norte",
        name: "Norte", 
        description: "Zona Norte de San Cristóbal",
        deliveryFee: 3000,
        maxDeliveryTime: 35,
        isActive: true,
        centerLatitude: "20.6800",
        centerLongitude: "-104.3647",
        radiusKm: 4,
      },
      {
        id: "zone-sur",
        name: "Sur",
        description: "Zona Sur de San Cristóbal", 
        deliveryFee: 3000,
        maxDeliveryTime: 35,
        isActive: true,
        centerLatitude: "20.6672",
        centerLongitude: "-104.3647",
        radiusKm: 4,
      },
    ];

    res.json({ success: true, zones });
  } catch (error: any) {
    console.error("Get zones error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get available drivers (admin only)
router.get("/drivers", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const drivers = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(
        eq(users.role, "delivery_driver"),
        eq(users.isActive, true)
      ));

    res.json({ success: true, drivers });
  } catch (error: any) {
    console.error("Get drivers error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver orders
router.get("/orders", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const driverOrders = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          address: businesses.address,
          phone: businesses.phone,
        }
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.driverId, req.user!.id));

    res.json({ success: true, orders: driverOrders });
  } catch (error: any) {
    console.error("Get driver orders error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Assign driver to order (admin only)
router.post("/assign", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orderId, driverId } = req.body;
    
    if (!orderId || !driverId) {
      return res.status(400).json({ error: "ID de pedido y conductor requeridos" });
    }

    const { orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    // Verify order exists
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verify driver exists and is active
    const [driver] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, driverId),
        eq(users.role, "delivery_driver"),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!driver) {
      return res.status(404).json({ error: "Conductor no encontrado" });
    }

    // Assign driver
    await db
      .update(orders)
      .set({ 
        driverId,
        status: "picked_up",
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));

    res.json({ success: true, message: "Conductor asignado" });
  } catch (error: any) {
    console.error("Assign driver error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update delivery status
router.patch("/orders/:id/status", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { status, deliveryProofPhoto, latitude, longitude } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Estado requerido" });
    }

    const validStatuses = ["picked_up", "on_the_way", "delivered"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const { orders, deliveryProofs } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { CloudinaryService } = await import("../cloudinaryService");
    
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.driverId !== req.user!.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Si es delivered, subir foto de prueba a Cloudinary
    let photoUrl = null;
    if (status === "delivered" && deliveryProofPhoto) {
      if (deliveryProofPhoto.startsWith('data:image/')) {
        photoUrl = await CloudinaryService.uploadImage(deliveryProofPhoto, 'delivery-proofs', `delivery-${req.params.id}`);
      } else {
        photoUrl = deliveryProofPhoto;
      }

      // Crear registro de delivery proof
      await db.insert(deliveryProofs).values({
        id: crypto.randomUUID(),
        orderId: req.params.id,
        driverId: req.user!.id,
        photoUrl,
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        timestamp: new Date(),
      });
    }

    await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date(),
        ...(status === "delivered" && { 
          deliveredAt: new Date(),
          deliveryProofPhoto: photoUrl,
          deliveryProofPhotoTimestamp: new Date(),
        })
      })
      .where(eq(orders.id, req.params.id));

    // Notificar al cliente del cambio de estado
    if (["picked_up", "on_the_way", "arriving", "delivered"].includes(status)) {
      await sendOrderStatusNotification(req.params.id, order.userId, status);
    }

    res.json({ success: true, message: "Estado actualizado", photoUrl });
  } catch (error: any) {
    console.error("Update delivery status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver location for an order (public - customers need to track their orders)
router.get("/location/:orderId", async (req, res) => {
  try {
    const { orders, deliveryDrivers, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    if (!order.deliveryPersonId) {
      return res.json({ success: true, location: null, driver: null });
    }

    const [driver] = await db
      .select({
        id: deliveryDrivers.id,
        currentLatitude: deliveryDrivers.currentLatitude,
        currentLongitude: deliveryDrivers.currentLongitude,
        lastLocationUpdate: deliveryDrivers.lastLocationUpdate,
      })
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);

    const [driverUser] = await db
      .select({ name: users.name, phone: users.phone, profileImage: users.profileImage })
      .from(users)
      .where(eq(users.id, order.deliveryPersonId))
      .limit(1);

    res.json({
      success: true,
      location: driver ? {
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        updatedAt: driver.lastLocationUpdate,
      } : null,
      driver: driverUser || null,
      orderStatus: order.status,
    });
  } catch (error: any) {
    console.error("Get driver location error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/delivery/active-order — pedido activo del repartidor (para el mapa)
router.get("/active-order", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { inArray } = await import("drizzle-orm");

    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, req.user!.id),
          inArray(orders.status, ["picked_up", "on_the_way", "ready"])
        )
      )
      .limit(1);

    if (!activeOrders.length) {
      return res.json({ success: true, order: null });
    }

    const order = activeOrders[0];
    const [biz] = await db
      .select({ name: businesses.name, address: businesses.address })
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        businessName: biz?.name ?? order.businessName ?? "Negocio",
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver stats
router.get("/stats", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    // Get all orders for this driver using deliveryPersonId
    const driverOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPersonId, req.user!.id));

    console.log(`📊 Driver ${req.user!.id} stats:`);
    console.log(`   Total orders: ${driverOrders.length}`);
    console.log(`   Orders:`, driverOrders.map(o => ({
      id: o.id,
      status: o.status,
      deliveryFee: o.deliveryFee,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt
    })));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    console.log(`   Today: ${today.toISOString()}`);
    console.log(`   This week: ${thisWeek.toISOString()}`);
    console.log(`   This month: ${thisMonth.toISOString()}`);

    const todayOrders = driverOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    const weekOrders = driverOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= thisWeek;
    });

    const monthOrders = driverOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= thisMonth;
    });

    console.log(`   Today orders: ${todayOrders.length}`);
    console.log(`   Week orders: ${weekOrders.length}`);
    console.log(`   Month orders: ${monthOrders.length}`);

    const deliveredOrders = driverOrders.filter(o => o.status === "delivered" || o.status === "completed");
    
    // Calculate earnings
    const todayEarnings = todayOrders
      .filter(o => o.status === "delivered" || o.status === "completed")
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    
    const weekEarnings = weekOrders
      .filter(o => o.status === "delivered" || o.status === "completed")
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    
    const monthEarnings = monthOrders
      .filter(o => o.status === "delivered" || o.status === "completed")
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    
    const totalEarnings = deliveredOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    console.log(`   Today earnings: $${todayEarnings / 100}`);
    console.log(`   Week earnings: $${weekEarnings / 100}`);
    console.log(`   Month earnings: $${monthEarnings / 100}`);
    console.log(`   Total earnings: $${totalEarnings / 100}`);

    // Calculate average delivery time (in minutes)
    const completedWithTimes = deliveredOrders.filter(o => o.deliveredAt && o.createdAt);
    const avgDeliveryTime = completedWithTimes.length > 0
      ? Math.round(
          completedWithTimes.reduce((sum, o) => {
            const diff = new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime();
            return sum + diff / (1000 * 60); // Convert to minutes
          }, 0) / completedWithTimes.length
        )
      : 0;

    // Calculate completion rate
    const totalOrders = driverOrders.length;
    const completionRate = totalOrders > 0
      ? Math.round((deliveredOrders.length / totalOrders) * 100)
      : 100;

    res.json({
      success: true,
      stats: {
        totalDeliveries: deliveredOrders.length,
        rating: 5.0, // TODO: Implement rating system
        completionRate,
        avgDeliveryTime,
        todayEarnings,
        weekEarnings,
        monthEarnings,
        totalEarnings,
      },
    });
  } catch (error: any) {
    console.error("Get driver stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;