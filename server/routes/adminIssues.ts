// Admin: gestión de incidencias de pedido
// Listar, ver el detalle con todo el contexto, conversar con el cliente y
// resolver (devolución total/parcial, saldo, reenvío o denegar).
import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { ISSUE_LABELS, RESOLUTION_LABELS } from "@shared/orderIssues";

const router = express.Router();

router.use(authenticateToken, requireRole("admin", "super_admin"));

const parseJson = (value: string | null): any => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// GET /api/admin/issues — listado con filtros y paginación
router.get("/", async (req, res) => {
  try {
    const { orderIssues, orders, users } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq, and, desc, gte, lte, like, or, sql } = await import(
      "drizzle-orm"
    );

    const {
      status,
      issueType,
      priority,
      liableParty,
      search,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const filters: any[] = [];
    if (status && status !== "all") filters.push(eq(orderIssues.status, status));
    if (issueType && issueType !== "all")
      filters.push(eq(orderIssues.issueType, issueType));
    if (priority && priority !== "all")
      filters.push(eq(orderIssues.priority, priority));
    if (liableParty && liableParty !== "all")
      filters.push(eq(orderIssues.liableParty, liableParty));
    if (dateFrom) filters.push(gte(orderIssues.createdAt, new Date(dateFrom)));
    if (dateTo) filters.push(lte(orderIssues.createdAt, new Date(dateTo)));
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      filters.push(
        or(
          like(orderIssues.orderId, q),
          like(orderIssues.description, q),
          like(users.name, q),
        ),
      );
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: orderIssues.id,
        orderId: orderIssues.orderId,
        ticketId: orderIssues.ticketId,
        reportedBy: orderIssues.reportedBy,
        reporterRole: orderIssues.reporterRole,
        issueType: orderIssues.issueType,
        description: orderIssues.description,
        photos: orderIssues.photos,
        status: orderIssues.status,
        priority: orderIssues.priority,
        resolutionType: orderIssues.resolutionType,
        resolutionAmount: orderIssues.resolutionAmount,
        liableParty: orderIssues.liableParty,
        assignedTo: orderIssues.assignedTo,
        resolvedAt: orderIssues.resolvedAt,
        createdAt: orderIssues.createdAt,
        customerName: users.name,
        customerPhone: users.phone,
        orderTotal: orders.total,
        orderStatus: orders.status,
        paymentMethod: orders.paymentMethod,
        businessName: orders.businessName,
        cashCollected: orders.cashCollected,
        stripePaymentIntentId: orders.stripePaymentIntentId,
      })
      .from(orderIssues)
      .leftJoin(orders, eq(orderIssues.orderId, orders.id))
      .leftJoin(users, eq(orderIssues.reportedBy, users.id))
      .where(where)
      .orderBy(desc(orderIssues.createdAt))
      .limit(limit)
      .offset(offset);

    // Contadores por estado, para las pestañas del panel
    const counts = await db
      .select({
        status: orderIssues.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(orderIssues)
      .groupBy(orderIssues.status);

    const byStatus: Record<string, number> = {
      open: 0,
      in_review: 0,
      resolved: 0,
      rejected: 0,
    };
    for (const c of counts) byStatus[c.status] = Number(c.count);

    res.json({
      success: true,
      issues: rows.map((r: any) => ({
        ...r,
        photos: parseJson(r.photos) || [],
        issueLabel: ISSUE_LABELS[r.issueType] || r.issueType,
      })),
      counts: {
        ...byStatus,
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      },
      pagination: { limit, offset, returned: rows.length },
    });
  } catch (error: any) {
    console.error("Admin list issues error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/issues/:id — detalle con todo lo necesario para decidir
router.get("/:id", async (req, res) => {
  try {
    const { orderIssues, orders, users, ticketMessages, refunds, businesses } =
      await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and, ne, desc, sql } = await import("drizzle-orm");
    const { describePaymentForRefund, getRefundableAmount, defaultLiableParty } =
      await import("../refundService");

    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, req.params.id))
      .limit(1);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, error: "Incidencia no encontrada" });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, issue.orderId))
      .limit(1);

    const [customer] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, issue.reportedBy))
      .limit(1);

    const messages = issue.ticketId
      ? await db
          .select()
          .from(ticketMessages)
          .where(eq(ticketMessages.ticketId, issue.ticketId))
          .orderBy(ticketMessages.createdAt)
      : [];

    const orderRefunds = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, issue.orderId))
      .orderBy(desc(refunds.createdAt));

    // Historial del cliente: señal de abuso, como en Uber Eats
    const history = await db
      .select({
        id: orderIssues.id,
        orderId: orderIssues.orderId,
        issueType: orderIssues.issueType,
        status: orderIssues.status,
        resolutionType: orderIssues.resolutionType,
        resolutionAmount: orderIssues.resolutionAmount,
        createdAt: orderIssues.createdAt,
      })
      .from(orderIssues)
      .where(
        and(
          eq(orderIssues.reportedBy, issue.reportedBy),
          ne(orderIssues.id, issue.id),
        ),
      )
      .orderBy(desc(orderIssues.createdAt))
      .limit(20);

    const [totals] = await db
      .select({
        orders: sql<number>`COUNT(*)`,
      })
      .from(orders)
      .where(eq(orders.userId, issue.reportedBy));

    const refundedToCustomer = await db
      .select({ amount: refunds.amount, status: refunds.status })
      .from(refunds)
      .where(eq(refunds.customerId, issue.reportedBy));

    let businessInfo: any = null;
    if (order?.businessId) {
      const [biz] = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          phone: businesses.phone,
          ownerId: businesses.ownerId,
        })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      businessInfo = biz || null;
    }

    let driverInfo: any = null;
    if (order?.deliveryPersonId) {
      const [drv] = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, order.deliveryPersonId))
        .limit(1);
      driverInfo = drv || null;
    }

    const payment = order ? await describePaymentForRefund(order) : null;
    const refundable = order ? await getRefundableAmount(order) : 0;

    res.json({
      success: true,
      issue: {
        ...issue,
        photos: parseJson(issue.photos) || [],
        affectedItems: parseJson(issue.affectedItems),
        issueLabel: ISSUE_LABELS[issue.issueType] || issue.issueType,
        resolutionLabel: issue.resolutionType
          ? RESOLUTION_LABELS[issue.resolutionType]
          : null,
        suggestedLiableParty:
          issue.liableParty || defaultLiableParty(issue.issueType),
      },
      order: order
        ? { ...order, items: parseJson(order.items) || order.items }
        : null,
      customer,
      business: businessInfo,
      driver: driverInfo,
      messages,
      refunds: orderRefunds,
      payment,
      refundableAmount: refundable,
      customerHistory: {
        issues: history,
        totalIssues: history.length + 1,
        totalOrders: Number(totals?.orders || 0),
        totalRefunded: refundedToCustomer
          .filter((r: any) => r.status === "completed")
          .reduce((s: number, r: any) => s + r.amount, 0),
      },
    });
  } catch (error: any) {
    console.error("Admin get issue error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/issues/:id/assign — el admin toma el caso
router.post("/:id/assign", async (req, res) => {
  try {
    const { orderIssues, supportTickets } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, req.params.id))
      .limit(1);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, error: "Incidencia no encontrada" });
    }

    await db
      .update(orderIssues)
      .set({
        assignedTo: req.user!.id,
        status: issue.status === "open" ? "in_review" : issue.status,
        updatedAt: new Date(),
      })
      .where(eq(orderIssues.id, req.params.id));

    if (issue.ticketId) {
      await db
        .update(supportTickets)
        .set({
          assignedTo: req.user!.id,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, issue.ticketId));
    }

    res.json({ success: true, message: "Incidencia asignada" });
  } catch (error: any) {
    console.error("Admin assign issue error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/issues/:id/messages — responder al cliente
router.post("/:id/messages", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "El mensaje no puede estar vacío" });
    }

    const { orderIssues, supportTickets, ticketMessages } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const { randomUUID } = await import("crypto");
    const { sendPushToUser } = await import("../enhancedPushService");

    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, req.params.id))
      .limit(1);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, error: "Incidencia no encontrada" });
    }

    // Una incidencia antigua puede no tener ticket: se crea al responder
    let ticketId = issue.ticketId;
    if (!ticketId) {
      ticketId = randomUUID();
      await db.insert(supportTickets).values({
        id: ticketId,
        userId: issue.reportedBy,
        orderId: issue.orderId,
        subject: `[Pedido #${issue.orderId.slice(-6)}] ${ISSUE_LABELS[issue.issueType] || issue.issueType}`.slice(
          0,
          255,
        ),
        category: "order_issue",
        priority: issue.priority,
        status: "in_progress",
      });
      await db
        .update(orderIssues)
        .set({ ticketId })
        .where(eq(orderIssues.id, issue.id));
    }

    await db.insert(ticketMessages).values({
      ticketId,
      senderId: req.user!.id,
      senderType: "admin",
      message: message.trim(),
    });

    await db
      .update(orderIssues)
      .set({
        status: issue.status === "open" ? "in_review" : issue.status,
        assignedTo: issue.assignedTo || req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(orderIssues.id, issue.id));

    await sendPushToUser(issue.reportedBy, {
      title: "Respuesta a tu incidencia",
      body: message.trim().substring(0, 120),
      data: {
        type: "issue_reply",
        issueId: issue.id,
        orderId: issue.orderId,
        ticketId,
        screen: "TicketDetail",
      },
    }).catch(() => {});

    res.json({ success: true, message: "Respuesta enviada", ticketId });
  } catch (error: any) {
    console.error("Admin issue message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/issues/:id/resolve — resolver con o sin devolución
router.post("/:id/resolve", async (req, res) => {
  try {
    const {
      resolutionType,
      amount,
      liableParty,
      customerMessage,
      internalNote,
    } = req.body;

    const VALID = ["refund_full", "refund_partial", "redelivery"];
    if (!VALID.includes(resolutionType)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de resolución inválido. Opciones: ${VALID.join(", ")}`,
      });
    }

    const { orderIssues, orders, supportTickets, ticketMessages } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const { sendPushToUser } = await import("../enhancedPushService");
    const { createRefund, getRefundableAmount, defaultLiableParty } =
      await import("../refundService");

    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, req.params.id))
      .limit(1);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, error: "Incidencia no encontrada" });
    }
    if (issue.status === "resolved") {
      return res
        .status(400)
        .json({ success: false, error: "Esta incidencia ya está resuelta" });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, issue.orderId))
      .limit(1);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Pedido asociado no encontrado" });
    }

    const responsible =
      liableParty || issue.liableParty || defaultLiableParty(issue.issueType);

    // Importe a devolver según el tipo de resolución
    let refundAmount = 0;
    if (resolutionType === "refund_full") {
      refundAmount = await getRefundableAmount(order);
    } else if (resolutionType === "refund_partial") {
      refundAmount = Math.round(Number(amount) || 0);
      if (refundAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Indica el importe a devolver (en céntimos)",
        });
      }
    }

    let refundResult: any = null;
    if (refundAmount > 0) {
      refundResult = await createRefund({
        orderId: issue.orderId,
        amount: refundAmount,
        type: "issue",
        reason: `${ISSUE_LABELS[issue.issueType] || issue.issueType}: ${issue.description.slice(0, 180)}`,
        issueId: issue.id,
        liableParty: responsible,
        requestedBy: req.user!.id,
        notes: internalNote,
        notifyCustomer: false, // el mensaje de resolución ya lo informa
      });

      if (!refundResult.success) {
        return res.status(400).json({
          success: false,
          error: refundResult.message,
          refund: refundResult,
        });
      }
    }

    await db
      .update(orderIssues)
      .set({
        status: "resolved",
        resolutionType,
        resolutionAmount: refundResult?.amount ?? 0,
        liableParty: responsible,
        customerMessage: customerMessage || null,
        internalNote: internalNote || issue.internalNote,
        assignedTo: issue.assignedTo || req.user!.id,
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orderIssues.id, issue.id));

    // Cerrar el ticket y dejar la resolución escrita en el hilo
    if (issue.ticketId) {
      const summary = [
        `Resolución: ${RESOLUTION_LABELS[resolutionType] || resolutionType}`,
        refundResult?.amount
          ? `Importe: ${(refundResult.amount / 100).toFixed(2)} €`
          : null,
        refundResult?.message,
        customerMessage,
      ]
        .filter(Boolean)
        .join("\n");

      await db.insert(ticketMessages).values({
        ticketId: issue.ticketId,
        senderId: req.user!.id,
        senderType: "admin",
        message: summary,
      });

      await db
        .update(supportTickets)
        .set({
          status: "resolved",
          assignedTo: req.user!.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, issue.ticketId));
    }

    const bodyText =
      customerMessage?.trim() ||
      (refundResult?.amount
        ? `Hemos resuelto tu incidencia. ${refundResult.message}`
        : resolutionType === "redelivery"
          ? "Vamos a reenviarte el pedido."
          : "Hemos resuelto tu incidencia.");

    await sendPushToUser(issue.reportedBy, {
      title: "✅ Incidencia resuelta",
      body: bodyText.substring(0, 150),
      data: {
        type: "issue_resolved",
        issueId: issue.id,
        orderId: issue.orderId,
        screen: "OrderTracking",
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: refundResult
        ? refundResult.message
        : "Incidencia resuelta sin devolución",
      refund: refundResult,
      liableParty: responsible,
    });
  } catch (error: any) {
    console.error("Admin resolve issue error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/issues/:id/reject — denegar con motivo
router.post("/:id/reject", async (req, res) => {
  try {
    const { reason, customerMessage } = req.body;
    if (!reason?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Indica el motivo de la denegación" });
    }

    const { orderIssues, supportTickets, ticketMessages } = await import(
      "@shared/schema-mysql"
    );
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const { sendPushToUser } = await import("../enhancedPushService");

    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, req.params.id))
      .limit(1);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, error: "Incidencia no encontrada" });
    }
    if (issue.status === "resolved") {
      return res.status(400).json({
        success: false,
        error: "Esta incidencia ya se resolvió con devolución",
      });
    }

    await db
      .update(orderIssues)
      .set({
        status: "rejected",
        resolutionType: "rejected",
        resolutionAmount: 0,
        customerMessage: customerMessage || null,
        internalNote: reason.trim(),
        assignedTo: issue.assignedTo || req.user!.id,
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orderIssues.id, issue.id));

    if (issue.ticketId) {
      await db.insert(ticketMessages).values({
        ticketId: issue.ticketId,
        senderId: req.user!.id,
        senderType: "admin",
        message:
          customerMessage?.trim() ||
          "Hemos revisado tu incidencia y no procede compensación en este caso.",
      });

      await db
        .update(supportTickets)
        .set({
          status: "closed",
          assignedTo: req.user!.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, issue.ticketId));
    }

    await sendPushToUser(issue.reportedBy, {
      title: "Incidencia revisada",
      body: (
        customerMessage?.trim() ||
        "Hemos revisado tu incidencia y no procede compensación en este caso."
      ).substring(0, 150),
      data: {
        type: "issue_rejected",
        issueId: issue.id,
        orderId: issue.orderId,
        screen: "OrderTracking",
      },
    }).catch(() => {});

    res.json({ success: true, message: "Incidencia denegada" });
  } catch (error: any) {
    console.error("Admin reject issue error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
