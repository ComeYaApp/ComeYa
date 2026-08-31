import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { EnhancedReviewService } from "../enhancedReviewService";

const router = express.Router();

// POST /api/reviews - Crear review mejorada
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
      tipAmount,
      tipMethod,
      tipProof,
    } = req.body;

    if (!orderId || !businessId) {
      return res
        .status(400)
        .json({ success: false, error: "Falta el pedido o el negocio" });
    }
    const validRating = (r: any) =>
      r === undefined || r === null || (Number.isInteger(r) && r >= 1 && r <= 5);
    if (
      !validRating(foodRating) ||
      !validRating(deliveryRating) ||
      !validRating(packagingRating) ||
      !validRating(driverRating)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Las puntuaciones deben ir de 1 a 5" });
    }
    // tipAmount llega en céntimos (entero); sin propina = 0
    const tipCents = Math.round(Number(tipAmount) || 0);
    if (!Number.isFinite(tipCents) || tipCents < 0 || tipCents > 50000) {
      return res
        .status(400)
        .json({ success: false, error: "Cantidad de propina no válida" });
    }
    const method = (["stripe", "manual", "cash"] as const).includes(
      tipMethod,
    )
      ? tipMethod
      : "stripe";

    // Gating OBLIGATORIO de propina: solo tras entrega confirmada y con
    // repartidor. La valoración sin propina no exige confirmación previa.
    let eligibility: any = { ok: true };
    if (tipCents > 0) {
      const { checkTipEligibility } = await import("../tipService");
      eligibility = await checkTipEligibility(orderId, req.user!.id);
      if (!eligibility.ok) {
        return res.status(400).json({ success: false, error: eligibility.error });
      }
    }

    // Subir comprobante de propina manual a Cloudinary (no bloquea la reseña)
    let proofUrl: string | null = null;
    if (tipCents > 0 && method === "manual" && tipProof) {
      try {
        const { CloudinaryService } = await import("../cloudinaryService");
        proofUrl = await CloudinaryService.uploadImage(
          String(tipProof),
          "tip-proofs",
          `tip-${orderId}-${Date.now()}`,
        );
      } catch (err) {
        console.error("[reviews] No se pudo subir el comprobante de propina:", err);
      }
    }

    const result = await EnhancedReviewService.createReview({
      userId: req.user!.id,
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
      tipAmount: tipCents,
    });

    if (!result.success) {
      return res.status(result.alreadyReviewed ? 409 : 400).json(result);
    }

    // Propina: registrar según el canal elegido
    if (tipCents > 0 && result.reviewId) {
      const tipService = await import("../tipService");
      const driverId = deliveryPersonId || eligibility.order?.deliveryPersonId;
      if (method === "stripe") {
        const intent = await tipService.createStripeTipIntent({
          orderId,
          driverId,
          amountCents: tipCents,
          reviewId: result.reviewId,
        });
        if (!intent.success) {
          return res.status(500).json({
            success: false,
            error: intent.error || "No se pudo crear el pago de la propina",
          });
        }
        await tipService.declareTip({
          orderId,
          driverId,
          amountCents: tipCents,
          method: "stripe",
          declaredBy: "customer",
          reviewId: result.reviewId,
          paymentIntentId: intent.paymentIntentId,
        });
        return res.json({
          success: true,
          reviewId: result.reviewId,
          needsPayment: true,
          clientSecret: intent.clientSecret,
          paymentIntentId: intent.paymentIntentId,
        });
      }
      if (method === "manual") {
        await tipService.declareTip({
          orderId,
          driverId,
          amountCents: tipCents,
          method: "manual",
          declaredBy: "customer",
          reviewId: result.reviewId,
          proofUrl: proofUrl || undefined,
        });
        return res.json({
          success: true,
          reviewId: result.reviewId,
          tipPending: true,
          message:
            "Propina declarada por pago manual. Se abonará al repartidor cuando administración verifique el comprobante.",
        });
      }
      // cash: doble confirmación con el repartidor
      await tipService.declareTip({
        orderId,
        driverId,
        amountCents: tipCents,
        method: "cash",
        declaredBy: "customer",
        reviewId: result.reviewId,
      });
      try {
        const { sendPushToUser } = await import("../enhancedPushService");
        await sendPushToUser(driverId, {
          title: "💵 Propina en efectivo declarada",
          body: `El cliente te dará ${(tipCents / 100).toFixed(2)} € en efectivo. Confírmalo en la app cuando la recibas.`,
          data: { orderId, screen: "DriverMyDeliveries" },
        });
      } catch {}
      return res.json({
        success: true,
        reviewId: result.reviewId,
        tipPending: true,
        message: "Propina en efectivo declarada. El repartidor debe confirmarla en su app.",
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Create review error:", error);
    res.status(500).json({
      success: false,
      error: "No se pudo guardar la reseña. Inténtalo de nuevo.",
    });
  }
});

// POST /api/reviews/:reviewId/confirm-tip — confirma el pago con tarjeta de
// una propina (rescate si el webhook se perdió). El cliente ya pagó con el
// Payment Sheet: aquí se verifica el PaymentIntent y se abona al repartidor.
router.post("/:reviewId/confirm-tip", authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params as { reviewId: string };
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res
        .status(400)
        .json({ success: false, error: "paymentIntentId es requerido" });
    }
    const { db } = await import("../db");
    const { reviews } = await import("@shared/schema-mysql");
    const { eq } = await import("drizzle-orm");
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);
    if (!review) {
      return res.status(404).json({ success: false, error: "Reseña no encontrada" });
    }
    if (review.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: "No autorizado" });
    }
    const tipService = await import("../tipService");
    const result = await tipService.handleStripeTipPayment(paymentIntentId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error("Confirm tip error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reviews/tags - Obtener tags disponibles
router.get("/tags", async (req, res) => {
  try {
    const result = await EnhancedReviewService.getTags();
    res.json(result);
  } catch (error: any) {
    console.error("Get tags error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reviews/business/:businessId - Obtener reviews de un negocio
router.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await EnhancedReviewService.getBusinessReviews(
      businessId,
      limit,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get business reviews error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reviews/:reviewId/respond - Responder a una review (solo dueño)
router.post(
  "/:reviewId/respond",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { reviewId } = req.params as { reviewId: string };
      const { businessId, responseText } = req.body;

      if (!responseText || responseText.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Respuesta requerida" });
      }

      const result = await EnhancedReviewService.respondToReview(
        reviewId,
        businessId,
        req.user!.id,
        responseText,
      );

      res.json(result);
    } catch (error: any) {
      console.error("Respond to review error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
