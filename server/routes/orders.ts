import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, desc, inArray } from "drizzle-orm";
import { sendPushToUser, sendOrderStatusNotification } from "../enhancedPushService";
import { notifyNewOrder } from "../websocket";

import { CONFIG } from "../config";

const router = express.Router();

// TEST ENDPOINT - BORRAR DESPUÉS
router.post("/test-ordertype", authenticateToken, async (req, res) => {
  const { orderType } = req.body;
  return res.json({ 
    received: orderType, 
    type: typeof orderType,
    isPickup: orderType === 'pickup',
    body: req.body 
  });
});

// Get user orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const userOrders = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
        }
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt));

    res.json({ success: true, orders: userOrders });
  } catch (error: any) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [order] = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
          phone: businesses.phone,
          address: businesses.address,
        }
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verify ownership
    if (order.order.userId !== req.user!.id && 
        req.user!.role !== "admin" && 
        req.user!.role !== "delivery_driver") {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Agregar flag si está buscando repartidor
    const searchingDriver = order.order.status === "confirmed" && !order.order.deliveryPersonId;

    res.json({ 
      success: true, 
      order: {
        ...order.order,
        business: order.business,
        searchingDriver,
      }
    });
  } catch (error: any) {
    console.error("Get order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses, products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const {
      businessId, businessName, businessImage,
      items: rawItems, deliveryAddress, deliveryAddressId,
      deliveryLatitude, deliveryLongitude,
      paymentMethod, notes,
      subtotal: clientSubtotal, productosBase, nemyCommission,
      deliveryFee: clientDeliveryFee, total: clientTotal,
      substitutionPreference, itemSubstitutionPreferences,
      cashPaymentAmount, cashChangeAmount,
      couponCode, couponDiscount,
      orderType,
    } = req.body;

    // items puede llegar como array o como string JSON
    const items: any[] = Array.isArray(rawItems)
      ? rawItems
      : (typeof rawItems === "string" ? JSON.parse(rawItems) : []);

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: "Datos del pedido incompletos" });
    }

    // Verify business exists and is active
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(
        eq(businesses.id, businessId),
        eq(businesses.isActive, true)
      ))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    // Verify products exist and calculate total
    const productIds = items.map((item: any) => item.productId || item.product?.id).filter(Boolean);
    const orderProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    let subtotal = 0;
    const validItems = [];

    for (const item of items) {
      const product = orderProducts.find(p => p.id === (item.productId || item.product?.id));
      if (!product || !product.isAvailable) {
        return res.status(400).json({ 
          error: `Producto no disponible: ${item.productId || item.product?.id}` 
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      
      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
        notes: item.notes || null,
      });
    }

    const deliveryFee = orderType === 'pickup' ? 0 : (clientDeliveryFee ?? business.deliveryFee ?? await CONFIG.deliveryFee());
    const finalSubtotal = clientSubtotal ?? subtotal;
    const nemyCommissionCalc = nemyCommission !== undefined && nemyCommission !== null 
      ? nemyCommission 
      : Math.round(finalSubtotal * (await CONFIG.commission()));
    
    // Validar que orderType sea válido y forzar a minúsculas
    const validOrderType: 'pickup' | 'delivery' = 
      typeof orderType === 'string' && orderType.toLowerCase() === 'pickup' 
        ? 'pickup' 
        : 'delivery';
    
    // SIEMPRE usar el total del cliente - NO recalcular
    const total = clientTotal;

    // Create order
    const orderId = crypto.randomUUID();
    const newOrder = {
      id: orderId,
      userId: req.user!.id,
      businessId,
      businessName: businessName || business.name,
      businessImage: businessImage || business.image || "",
      items: JSON.stringify(validItems),
      status: "pending" as const,
      subtotal: finalSubtotal,
      productosBase: productosBase ?? finalSubtotal,
      nemyCommission: nemyCommissionCalc,
      deliveryFee,
      total,
      paymentMethod: paymentMethod || "cash",
      orderType: validOrderType,
      deliveryAddress: deliveryAddress || "",
      deliveryLatitude: deliveryLatitude || null,
      deliveryLongitude: deliveryLongitude || null,
      notes: notes || null,
      substitutionPreference: substitutionPreference || "refund",
      itemSubstitutionPreferences: itemSubstitutionPreferences || null,
      cashPaymentAmount: cashPaymentAmount || null,
      cashChangeAmount: cashChangeAmount || null,
      createdAt: new Date(),
    };

    await db.insert(orders).values(newOrder);

    // Si es pickup, generar código y QR
    if (orderType === 'pickup') {
      const { pickupService } = await import('../pickupService');
      const estimatedMinutes = 20; // Default, el negocio lo ajustará
      await pickupService.createPickupOrder(orderId, estimatedMinutes);
    }

    // Notificar al negocio del nuevo pedido
    if (business.ownerId) {
      await sendPushToUser(business.ownerId, {
        title: "🛒 Nuevo pedido recibido",
        body: `Pedido #${orderId.slice(-6)} — €${(total / 100).toFixed(2)}`,
        data: { orderId, screen: "BusinessOrders" },
      });
    }

    // WebSocket: Notificar en tiempo real
    notifyNewOrder(businessId, { id: orderId, businessName: business.name, total, items: validItems });

    res.json({ 
      success: true,
      orderId,
      order: newOrder
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm order after regret period (notify business)
router.post("/:id/confirm", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });

    await db.update(orders).set({
      status: "accepted",
      confirmedToBusinessAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    // Notificar al cliente que el negocio aceptó
    await sendOrderStatusNotification(req.params.id, order.userId, "accepted");

    res.json({ success: true, message: "Pedido confirmado" });
  } catch (error: any) {
    console.error("Confirm order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel during regret period (no penalty)
router.post("/:id/cancel-regret", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });
    if (order.status !== "pending")
      return res.status(400).json({ error: "Solo se puede cancelar un pedido pendiente" });

    await db.update(orders).set({
      status: "cancelled" as any,
      cancelledAt: new Date(),
      cancelledBy: req.user!.id,
      cancellationReason: "regret_period",
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido cancelado sin penalización" });
  } catch (error: any) {
    console.error("Cancel regret error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status (business owner or admin)
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Estado requerido" });
    }

    const validStatuses = [
      "pending", "accepted", "preparing", "ready",
      "assigned_driver", "picked_up", "on_the_way",
      "in_transit", "arriving", "delivered", "cancelled", "refunded"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const [order] = await db
      .select({
        order: orders,
        business: businesses
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Check permissions
    // El repartidor NO puede poner "delivered" directamente — debe usar /complete-delivery
    const canUpdate = 
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" && order.business?.ownerId === req.user!.id) ||
      (req.user!.role === "delivery_driver" && ["picked_up", "on_the_way", "in_transit", "arriving"].includes(status));

    if (!canUpdate) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(orders.id, req.params.id));

    // Notificaciones según el nuevo estado
    const o = order.order;
    if (status === "preparing") {
      await sendOrderStatusNotification(req.params.id, o.userId, "preparing");
    } else if (status === "ready") {
      await sendOrderStatusNotification(req.params.id, o.userId, "ready");
      // Notificar al repartidor asignado que el pedido está listo para recoger
      if (o.deliveryPersonId) {
        await sendPushToUser(o.deliveryPersonId, {
          title: "📦 Pedido listo para recoger",
          body: `${o.businessName} — Pedido #${o.id.slice(-6)} listo`,
          data: { orderId: o.id, screen: "DriverActiveOrder" },
        });
      }
    } else if (status === "cancelled") {
      await sendOrderStatusNotification(req.params.id, o.userId, "cancelled");
      // Notificar al negocio si cancela el admin o el cliente
      if (order.business?.ownerId) {
        await sendPushToUser(order.business.ownerId, {
          title: "❌ Pedido cancelado",
          body: `Pedido #${o.id.slice(-6)} fue cancelado`,
          data: { orderId: o.id, screen: "BusinessOrders" },
        });
      }
      // Notificar al repartidor si ya estaba asignado
      if (o.deliveryPersonId) {
        await sendPushToUser(o.deliveryPersonId, {
          title: "❌ Pedido cancelado",
          body: `El pedido #${o.id.slice(-6)} fue cancelado`,
          data: { orderId: o.id, screen: "DriverAvailable" },
        });
      }
    }

    res.json({ success: true, message: "Estado actualizado" });
  } catch (error: any) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Tip — solo el cliente del pedido puede enviar propina al repartidor
router.post("/:id/tip", authenticateToken, async (req, res) => {
  try {
    if (req.user!.role !== "customer") {
      return res.status(403).json({ error: "Solo el cliente puede enviar propinas" });
    }

    const { orders, wallets, transactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { amount, deliveryPersonId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Monto de propina inválido" });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id) return res.status(403).json({ error: "No autorizado" });
    if (order.status !== "delivered") return res.status(400).json({ error: "El pedido debe estar entregado" });

    const driverId = deliveryPersonId || order.deliveryPersonId;
    if (!driverId) return res.status(400).json({ error: "No hay repartidor asignado" });

    // Agregar propina a la wallet del repartidor
    const [driverWallet] = await db.select().from(wallets).where(eq(wallets.userId, driverId)).limit(1);
    if (driverWallet) {
      await db.update(wallets).set({
        balance: driverWallet.balance + amount,
        totalEarned: driverWallet.totalEarned + amount,
      }).where(eq(wallets.userId, driverId));
    }

    await db.insert(transactions).values({
      userId: driverId,
      orderId: order.id,
      type: "tip",
      amount,
      description: `Propina del cliente por pedido #${order.id.slice(-6)}`,
      status: "completed",
    });

    res.json({ success: true, message: "Propina enviada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark pickup order as delivered (business owner)
router.post("/:id/mark-picked-up", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    // Solo el dueño del negocio o admin puede marcar como recogido
    const canMark = 
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" && order.business?.ownerId === req.user!.id);

    if (!canMark) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que sea pickup y esté en estado ready
    if (order.order.orderType !== "pickup") {
      return res.status(400).json({ error: "Solo para pedidos de tipo pickup" });
    }

    if (order.order.status !== "ready") {
      return res.status(400).json({ error: "El pedido debe estar en estado 'listo'" });
    }

    // Marcar como entregado
    await db.update(orders).set({
      status: "delivered",
      deliveredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    // Notificar al cliente
    await sendOrderStatusNotification(req.params.id, order.order.userId, "delivered");

    // Liberar fondos (si aplica)
    const { fundReleaseService } = await import("../fundReleaseService");
    await fundReleaseService.releaseOrderFunds(req.params.id);

    res.json({ success: true, message: "Pedido marcado como recogido" });
  } catch (error: any) {
    console.error("Mark picked up error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Complete order (business scans customer QR)
router.put("/:id/complete", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verificar que sea el dueño del negocio o admin
    const canComplete = 
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" && order.business?.ownerId === req.user!.id);

    if (!canComplete) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que el pedido esté en un estado válido para completar
    const validStatuses = ["ready", "picked_up", "on_the_way", "in_transit", "arriving"];
    if (!validStatuses.includes(order.order.status)) {
      return res.status(400).json({ 
        error: `No se puede completar un pedido en estado '${order.order.status}'` 
      });
    }

    // Marcar como entregado y confirmado
    await db.update(orders).set({
      status: "delivered",
      deliveredAt: new Date(),
      confirmedByCustomer: true,
      confirmedByCustomerAt: new Date(),
      fundsReleased: true,
      fundsReleasedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, req.params.id));

    // Notificar al cliente
    await sendOrderStatusNotification(req.params.id, order.order.userId, "delivered");

    // Crear payouts para negocio y repartidor
    try {
      const { createPayoutsForOrder } = await import("../payoutService");
      await createPayoutsForOrder(req.params.id);
    } catch (e: any) {
      console.error(`Error creating payouts for order ${req.params.id}:`, e);
    }

    res.json({ 
      success: true, 
      message: "Pedido completado exitosamente",
      orderId: order.order.id
    });
  } catch (error: any) {
    console.error("Complete order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Check permissions
    const canCancel = 
      order.userId === req.user!.id ||
      req.user!.role === "admin";

    if (!canCancel) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Check if order can be cancelled
    if (!["pending", "confirmed", "accepted"].includes(order.status)) {
      return res.status(400).json({ 
        error: "El pedido no puede ser cancelado en su estado actual" 
      });
    }

    await db
      .update(orders)
      .set({ 
        status: "cancelled",
        updatedAt: new Date()
      })
      .where(eq(orders.id, req.params.id));

    res.json({ success: true, message: "Pedido cancelado" });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
