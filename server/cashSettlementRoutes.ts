// Cash Settlement Routes - Para que negocios registren liquidaciones
import { Router } from "express";
import { db } from "./db";
import { orders, wallets, transactions } from "@shared/schema-mysql";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "./authMiddleware";

const router = Router();

// Ver pedidos en efectivo pendientes de liquidar (para el negocio)
router.get("/pending", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Obtener negocios del owner
    const { businesses } = await import("@shared/schema-mysql");
    const ownerBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, userId));

    if (ownerBusinesses.length === 0) {
      return res.json({ success: true, orders: [], total: 0 });
    }

    const businessIds = ownerBusinesses.map((b) => b.id);

    // Pedidos en efectivo entregados pero no liquidados
    const { inArray, sql } = await import("drizzle-orm");

    const allOrders = await db.select().from(orders);
    const pendingOrders = allOrders.filter(
      (o) =>
        businessIds.includes(o.businessId) &&
        o.paymentMethod === "cash" &&
        o.status === "delivered" &&
        o.cashSettled === false,
    );

    // Calcular comisiones si no están definidas
    const { financialService } = await import("./unifiedFinancialService");
    let total = 0;

    for (const order of pendingOrders) {
      if (order.businessEarnings) {
        total += order.businessEarnings;
      } else {
        // Negocio recibe: 100% del subtotal
        const businessShare = order.subtotal;
        total += businessShare;
      }
    }

    res.json({
      success: true,
      orders: pendingOrders,
      total,
      count: pendingOrders.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar pedido como liquidado
router.post("/settle/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    // Verificar que el pedido pertenece a un negocio del owner
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const { businesses } = await import("@shared/schema-mysql");
    const [business] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, order.businessId),
          eq(businesses.ownerId, userId),
        ),
      )
      .limit(1);

    if (!business) {
      return res.status(403).json({ error: "No tienes permiso" });
    }

    if (order.paymentMethod !== "cash") {
      return res.status(400).json({ error: "El pedido no es en efectivo" });
    }

    if (order.cashSettled) {
      return res.status(400).json({ error: "Ya está liquidado" });
    }

    // Verificar que no haya sido liquidado recientemente (evitar doble click)
    const recentSettlement = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, orderId),
          eq(transactions.type, "cash_settlement"),
          eq(transactions.status, "completed"),
        ),
      )
      .limit(1);

    if (recentSettlement.length > 0) {
      return res.status(400).json({ error: "Este pedido ya fue liquidado" });
    }

    // Calcular el monto total a descontar (business + platform)
    const { financialService } = await import("./unifiedFinancialService");
    const commissions = await financialService.calculateCommissions(
      order.total,
      order.deliveryFee || 0,
    );

    // El repartidor debe entregar: business + platform (NO su comisión)
    const totalDebtForOrder = commissions.business + commissions.platform;

    // Marcar como liquidado
    await db
      .update(orders)
      .set({
        cashSettled: 1,
        cashSettledAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Reducir deuda del driver por el monto COMPLETO
    if (order.deliveryPersonId) {
      const [driverWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, order.deliveryPersonId))
        .limit(1);

      if (driverWallet) {
        await db
          .update(wallets)
          .set({
            cashOwed: Math.max(0, driverWallet.cashOwed - totalDebtForOrder),
          })
          .where(eq(wallets.userId, order.deliveryPersonId));

        // Registrar transacción de pago de deuda
        await db.insert(transactions).values({
          walletId: driverWallet.id,
          userId: order.deliveryPersonId,
          orderId: order.id,
          type: "cash_debt_payment",
          amount: -totalDebtForOrder,
          balanceBefore: driverWallet.cashOwed,
          balanceAfter: Math.max(0, driverWallet.cashOwed - totalDebtForOrder),
          description: `Deuda liquidada por negocio - Pedido #${order.id.slice(-6)}`,
          status: "completed",
        });
      }
    }

    res.json({
      success: true,
      message: "Liquidación registrada",
      settled: (totalDebtForOrder / 100).toFixed(2),
      breakdown: {
        business: (commissions.business / 100).toFixed(2),
        platform: (commissions.platform / 100).toFixed(2),
        total: (totalDebtForOrder / 100).toFixed(2),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
