import express from "express";
import { authenticateToken } from "../authMiddleware";
import { GroupOrderService } from "../groupOrderService";
import { db } from "../db";
import { groupOrders } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

const router = express.Router();

// POST /api/group-orders - Crear pedido grupal
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes,
    } = req.body;

    const result = await GroupOrderService.createGroupOrder({
      creatorId: req.user!.id,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Create group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/group-orders/join - Unirse a pedido grupal
router.post("/join", authenticateToken, async (req, res) => {
  try {
    const { shareToken, items, subtotal } = req.body;

    const result = await GroupOrderService.joinGroupOrder({
      shareToken,
      userId: req.user!.id,
      userName: req.user!.name,
      items,
      subtotal,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Join group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/group-orders/:groupOrderId - Obtener detalles del grupo
router.get("/:groupOrderId", authenticateToken, async (req, res) => {
  try {
    const { groupOrderId } = req.params;

    const result = await GroupOrderService.getGroupOrder(groupOrderId);
    res.json(result);
  } catch (error: any) {
    console.error("Get group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/group-orders/by-token/:shareToken — token = id del grupo
router.get("/by-token/:shareToken", authenticateToken, async (req, res) => {
  try {
    const { shareToken } = req.params;
    const result = await GroupOrderService.getGroupOrder(shareToken);
    res.json(result);
  } catch (error: any) {
    console.error("Get group order by token error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/group-orders/:groupOrderId/lock - Cerrar grupo y crear pedido
router.post("/:groupOrderId/lock", authenticateToken, async (req, res) => {
  try {
    const { groupOrderId } = req.params;

    const result = await GroupOrderService.lockGroupOrder(
      groupOrderId,
      req.user!.id,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Lock group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/group-orders/participants/:participantId/pay - Marcar pago
router.post(
  "/participants/:participantId/pay",
  authenticateToken,
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const { paymentProofUrl } = req.body;

      const result = await GroupOrderService.markParticipantPaid(
        participantId,
        paymentProofUrl,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Mark participant paid error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/group-orders/user/my-groups - Obtener grupos del usuario
router.get("/user/my-groups", authenticateToken, async (req, res) => {
  try {
    const result = await GroupOrderService.getMyGroups(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error("Get user group orders error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
