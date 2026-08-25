// Fund Release Routes
import { Router } from "express";
import { fundReleaseService } from "../fundReleaseService";
import { authenticateToken } from "../authMiddleware";
import { requireRole } from "../authMiddleware";
import { createPayoutsForOrder } from "../payoutService";
import { LoyaltyService } from "../loyaltyService";

const router = Router();

// Customer confirms delivery and releases funds
router.post("/confirm-delivery", authenticateToken, async (req, res) => {
  try {
    // Solo el cliente puede confirmar la entrega
    if (
      req.user!.role !== "customer" &&
      req.user!.role !== "admin" &&
      req.user!.role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Solo el cliente puede confirmar la entrega",
        });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId es requerido",
      });
    }

    const result = await fundReleaseService.releaseOnCustomerConfirmation(
      orderId,
      req.user!.id,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Cliente confirmó entrega → crear payouts para negocio y repartidor
    await createPayoutsForOrder(orderId);

    // Agregar puntos de lealtad al cliente
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (order?.userId) {
        await LoyaltyService.awardPointsForOrder(
          order.userId,
          orderId,
          order.total,
        );
        console.log(
          `✅ Puntos de lealtad awarded para orden ${orderId.slice(-6)}`,
        );
      }
    } catch (loyaltyError) {
      console.error("⚠️ Error agregando puntos de lealtad:", loyaltyError);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customer disputes order
router.post("/dispute", authenticateToken, async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        error: "orderId y reason son requeridos",
      });
    }

    const result = await fundReleaseService.disputeOrder(
      orderId,
      req.user!.id,
      reason,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Disputa registrada → strike automático al repartidor
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (order?.deliveryPersonId) {
        const { addStrike } = await import("../strikeService");
        await addStrike(
          order.deliveryPersonId,
          `Disputa del cliente: ${reason}`,
          orderId,
        );
      }
    } catch (strikeErr) {
      console.error("Error adding strike on dispute:", strikeErr);
      // No bloqueamos la respuesta si falla el strike
    }

    // La disputa también entra en el circuito de incidencias para que el
    // admin la vea, converse con el cliente y pueda compensarle
    try {
      const { randomUUID } = await import("crypto");
      const schema = await import("@shared/schema-mysql");
      const { orderIssues, supportTickets, ticketMessages, users, orders } = schema;
      const { db } = await import("../db");
      const { eq, inArray } = await import("drizzle-orm");
      const { sendPushToUser } = await import("../enhancedPushService");

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (order) {
        // Evitar duplicar la incidencia si ya existe una abierta por disputa
        const existing = await db
          .select({ id: orderIssues.id })
          .from(orderIssues)
          .where(eq(orderIssues.orderId, orderId));
        if (existing.length === 0) {
          const ticketId = randomUUID();
          await db.insert(supportTickets).values({
            id: ticketId,
            userId: req.user!.id,
            orderId,
            subject: `[Disputa #${orderId.slice(-6)}] ${reason}`.slice(0, 255),
            category: "order_issue",
            priority: "high",
            status: "open",
          });
          await db.insert(ticketMessages).values({
            ticketId,
            senderId: req.user!.id,
            senderType: "user",
            message: reason,
          });

          const issueId = randomUUID();
          await db.insert(orderIssues).values({
            id: issueId,
            orderId,
            ticketId,
            reportedBy: req.user!.id,
            reporterRole: "customer",
            issueType: "never_arrived",
            description: `[Disputa de entrega] ${reason}`,
            status: "open",
            priority: "high",
          });

          const admins = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.role, ["admin", "super_admin"]));
          for (const admin of admins) {
            await sendPushToUser(admin.id, {
              title: "⚠️ Disputa de entrega",
              body: `Pedido #${orderId.slice(-6)}: ${reason.slice(0, 80)}`,
              data: {
                type: "order_issue",
                issueId,
                orderId,
                screen: "AdminDashboard",
                section: "support_issues",
              },
            }).catch(() => {});
          }
        }
      }
    } catch (issueErr) {
      console.error("Error creating issue from dispute:", issueErr);
      // La disputa ya quedó registrada; la incidencia es complementaria
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders pending fund release (Admin)
router.get(
  "/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const orders = await fundReleaseService.getPendingReleaseOrders();
      res.json({ success: true, orders });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Manually trigger auto-release (Admin/Cron)
router.post(
  "/auto-release",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await fundReleaseService.autoReleaseFunds();
      res.json({
        success: true,
        message: `Auto-release completado: ${result.released} liberados, ${result.failed} fallidos`,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
