// Admin: libro de devoluciones al cliente y acciones sobre pedidos
// (cancelar con preview de la política, reembolsar sin incidencia previa).
import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { REFUND_METHOD_LABELS } from "@shared/orderIssues";

const router = express.Router();

router.use(authenticateToken, requireRole("admin", "super_admin"));

// GET /api/admin/refunds — libro de devoluciones
router.get("/", async (req, res) => {
  try {
    const { refunds, orders, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and, desc, gte, lte, like, or, sql } = await import(
      "drizzle-orm"
    );

    const { status, method, type, liableParty, search, dateFrom, dateTo } =
      req.query as Record<string, string | undefined>;

    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const filters: any[] = [];
    if (status && status !== "all") filters.push(eq(refunds.status, status));
    if (method && method !== "all") filters.push(eq(refunds.method, method));
    if (type && type !== "all") filters.push(eq(refunds.type, type));
    if (liableParty && liableParty !== "all")
      filters.push(eq(refunds.liableParty, liableParty));
    if (dateFrom) filters.push(gte(refunds.createdAt, new Date(dateFrom)));
    if (dateTo) filters.push(lte(refunds.createdAt, new Date(dateTo)));
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      filters.push(or(like(refunds.orderId, q), like(users.name, q)));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: refunds.id,
        orderId: refunds.orderId,
        issueId: refunds.issueId,
        customerId: refunds.customerId,
        amount: refunds.amount,
        type: refunds.type,
        reason: refunds.reason,
        method: refunds.method,
        status: refunds.status,
        stripeRefundId: refunds.stripeRefundId,
        liableParty: refunds.liableParty,
        businessDeduction: refunds.businessDeduction,
        driverDeduction: refunds.driverDeduction,
        platformCost: refunds.platformCost,
        payoutAdjusted: refunds.payoutAdjusted,
        failureReason: refunds.failureReason,
        proofUrl: refunds.proofUrl,
        notes: refunds.notes,
        processedAt: refunds.processedAt,
        createdAt: refunds.createdAt,
        customerName: users.name,
        customerPhone: users.phone,
        businessName: orders.businessName,
        orderTotal: orders.total,
        paymentMethod: orders.paymentMethod,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .leftJoin(users, eq(refunds.customerId, users.id))
      .where(where)
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const counts = await db
      .select({ status: refunds.status, count: sql<number>`COUNT(*)` })
      .from(refunds)
      .groupBy(refunds.status);

    const byStatus: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    for (const c of counts) byStatus[c.status] = Number(c.count);

    res.json({
      success: true,
      refunds: rows.map((r: any) => ({
        ...r,
        methodLabel: REFUND_METHOD_LABELS[r.method] || r.method,
      })),
      counts: {
        ...byStatus,
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      },
      pagination: { limit, offset, returned: rows.length },
    });
  } catch (error: any) {
    console.error("Admin list refunds error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/refunds/summary — KPIs para la cabecera de Finanzas
router.get("/summary", async (req, res) => {
  try {
    const { refunds } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const all = await db.select().from(refunds);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const completed = all.filter((r: any) => r.status === "completed");
    const sum = (rows: typeof all) => rows.reduce((s: number, r: any) => s + r.amount, 0);
    const since = (d: Date) =>
      completed.filter((r: any) => r.createdAt && new Date(r.createdAt) >= d);

    const byMethod: Record<string, { count: number; amount: number }> = {};
    for (const r of completed) {
      byMethod[r.method] = byMethod[r.method] || { count: 0, amount: 0 };
      byMethod[r.method].count += 1;
      byMethod[r.method].amount += r.amount;
    }

    const byLiableParty: Record<string, { count: number; amount: number }> = {};
    for (const r of completed) {
      const key = r.liableParty || "platform";
      byLiableParty[key] = byLiableParty[key] || { count: 0, amount: 0 };
      byLiableParty[key].count += 1;
      byLiableParty[key].amount += r.amount;
    }

    const pendingManual = all.filter(
      (r: any) => r.status === "pending" && r.method === "manual_transfer",
    );
    const failed = all.filter((r: any) => r.status === "failed");

    res.json({
      success: true,
      refunded: {
        today: sum(since(today)),
        week: sum(since(weekAgo)),
        month: sum(since(monthStart)),
        total: sum(completed),
      },
      cost: {
        business: completed.reduce((s: number, r: any) => s + (r.businessDeduction || 0), 0),
        driver: completed.reduce((s: number, r: any) => s + (r.driverDeduction || 0), 0),
        platform: completed.reduce((s: number, r: any) => s + (r.platformCost || 0), 0),
      },
      byMethod,
      byLiableParty,
      pendingManual: {
        count: pendingManual.length,
        amount: sum(pendingManual),
      },
      failed: { count: failed.length, amount: sum(failed) },
      stats: {
        totalRefunds: all.length,
        avgRefund:
          completed.length > 0
            ? Math.round(sum(completed) / completed.length)
            : 0,
      },
    });
  } catch (error: any) {
    console.error("Admin refunds summary error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/refunds — devolución manual sin incidencia previa.
// El método (Stripe o transferencia) lo decide el pago original del pedido.
router.post("/", async (req, res) => {
  try {
    const { orderId, amount, reason, liableParty, notes } = req.body;

    if (!orderId || !reason?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Pedido y motivo son obligatorios" });
    }

    const { createRefund } = await import("../refundService");
    const result = await createRefund({
      orderId,
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
    console.error("Admin create refund error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/refunds/order/:orderId — contexto de pago de un pedido
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orders, refunds } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");
    const { describePaymentForRefund, getRefundableAmount } = await import(
      "../refundService"
    );

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.orderId))
      .limit(1);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Pedido no encontrado" });
    }

    const history = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id))
      .orderBy(desc(refunds.createdAt));

    res.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        businessName: order.businessName,
      },
      payment: await describePaymentForRefund(order),
      refundableAmount: await getRefundableAmount(order),
      refunds: history,
    });
  } catch (error: any) {
    console.error("Admin refund order context error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/refunds/:id/mark-paid — cerrar una transferencia manual
router.post("/:id/mark-paid", async (req, res) => {
  try {
    const { proofUrl, notes } = req.body;
    if (!proofUrl && !notes) {
      return res.status(400).json({
        success: false,
        error: "Adjunta el comprobante o deja una nota del pago",
      });
    }

    const { markRefundPaid } = await import("../refundService");
    const result = await markRefundPaid(req.params.id, req.user!.id, {
      proofUrl,
      notes,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error("Admin mark refund paid error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/refunds/:id/retry — reintentar una devolución fallida
router.post("/:id/retry", async (req, res) => {
  try {
    const { retryRefund } = await import("../refundService");
    const result = await retryRefund(req.params.id, req.user!.id);

    if (!result.success) {
      return res
        .status(400)
        .json({ success: false, error: result.message, refund: result });
    }

    res.json({ success: true, message: result.message, refund: result });
  } catch (error: any) {
    console.error("Admin retry refund error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
