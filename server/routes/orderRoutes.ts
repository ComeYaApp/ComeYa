import express from "express";
import { authenticateToken, requireRole, auditAction } from "../authMiddleware";
import { 
  validateOrderFinancials, 
  validateOrderCompletion 
} from "../financialMiddleware";
import {
  validateDriverOrderOwnership,
  validateCustomerOrderOwnership,
} from "../validateOwnership";
import { calculateDistance, calculateDeliveryFee, estimateDeliveryTime } from "../utils/distance";
import { getDeliveryConfig } from "../services/deliveryConfigService";
import { sendPushToUser, sendOrderStatusNotification } from "../enhancedPushService";
import { LoyaltyService } from "../loyaltyService";

const router = express.Router();

// Calculate delivery fee based on distance
router.post("/calculate-delivery", authenticateToken, async (req, res) => {
  try {
    const { businessLat, businessLng, deliveryLat, deliveryLng } = req.body;
    
    if (!businessLat || !businessLng || !deliveryLat || !deliveryLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    const distance = calculateDistance(businessLat, businessLng, deliveryLat, deliveryLng);
    const deliveryFee = await calculateDeliveryFee(distance);
    const estimatedTime = estimateDeliveryTime(distance);

    res.json({
      success: true,
      distance: Math.round(distance * 100) / 100,
      deliveryFee,
      estimatedTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, validateOrderFinancials, async (req, res) => {
  try {
    const { orders, businesses, addresses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    // Calculate dynamic delivery fee if coordinates provided
    let deliveryFee = req.body.deliveryFee;
    let estimatedDeliveryTime = req.body.estimatedDeliveryTime;

    if (req.body.deliveryAddressId && req.body.businessId) {
      const [business] = await db.select().from(businesses).where(eq(businesses.id, req.body.businessId)).limit(1);
      const [address] = await db.select().from(addresses).where(eq(addresses.id, req.body.deliveryAddressId)).limit(1);

      if (business && address && business.latitude && business.longitude && address.latitude && address.longitude) {
        const distance = calculateDistance(
          business.latitude,
          business.longitude,
          address.latitude,
          address.longitude
        );
        deliveryFee = await calculateDeliveryFee(distance);
        estimatedDeliveryTime = estimateDeliveryTime(distance, business.prepTime || 20);
      } else {
        // Sin coordenadas — usar tarifa mínima (250 centavos = €2.50)
        deliveryFee = Math.max(deliveryFee || 0, 250);
      }
    }

    // El subtotal que viene del frontend YA incluye la comisión del 15%
    // No necesitamos calcular productosBase ni nemyCommission por separado
    const subtotal = req.body.subtotal; // Productos con comisión incluida
    const couponDiscount = req.body.couponDiscount || 0;

    // Aplicar beneficios de suscripcion Premium/Business
    const { SubscriptionService } = await import('../subscriptionService');
    const rawDeliveryFee = req.body.orderType === 'pickup' ? 0 : (deliveryFee || 0);
    const subBenefits = await SubscriptionService.applySubscriptionBenefits(
      req.user!.id,
      req.body.subtotal || 0,
      rawDeliveryFee
    );
    const subDiscount = subBenefits.discount;
    const subDeliveryFee = subBenefits.deliveryFee;
    
    // Para pickup, deliveryFee = 0
    const finalDeliveryFee = req.body.orderType === 'pickup' ? 0 : subDeliveryFee;
    
    // Total = subtotal (ya con comisión) + delivery - descuentos
    const calculatedTotal = Math.max(0, subtotal + finalDeliveryFee - couponDiscount - subDiscount);

    const orderData = {
      userId: req.user!.id,
      businessId: req.body.businessId,
      businessName: req.body.businessName,
      businessImage: req.body.businessImage,
      items: req.body.items,
      status: req.body.status || "pending",
      subtotal: subtotal,
      productosBase: req.body.productosBase || null,
      nemyCommission: req.body.nemyCommission || null,
      deliveryFee: finalDeliveryFee,
      total: calculatedTotal,
      paymentMethod: req.body.paymentMethod,
      orderType: req.body.orderType === 'pickup' ? 'pickup' : 'delivery',
      deliveryAddress: req.body.deliveryAddress,
      notes: req.body.notes,
      substitutionPreference: req.body.substitutionPreference,
      itemSubstitutionPreferences: req.body.itemSubstitutionPreferences,
      cashPaymentAmount: req.body.cashPaymentAmount,
      cashChangeAmount: req.body.cashChangeAmount,
      estimatedDeliveryTime,
    };

    await db.insert(orders).values(orderData);
    
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    
    const orderId = createdOrder[0].id;
    res.json({ 
      success: true, 
      id: orderId, 
      orderId, 
      order: { id: orderId },
      deliveryFee,
      estimatedDeliveryTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, inArray } = await import("drizzle-orm");

    let userOrders;
    
    // Filtro por status si se proporciona
    if (req.query.status === 'active') {
      // Pedidos activos = pending, confirmed, preparing, ready, on_the_way
      userOrders = await db
        .select()
        .from(orders)
        .where(
          eq(orders.userId, req.user!.id)
        );
// Filtrar en memoria para incluir solo estados activos
      userOrders = userOrders.filter((o: { status: string }) => 
        ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(o.status)
      );
    } else {
      userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, req.user!.id));
    }
    
    res.json({ success: true, orders: userOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID — accesible por cliente, repartidor asignado y admin
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { orders, users, deliveryDrivers } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, sql } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Get order base data
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { id: userId, role } = req.user!;
    const isCustomer = order.userId === userId;
    const isDriver = order.deliveryPersonId === userId;
    const isAdmin = role === "admin" || role === "super_admin";

    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Get driver info if assigned - join with delivery_drivers and users tables
    let driverInfo = null;
    if (order.deliveryPersonId) {
      try {
const [driverData] = await db
          .select({
            id: users.id,
            name: users.name,
            phone: users.phone,
            profileImage: users.profileImage,
            vehicleType: deliveryDrivers.vehicleType,
            vehiclePlate: deliveryDrivers.vehiclePlate,
            vehicleBrand: deliveryDrivers.vehicleBrand,
            vehicleModel: deliveryDrivers.vehicleModel,
            vehicleColor: deliveryDrivers.vehicleColor,
            vehiclePhoto: deliveryDrivers.vehiclePhoto,
          })
          .from(users)
          .leftJoin(deliveryDrivers, eq(users.id, deliveryDrivers.userId))
          .where(eq(users.id, order.deliveryPersonId))
          .limit(1);

if (driverData) {
          driverInfo = {
            id: driverData.id,
            name: driverData.name,
            phone: driverData.phone,
            profilePhoto: driverData.profileImage,
            vehicleType: driverData.vehicleType,
            vehiclePlate: driverData.vehiclePlate,
            vehicleBrand: driverData.vehicleBrand,
            vehicleModel: driverData.vehicleModel,
            vehicleColor: driverData.vehicleColor,
            vehiclePhoto: driverData.vehiclePhoto,
          };
        }
      } catch (err) {
        console.error("Error fetching driver info:", err);
      }
    }

    // Return order with driver info included
    res.json({ 
      success: true, 
      order: {
        ...order,
        driverInfo
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign driver automatically
router.post("/:id/assign-driver", authenticateToken, async (req, res) => {
  try {
    const { orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const availableDrivers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "delivery_driver"),
          eq(users.isActive, true)
        )
      )
      .limit(10);

    if (availableDrivers.length === 0) {
      return res.json({ success: false, message: "No hay repartidores disponibles" });
    }

    const driver = availableDrivers[0];

    await db
      .update(orders)
      .set({
        deliveryPersonId: driver.id,
        status: "picked_up",
      })
      .where(eq(orders.id, orderId));

    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order during regret period
router.post("/:id/cancel-regret", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ error: "Solo se pueden cancelar pedidos pendientes" });
    }

    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));

    res.json({ success: true, message: "Pedido cancelado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm order after regret period (notifies business but stays pending)
router.post("/:id/confirm", authenticateToken, validateCustomerOrderOwnership, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Mark regret period as confirmed (customer won't cancel)
    await db.update(orders).set({ 
      regretPeriodConfirmed: true,
      regretPeriodConfirmedAt: new Date(),
      confirmedToBusinessAt: new Date()
    }).where(eq(orders.id, orderId));

    // TODO: Send notification to business

    res.json({ success: true, message: "Pedido confirmado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete delivery and release funds
router.post(
  "/:id/complete-delivery",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { calculateDistance } = await import("../utils/distance");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Enforce proximity check (100m) before allowing delivery completion
      const driverLat = req.body.latitude ?? req.body.lat;
      const driverLng = req.body.longitude ?? req.body.lng;
      const hasDriverCoords =
        typeof driverLat === "number" && typeof driverLng === "number";

      if (process.env.NODE_ENV === "production") {
        if (!hasDriverCoords) {
          return res.status(400).json({ error: "Ubicación requerida para marcar entregado" });
        }

        const deliveryLat = order.deliveryLatitude ?? order.deliveryLat ?? order.latitude;
        const deliveryLng = order.deliveryLongitude ?? order.deliveryLng ?? order.longitude;
        const hasDeliveryCoords =
          typeof deliveryLat === "number" && typeof deliveryLng === "number";

        if (hasDeliveryCoords) {
          const distanceKm = calculateDistance(
            Number(driverLat),
            Number(driverLng),
            Number(deliveryLat),
            Number(deliveryLng),
          );
          const maxDistanceMeters = 200;
          if (distanceKm * 1000 > maxDistanceMeters) {
            return res.status(400).json({
              error: "Debes estar más cerca del cliente para marcar entregado",
              distanceMeters: Math.round(distanceKm * 1000),
              maxDistanceMeters,
            });
          }
        }
      }

      // Mark as delivered (waiting for customer confirmation)
      await db
        .update(orders)
        .set({ 
          status: "delivered", 
          deliveredAt: new Date(),
          driverArrivedAt: new Date() 
        })
        .where(eq(orders.id, orderId));

      // Subir foto de entrega a Cloudinary si se proporcionó
      if (req.body.deliveryPhoto) {
        try {
          const { CloudinaryService } = await import("../cloudinaryService");
          const { deliveryProofs } = await import("@shared/schema-mysql");
          const photoUrl = await CloudinaryService.uploadImage(
            req.body.deliveryPhoto,
            "delivery-proofs",
            `proof-${orderId}-${Date.now()}`
          );
          await db.insert(deliveryProofs).values({
            id: crypto.randomUUID(),
            orderId,
            driverId: req.user!.id,
            photoUrl,
            latitude: driverLat ? String(driverLat) : "0",
            longitude: driverLng ? String(driverLng) : "0",
            timestamp: new Date(),
          });
          await db.update(orders).set({ deliveryProofPhoto: photoUrl }).where(eq(orders.id, orderId));
        } catch (photoErr) {
          console.error("Error uploading delivery photo:", photoErr);
          // No bloqueamos la entrega si falla la foto
        }
      }

      // Notificar al cliente que su pedido fue entregado
      await sendOrderStatusNotification(orderId, order.userId, "delivered");

      res.json({
        success: true,
        message: "Pedido marcado como entregado. Esperando confirmación del cliente.",
      });
    } catch (error: any) {
      console.error("Complete delivery error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Customer confirms receipt and releases funds — SOLO el cliente
router.post(
  "/:id/confirm-receipt",
  authenticateToken,
  validateCustomerOrderOwnership,
  validateOrderCompletion,
  async (req, res) => {
    try {
      // Bloqueo explícito: solo el rol customer puede confirmar recepción
      if (req.user!.role !== "customer" && req.user!.role !== "admin" && req.user!.role !== "super_admin") {
        return res.status(403).json({ error: "Solo el cliente puede confirmar la recepción del pedido" });
      }
      const { orders, businesses, payouts } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== "delivered") return res.status(400).json({ error: "El pedido debe estar entregado primero" });
      if (order.confirmedByCustomer) return res.status(400).json({ error: "Ya confirmaste este pedido" });

      // Award loyalty points
      try {
        await LoyaltyService.awardPointsForOrder(order.userId, order.id, order.total);
      } catch (e) {
        console.error("Error awarding loyalty points:", e);
      }

      // Calcular ganancias en Bs. directos
      const productosBase = order.productosBase && order.productosBase > 0
        ? order.productosBase
        : Math.round((order.subtotal || order.total) / 1.15);
      const businessAmount = productosBase;
      const driverAmount = order.deliveryFee || 0;
      const platformAmount = order.nemyCommission || Math.round(productosBase * 0.15);

      // Marcar pedido como confirmado
      await db.update(orders).set({
        confirmedByCustomer: true,
        confirmedByCustomerAt: new Date(),
        fundsReleased: true,
        fundsReleasedAt: new Date(),
        platformFee: platformAmount,
        businessEarnings: businessAmount,
        deliveryEarnings: driverAmount,
      }).where(eq(orders.id, orderId));

      // Crear payouts
      const [business] = await db.select({ ownerId: businesses.ownerId })
        .from(businesses).where(eq(businesses.id, order.businessId)).limit(1);
      const businessOwnerId = business?.ownerId || order.businessId;

      const payoutInserts: any[] = [];
      if (businessAmount > 0) {
        payoutInserts.push({
          orderId: order.id,
          recipientId: businessOwnerId,
          recipientType: "business" as const,
          amount: businessAmount,
          status: "pending" as const,
        });
      }
      if (order.deliveryPersonId && driverAmount > 0) {
        payoutInserts.push({
          orderId: order.id,
          recipientId: order.deliveryPersonId,
          recipientType: "driver" as const,
          amount: driverAmount,
          status: "pending" as const,
        });
      }
      if (payoutInserts.length > 0) {
        await db.insert(payouts).values(payoutInserts);
      }

      res.json({ success: true, message: "Pedido confirmado. Payouts creados para negocio y repartidor." });

      // Notificaciones push
      if (businessOwnerId) {
        await sendPushToUser(businessOwnerId, {
          title: "💰 Pago liberado",
          body: `El cliente confirmó la entrega del pedido #${order.id.slice(-6)}`,
          data: { orderId: order.id, screen: "BusinessEarnings" },
        });
      }
      if (order.deliveryPersonId) {
        await sendPushToUser(order.deliveryPersonId, {
          title: "💰 Pago liberado",
          body: `Pedido #${order.id.slice(-6)} confirmado. Tu pago está disponible.`,
          data: { orderId: order.id, screen: "DriverEarnings" },
        });
      }
    } catch (error: any) {
      console.error("Confirm receipt error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// NEW: Driver picks up order from business
router.post(
  "/:id/pickup",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }

      // Validar que el pedido está listo para recoger
      if (![ "ready", "picked_up", "preparing" ].includes(order.status)) {
        return res.status(400).json({ 
          error: `No puedes recoger este pedido. Estado actual: ${order.status}` 
        });
      }

      // Validar que el repartidor está asignado a este pedido
      if (order.deliveryPersonId !== req.user!.id) {
        return res.status(403).json({ error: "Este pedido no está asignado a ti" });
      }

      // Cambiar estado a on_the_way y registrar timestamp
      await db
        .update(orders)
        .set({ 
          status: "on_the_way",
          driverPickedUpAt: new Date()
        })
        .where(eq(orders.id, orderId));

      // Notificar al cliente que el repartidor recogió y va en camino
      await sendOrderStatusNotification(orderId, order.userId, "picked_up");

      res.json({
        success: true,
        message: "Pedido recogido. Ahora en camino al cliente.",
        order: {
          id: order.id,
          status: "on_the_way",
          driverPickedUpAt: new Date()
        }
      });
    } catch (error: any) {
      console.error("Pickup order error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
