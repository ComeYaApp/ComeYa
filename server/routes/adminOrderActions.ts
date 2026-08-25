// Admin: acciones sobre un pedido concreto.
// Hasta ahora el panel de pedidos era de solo lectura: aquí viven la
// cancelación con su política de reembolso y el reembolso directo.
import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";

const router = express.Router();

router.use(authenticateToken, requireRole("admin", "super_admin"));

// GET /api/admin/orders/:id/cancel-preview — qué pasaría con el dinero
router.get("/:id/cancel-preview", async (req, res) => {
  try {
    const { getCancelPreview } = await import("../orderCancellationService");
    const { describePaymentForRefund, getRefundableAmount } = await import(
      "../refundService"
    );

    const refundOverride =
      req.query.refundAmount !== undefined
        ? Number(req.query.refundAmount)
        : undefined;

    const preview = await getCancelPreview(req.params.id, "admin", {
      actorRole: "admin",
      refundOverride,
      liableParty: req.query.liableParty as any,
    });

    if (!preview.success || !preview.order) {
      return res
        .status(404)
        .json({ success: false, error: preview.message || "Pedido no encontrado" });
    }

    res.json({
      success: true,
      cancellable: preview.cancellable,
      policy: preview.policy,
      payment: await describePaymentForRefund(preview.order),
      refundableAmount: await getRefundableAmount(preview.order),
      order: {
        id: preview.order.id,
        status: preview.order.status,
        total: preview.order.total,
        productosBase: preview.order.productosBase,
        deliveryFee: preview.order.deliveryFee,
        paymentMethod: preview.order.paymentMethod,
        businessName: preview.order.businessName,
      },
    });
  } catch (error: any) {
    console.error("Admin cancel preview error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/orders/:id/cancel — cancelar y devolver según política
router.post("/:id/cancel", async (req, res) => {
  try {
    const { reason, refundAmount, liableParty } = req.body;

    if (!reason?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Indica el motivo de la cancelación" });
    }

    const { cancelOrder } = await import("../orderCancellationService");
    const result = await cancelOrder(req.params.id, req.user!.id, reason.trim(), {
      actorRole: req.user!.role as any,
      refundOverride:
        refundAmount !== undefined && refundAmount !== null
          ? Math.round(Number(refundAmount))
          : undefined,
      liableParty,
    });

    if (!result.success) {
      return res
        .status(result.error === "not_found" ? 404 : 400)
        .json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      policy: result.policy,
      refund: result.refund,
    });
  } catch (error: any) {
    console.error("Admin cancel order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/orders/:id/refund — devolver sin cancelar el pedido.
// El método (Stripe automático o transferencia manual) lo decide el pago.
router.post("/:id/refund", async (req, res) => {
  try {
    const { amount, reason, liableParty, notes } = req.body;

    if (!reason?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Indica el motivo de la devolución" });
    }

    const { createRefund } = await import("../refundService");
    const result = await createRefund({
      orderId: req.params.id,
      amount: Math.round(Number(amount) || 0),
      type: "manual",
      reason: reason.trim(),
      liableParty,
      requestedBy: req.user!.id,
      notes,
    });

    if (!result.success) {
      return res
        .status(400)
        .json({ success: false, error: result.message, refund: result });
    }

    res.json({ success: true, message: result.message, refund: result });
  } catch (error: any) {
    console.error("Admin order refund error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
