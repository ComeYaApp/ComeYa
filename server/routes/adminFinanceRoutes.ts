import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { sql } from "drizzle-orm";
import { orderRefFromId } from "../orderNumberService";

const router = express.Router();

// GET /api/admin/finance/platform-earnings - Ganancias de la plataforma
router.get(
  "/platform-earnings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, transactions } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      // Obtener todos los pedidos completados
      const allOrders = await db.select().from(orders);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Filtrar pedidos entregados
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");

      // Calcular comisiones por período
      const todayEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= today)
        .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

      const weekEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= weekAgo)
        .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

      const monthEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= monthStart)
        .reduce((sum, o) => sum + (o.nemyCommission || 0), 0);

      const totalEarnings = deliveredOrders.reduce(
        (sum, o) => sum + (o.nemyCommission || 0),
        0,
      );

      // Obtener transacciones de la plataforma
      const allTransactions = await db.select().from(transactions);

      const penalties = allTransactions
        .filter((t) => t.type === "penalty")
        .reduce((sum, t) => sum + t.amount, 0);

      const couponsApplied = allTransactions
        .filter((t) => t.type === "coupon_discount")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Transacciones recientes (últimas 50)
      const recentTransactions = deliveredOrders
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 50)
        .map((order) => ({
          id: order.id,
          orderId: order.id,
          date: order.createdAt,
          amount: order.nemyCommission || 0,
          type: "commission",
          businessName: order.businessName,
          status: order.status,
        }));

      res.json({
        success: true,
        earnings: {
          today: todayEarnings,
          week: weekEarnings,
          month: monthEarnings,
          total: totalEarnings,
        },
        breakdown: {
          productMarkup: totalEarnings,
          deliveryCommission: 0, // ComeYa no cobra comisión de delivery
          businessCommission: 0, // ComeYa no cobra comisión a negocios
          penalties: penalties,
          couponsApplied: -couponsApplied,
          netTotal: totalEarnings + penalties - couponsApplied,
        },
        transactions: recentTransactions,
        stats: {
          totalOrders: deliveredOrders.length,
          avgCommissionPerOrder:
            deliveredOrders.length > 0
              ? Math.round(totalEarnings / deliveredOrders.length)
              : 0,
          conversionRate:
            allOrders.length > 0
              ? ((deliveredOrders.length / allOrders.length) * 100).toFixed(1)
              : "0.0",
        },
      });
    } catch (error: any) {
      console.error("Platform earnings error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/finance/stripe-status - Estado de Stripe Connect
router.get(
  "/stripe-status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      // Verificar si Stripe está configurado
      const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

      if (!stripeConfigured) {
        return res.json({
          success: true,
          status: {
            isConnected: false,
            accountId: null,
            chargesEnabled: false,
            payoutsEnabled: false,
            requirements: ["Configurar Stripe Secret Key"],
            lastSync: null,
            balance: {
              available: 0,
              pending: 0,
            },
          },
        });
      }

      // Si Stripe está configurado, obtener información real
      try {
        const { getStripe } = await import("../stripeClient");
        const stripe = getStripe();
        const account = await stripe.accounts.retrieve();
        let balance: any = { available: 0, pending: 0 };
        try {
          const b = await stripe.balance.retrieve();
          balance = {
            available: b.available?.[0]?.amount || 0,
            pending: b.pending?.[0]?.amount || 0,
          };
        } catch (balanceError) {
          console.error("Stripe balance error:", balanceError);
        }

        res.json({
          success: true,
          status: {
            isConnected: true,
            accountId: account.id || null,
            accountEmail: account.email || null,
            accountName:
              (account.settings?.dashboard?.display_name as string) ||
              account.business_profile?.name ||
              "ComeYa",
            chargesEnabled: account.charges_enabled ?? true,
            payoutsEnabled: account.payouts_enabled ?? true,
            requirements: [],
            lastSync: new Date().toISOString(),
            balance,
          },
        });
      } catch (stripeError: any) {
        console.error("Stripe API error:", stripeError);
        res.json({
          success: true,
          status: {
            isConnected: !!process.env.STRIPE_SECRET_KEY,
            accountId: null,
            chargesEnabled: false,
            payoutsEnabled: false,
            requirements: ["No se pudo conectar con la API de Stripe"],
            lastSync: new Date().toISOString(),
            balance: { available: 0, pending: 0 },
            error:
              stripeError?.message || "No se pudo conectar con Stripe API",
          },
        });
      }
    } catch (error: any) {
      console.error("Stripe status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/finance/top-businesses - Negocios que más comisiones generan
router.get(
  "/top-businesses",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, businesses } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const allOrders = await db.select().from(orders);
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");

      // Agrupar por negocio
      const businessEarnings = new Map<
        string,
        { name: string; total: number; orders: number }
      >();

      for (const order of deliveredOrders) {
        const current = businessEarnings.get(order.businessId) || {
          name: order.businessName,
          total: 0,
          orders: 0,
        };

        current.total += order.nemyCommission || 0;
        current.orders += 1;
        businessEarnings.set(order.businessId, current);
      }

      // Convertir a array y ordenar
      const topBusinesses = Array.from(businessEarnings.entries())
        .map(([id, data]) => ({
          businessId: id,
          businessName: data.name,
          totalCommissions: data.total,
          totalOrders: data.orders,
          avgCommissionPerOrder: Math.round(data.total / data.orders),
        }))
        .sort((a, b) => b.totalCommissions - a.totalCommissions)
        .slice(0, 10);

      res.json({
        success: true,
        topBusinesses,
      });
    } catch (error: any) {
      console.error("Top businesses error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/finance/earnings-chart - Datos para gráfica de ganancias
router.get(
  "/earnings-chart",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const days = parseInt(req.query.days as string) || 30;
      const allOrders = await db.select().from(orders);
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Agrupar por día
      const dailyEarnings = new Map<string, number>();

      for (const order of deliveredOrders) {
        const orderDate = new Date(order.createdAt);
        if (orderDate >= startDate) {
          const dateKey = orderDate.toISOString().split("T")[0];
          const current = dailyEarnings.get(dateKey) || 0;
          dailyEarnings.set(dateKey, current + (order.nemyCommission || 0));
        }
      }

      // Convertir a array ordenado
      const chartData = Array.from(dailyEarnings.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        success: true,
        chartData,
      });
    } catch (error: any) {
      console.error("Earnings chart error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /api/admin/finance/export-csv - Exportar transacciones a CSV
router.post(
  "/export-csv",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const { orders } = await import("@shared/schema-mysql");
      const { db } = await import("../db");

      const allOrders = await db.select().from(orders);
      let filteredOrders = allOrders.filter((o) => o.status === "delivered");

      if (startDate) {
        filteredOrders = filteredOrders.filter(
          (o) => new Date(o.createdAt) >= new Date(startDate),
        );
      }
      if (endDate) {
        filteredOrders = filteredOrders.filter(
          (o) => new Date(o.createdAt) <= new Date(endDate),
        );
      }

      // Generar CSV
      const csvHeader = "Fecha,Pedido ID,Negocio,Comisión (EUR),Estado\n";
      const csvRows = filteredOrders
        .map((order) => {
          const date = new Date(order.createdAt).toLocaleDateString("es-VE");
          const commission = ((order.nemyCommission || 0) / 100).toFixed(2);
          return `${date},${order.id},${order.businessName},${commission},${order.status}`;
        })
        .join("\n");

      const csv = csvHeader + csvRows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=comisiones_${Date.now()}.csv`,
      );
      res.send(csv);
    } catch (error: any) {
      console.error("Export CSV error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /api/admin/payouts/pending — payouts pendientes de pago
router.get(
  "/payouts/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { payouts, users, businesses, orders, paymentAccounts } =
        await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const pending = await db
        .select()
        .from(payouts)
        .where(eq(payouts.status, "pending"));

      const enriched = await Promise.all(
        pending.map(async (p) => {
          let recipientName = "";
          let recipientUserId = p.recipientId;
          let businessName: string | null = null;
          const isWithdrawal = (p.orderId || "").startsWith("wdr-");

          if (p.recipientType === "business") {
            const [biz] = await db
              .select({ name: businesses.name, ownerId: businesses.ownerId })
              .from(businesses)
              .where(eq(businesses.id, p.recipientId))
              .limit(1);
            if (biz) {
              recipientName = biz.name ?? "";
              businessName = biz.name ?? null;
              if (biz.ownerId) recipientUserId = biz.ownerId;
            } else if (isWithdrawal) {
              // Los retiros guardan el id del USUARIO como recipientId
              const [usr] = await db
                .select({ name: users.name })
                .from(users)
                .where(eq(users.id, p.recipientId))
                .limit(1);
              recipientName = usr?.name ?? "";
            }
          } else {
            const [usr] = await db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, p.recipientId))
              .limit(1);
            recipientName = usr?.name ?? "";
          }

          // Cuentas de pago del recipiente
          const accounts = await db
            .select()
            .from(paymentAccounts)
            .where(eq(paymentAccounts.userId, recipientUserId));

          // Datos del pedido (los retiros wdr- no tienen pedido asociado)
          const [order] = isWithdrawal
            ? [null]
            : await db
                .select({
                  paymentMethod: orders.paymentMethod,
                  assignedAt: orders.assignedAt,
                  deliveredAt: orders.deliveredAt,
                  total: orders.total,
                  businessName: orders.businessName,
                })
                .from(orders)
                .where(eq(orders.id, p.orderId))
                .limit(1);

          let deliveryMinutes: number | null = null;
          if (order?.assignedAt && order?.deliveredAt) {
            deliveryMinutes = Math.round(
              (new Date(order.deliveredAt).getTime() -
                new Date(order.assignedAt).getTime()) /
                60000,
            );
          }

          return {
            ...p,
            recipientName,
            isWithdrawal,
            paymentAccounts: accounts,
            paymentMethod: order?.paymentMethod ?? null,
            deliveryMinutes,
            orderTotal: order?.total ?? null,
            businessName: order?.businessName ?? businessName ?? null,
          };
        }),
      );

      res.json({ success: true, payouts: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/admin/payouts/fix-amounts — corregir payouts con montos en centavos (legacy)
router.post(
  "/payouts/fix-amounts",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { payouts } = await import("@shared/schema-mysql");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const all = await db.select().from(payouts);
      const fixed = 0;

      // No-op de seguridad: este endpoint era un parche legacy que dividía
      // por 100 los montos antiguos (bolívares). Con todos los importes ya en
      // céntimos, volver a dividir corrompería los datos (59,80 € -> 0,60 €).
      // Se mantiene por compatibilidad, sin modificar nada.

      res.json({ success: true, fixed, total: all.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/admin/payouts/backfill — crear payouts para pedidos entregados sin payouts
router.post(
  "/payouts/backfill",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders, payouts, businesses } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { eq, and } = await import("drizzle-orm");

      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "delivered"),
            eq(orders.confirmedByCustomer, true),
          ),
        );

      const existingPayouts = await db
        .select({ orderId: payouts.orderId })
        .from(payouts);
      const existingOrderIds = new Set(existingPayouts.map((p) => p.orderId));

      const toProcess = deliveredOrders.filter(
        (o) => !existingOrderIds.has(o.id),
      );
      let created = 0;

      for (const order of toProcess) {
        const inserts: any[] = [];

        const [biz] = await db
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq(businesses.id, order.businessId))
          .limit(1);
        const businessOwnerId = biz?.ownerId || order.businessId;

        const businessAmount = order.businessEarnings || order.subtotal || 0;
        if (businessAmount > 0) {
          inserts.push({
            orderId: order.id,
            recipientId: businessOwnerId,
            recipientType: "business" as const,
            amount: businessAmount,
            status: "pending" as const,
          });
        }

        const driverAmount = order.deliveryEarnings || order.deliveryFee || 0;
        if (order.deliveryPersonId && driverAmount > 0) {
          inserts.push({
            orderId: order.id,
            recipientId: order.deliveryPersonId,
            recipientType: "driver" as const,
            amount: driverAmount,
            status: "pending" as const,
          });
        }

        if (inserts.length > 0) {
          await db.insert(payouts).values(inserts);
          created += inserts.length;
        }
      }

      res.json({ success: true, processed: toProcess.length, created });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// POST /api/admin/finance/payout-proof-upload — subir comprobante de transferencia
router.post(
  "/payout-proof-upload",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { image } = req.body;
      if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({ success: false, error: "Imagen requerida (data:image/...)" });
      }

      const estimatedBytes = Math.ceil(image.length * 0.75);
      if (estimatedBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: "El archivo es muy pesado. Máximo 5MB" });
      }

      const { CloudinaryService } = await import("../cloudinaryService");
      const url = await CloudinaryService.uploadImage(
        image,
        "comprobantes",
        `payout-proof-${req.user!.id}-${Date.now()}`,
      );

      res.json({ success: true, url });
    } catch (error: any) {
      console.error("Payout proof upload error:", error);
      res.status(500).json({ success: false, error: "Error al subir el comprobante" });
    }
  },
);

// POST /api/admin/payouts/:id/mark-paid — marcar payout como pagado + notificar
router.post(
  "/payouts/:id/mark-paid",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { payouts, users, businesses } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { notes, proofUrl, method } = req.body;

      const [payout] = await db
        .select()
        .from(payouts)
        .where(eq(payouts.id, req.params.id))
        .limit(1);
      if (!payout)
        return res.status(404).json({ error: "Payout no encontrado" });
      if (payout.status === "paid" || payout.status === "stripe_auto")
        return res.status(400).json({ error: "Este pago ya fue procesado" });

      // El admin debe registrar referencia y comprobante antes de aprobar
      const cleanNotes = (notes || "").trim();
      if (!cleanNotes) {
        return res.status(400).json({
          error: "Indica la referencia / nota de la transferencia realizada",
        });
      }
      if (!proofUrl) {
        return res.status(400).json({
          error: "Adjunta la captura del comprobante de la transferencia",
        });
      }

      await db
        .update(payouts)
        .set({
          status: "paid",
          paidBy: req.user!.id,
          paidAt: new Date(),
          method: method || payout.method || "transferencia",
          notes: cleanNotes,
          proofUrl,
        })
        .where(eq(payouts.id, req.params.id));

      // Si es una solicitud de retiro (order_id con prefijo wdr-),
      // liquidar el saldo retenido en la wallet del usuario
      if ((payout.orderId || "").startsWith("wdr-")) {
        try {
          const { settleWithdrawalWallet } = await import("../payoutService");
          await settleWithdrawalWallet(payout.recipientId, payout.amount);
        } catch (settleError) {
          console.error("Error settling withdrawal wallet:", settleError);
        }
      }

      // Notificación push al recipiente
      try {
        const { sendPushToUser } = await import("../enhancedPushService");
        let recipientUserId = payout.recipientId;

        // Si es negocio, notificar al dueño
        if (payout.recipientType === "business") {
          const [biz] = await db
            .select({ ownerId: businesses.ownerId })
            .from(businesses)
            .where(eq(businesses.id, payout.recipientId))
            .limit(1);
          if (biz?.ownerId) recipientUserId = biz.ownerId;
        }

        const amountEur = `€${(payout.amount / 100).toFixed(2)}`;
        const methodLabel =
          method === "bizum"
            ? "Bizum"
            : method === "transferencia"
              ? "Transferencia IBAN"
              : method === "paypal"
                ? "PayPal"
                : "transferencia";

        await sendPushToUser(recipientUserId, {
          title: "💰 Pago recibido",
          body: `ComeYa te ha enviado ${amountEur} vía ${methodLabel}. Pedido ${await orderRefFromId(payout.orderId)}.`,
          data: {
            screen:
              payout.recipientType === "business"
                ? "BusinessFinances"
                : "DriverEarnings",
            payoutId: payout.id,
          },
        });
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// GET /api/admin/finance/payouts/history — historial de payouts pagados
router.get(
  "/payouts/history",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { payouts, users, businesses, orders } = await import(
        "@shared/schema-mysql"
      );
      const { db } = await import("../db");
      const { inArray, eq, desc } = await import("drizzle-orm");

      // Incluye pagos manuales (paid) y automáticos de Stripe (stripe_auto)
      const paid = await db
        .select()
        .from(payouts)
        .where(inArray(payouts.status, ["paid", "stripe_auto"]))
        .orderBy(desc(payouts.paidAt));

      console.log(`[Finance] Found ${paid.length} paid payouts`);

      const enriched = await Promise.all(
        paid.map(async (p) => {
          let recipientName = "";
          let businessName = null;

          if (p.recipientType === "business") {
            const [biz] = await db
              .select({ name: businesses.name })
              .from(businesses)
              .where(eq(businesses.id, p.recipientId))
              .limit(1);
            if (biz) {
              recipientName = biz.name ?? "";
            } else {
              // Retiros wdr- guardan el id del usuario
              const [usr] = await db
                .select({ name: users.name })
                .from(users)
                .where(eq(users.id, p.recipientId))
                .limit(1);
              recipientName = usr?.name ?? "";
            }
          } else {
            const [usr] = await db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, p.recipientId))
              .limit(1);
            recipientName = usr?.name ?? "";

            // Si es driver, obtener nombre del negocio del pedido
            const [order] = await db
              .select({ businessName: orders.businessName })
              .from(orders)
              .where(eq(orders.id, p.orderId))
              .limit(1);
            businessName = order?.businessName ?? null;
          }

          // proofUrl vive en su columna; legacy: dentro de accountSnapshot
          let proofUrl = p.proofUrl ?? null;
          if (!proofUrl && p.accountSnapshot) {
            try {
              const snap = JSON.parse(p.accountSnapshot);
              proofUrl = snap?.proofUrl ?? null;
            } catch {
              /* snapshot no JSON */
            }
          }
          return {
            ...p,
            recipientName,
            businessName,
            proofUrl,
          };
        }),
      );

      res.json({ success: true, payouts: enriched });
    } catch (error: any) {
      console.error("[Finance] History error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

export default router;
