import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq } from "drizzle-orm";
import { pickupService } from "../pickupService";

const router = express.Router();

// Obtener info de pickup (tiempo restante, progreso, código)
router.get("/:orderId/info", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.orderType !== "pickup") {
      return res
        .status(400)
        .json({ error: "Este pedido no es de tipo pickup" });
    }

    const timeRemaining = pickupService.getTimeRemaining(order);
    const progress = pickupService.getProgress(order);
    const pendingBefore = await pickupService.getPendingOrdersCount(
      order.businessId,
      order.id,
    );

    res.json({
      success: true,
      pickup: {
        code: order.pickupCode,
        qrCode: order.pickupQrCode,
        estimatedMinutes: order.estimatedPickupTime,
        timeRemaining,
        progress,
        isReady: order.status === "ready",
        readyAt: order.pickupReadyAt,
        pendingBefore,
      },
    });
  } catch (error: any) {
    console.error("Get pickup info error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cliente avisa que llegó al local
router.post("/:orderId/arrived", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.order.userId !== req.user!.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    if (order.order.orderType !== "pickup") {
      return res
        .status(400)
        .json({ error: "Este pedido no es de tipo pickup" });
    }

    await pickupService.customerArrived(
      req.params.orderId,
      order.business?.ownerId!,
    );

    res.json({ success: true, message: "Negocio notificado de tu llegada" });
  } catch (error: any) {
    console.error("Customer arrived error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Negocio actualiza tiempo estimado
router.post("/:orderId/update-time", authenticateToken, async (req, res) => {
  try {
    const { orders, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { estimatedMinutes } = req.body;

    if (!estimatedMinutes || estimatedMinutes < 5 || estimatedMinutes > 120) {
      return res
        .status(400)
        .json({ error: "Tiempo estimado inválido (5-120 min)" });
    }

    const [order] = await db
      .select({ order: orders, business: businesses })
      .from(orders)
      .leftJoin(businesses, eq(orders.businessId, businesses.id))
      .where(eq(orders.id, req.params.orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (
      order.business?.ownerId !== req.user!.id &&
      req.user!.role !== "admin"
    ) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db
      .update(orders)
      .set({
        estimatedPickupTime: estimatedMinutes,
      })
      .where(eq(orders.id, req.params.orderId));

    // Notificar al cliente del cambio
    const { sendPushToUser } = await import("../enhancedPushService");
    await sendPushToUser(order.order.userId, {
      title: "⏱️ Tiempo actualizado",
      body: `Tu pedido estará listo en aprox. ${estimatedMinutes} min`,
      data: { orderId: order.order.id, screen: "OrderTracking" },
    });

    res.json({ success: true, message: "Tiempo actualizado" });
  } catch (error: any) {
    console.error("Update time error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Validar código de pickup
router.post("/:orderId/validate-code", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: "Código inválido" });
    }

    const isValid = await pickupService.validatePickupCode(
      req.params.orderId,
      code,
    );

    res.json({ success: true, valid: isValid });
  } catch (error: any) {
    console.error("Validate code error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener tiempo promedio del negocio
router.get("/business/:businessId/average-time", async (req, res) => {
  try {
    const avgTime = await pickupService.getBusinessAverageTime(
      req.params.businessId,
    );
    res.json({ success: true, averageMinutes: avgTime });
  } catch (error: any) {
    console.error("Get average time error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
