import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  sendPushToUser,
  sendOrderStatusNotification,
} from "../enhancedPushService";
import { notifyNewOrder } from "../websocket";
import { ISSUE_LABELS } from "@shared/orderIssues";
import { orderRef, orderRefFromId } from "../orderNumberService";

import { CONFIG } from "../config";

const router = express.Router();

// TEST ENDPOINT - BORRAR DESPUÉS
router.post("/test-ordertype", authenticateToken, async (req, res) => {
  const { orderType } = req.body;
  return res.json({
    received: orderType,
    type: typeof orderType,
    isPickup: orderType === "pickup",
    body: req.body,
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
        },
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
    const { orders, businesses, products } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");

    const orderId = req.params.id as string;
    const [order] = await db
      .select({
        order: orders,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
          phone: businesses.phone,
          address: businesses.address,
        },
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verify ownership
    if (
      order.order.userId !== req.user!.id &&
      req.user!.role !== "admin" &&
      req.user!.role !== "delivery_driver"
    ) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Agregar flag si está buscando repartidor
    const searchingDriver =
      order.order.status === "confirmed" && !order.order.deliveryPersonId;

    res.json({
      success: true,
      order: {
        ...order.order,
        business: order.business,
        searchingDriver,
      },
    });
  } catch (error: any) {
    console.error("Get order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses, products } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");

    const {
      businessId,
      businessName,
      businessImage,
      items: rawItems,
      deliveryAddress,
      deliveryAddressId,
      deliveryLatitude,
      deliveryLongitude,
      paymentMethod,
      notes,
      subtotal: clientSubtotal,
      productosBase,
      nemyCommission,
      deliveryFee: clientDeliveryFee,
      total: clientTotal,
      substitutionPreference,
      itemSubstitutionPreferences,
      substituteProductIds,
      cashPaymentAmount,
      cashChangeAmount,
      couponCode,
      couponDiscount,
      orderType,
    } = req.body;

    // items puede llegar como array o como string JSON
    const items: any[] = Array.isArray(rawItems)
      ? rawItems
      : typeof rawItems === "string"
        ? JSON.parse(rawItems)
        : [];

    if (!businessId || !items || items.length === 0) {
      return res.status(400).json({ error: "Datos del pedido incompletos" });
    }

    // Verify business exists and is active
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.isActive, true)))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    // Verify products exist and calculate total
    const productIds = items
      .map((item: any) => item.productId || item.product?.id)
      .filter(Boolean);
    const orderProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    let subtotal = 0;
    const validItems = [];

    for (const item of items) {
      const product = orderProducts.find(
        (p: any) => p.id === (item.productId || item.product?.id),
      );
      if (!product || !product.isAvailable) {
        return res.status(400).json({
          error: `Producto no disponible: ${item.productId || item.product?.id}`,
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

    const deliveryFee =
      orderType === "pickup"
        ? 0
        : (clientDeliveryFee ??
          business.deliveryFee ??
          (await CONFIG.deliveryFee()));
    const finalSubtotal = clientSubtotal ?? subtotal;
    const nemyCommissionCalc =
      nemyCommission !== undefined && nemyCommission !== null
        ? nemyCommission
        : Math.round(finalSubtotal * (await CONFIG.commission()));

    // Validar que orderType sea válido y forzar a minúsculas
    const validOrderType: "pickup" | "delivery" =
      typeof orderType === "string" && orderType.toLowerCase() === "pickup"
        ? "pickup"
        : "delivery";

    // SIEMPRE usar el total del cliente - NO recalcular
    const total = clientTotal;
    // Calcular ganancias del negocio = subtotal base (sin comisión ComeYa ni delivery)
    const businessEarnings = productosBase ?? finalSubtotal;

    // Extraer lat/lng del JSON de deliveryAddress si no vienen como campos separados
    let finalDeliveryLat = deliveryLatitude || null;
    let finalDeliveryLng = deliveryLongitude || null;
    if ((!finalDeliveryLat || !finalDeliveryLng) && deliveryAddress) {
      try {
        const addrObj =
          typeof deliveryAddress === "string"
            ? JSON.parse(deliveryAddress)
            : deliveryAddress;
        if (addrObj?.latitude) finalDeliveryLat = String(addrObj.latitude);
        if (addrObj?.longitude) finalDeliveryLng = String(addrObj.longitude);
      } catch {}
    }

    // Si aún no hay coordenadas, geocodificar (servicio cacheado: una
    // dirección = una llamada a Google para siempre, con rate limit)
    if ((!finalDeliveryLat || !finalDeliveryLng) && deliveryAddress) {
      try {
        const addrText =
          typeof deliveryAddress === "string"
            ? deliveryAddress
            : (deliveryAddress?.street || "") + ", Soria, España";
        const query = addrText.includes("Soria")
          ? addrText
          : addrText + ", Soria, España";
        const { googleMapsService } = await import(
          "../services/googleMapsService"
        );
        const geo = await googleMapsService.geocodeAddress(query);
        if (geo) {
          finalDeliveryLat = String(geo.lat);
          finalDeliveryLng = String(geo.lng);
        }
      } catch {}
    }

    // Create order
    const orderId = crypto.randomUUID();
    // Número secuencial público #CY000001 (reserva atómica)
    const { nextOrderNumber } = await import("../orderNumberService");
    const seqNumber = await nextOrderNumber();
    const newOrder = {
      id: orderId,
      ...(seqNumber != null ? { orderNumber: seqNumber } : {}),
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
      deliveryLatitude: finalDeliveryLat,
      deliveryLongitude: finalDeliveryLng,
      notes: notes || null,
      substitutionPreference: substitutionPreference || "refund",
      itemSubstitutionPreferences: itemSubstitutionPreferences || null,
      substituteProductIds: substituteProductIds || null,
      cashPaymentAmount: cashPaymentAmount || null,
      cashChangeAmount: cashChangeAmount || null,
      businessEarnings: businessEarnings,
    };

    await db.insert(orders).values(newOrder);

    // Si es pickup, generar código y QR
    if (orderType === "pickup") {
      const { pickupService } = await import("../pickupService");
      const estimatedMinutes = 20; // Default, el negocio lo ajustará
      await pickupService.createPickupOrder(orderId, estimatedMinutes);
    }

    // Notificar al negocio del nuevo pedido
    if (business.ownerId) {
      await sendPushToUser(business.ownerId, {
        title: "🛒 Nuevo pedido recibido",
        body: `Pedido ${await orderRefFromId(orderId)} — €${(total / 100).toFixed(2)}`,
        data: { orderId, screen: "BusinessOrders" },
      });
    }

    // WebSocket: Notificar en tiempo real
    notifyNewOrder(businessId, {
      id: orderId,
      businessName: business.name,
      total,
      items: validItems,
    });

    res.json({
      success: true,
      orderId,
      order: newOrder,
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

    const confirmId = req.params.id as string;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, confirmId))
      .limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });

    // Guard: el confirm (fin del período de arrepentimiento) solo aplica en
    // fase temprana. Sin esto, un reintento/tarde del countdown podía resetear
    // un pedido ya en preparación o en camino de vuelta a "accepted".
    const earlyStatuses = ["pending", "confirmed", "accepted"];
    if (!earlyStatuses.includes(order.status)) {
      return res.json({
        success: true,
        message: "El pedido ya avanzó de fase; no se requiere confirmación",
        status: order.status,
      });
    }

    await db
      .update(orders)
      .set({
        status: "accepted",
        confirmedToBusinessAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, confirmId));

    // Notificar al cliente que el negocio aceptó
    await sendOrderStatusNotification(confirmId, order.userId, "accepted");

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

    const regretId = req.params.id as string;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, regretId))
      .limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id && req.user!.role !== "admin")
      return res.status(403).json({ error: "No autorizado" });
    if (order.status !== "pending")
      return res
        .status(400)
        .json({ error: "Solo se puede cancelar un pedido pendiente" });

    await db
      .update(orders)
      .set({
        status: "cancelled" as any,
        cancelledAt: new Date(),
        cancelledBy: req.user!.id,
        cancellationReason: "regret_period",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, regretId));

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
      "pending",
      "accepted",
      "preparing",
      "ready",
      "assigned_driver",
      "picked_up",
      "on_the_way",
      "in_transit",
      "arriving",
      "delivered",
      "cancelled",
      "refunded",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const statusId = req.params.id as string;
    const [order] = await db
      .select({
        order: orders,
        business: businesses,
      })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, statusId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Los pedidos de recogida en local no pasan por estados de reparto:
    // si entraban en el pool de drivers quedaban atascados "en camino".
    const isPickup = order.order.orderType === "pickup";
    if (
      isPickup &&
      [
        "assigned_driver",
        "picked_up",
        "on_the_way",
        "in_transit",
        "arriving",
      ].includes(status)
    ) {
      return res.status(400).json({
        error: "Un pedido de recogida no puede pasar a estados de reparto",
      });
    }

    // Check permissions
    // El repartidor NO puede poner "delivered" directamente — debe usar /complete-delivery
    const canUpdate =
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" &&
        order.business?.ownerId === req.user!.id) ||
      (req.user!.role === "delivery_driver" &&
        ["picked_up", "on_the_way", "in_transit", "arriving"].includes(status));

    if (!canUpdate) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Guardia de pago (misma política que PUT /api/business/orders/:id/status):
    // no se acepta un pedido pendiente cuyo pago no está confirmado, salvo
    // rescate de un pago Stripe confirmado cuyo webhook se perdió. La app
    // nativa acepta las recogidas por esta ruta; sin esta guardia una
    // recogida sin pagar se podía aceptar.
    if (status === "accepted" && order.order.status === "pending") {
      const { paymentStateOf, acceptanceBlockedMessage } = await import(
        "../utils/paymentState"
      );
      let paymentState = await paymentStateOf(order.order);
      if (paymentState === "awaiting_payment") {
        const { rescueStripePayment } = await import(
          "../paymentConfirmationService"
        );
        if (await rescueStripePayment(order.order)) paymentState = "paid";
      }
      const blocked = acceptanceBlockedMessage(paymentState);
      if (blocked) {
        return res.status(400).json({ error: blocked });
      }
    }

    await db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, statusId));

    // Notificaciones según el nuevo estado
    const o = order.order;
    const isPickupOrder = o.orderType === "pickup";
    if (status === "preparing") {
      await sendOrderStatusNotification(statusId, o.userId, "preparing");
    } else if (status === "ready") {
      await sendOrderStatusNotification(statusId, o.userId, "ready");
      // Notificar al repartidor asignado que el pedido está listo para recoger
      if (o.deliveryPersonId) {
        await sendPushToUser(o.deliveryPersonId, {
          title: "📦 Pedido listo para recoger",
          body: `${o.businessName} — Pedido ${orderRef(o)} listo`,
          data: { orderId: o.id, screen: "DriverActiveOrder" },
        });
      } else if (!isPickupOrder) {
        // Si no hay repartidor asignado, notificar a TODOS los drivers online
        // para que sepan que hay un nuevo pedido disponible (estilo Rappi/UberEats)
        try {
          const { DeliveryNotificationService } = await import(
            "../deliveryNotificationService"
          );
          const notified = await DeliveryNotificationService.broadcastToDrivers(
            "🛵 ¡Nuevo pedido disponible!",
            `${o.businessName} — Recoge en ${o.businessName || "negocio"} y gana €${((o.deliveryFee || 0) / 100).toFixed(2)}`,
            { orderId: o.id, screen: "DriverAvailable" },
          );
          console.log(`📢 Broadcast: nuevo pedido ${orderRef(o)} notificado a ${notified} drivers`);
        } catch (err) {
          console.error("Error broadcasting new order to drivers:", err);
        }
      }
    } else if (status === "cancelled") {
      await sendOrderStatusNotification(statusId, o.userId, "cancelled");
      // Notificar al negocio si cancela el admin o el cliente
      if (order.business?.ownerId) {
        await sendPushToUser(order.business.ownerId, {
          title: "❌ Pedido cancelado",
          body: `Pedido ${orderRef(o)} fue cancelado`,
          data: { orderId: o.id, screen: "BusinessOrders" },
        });
      }
      // Notificar al repartidor si ya estaba asignado
      if (o.deliveryPersonId) {
        await sendPushToUser(o.deliveryPersonId, {
          title: "❌ Pedido cancelado",
          body: `El pedido ${orderRef(o)} fue cancelado`,
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
      return res
        .status(403)
        .json({ error: "Solo el cliente puede enviar propinas" });
    }

    const { orders, wallets, transactions } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { amount, deliveryPersonId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Monto de propina inválido" });
    }

    const tipOrderId = req.params.id as string;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, tipOrderId))
      .limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.userId !== req.user!.id)
      return res.status(403).json({ error: "No autorizado" });
    if (order.status !== "delivered")
      return res.status(400).json({ error: "El pedido debe estar entregado" });

    const driverId = deliveryPersonId || order.deliveryPersonId;
    if (!driverId)
      return res.status(400).json({ error: "No hay repartidor asignado" });

    // Agregar propina a la wallet del repartidor
    const [driverWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, driverId))
      .limit(1);
    if (driverWallet) {
      await db
        .update(wallets)
        .set({
          balance: driverWallet.balance + amount,
          totalEarned: driverWallet.totalEarned + amount,
        })
        .where(eq(wallets.userId, driverId));
    }

    await db.insert(transactions).values({
      userId: driverId,
      orderId: tipOrderId,
      type: "tip",
      amount,
      description: `Propina del cliente por pedido ${await orderRefFromId(tipOrderId)}`,
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

    const pickupId = req.params.id as string;
    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, pickupId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    // Solo el dueño del negocio o admin puede marcar como recogido
    const canMark =
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" &&
        order.business?.ownerId === req.user!.id);

    if (!canMark) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que sea pickup y esté en estado ready
    if (order.order.orderType !== "pickup") {
      return res
        .status(400)
        .json({ error: "Solo para pedidos de tipo pickup" });
    }

    // Recuperación: si una recogida quedó atascada en un estado de reparto
    // (builds antiguos metían el pedido en el pool de drivers), permitir
    // completarla igualmente.
    const pickupTerminalStatuses = ["ready", "on_the_way", "picked_up"];
    if (!pickupTerminalStatuses.includes(order.order.status)) {
      return res
        .status(400)
        .json({ error: "El pedido debe estar en estado 'listo'" });
    }

    // SEGURIDAD: solo se cierra la recogida con el código de 6 dígitos que
    // tiene el cliente (escrito o escaneado de su QR). Sin él, el dueño del
    // negocio podría cerrar pedidos sin que el cliente los reciba.
    const { code } = req.body;
    if (typeof code !== "string" || code.trim().length !== 6) {
      return res
        .status(400)
        .json({ error: "Código de recogida requerido (6 dígitos)" });
    }

    const { pickupService } = await import("../pickupService");
    // Pedidos antiguos sin código: regenerarlo para poder validar
    await pickupService.ensurePickupCodes(order.order as any);
    const codeValid = await pickupService.validatePickupCode(
      pickupId,
      code.trim(),
    );
    if (!codeValid) {
      return res.status(400).json({ error: "Código de recogida inválido" });
    }

    // Marcar como entregado. La validación del código/QR del cliente YA es
    // la confirmación de recepción: el pedido pasa directo al historial del
    // cliente como completado, sin pedirle confirmar de nuevo.
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        confirmedByCustomer: true,
        confirmedByCustomerAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, pickupId));

    // Notificar al cliente SIN pedir la reseña: el prompt inmediato de
    // valoración tras el QR crasheaba la app. La invitación a valorar llega
    // 1 hora después (notificación local programada por el cliente al
    // recibir este push y abrir el pedido).
    await sendPushToUser(order.order.userId, {
      title: "🛍️ ¡Pedido recogido!",
      body: `Gracias por recoger tu pedido en ${order.business?.name || order.order.businessName || "el negocio"}. ¡Que lo disfrutes!`,
      data: {
        orderId: pickupId,
        screen: "OrderTracking",
        reviewDelayMs: 60 * 60 * 1000, // el cliente programa el recordatorio
      },
    });

    // Liberar fondos (si aplica)
    const { fundReleaseService } = await import("../fundReleaseService");
    await fundReleaseService.releaseOrderFunds(pickupId);

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

    const completeId = req.params.id as string;
    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, completeId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Verificar que sea el dueño del negocio o admin
    const canComplete =
      req.user!.role === "admin" ||
      (req.user!.role === "business_owner" &&
        order.business?.ownerId === req.user!.id);

    if (!canComplete) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Verificar que el pedido esté en un estado válido para completar
    const validStatuses = [
      "ready",
      "picked_up",
      "on_the_way",
      "in_transit",
      "arriving",
    ];
    if (!validStatuses.includes(order.order.status)) {
      return res.status(400).json({
        error: `No se puede completar un pedido en estado '${order.order.status}'`,
      });
    }

    // Marcar como entregado y confirmado
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        confirmedByCustomer: true,
        confirmedByCustomerAt: new Date(),
        fundsReleased: true,
        fundsReleasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, completeId));

    // Notificar al cliente
    await sendOrderStatusNotification(
      completeId,
      order.order.userId,
      "delivered",
    );

    // Crear payouts para negocio y repartidor
    try {
      const { createPayoutsForOrder } = await import("../payoutService");
      await createPayoutsForOrder(completeId);
    } catch (e: any) {
      console.error(`Error creating payouts for order ${req.params.id}:`, e);
    }

    res.json({
      success: true,
      message: "Pedido completado exitosamente",
      orderId: order.order.id,
    });
  } catch (error: any) {
    console.error("Complete order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { cancelOrder } = await import("../orderCancellationService");

    const cancelId = req.params.id as string;
    const isAdmin =
      req.user!.role === "admin" || req.user!.role === "super_admin";

    const result = await cancelOrder(
      cancelId,
      req.user!.id,
      req.body?.reason || "Cancelado por el usuario",
      {
        actorRole: isAdmin ? (req.user!.role as any) : undefined,
        refundOverride: isAdmin ? req.body?.refundAmount : undefined,
        liableParty: isAdmin ? req.body?.liableParty : undefined,
      },
    );

    if (!result.success) {
      const code =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
            ? 403
            : 400;
      return res.status(code).json({ error: result.message });
    }

    res.json({
      success: true,
      message: "Pedido cancelado",
      refund: result.refund,
      policy: result.policy,
    });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reportar problema en un pedido — crea la incidencia, su hilo de mensajes
// y notifica a admins y negocio.
router.post("/:id/report-issue", authenticateToken, async (req, res) => {
  try {
    const { orders, orderIssues, supportTickets, ticketMessages } =
      await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { randomUUID } = await import("crypto");

    const { issueType, description, priority, photos, affectedItems } = req.body;
    if (!issueType || !description) {
      return res
        .status(400)
        .json({ error: "Tipo de problema y descripción son obligatorios" });
    }

    const issueOrderId = req.params.id as string;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, issueOrderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    // El cliente solo reporta sobre sus pedidos; el negocio solo sobre los suyos
    const role = req.user!.role;
    if (role === "customer" && order.userId !== req.user!.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (role === "delivery_driver" && order.deliveryPersonId !== req.user!.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (role === "business_owner") {
      const { businesses } = await import("@shared/schema-mysql");
      const [biz] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      if (biz?.ownerId !== req.user!.id) {
        return res.status(403).json({ error: "No autorizado" });
      }
    }

    const photoList: string[] = Array.isArray(photos)
      ? photos.filter((p: any) => typeof p === "string" && p.length > 0)
      : [];

    // Ticket que aloja la conversación con el cliente
    const ticketId = randomUUID();
    const subject = `[Pedido ${orderRef(order)}] ${ISSUE_LABELS[issueType] || issueType}`.slice(
      0,
      255,
    );
    await db.insert(supportTickets).values({
      id: ticketId,
      userId: req.user!.id,
      orderId: issueOrderId,
      subject,
      category: "order_issue",
      priority: priority || "medium",
      status: "open",
    });

    // El texto completo va al hilo, no truncado en el asunto
    await db.insert(ticketMessages).values({
      ticketId,
      senderId: req.user!.id,
      senderType: "user",
      message: description,
    });

    const issueId = randomUUID();
    await db.insert(orderIssues).values({
      id: issueId,
      orderId: issueOrderId,
      ticketId,
      reportedBy: req.user!.id,
      reporterRole: role,
      issueType,
      description,
      photos: photoList.length > 0 ? JSON.stringify(photoList) : null,
      affectedItems: affectedItems ? JSON.stringify(affectedItems) : null,
      status: "open",
      priority: priority || "medium",
    });

    // Notificar a los administradores (sin romper la respuesta si falla la red)
    const { users, businesses } = await import("@shared/schema-mysql");
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role, ["admin", "super_admin"]));
    try {
      for (const admin of admins) {
        await sendPushToUser(admin.id, {
          title: "⚠️ Incidencia reportada",
          body: `Pedido ${orderRef(order)}: ${ISSUE_LABELS[issueType] || issueType}`,
          data: {
            type: "order_issue",
            issueId,
            orderId: issueOrderId,
            screen: "AdminDashboard",
            section: "support_issues",
          },
        });
      }
    } catch (err) {
      console.error("Error notifying admins of issue:", err);
    }

    // Aviso en tiempo real al panel admin abierto
    try {
      const { notifyAdminNewIssue } = await import("../websocket");
      notifyAdminNewIssue({
        issueId,
        orderId: issueOrderId,
        issueType,
        priority: priority || "medium",
      });
    } catch (err) {
      console.error("Error emitting admin issue event:", err);
    }

    // Notificar también al negocio del pedido
    try {
      const [biz] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      if (biz?.ownerId && biz.ownerId !== req.user!.id) {
        await sendPushToUser(biz.ownerId, {
          title: "⚠️ Incidencia en tu pedido",
          body: `Pedido ${orderRef(order)}: ${ISSUE_LABELS[issueType] || issueType}`,
          data: {
            orderId: issueOrderId,
            screen: "BusinessOrders",
            type: "order_issue",
          },
        });
      }
    } catch (err) {
      console.error("Error notifying business of issue:", err);
    }

    res.json({
      success: true,
      message: "Problema reportado. Nuestro equipo lo revisará en breve.",
      issueId,
      ticketId,
    });
  } catch (error: any) {
    console.error("Report issue error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Incidencias de un pedido — visibles para quien la reportó, el negocio y admins
router.get("/:id/issues", authenticateToken, async (req, res) => {
  try {
    const { orders, orderIssues, refunds } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");

    const orderId = req.params.id as string;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const isAdmin =
      req.user!.role === "admin" || req.user!.role === "super_admin";
    if (!isAdmin && order.userId !== req.user!.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const issues = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.orderId, orderId))
      .orderBy(desc(orderIssues.createdAt));

    const orderRefunds = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt));

    res.json({
      success: true,
      issues: issues.map((i: any) => ({
        ...i,
        photos: i.photos ? JSON.parse(i.photos) : [],
        affectedItems: i.affectedItems ? JSON.parse(i.affectedItems) : null,
        // La nota interna no sale del panel admin
        internalNote: isAdmin ? i.internalNote : undefined,
      })),
      refunds: orderRefunds,
    });
  } catch (error: any) {
    console.error("Get order issues error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
