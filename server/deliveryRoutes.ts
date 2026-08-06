import { Router } from "express";
import { db } from "./db";
import { deliveryDrivers, users, orders, wallets } from "@shared/schema-mysql";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { authenticateToken } from "./authMiddleware";
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from "./errors";
import { logger } from "./logger";
import { calculateDistance } from "./utils/distance";

const router = Router();
const DELIVERY_RADIUS_KM = 0.2; // 200 metros

router.post(
  "/register",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { userId, vehicleType, vehiclePlate } = req.body;

    if (!vehicleType || !vehiclePlate) {
      throw new ValidationError("Vehicle type and plate are required");
    }

    if (!["bike", "motorcycle", "car"].includes(vehicleType)) {
      throw new ValidationError("Invalid vehicle type");
    }

    const [existing] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);
    if (existing) {
      await db
        .update(deliveryDrivers)
        .set({
          vehicleType,
          vehiclePlate: vehiclePlate.toUpperCase(),
        })
        .where(eq(deliveryDrivers.userId, userId));
    } else {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType,
        vehiclePlate: vehiclePlate.toUpperCase(),
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    const [existingWallet] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!existingWallet) {
      await db.insert(wallets).values({
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
    }

    logger.delivery("Driver registered", { userId, driverId: driver.id });

    res.json({ driver, message: "Driver registered" });
  }),
);

router.post(
  "/location",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      throw new ValidationError("Latitude and longitude required");
    }

    await db
      .update(deliveryDrivers)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        lastLocationUpdate: new Date(),
      })
      .where(eq(deliveryDrivers.userId, userId));

    // Verificar si el driver está cerca de alguna entrega
    const { checkAndUpdateArrivingStatus } = await import(
      "./arrivingStatusService"
    );
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, userId),
          inArray(orders.status, ["picked_up", "on_the_way", "in_transit"]),
        ),
      );

    for (const order of activeOrders) {
      await checkAndUpdateArrivingStatus(order.id, latitude, longitude);
    }

    res.json({ success: true });
  }),
);

router.get(
  "/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    res.json({ success: true, isOnline: driver?.isAvailable ?? false });
  }),
);

router.get(
  "/stats",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    if (!driver) {
      return res.json({
        success: true,
        stats: {
          totalDeliveries: 0,
          rating: 0,
          totalRatings: 0,
          completionRate: 100,
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          totalEarnings: 0,
          balance: 0,
          avgDeliveryTime: 0,
          cashOwed: 0,
          availableToWithdraw: 0,
          pendingCashOrders: [],
        },
      });
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    // Incluir tanto "delivered" como "completed" (confirmados por el cliente)
    const { or: orOp } = await import("drizzle-orm");
    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, userId),
          orOp(eq(orders.status, "delivered"), eq(orders.status, "completed")),
        ),
      );

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);

    const todayOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= todayStart;
    });
    const weekOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= weekStart;
    });
    const monthOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= monthStart;
    });

    // Driver gana 100% del deliveryFee
    const todayEarnings = todayOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const weekEarnings = weekOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const monthEarnings = monthOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const totalEarnings = completedOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );

    const avgTimeMinutes =
      completedOrders.length > 0
        ? completedOrders.reduce((sum, order) => {
            if (order.deliveredAt && order.createdAt) {
              const diff =
                new Date(order.deliveredAt).getTime() -
                new Date(order.createdAt).getTime();
              return sum + Math.floor(diff / 60000);
            }
            return sum;
          }, 0) / completedOrders.length
        : 0;

    // Obtener resumen de efectivo
    const { cashSettlementService } = await import("./cashSettlementService");
    const cashSummary = await cashSettlementService.getDriverDebt(userId);

    const canWithdraw = Math.max(
      0,
      (wallet?.balance || 0) - (wallet?.cashOwed || 0),
    );

    res.json({
      success: true,
      stats: {
        totalDeliveries: completedOrders.length,
        rating: driver.rating,
        totalRatings: driver.totalRatings,
        completionRate: 100,
        todayEarnings,
        weekEarnings,
        monthEarnings,
        totalEarnings,
        balance: wallet?.balance || 0,
        avgDeliveryTime: Math.round(avgTimeMinutes),
        // Info de efectivo
        cashOwed: wallet?.cashOwed || 0,
        availableToWithdraw: canWithdraw,
        pendingCashOrders: cashSummary.pendingOrders || [],
      },
      // Historial de entregas para mostrar en pantalla
      deliveries: completedOrders
        .map((o) => ({
          id: o.id,
          businessName: o.businessName,
          deliveryFee: o.deliveryFee || 0,
          deliveryEarnings: o.deliveryEarnings || o.deliveryFee || 0,
          deliveredAt: o.deliveredAt,
          createdAt: o.createdAt,
          paymentMethod: o.paymentMethod,
        }))
        .sort(
          (a, b) =>
            new Date(b.deliveredAt || b.createdAt).getTime() -
            new Date(a.deliveredAt || a.createdAt).getTime(),
        ),
    });
  }),
);

router.post(
  "/toggle-status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    let [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    if (!driver) {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType: "motorcycle",
        vehiclePlate: "PENDIENTE",
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
      [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId))
        .limit(1);
    }

    const newStatus = !driver.isAvailable;

    await db
      .update(deliveryDrivers)
      .set({
        isAvailable: newStatus,
        lastLocationUpdate: new Date(),
      })
      .where(eq(deliveryDrivers.userId, userId));

    logger.delivery(`Driver ${newStatus ? "online" : "offline"}`, { userId });

    res.json({ success: true, isOnline: newStatus });
  }),
);

router.get(
  "/orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const myOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.deliveryPersonId, userId),
          inArray(orders.status, ["ready", "picked_up", "delivered"]),
        ),
      );

    const { isNull: isNullOp } = await import("drizzle-orm");
    const availableOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.status, "ready"), isNullOp(orders.deliveryPersonId)))
      .limit(10);

    res.json({ orders: myOrders, availableOrders });
  }),
);

// Get my orders (for driver profile)
router.get(
  "/my-orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    const myOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPersonId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(50);

    res.json({ success: true, orders: myOrders });
  }),
);

router.get(
  "/available-orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;

    let [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);

    if (!driver) {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType: "motorcycle",
        vehiclePlate: "PENDIENTE",
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
      [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, userId))
        .limit(1);
    }

    // SIN RESTRICCIÓN DE DISTANCIA - Muestra TODOS los pedidos disponibles
    const { isNull } = await import("drizzle-orm");
    const availableOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.status, "ready"), isNull(orders.deliveryPersonId)))
      .limit(100);

    res.json({ success: true, orders: availableOrders });
  }),
);

router.post(
  "/accept/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.deliveryPersonId) {
      throw new ValidationError("Order already assigned");
    }

    if (order.status !== "ready") {
      throw new ValidationError("Order not ready for pickup");
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, userId))
      .limit(1);
    if (!driver || !driver.isAvailable) {
      throw new AuthorizationError("Driver not available");
    }

    await db
      .update(orders)
      .set({
        deliveryPersonId: userId,
        status: "accepted",
        assignedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Notificar al negocio que un driver aceptó el pedido
    const { sendPushToUser } = await import("./enhancedPushService");
    if (order.userId) {
      await sendPushToUser(order.userId, {
        title: "🛵 Repartidor asignado",
        body: `Un repartidor está en camino a recoger tu pedido #${orderId.slice(-6)}`,
        data: { orderId, screen: "OrderTracking" },
      });
    }

    logger.delivery("Order accepted", { orderId, driverId: userId });

    res.json({ success: true, order });
  }),
);

// Mark order as picked up
router.post(
  "/pickup/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }

    if (order.status !== "ready" && order.status !== "assigned") {
      throw new ValidationError("Order not ready for pickup");
    }

    await db
      .update(orders)
      .set({
        status: "picked_up",
        pickedUpAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    logger.delivery("Order picked up", { orderId, driverId: userId });

    res.json({ success: true });
  }),
);

// Update order status (for on_the_way, in_transit, etc.)
router.put(
  "/orders/:orderId/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.id;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }

    await db.update(orders).set({ status }).where(eq(orders.id, orderId));

    logger.delivery(`Order status updated to ${status}`, {
      orderId,
      driverId: userId,
    });

    res.json({ success: true });
  }),
);

// Mark order as delivered - triggers commission distribution
router.post(
  "/deliver/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = (req as any).user.id;
    const { latitude, longitude } = req.body;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }

    if (order.status === "delivered") {
      return res.status(400).json({ error: "Order already delivered" });
    }

    if (
      order.status !== "picked_up" &&
      order.status !== "on_the_way" &&
      order.status !== "in_transit"
    ) {
      throw new ValidationError("Order must be picked up or on the way first");
    }

    if (latitude === undefined || longitude === undefined) {
      throw new ValidationError(
        "Se requiere la ubicación GPS para finalizar la entrega",
      );
    }

    const deliveryLat =
      order.deliveryLatitude ??
      (order as any).deliveryLat ??
      (order as any).latitude;
    const deliveryLng =
      order.deliveryLongitude ??
      (order as any).deliveryLng ??
      (order as any).longitude;

    if (!deliveryLat || !deliveryLng) {
      throw new ValidationError(
        "No hay coordenadas de entrega registradas para validar la entrega",
      );
    }

    const driverLat = Number(latitude);
    const driverLng = Number(longitude);
    const deliveryLatNum = Number(deliveryLat);
    const deliveryLngNum = Number(deliveryLng);

    if (
      [driverLat, driverLng, deliveryLatNum, deliveryLngNum].some((value) =>
        Number.isNaN(value),
      )
    ) {
      throw new ValidationError(
        "Coordenadas inválidas para validar la entrega",
      );
    }

    const distanceKm = calculateDistance(
      driverLat,
      driverLng,
      deliveryLatNum,
      deliveryLngNum,
    );
    if (distanceKm > DELIVERY_RADIUS_KM) {
      return res.status(400).json({
        error: `Debes estar dentro de ${Math.round(DELIVERY_RADIUS_KM * 1000)}m del punto de entrega para finalizar`,
        distanceKm,
      });
    }

    // Mark as delivered
    const deliveredAt = new Date();
    const actualDeliveryTime = order.pickedUpAt
      ? Math.floor(
          (deliveredAt.getTime() - new Date(order.pickedUpAt).getTime()) /
            60000,
        )
      : null;
    const actualPrepTime =
      order.pickedUpAt && order.createdAt
        ? Math.floor(
            (new Date(order.pickedUpAt).getTime() -
              new Date(order.createdAt).getTime()) /
              60000,
          )
        : null;

    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt,
        deliveryLatitude: latitude?.toString(),
        deliveryLongitude: longitude?.toString(),
        actualDeliveryTime,
        actualPrepTime,
      })
      .where(eq(orders.id, orderId));

    // Si es pago en efectivo, registrar liquidación
    if (order.paymentMethod === "cash") {
      const { cashSettlementService } = await import("./cashSettlementService");
      await cashSettlementService.registerCashDebt(
        orderId,
        userId,
        order.businessId,
        order.total,
        order.deliveryFee,
      );

      logger.delivery("Cash order completed - debt registered", {
        orderId,
        driverId: userId,
        total: order.total,
      });
    } else {
      // Si es tarjeta, distribuir comisiones normalmente
      const { calculateAndDistributeCommissions } = await import(
        "./commissionService"
      );
      await calculateAndDistributeCommissions(orderId);
    }

    // Increment driver's delivery count
    await db
      .update(deliveryDrivers)
      .set({
        totalDeliveries: sql`total_deliveries + 1`,
        isAvailable: true,
      })
      .where(eq(deliveryDrivers.userId, userId));

    // Update metrics
    const { updateBusinessPrepTimeMetrics, updateDriverSpeedMetrics } =
      await import("./metricsService");
    updateBusinessPrepTimeMetrics(order.businessId).catch(console.error);
    updateDriverSpeedMetrics(userId).catch(console.error);

    // Send notification to customer
    const { sendOrderStatusNotification } = await import(
      "./enhancedPushService"
    );
    await sendOrderStatusNotification(orderId, order.userId, "delivered");

    logger.delivery("Order delivered", { orderId, driverId: userId });

    res.json({ success: true, message: "Pedido entregado exitosamente" });
  }),
);

router.get(
  "/location/:orderId",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order || !order.deliveryPersonId) {
      return res.json({ location: null });
    }

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);
    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return res.json({ location: null });
    }

    res.json({
      location: {
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        lastUpdate: driver.lastLocationUpdate,
      },
    });
  }),
);

// Get delivery person location by deliveryPersonId
router.get(
  "/location/driver/:deliveryPersonId",
  asyncHandler(async (req, res) => {
    const { deliveryPersonId } = req.params;

    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq(deliveryDrivers.userId, deliveryPersonId))
      .limit(1);

    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return res.json({ location: null });
    }

    res.json({
      location: {
        latitude: parseFloat(driver.currentLatitude),
        longitude: parseFloat(driver.currentLongitude),
        lastUpdate: driver.lastLocationUpdate,
      },
    });
  }),
);

export default router;
