import express from "express";
import { authenticateToken } from "../authMiddleware";
import { db } from "../db";
import { users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";
import { getStripe } from "../stripeClient";

const router = express.Router();

// ---------------------------------------------------------------------------
// Utilidades de cliente Stripe
// El stripe_customer_id guardado en BD puede quedar huérfano (cambio de clave
// test/live o cliente borrado en el panel de Stripe). Al usarlo la API
// responde "No such customer": lo detectamos, creamos un customer nuevo,
// lo persistimos y reintentamos la operación una vez.
// ---------------------------------------------------------------------------

function isMissingStripeCustomerError(error: any): boolean {
  return (
    error?.code === "resource_missing" ||
    (typeof error?.message === "string" &&
      error.message.includes("No such customer"))
  );
}

async function loadUserForStripe(userId: string): Promise<any> {
  const { sql } = await import("drizzle-orm");
  const [userRows]: any = await db.execute(
    sql`SELECT id, name, stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1`,
  );
  return userRows[0];
}

async function createAndStoreStripeCustomer(
  userId: string,
  name?: string | null,
): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { userId },
    ...(name ? { name } : {}),
  });
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql`UPDATE users SET stripe_customer_id = ${customer.id} WHERE id = ${userId}`,
  );
  return customer.id;
}

/** Ejecuta op(customerId); si el customer guardado no existe en Stripe,
 *  crea uno nuevo, lo guarda y reintenta una vez. */
async function withStripeCustomer<T>(
  userId: string,
  op: (customerId: string) => Promise<T>,
): Promise<{ result: T; customerId: string }> {
  const user = await loadUserForStripe(userId);
  let customerId: string | undefined = user?.stripe_customer_id;
  if (!customerId) {
    customerId = await createAndStoreStripeCustomer(userId, user?.name);
  }
  try {
    return { result: await op(customerId), customerId };
  } catch (error) {
    if (isMissingStripeCustomerError(error)) {
      customerId = await createAndStoreStripeCustomer(userId, user?.name);
      return { result: await op(customerId), customerId };
    }
    throw error;
  }
}

/** Registra el detalle en el log del servidor y responde al cliente con un
 *  mensaje legible, sin filtrar errores técnicos de Stripe. */
function stripeErrorResponse(res: any, error: any, context: string) {
  console.error(`[stripe] ${context}`, {
    code: error?.code,
    type: error?.type,
    message: error?.message,
  });
  res.status(500).json({
    error: "No se pudo procesar el pago. Inténtalo de nuevo en unos momentos.",
  });
}

// Publishable key for Stripe SDK (public endpoint)
router.get("/publishable-key", async (_req, res) => {
  try {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (error: any) {
    stripeErrorResponse(res, error, "publishable-key");
  }
});

// Create PaymentSheet — devuelve paymentIntent + ephemeralKey + customerId
router.post("/create-payment-sheet", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }

    const {
      amount,
      businessId,
      orderId,
      giftCardId,
      isGiftCard,
      subtotal,
      deliveryFee,
    } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Datos de pago incompletos" });
    }
    if (isGiftCard && !giftCardId) {
      return res.status(400).json({ error: "Datos de gift card incompletos" });
    }
    if (!isGiftCard && !orderId) {
      return res.status(400).json({ error: "Datos de pago incompletos" });
    }
    if (!isGiftCard && !businessId) {
      return res.status(400).json({ error: "Datos de pago incompletos" });
    }

    const stripe = getStripe();
    const { orders } = await import("@shared/schema-mysql");

    // Calcular comision
    const subtotalCents = Math.round(subtotal || 0);
    const nemyCommission = Math.round(subtotalCents * 0.15);
    const amountCents = Math.round(amount);

    // Customer + ephemeral key + PaymentIntent con recuperacion automatica:
    // si el customer guardado ya no existe en la cuenta de Stripe se crea
    // uno nuevo y se reintenta una vez.
    const { result: payment, customerId } = await withStripeCustomer(
      req.user!.id,
      async (cid) => {
        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: cid },
          { apiVersion: "2024-06-20" },
        );
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "eur",
          customer: cid,
          automatic_payment_methods: { enabled: true },
          metadata: {
            userId: req.user!.id,
            businessId: businessId || "",
            orderId: orderId || "",
            giftCardId: giftCardId || "",
            subtotal: subtotalCents.toString(),
            deliveryFee: (deliveryFee || 0).toString(),
            nemyCommission: nemyCommission.toString(),
          },
        });
        return { ephemeralKeySecret: ephemeralKey.secret, paymentIntent };
      },
    );

    // Actualizar pedido con el paymentIntentId solo para pedidos normales
    if (!isGiftCard && orderId) {
      await db
        .update(orders)
        .set({
          paymentIntentId: payment.paymentIntent.id,
          stripePaymentIntentId: payment.paymentIntent.id,
          productosBase: subtotalCents,
          nemyCommission,
          platformFee: nemyCommission,
          businessEarnings: subtotalCents,
          deliveryEarnings: deliveryFee || 0,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    res.json({
      paymentIntent: payment.paymentIntent.client_secret,
      ephemeralKey: payment.ephemeralKeySecret,
      customer: customerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error: any) {
    stripeErrorResponse(res, error, "create-payment-sheet");
  }
});

// Create PaymentIntent for checkout
router.post("/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
      console.error("Stripe config missing", {
        hasSecret: !!process.env.STRIPE_SECRET_KEY,
        hasPublishable: !!process.env.STRIPE_PUBLISHABLE_KEY,
      });
      return res.status(503).json({ message: "Stripe no está configurado" });
    }

    const {
      amount,
      businessId,
      orderId,
      giftCardId,
      subtotal,
      deliveryFee,
      isGiftCard,
      isSubscription,
    } = req.body;
    if (!amount || amount <= 0) {
      console.error("Invalid payment intent data", {
        amount,
        businessId,
        orderId,
        giftCardId,
        userId: req.user?.id,
      });
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }
    if (isGiftCard && !giftCardId) {
      return res
        .status(400)
        .json({ message: "Datos de gift card incompletos" });
    }
    if (!isGiftCard && !isSubscription && !orderId) {
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }
    // businessId solo es obligatorio para pedidos normales
    if (!isGiftCard && !isSubscription && !businessId) {
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }

    // Get business Stripe Connect account (solo para pedidos normales)
    let business = null;
    if (businessId && !isGiftCard && !isSubscription) {
      const { businesses } = await import("@shared/schema-mysql");
      const [b] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
      if (!b) return res.status(404).json({ message: "Negocio no encontrado" });
      business = b;
    }

    const stripe = getStripe();
    const amountInCents = Math.round(amount);
    const subtotalInCents = Math.round(subtotal || 0);

    // Comision ComeYa (15% del subtotal)
    const nemyCommission = Math.round(subtotalInCents * 0.15);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      metadata: {
        userId: req.user!.id,
        businessId: businessId || "",
        orderId: orderId || "",
        giftCardId: giftCardId || "",
        subtotal: subtotalInCents.toString(),
        deliveryFee: (deliveryFee || 0).toString(),
        nemyCommission: nemyCommission.toString(),
      },
    });

    // Update order with payment details (solo pedidos normales)
    if (orderId && !isGiftCard && !isSubscription) {
      const { orders } = await import("@shared/schema-mysql");
      await db
        .update(orders)
        .set({
          paymentIntentId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          productosBase: subtotalInCents,
          nemyCommission,
          platformFee: nemyCommission,
          businessEarnings: subtotalInCents, // Business gets 100% of products
          deliveryEarnings: deliveryFee || 0, // Delivery gets 100% of delivery fee
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Create payment intent error", {
      userId: req.user?.id,
      amount: req.body?.amount,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });
    res.status(500).json({ message: "No se pudo crear el pago" });
  }
});

// Get saved payment method
router.get("/payment-method/:userId", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.userId as string))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Drivers don't need payment methods (they receive money)
    if (user.role === "delivery_driver") {
      return res.json({ hasCard: false });
    }

    if (user.cardLast4 && user.cardBrand) {
      return res.json({
        hasCard: true,
        card: {
          last4: user.cardLast4,
          brand: user.cardBrand,
        },
      });
    }

    res.json({ hasCard: false });
  } catch (error: any) {
    stripeErrorResponse(res, error, "payment-method");
  }
});

// Create setup intent for adding card.
// usage: "off_session" es imprescindible para poder cobrar la tarjeta guardada
// sin el usuario delante (tarifas de reservas, suscripciones).
router.post("/create-setup-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    const userId = req.body?.userId || req.user!.id;

    const { result: setupIntent } = await withStripeCustomer(
      userId,
      async (cid) =>
        stripeClient.setupIntents.create({
          customer: cid,
          payment_method_types: ["card"],
          usage: "off_session",
        }),
    );

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error: any) {
    stripeErrorResponse(res, error, "create-setup-intent");
  }
});

// Save payment method
router.post("/save-payment-method", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    const userId = req.body?.userId || req.user!.id;
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) {
      return res.status(400).json({ error: "paymentMethodId requerido" });
    }

    const paymentMethod =
      await stripeClient.paymentMethods.retrieve(paymentMethodId);

    // Adjuntar el método al customer de la plataforma si aún no lo está:
    // sin el attach no se puede cobrar off-session más adelante
    const { customerId } = await withStripeCustomer(userId, async (cid) => {
      if (paymentMethod.customer && paymentMethod.customer !== cid) {
        return null; // pertenece a otro customer: no se re-attach
      }
      if (!paymentMethod.customer) {
        return stripeClient.paymentMethods.attach(paymentMethodId, {
          customer: cid,
        });
      }
      return null;
    });

    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        cardLast4: paymentMethod.card?.last4 || null,
        cardBrand: paymentMethod.card?.brand || null,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      card: {
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
      },
    });
  } catch (error: any) {
    stripeErrorResponse(res, error, "save-payment-method");
  }
});

// Delete payment method
router.delete(
  "/payment-method/:userId",
  authenticateToken,
  async (req, res) => {
    try {
      await db
        .update(users)
        .set({
          stripePaymentMethodId: null,
          cardLast4: null,
          cardBrand: null,
        })
        .where(eq(users.id, req.params.userId as string));

      res.json({ success: true });
    } catch (error: any) {
      stripeErrorResponse(res, error, "delete-payment-method");
    }
  },
);

// Confirm delivery and release funds (customer confirms receipt)
router.post(
  "/confirm-delivery/:orderId",
  authenticateToken,
  async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
      const {
        orders,
        businesses,
        users: usersTable,
      } = await import("@shared/schema-mysql");

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, req.params.orderId as string))
        .limit(1);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.userId !== req.user!.id)
        return res.status(403).json({ error: "Not authorized" });
      if (order.status !== "delivered")
        return res.status(400).json({ error: "Order not delivered yet" });
      if (order.confirmedByCustomer)
        return res.status(400).json({ error: "Already confirmed" });
      if (!order.paymentIntentId)
        return res.status(400).json({ error: "No payment found" });

      // Get business and driver accounts
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Business not found" });

      // Si el negocio tiene Stripe Connect → transferencia automatica
      // Si no → crear payouts manuales para que el admin transfiera
      const hasStripeConnect = !!business.stripeAccountId;

      let driverAccount = null;
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, order.deliveryPersonId))
          .limit(1);
        driverAccount = driver?.stripeAccountId;
      }

      const businessAmount =
        order.businessEarnings || order.productosBase || order.subtotal || 0;
      const deliveryAmount = order.deliveryEarnings || order.deliveryFee || 0;

      let businessTransferId = null;
      let driverTransferId = null;

      if (hasStripeConnect && order.paymentIntentId) {
        // Transferencia automatica via Stripe Connect
        const paymentIntent = await stripeClient.paymentIntents.retrieve(
          order.paymentIntentId,
        );
        const chargeId = (paymentIntent as any).latest_charge as string;
        if (chargeId) {
          const businessTransfer = await stripeClient.transfers.create({
            amount: businessAmount,
            currency: "eur",
            destination: business.stripeAccountId!,
            source_transaction: chargeId,
            metadata: { orderId: order.id, type: "business_payment" },
          });
          businessTransferId = businessTransfer.id;

          if (driverAccount && deliveryAmount > 0) {
            const driverTransfer = await stripeClient.transfers.create({
              amount: deliveryAmount,
              currency: "eur",
              destination: driverAccount,
              source_transaction: chargeId,
              metadata: { orderId: order.id, type: "delivery_payment" },
            });
            driverTransferId = driverTransfer.id;
          }
        }
      } else {
        // Fallback: crear payouts manuales
        const { createPayoutsForOrder } = await import("../payoutService");
        await createPayoutsForOrder(order.id);
      }

      // Marcar pedido como confirmado
      await db
        .update(orders)
        .set({
          confirmedByCustomer: true,
          confirmedByCustomerAt: new Date(),
          fundsReleased: true,
          fundsReleasedAt: new Date(),
          businessTransferId,
          driverTransferId,
          driverPaymentStatus: driverTransferId ? "completed" : "pending",
          driverPaidAt: driverTransferId ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      // Agregar puntos de lealtad al cliente
      try {
        const { LoyaltyService } = await import("../loyaltyService");
        await LoyaltyService.awardPointsForOrder(
          order.userId,
          order.id,
          order.total,
        );
        console.log(
          `✅ Puntos de lealtad awarded para orden ${order.id.slice(-6)}`,
        );
      } catch (loyaltyError) {
        console.error("⚠️ Error agregando puntos de lealtad:", loyaltyError);
      }

      res.json({
        success: true,
        message: hasStripeConnect
          ? "Fondos transferidos automaticamente"
          : "Pedido confirmado. Pago pendiente de transferencia manual.",
        businessTransferId,
        driverTransferId,
        method: hasStripeConnect ? "stripe_connect" : "manual_payout",
      });
    } catch (error: any) {
      console.error("Confirm delivery error:", error);
      res
        .status(500)
        .json({ error: "No se pudo confirmar la entrega. Inténtalo de nuevo." });
    }
  },
);

// POST /api/stripe/create-subscription-payment-intent — PaymentIntent para suscripción
router.post(
  "/create-subscription-payment-intent",
  authenticateToken,
  async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: "Stripe no configurado" });
      }
      const { subscriptionId, amount } = req.body;
      if (!subscriptionId || !amount || amount <= 0) {
        return res
          .status(400)
          .json({ error: "subscriptionId y amount son requeridos" });
      }

      const { subscriptions } = await import("@shared/schema-mysql");
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId as string))
        .limit(1);
      if (!sub || sub.userId !== req.user!.id) {
        return res.status(404).json({ error: "Suscripción no encontrada" });
      }

      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        metadata: { userId: req.user!.id, subscriptionId, plan: sub.plan },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      stripeErrorResponse(res, error, "create-subscription-payment-intent");
    }
  },
);

// POST /api/stripe/confirm-subscription/:subscriptionId — activar suscripción tras pago Stripe
router.post(
  "/confirm-subscription/:subscriptionId",
  authenticateToken,
  async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { subscriptions } = await import("@shared/schema-mysql");
      const { sql } = await import("drizzle-orm");

      // Buscar por id O por userId (por si el subscriptionId cambio al sobreescribir)
      let [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId as string))
        .limit(1);

      // Si no encontramos por id exacto, buscar la suscripcion activa/pending del usuario
      if (!sub || sub.userId !== req.user!.id) {
        const [byUser] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, req.user!.id))
          .limit(1);
        if (!byUser)
          return res.status(404).json({ error: "Suscripción no encontrada" });
        sub = byUser;
      }

      const now = new Date();
      const periodEnd = new Date(now);
      sub.billingCycle === "yearly"
        ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        : periodEnd.setMonth(periodEnd.getMonth() + 1);

      await db
        .update(subscriptions)
        .set({
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          autoRenew: true,
          cancelledAt: null as any, // Limpiar cancelación previa si la hubiera
        })
        .where(eq(subscriptions.userId, req.user!.id));

      // Efectos del plan (negocio destacado para Top/Premium/Express)
      const { SubscriptionService } = await import("../subscriptionService");
      await SubscriptionService.applyPlanActivationSideEffects(
        sub.userId,
        sub.plan,
      ).catch(() => {});

      try {
        const { sendPushToUser } = await import("../enhancedPushService");
        await sendPushToUser(sub.userId, {
          title: "✅ Suscripción activada",
          body: `Tu plan ${sub.plan} ya está activo. ¡Disfruta los beneficios!`,
          data: { screen: "Subscriptions" },
        });
      } catch {}

      res.json({ success: true, plan: sub.plan });
    } catch (error: any) {
      stripeErrorResponse(res, error, "confirm-subscription");
    }
  },
);

// GET /api/stripe/cards — tarjetas guardadas del usuario
router.get("/cards", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!user.stripePaymentMethodId || !user.cardLast4) {
      return res.json({ cards: [] });
    }

    res.json({
      cards: [
        {
          id: user.stripePaymentMethodId,
          brand: user.cardBrand || "card",
          last4: user.cardLast4,
          expMonth: 12,
          expYear: 2026,
          isDefault: true,
        },
      ],
    });
  } catch (error: any) {
    stripeErrorResponse(res, error, "cards");
  }
});

// GET /api/stripe/history — historial de pagos
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { desc } = await import("drizzle-orm");
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.id))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    const payments = userOrders
      .filter((o: any) => o.stripePaymentIntentId || o.paymentMethod)
      .map((o: any) => ({
        payment: {
          id: o.stripePaymentIntentId || o.id,
          amount: o.total || 0,
          method: o.paymentMethod || "card",
          status: ["delivered", "accepted", "confirmed"].includes(o.status)
            ? "completed"
            : "pending",
          createdAt: o.createdAt,
        },
        order: {
          id: o.id,
          total: o.total || 0,
          status: o.status,
        },
      }));

    res.json({ payments });
  } catch (error: any) {
    stripeErrorResponse(res, error, "history");
  }
});

// PUT /api/stripe/cards/:cardId/default — marcar tarjeta como predeterminada
router.put("/cards/:cardId/default", authenticateToken, async (req, res) => {
  res.json({ success: true });
});

// DELETE /api/stripe/cards/:cardId — eliminar tarjeta
router.delete("/cards/:cardId", authenticateToken, async (req, res) => {
  try {
    await db
      .update(users)
      .set({
        stripePaymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
      })
      .where(eq(users.id, req.user!.id));
    res.json({ success: true });
  } catch (error: any) {
    stripeErrorResponse(res, error, "delete-card");
  }
});

export default router;
