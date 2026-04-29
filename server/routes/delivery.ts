import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { eq, and, inArray } from "drizzle-orm";

const router = express.Router();

// GET /api/delivery/config — config de tarifas (no existe en legacy)
router.get("/config", (req, res) => {
  res.json({
    success: true,
    config: { tier1: 2.50, tier2: 4.00, tier3: 5.00, extraPerKm: 1.00 },
  });
});

// GET /api/delivery/active-order — pedido activo del repartidor para el mapa (no existe en legacy)
router.get("/active-order", authenticateToken, requireRole("delivery_driver"), async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

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

    if (!activeOrders.length) return res.json({ success: true, order: null });

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

// GET /api/delivery/drivers — admin only (no existe en legacy)
router.get("/drivers", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const drivers = await db
      .select({ id: users.id, name: users.name, phone: users.phone, isActive: users.isActive, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.role, "delivery_driver"), eq(users.isActive, true)));
    res.json({ success: true, drivers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/delivery/assign — admin only (no existe en legacy)
router.post("/assign", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orderId, driverId } = req.body;
    if (!orderId || !driverId) return res.status(400).json({ error: "ID de pedido y conductor requeridos" });
    const { orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    const [driver] = await db.select().from(users)
      .where(and(eq(users.id, driverId), eq(users.role, "delivery_driver"), eq(users.isActive, true)))
      .limit(1);
    if (!driver) return res.status(404).json({ error: "Conductor no encontrado" });
    await db.update(orders).set({ driverId, status: "picked_up", updatedAt: new Date() }).where(eq(orders.id, orderId));
    res.json({ success: true, message: "Conductor asignado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
