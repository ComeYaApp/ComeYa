// Reservas de mesa 2.0: los negocios (con o sin reparto) reciben reservas que
// gestionan desde su panel. Si configuran aforo (reservation_config), ComeYa
// genera franjas reales desde su horario, muestra disponibilidad, confirma
// automáticamente y cobra 0,99 € por comensal que asiste (transacción en la
// wallet del negocio). Sin aforo configurado se mantiene el flujo manual MVP.
import { Router } from "express";
import { db } from "./db";
import {
  reservations,
  businesses,
  users,
  wallets,
  transactions,
  paymentProofs,
  reservationWaitlist,
  reservationFlash,
  reservationParticipants,
  restaurantBills,
} from "@shared/schema-mysql";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { authenticateToken, requireRole } from "./authMiddleware";
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from "./errors";
import { sendPushToUser } from "./enhancedPushService";
import { BusinessHoursService } from "./businessHoursService";
import {
  ReservationAvailabilityService,
  RESERVATION_FEE_CENTS_PER_GUEST,
} from "./reservationAvailabilityService";
import {
  ReservationFeeSettlementService,
  MIN_PAYABLE_CENTS,
} from "./reservationFeeSettlementService";
import { LoyaltyService } from "./loyaltyService";
import { randomUUID } from "crypto";

const router = Router();

const OCCASIONS = [
  "birthday",
  "anniversary",
  "date",
  "family",
  "business",
  "celebration",
];

// Puntos ComeYa por eventos de reserva (Rewards)
const POINTS_RESERVATION_CONFIRMED = 10;
const POINTS_RESERVATION_ATTENDED = 20;

// ComeYa Pass: los miembros ganan el doble de puntos en reservas
async function passDoublesPoints(userId: string): Promise<boolean> {
  try {
    const { subscriptions } = await import("@shared/schema-mysql");
    const rows = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.plan, "comeya_pass"),
          eq(subscriptions.status, "active"),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}


// ¿Cabe ahora el grupo en la franja donde esperaba? (para liberar la lista)
async function waitlistEntryNowFits(entry: any): Promise<boolean> {
  const business =
    await ReservationAvailabilityService.getBusiness(entry.businessId);
  if (!business) return false;
  const { slots } = await ReservationAvailabilityService.getSlotsForDay(
    business,
    entry.date,
    entry.partySize,
  );
  const slot = slots.find((s: any) => s.time === entry.time);
  return !!slot && slot.status !== "full" && !slot.isPast;
}

// Tras liberar capacidad (cancelación/rechazo) se avisa a la lista de espera
// cuya franja vuelve a tener sitio. El primero que reserve se queda la mesa:
// lo garantiza el re-chequeo de aforo en POST /.
async function notifyFreedCapacity(businessId: string, date: string) {
  const entries = await db
    .select()
    .from(reservationWaitlist)
    .where(
      and(
        eq(reservationWaitlist.businessId, businessId),
        eq(reservationWaitlist.date, date),
        eq(reservationWaitlist.status, "active"),
      ),
    )
    .limit(50);

  const [biz] = await db
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  for (const entry of entries) {
    if (!(await waitlistEntryNowFits(entry))) continue;
    await db
      .update(reservationWaitlist)
      .set({ status: "notified", notifiedAt: new Date() })
      .where(eq(reservationWaitlist.id, entry.id));
    try {
      await sendPushToUser(entry.userId, {
        title: "🔔 ¡Se liberó una mesa!",
        body: `${biz?.name || "El restaurante"} tiene mesa para ${entry.partySize} el ${entry.date} a las ${entry.time}. ¡Reserva rápido antes de que la cojan!`,
        data: { screen: "MyReservations", businessId },
      });
    } catch {}
  }
}

// Radar ComeYa: el negocio publica un hueco y se avisa a quien esperaba mesa
async function notifyFlashToWaitlist(
  businessId: string,
  flash: { date: string; time: string; partySize: number },
) {
  const entries = await db
    .select()
    .from(reservationWaitlist)
    .where(
      and(
        eq(reservationWaitlist.businessId, businessId),
        eq(reservationWaitlist.date, flash.date),
        eq(reservationWaitlist.status, "active"),
      ),
    )
    .limit(50);

  const [biz] = await db
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  for (const entry of entries) {
    if (entry.partySize > flash.partySize) continue;
    try {
      await sendPushToUser(entry.userId, {
        title: "⚡ Mesa flash disponible",
        body: `${biz?.name || "El restaurante"} acaba de publicar una mesa para ${flash.partySize} el ${flash.date} a las ${flash.time}. Reserva ahora.`,
        data: { screen: "MyReservations", businessId },
      });
    } catch {}
  }
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function isValidDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidTime(time: unknown): time is string {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// Tarifa ComeYa: 0,99 € por comensal que asiste, como transacción negativa en
// la wallet del dueño del negocio. Idempotente vía fee_charged_at.
async function chargeReservationFee(
  reservation: any,
  business: any,
): Promise<{ charged: boolean; feeCents: number }> {
  if (reservation.feeChargedAt) {
    return { charged: false, feeCents: reservation.feeCents || 0 };
  }
  const ownerId = business?.ownerId;
  if (!ownerId) return { charged: false, feeCents: 0 };

  const feeCents = RESERVATION_FEE_CENTS_PER_GUEST * (reservation.partySize || 0);
  const now = new Date();

  // Idempotencia: la primera escritura de fee_charged_at gana; si otra
  // petición concurrente ya la fijó, no se toca la wallet
  const claim = await db
    .update(reservations)
    .set({ feeCents, feeChargedAt: now, updatedAt: now })
    .where(
      and(
        eq(reservations.id, reservation.id),
        sql`${reservations.feeChargedAt} IS NULL`,
      ),
    );
  const claimed = Number((claim as any)?.[0]?.affectedRows ?? 1) > 0;
  if (!claimed) {
    return { charged: false, feeCents: reservation.feeCents || feeCents };
  }

  let [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, ownerId))
    .limit(1);
  if (!wallet) {
    await db.insert(wallets).values({
      userId: ownerId,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });
    [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, ownerId))
      .limit(1);
  }

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore - feeCents;
  await db
    .update(wallets)
    .set({ balance: balanceAfter, updatedAt: now })
    .where(eq(wallets.id, wallet.id));

  await db.insert(transactions).values({
    walletId: wallet.id,
    userId: ownerId,
    businessId: business.id,
    type: "reservation_fee",
    amount: -feeCents,
    balanceBefore,
    balanceAfter,
    description: `Tarifa reserva ${reservation.code || reservation.id.slice(-6).toUpperCase()} · ${reservation.partySize} comensales × 0,99 €`,
    status: "completed",
    metadata: JSON.stringify({
      reservationId: reservation.id,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      feePerGuestCents: RESERVATION_FEE_CENTS_PER_GUEST,
      source: "reservations_module",
    }),
  });

  return { charged: true, feeCents };
}

// ─────────────────────────────────────────────────────────────────────────────
// Disponibilidad de un negocio para una fecha (público, para el modal y el
// buscador de la Home)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const businessId = String(req.query.businessId || "");
    const date = String(req.query.date || "");
    const partySize = Math.max(1, Math.min(20, Number(req.query.partySize) || 2));
    if (!businessId || !isValidDate(date)) {
      throw new ValidationError("businessId y date (YYYY-MM-DD) son obligatorios");
    }

    const business =
      await ReservationAvailabilityService.getBusiness(businessId);
    if (!business) throw new NotFoundError("Negocio no encontrado");
    if (!business.reservationsEnabled) {
      throw new ValidationError("Este negocio no acepta reservas por la app");
    }

    const { slots, config, windows } =
      await ReservationAvailabilityService.getSlotsForDay(
        business,
        date,
        partySize,
      );
    res.json({
      success: true,
      date,
      partySize,
      windows,
      slots,
      config: config
        ? {
            capacityPerSlot: config.capacityPerSlot,
            turnMinutes: config.turnMinutes,
            slotMinutes: config.slotMinutes,
            maxPartySize: config.maxPartySize,
            advanceDays: config.advanceDays,
            autoConfirm: config.autoConfirm,
            maxCoversPerDay: config.maxCoversPerDay,
          }
        : null,
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Buscador de la Home (modo "Reservar"): negocios con reservas activadas y su
// disponibilidad real para la fecha/hora/comensales pedidos. Público.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || "");
    const time = String(req.query.time || ""); // opcional
    const partySize = Math.max(1, Math.min(20, Number(req.query.partySize) || 2));
    if (!isValidDate(date)) throw new ValidationError("date (YYYY-MM-DD) es obligatorio");
    if (time && !isValidTime(time)) throw new ValidationError("time inválida (HH:mm)");
    if (date < todayStr()) throw new ValidationError("No se puede buscar en una fecha pasada");

    const list = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.reservationsEnabled, true),
          eq(businesses.isActive, true),
        ),
      )
      .limit(100);

    const results = [];
    for (const business of list) {
      // Abierto ese día (sin horario configurado cuenta como abierto)
      let openThatDay = true;
      if (business.openingHours) {
        const hasSlot = await (async () => {
          const { slots } = await ReservationAvailabilityService.getSlotsForDay(
            business,
            date,
            partySize,
          );
          return slots.length > 0;
        })();
        openThatDay = hasSlot;
      }
      if (!openThatDay) continue;

      const summary = await ReservationAvailabilityService.getDaySummary(
        business,
        date,
      );

      let slotAtTime: any = null;
      if (time) {
        slotAtTime =
          summary.slots.find((s: any) => s.time === time) || null;
      }

      const anyAvailability = summary.freeSlots > 0;
      const status = !anyAvailability
        ? ("full" as const)
        : slotAtTime
          ? slotAtTime.status
          : ("available" as const);

      results.push({
        id: business.id,
        name: business.name,
        image: business.image,
        coverImage: business.coverImage,
        address: business.address,
        phone: business.phone,
        type: business.type,
        rating: business.rating,
        totalRatings: business.totalRatings,
        categories: business.categories,
        latitude: business.latitude,
        longitude: business.longitude,
        deliveryEnabled: business.deliveryEnabled,
        isOpen: business.isOpen,
        availability: {
          hasConfig: summary.hasConfig,
          freeSlots: summary.freeSlots,
          totalSlots: summary.totalSlots,
          confirmedCovers: summary.confirmedCovers,
          status, // available | last | full
          slotAtTime,
        },
      });
    }

    // Primero los que tienen mesa, luego el resto
    results.sort((a, b) => {
      const rank = (s: string) => (s === "available" ? 0 : s === "last" ? 1 : 2);
      return rank(a.availability.status) - rank(b.availability.status);
    });

    res.json({ success: true, date, time: time || null, partySize, businesses: results });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Crear reserva (cliente)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const {
      businessId,
      date,
      time,
      partySize,
      customerName,
      customerPhone,
      notes,
      occasion,
    } = req.body || {};

    if (!businessId || !date || !time) {
      throw new ValidationError("Negocio, fecha y hora son obligatorios");
    }
    if (!isValidDate(date)) {
      throw new ValidationError("Fecha inválida (formato YYYY-MM-DD)");
    }
    if (!isValidTime(time)) {
      throw new ValidationError("Hora inválida (formato HH:mm)");
    }
    const size = Math.max(1, Math.min(20, Number(partySize) || 2));

    if (new Date(`${date}T00:00:00`) < new Date(`${todayStr()}T00:00:00`)) {
      throw new ValidationError("No se puede reservar en una fecha pasada");
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business) throw new NotFoundError("Negocio no encontrado");
    if (!business.reservationsEnabled) {
      throw new ValidationError("Este negocio no acepta reservas por la app");
    }

    const config = ReservationAvailabilityService.configForBusiness(business);
    const maxAdvanceDays = config?.advanceDays ?? 60;
    if (
      new Date(`${date}T00:00:00`) >
      new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000)
    ) {
      throw new ValidationError(
        `Solo se puede reservar con hasta ${maxAdvanceDays} días de antelación`,
      );
    }
    if (config && size > config.maxPartySize) {
      throw new ValidationError(
        `Este negocio acepta grupos de hasta ${config.maxPartySize} comensales`,
      );
    }

    // La hora pedida debe caer dentro del horario del negocio ese día
    const openAt = await BusinessHoursService.isOpenAt(businessId, date, time);
    if (!openAt) {
      throw new ValidationError(
        "El negocio está cerrado a esa hora. Elige otro horario.",
      );
    }

    // Con aforo configurado, la hora debe ser una franja ofrecida y tener sitio
    if (config) {
      const offered = await ReservationAvailabilityService.isOfferedSlot(
        business,
        date,
        time,
      );
      if (!offered) {
        throw new ValidationError(
          "Esa hora no está disponible para reservar. Elige otra franja.",
        );
      }
      const check = await ReservationAvailabilityService.assertSlotAvailable(
        business,
        date,
        time,
        size,
      );
      if (!check.ok) throw new ValidationError(check.reason || "Franja no disponible");
    }

    // Sin duplicados: una reserva activa por cliente, negocio y día
    const [dup] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.userId, userId),
          eq(reservations.businessId, businessId),
          eq(reservations.date, date),
          inArray(reservations.status, ["pending", "confirmed", "seated"]),
        ),
      )
      .limit(1);
    if (dup) {
      throw new ValidationError(
        "Ya tienes una reserva para ese día en este negocio",
      );
    }

    const [user] = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const id = randomUUID();
    const finalName = String(customerName || user?.name || "").slice(0, 255);
    const finalPhone = String(customerPhone || user?.phone || "").slice(0, 50);

    // Auto-confirmación cuando el negocio configuró aforo y la activó
    const autoConfirm = !!(config?.autoConfirm);
    const status = autoConfirm ? "confirmed" : "pending";
    const code = autoConfirm
      ? await ReservationAvailabilityService.generateCode(businessId, date)
      : null;

    await db.insert(reservations).values({
      id,
      businessId,
      userId,
      date,
      time,
      partySize: size,
      customerName: finalName,
      customerPhone: finalPhone,
      notes: notes ? String(notes).slice(0, 500) : null,
      occasion: OCCASIONS.includes(occasion) ? occasion : null,
      status,
      code,
    });

    // Rewards: puntos por reserva confirmada
    if (status === "confirmed") {
      try {
        await LoyaltyService.addPoints(
          userId,
          POINTS_RESERVATION_CONFIRMED * ((await passDoublesPoints(userId)) ? 2 : 1),
          "reservation_confirmed",
        "Reserva confirmada",
          undefined,
          undefined,
        );
      } catch {}
    }

    // Si reservó desde un aviso de lista de espera / flash, cerrar su entrada
    // y marcar la flash como ocupada si coincide
    await db
      .update(reservationWaitlist)
      .set({ status: "fulfilled", updatedAt: new Date() })
      .where(
        and(
          eq(reservationWaitlist.userId, userId),
          eq(reservationWaitlist.businessId, businessId),
          eq(reservationWaitlist.date, date),
          inArray(reservationWaitlist.status, ["active", "notified"]),
        ),
      );
    await db
      .update(reservationFlash)
      .set({ status: "reserved" })
      .where(
        and(
          eq(reservationFlash.businessId, businessId),
          eq(reservationFlash.date, date),
          eq(reservationFlash.time, time),
          eq(reservationFlash.status, "active"),
          sql`${reservationFlash.partySize} >= ${size}`,
        ),
      );

    const row = {
      id,
      businessId,
      userId,
      date,
      time,
      partySize: size,
      customerName: finalName,
      customerPhone: finalPhone,
      occasion: OCCASIONS.includes(occasion) ? occasion : null,
      status,
      code,
    };

    if (business.ownerId) {
      await sendPushToUser(business.ownerId, {
        title: autoConfirm ? "📅 Nueva reserva confirmada" : "📅 Nueva reserva",
        body: autoConfirm
          ? `${finalName || "Cliente"} · ${size} comensales · ${date} ${time} (confirmada automáticamente)`
          : `${finalName || "Cliente"} reservó para ${size} el ${date} a las ${time}`,
        data: { reservationId: id, screen: "BusinessReservations" },
      });
    }
    if (autoConfirm) {
      await sendPushToUser(userId, {
        title: "✅ Reserva confirmada",
        body: `${business.name}: ${size} comensales el ${date} a las ${time}. Código ${code}`,
        data: { reservationId: id, screen: "MyReservations" },
      });
    }
    try {
      const { notifyNewReservation } = await import("./websocket");
      notifyNewReservation(businessId, row);
    } catch {}

    res.json({ success: true, autoConfirmed: autoConfirm, reservation: row });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Mis reservas (cliente)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/mine",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const rows = await db
      .select({
        reservation: reservations,
        businessName: businesses.name,
        businessImage: businesses.image,
        businessAddress: businesses.address,
        businessPhone: businesses.phone,
      })
      .from(reservations)
      .leftJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(eq(reservations.userId, userId))
      .orderBy(desc(reservations.date), desc(reservations.time))
      .limit(100);
    res.json({
      success: true,
      reservations: rows.map((r: any) => ({
        ...r.reservation,
        businessName: r.businessName,
        businessImage: r.businessImage,
        businessAddress: r.businessAddress,
        businessPhone: r.businessPhone,
      })),
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Tarifas de reservas (cobros al negocio): deuda pendiente, pago con tarjeta
// (queda guardada para cobros automáticos), pago manual con comprobante y
// verificación por el admin.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/fees/pending",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const summary = await ReservationFeeSettlementService.getOwnerSummary(userId);
    res.json({ success: true, ...summary });
  }),
);

// Pago con tarjeta en la app. La tarjeta queda guardada en el customer de
// Stripe (setup_future_usage off_session) para futuros cobros automáticos.
router.post(
  "/fees/pay",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ValidationError(
        "Stripe no está configurado. Usa el pago por transferencia/Bizum con comprobante.",
      );
    }
    const userId = (req as any).user.id;
    const outstandingCents =
      await ReservationFeeSettlementService.getOutstandingCents(userId);
    if (outstandingCents < MIN_PAYABLE_CENTS) {
      throw new ValidationError("No hay tarifas pendientes de pago");
    }

    const Stripe = (await import("stripe")).default as any;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const [user] = await db
      .select({
        name: users.name,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId },
        ...(user?.name ? { name: user.name } : {}),
      });
      await db
        .update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, userId));
      customerId = customer.id;
    }

    const intent = await stripe.paymentIntents.create({
      amount: outstandingCents,
      currency: "eur",
      customer: customerId,
      payment_method_types: ["card"],
      setup_future_usage: "off_session",
      description: `Tarifas de reservas ComeYa (${(outstandingCents / 100).toFixed(2).replace(".", ",")} €)`,
      metadata: { userId, purpose: "reservation_fees" },
    });

    res.json({
      success: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents: outstandingCents,
    });
  }),
);

// Confirmación del pago: se VERIFICA el PaymentIntent en Stripe antes de
// abonar (no se confía en la llamada del cliente)
router.post(
  "/fees/pay/confirm",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ValidationError("Stripe no está configurado");
    }
    const userId = (req as any).user.id;
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) throw new ValidationError("paymentIntentId requerido");

    const Stripe = (await import("stripe")).default as any;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(String(paymentIntentId));

    if (intent.metadata?.userId !== userId) {
      throw new AuthorizationError("No autorizado");
    }
    if (intent.status !== "succeeded") {
      throw new ValidationError(
        "El pago no se completó. Si cancelaste el pago, no se ha cobrado nada.",
      );
    }

    const { credited } = await ReservationFeeSettlementService.creditSettlement({
      ownerId: userId,
      amountCents: intent.amount,
      method: "stripe_manual",
      description: `Pago de tarifas de reservas con tarjeta (${(intent.amount / 100).toFixed(2).replace(".", ",")} €)`,
      idempotencyKey: `pi_${intent.id}`,
      metadata: { paymentIntentId: intent.id },
    });

    // La tarjeta usada queda como método guardado para el cobro automático
    if (intent.payment_method) {
      await db
        .update(users)
        .set({ stripePaymentMethodId: String(intent.payment_method) })
        .where(eq(users.id, userId));
    }

    const outstandingCents =
      await ReservationFeeSettlementService.getOutstandingCents(userId);
    res.json({ success: true, credited, outstandingCents });
  }),
);

// Pago manual (Bizum/transferencia/PayPal) con comprobante para el admin
router.post(
  "/fees/submit-proof",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { imageUrl, referenceNumber, provider } = req.body || {};
    if (!imageUrl || !referenceNumber) {
      throw new ValidationError("Imagen del comprobante y referencia son obligatorias");
    }
    const method = ["bizum", "transferencia", "paypal"].includes(provider)
      ? provider
      : "transferencia";

    const outstandingCents =
      await ReservationFeeSettlementService.getOutstandingCents(userId);
    if (outstandingCents < MIN_PAYABLE_CENTS) {
      throw new ValidationError("No hay tarifas pendientes de pago");
    }

    const orderId = null; // los comprobantes de tarifas no van ligados a pedidos (FK)
    const [dup] = await db
      .select({ id: paymentProofs.id })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.referenceNumber, String(referenceNumber)),
          inArray(paymentProofs.status, ["pending", "approved"]),
        ),
      )
      .limit(1);
    if (dup) {
      throw new ValidationError(
        "Ya existe un comprobante con esa referencia. Espera a que se verifique.",
      );
    }
    const [pendingOwn] = await db
      .select({ id: paymentProofs.id })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.purpose, "reservation_fees"),
          eq(paymentProofs.status, "pending"),
        ),
      )
      .limit(1);
    if (pendingOwn) {
      throw new ValidationError(
        "Ya tienes un comprobante pendiente de verificación.",
      );
    }

    const id = randomUUID();
    await db.insert(paymentProofs).values({
      id,
      orderId,
      userId,
      paymentProvider: method,
      proofImageUrl: String(imageUrl).slice(0, 500),
      referenceNumber: String(referenceNumber).slice(0, 100),
      amount: outstandingCents,
      status: "pending",
      purpose: "reservation_fees",
      submittedAt: new Date(),
    });

    try {
      const { notifyAdminNewFeeProof } = await import("./websocket");
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      notifyAdminNewFeeProof({
        proofId: id,
        ownerName: u?.name || "Negocio",
        amount: outstandingCents,
        method,
      });
    } catch {}

    // Push a todos los admins (patrón de comprobantes de pedidos)
    try {
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ["admin", "super_admin"]))
        .limit(20);
      for (const a of admins) {
        await sendPushToUser(a.id, {
          title: "💳 Tarifas de reservas pendientes",
          body: `Un negocio envió un comprobante de ${(outstandingCents / 100).toFixed(2).replace(".", ",")} € por tarifas de reservas. Verifícalo en Finanzas → Cobros reservas.`,
          data: { section: "finance_reservations" },
        });
      }
    } catch {}

    res.json({
      success: true,
      proofId: id,
      amountCents: outstandingCents,
      message: "Comprobante recibido. Se verificará en breve.",
    });
  }),
);

// Panel admin: comprobantes de tarifas pendientes
router.get(
  "/fees/admin/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        proof: paymentProofs,
        ownerName: users.name,
        ownerPhone: users.phone,
      })
      .from(paymentProofs)
      .leftJoin(users, eq(users.id, paymentProofs.userId))
      .where(
        and(
          eq(paymentProofs.purpose, "reservation_fees"),
          inArray(paymentProofs.status, ["pending"]),
        ),
      )
      .orderBy(desc(paymentProofs.createdAt))
      .limit(100);

    const proofs = [];
    for (const r of rows) {
      const outstandingCents =
        await ReservationFeeSettlementService.getOutstandingCents(r.proof.userId);
      proofs.push({
        ...r.proof,
        ownerName: r.ownerName,
        ownerPhone: r.ownerPhone,
        currentOutstandingCents: outstandingCents,
      });
    }
    res.json({ success: true, proofs });
  }),
);

async function decideFeeProof(
  req: any,
  res: any,
  approved: boolean,
) {
  const { reason } = req.body || {};
  const [proof] = await db
    .select()
    .from(paymentProofs)
    .where(eq(paymentProofs.id, req.params.id as string))
    .limit(1);
  if (!proof) throw new NotFoundError("Comprobante no encontrado");
  if (proof.purpose !== "reservation_fees") {
    throw new ValidationError("Este comprobante no es de tarifas de reservas");
  }
  if (proof.status !== "pending") {
    throw new ValidationError("Este comprobante ya fue procesado");
  }

  const adminId = req.user.id;
  if (approved) {
    await ReservationFeeSettlementService.creditSettlement({
      ownerId: proof.userId,
      amountCents: proof.amount,
      method: "proof",
      description: `Pago de tarifas de reservas vía comprobante (${(proof.amount / 100).toFixed(2).replace(".", ",")} €)`,
      idempotencyKey: `proof_${proof.id}`,
      metadata: { proofId: proof.id, reference: proof.referenceNumber },
    });
  }

  await db
    .update(paymentProofs)
    .set({
      status: approved ? "approved" : "rejected",
      verifiedBy: adminId,
      verifiedAt: new Date(),
      verificationNotes: approved
        ? "Tarifas de reservas verificadas"
        : reason
          ? String(reason).slice(0, 500)
          : "Comprobante rechazado",
    })
    .where(eq(paymentProofs.id, proof.id));

  await sendPushToUser(proof.userId, {
    title: approved
      ? "✅ Pago de tarifas verificado"
      : "❌ Comprobante rechazado",
    body: approved
      ? `Tu pago de ${(proof.amount / 100).toFixed(2).replace(".", ",")} € por tarifas de reservas ha sido verificado.`
      : `Tu comprobante de tarifas fue rechazado.${reason ? ` Motivo: ${String(reason).slice(0, 120)}` : ""}`,
    data: { screen: "BusinessFees" },
  });

  res.json({ success: true });
}

router.post(
  "/fees/admin/proofs/:id/approve",
  authenticateToken,
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => decideFeeProof(req, res, true)),
);

router.post(
  "/fees/admin/proofs/:id/reject",
  authenticateToken,
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => decideFeeProof(req, res, false)),
);

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar reserva (cliente) — pendiente/confirmada/sentada (aviso al negocio)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/cancel",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");
    const user = (req as any).user;
    if (r.userId !== user.id && !["admin", "super_admin"].includes(user.role)) {
      throw new AuthorizationError("No autorizado");
    }
    if (!["pending", "confirmed", "seated"].includes(r.status)) {
      throw new ValidationError("La reserva ya no se puede cancelar");
    }
    await db
      .update(reservations)
      .set({
        status: "cancelled",
        cancelledBy: user.id === r.userId ? "customer" : "admin",
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, r.id));

    // Liberar capacidad → avisar a la lista de espera ("Avísame")
    notifyFreedCapacity(r.businessId, r.date).catch(() => {});

    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (biz?.ownerId) {
      await sendPushToUser(biz.ownerId, {
        title: "❌ Reserva cancelada",
        body: `${r.customerName || "Cliente"} canceló la reserva del ${r.date} a las ${r.time} (${r.partySize} personas)`,
        data: { reservationId: r.id, screen: "BusinessReservations" },
      });
    }
    try {
      const { notifyNewReservation } = await import("./websocket");
      notifyNewReservation(r.businessId, { id: r.id, status: "cancelled" });
    } catch {}

    res.json({ success: true, message: "Reserva cancelada" });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de reservas del negocio (aforo, turnos, auto-confirmación)
// ─────────────────────────────────────────────────────────────────────────────
async function assertBusinessOwnership(businessId: string, user: any) {
  const [biz] = await db
    .select({ id: businesses.id, ownerId: businesses.ownerId, name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!biz) throw new NotFoundError("Negocio no encontrado");
  if (
    user.role !== "admin" &&
    user.role !== "super_admin" &&
    biz.ownerId !== user.id
  ) {
    throw new AuthorizationError("No autorizado");
  }
  return biz;
}

router.get(
  "/business/config",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const businessId = String(req.query.businessId || "");
    if (!businessId) throw new ValidationError("businessId es obligatorio");
    const biz = await assertBusinessOwnership(businessId, (req as any).user);
    const [row] = await db
      .select({
        reservationsEnabled: businesses.reservationsEnabled,
        reservationConfig: businesses.reservationConfig,
      })
      .from(businesses)
      .where(eq(businesses.id, biz.id))
      .limit(1);
    const parsed =
      ReservationAvailabilityService.parseConfig(row?.reservationConfig);
    res.json({
      success: true,
      reservationsEnabled: row?.reservationsEnabled ?? false,
      config: parsed,
      feeCentsPerGuest: RESERVATION_FEE_CENTS_PER_GUEST,
    });
  }),
);

router.put(
  "/business/config",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const { businessId, config } = req.body || {};
    if (!businessId) throw new ValidationError("businessId es obligatorio");
    const biz = await assertBusinessOwnership(businessId, (req as any).user);
    if (!config || typeof config !== "object") {
      throw new ValidationError("config es obligatorio");
    }

    const capacity = Number(config.capacityPerSlot) || 0;
    let toStore: string | null = null;
    if (capacity > 0) {
      const clamp = (v: any, min: number, max: number, def: number) => {
        const n = Number(v);
        return Number.isFinite(n)
          ? Math.max(min, Math.min(max, Math.round(n)))
          : def;
      };
      const normalized = {
        capacityPerSlot: clamp(capacity, 1, 500, 20),
        turnMinutes: clamp(config.turnMinutes, 30, 300, 90),
        slotMinutes: clamp(config.slotMinutes, 15, 120, 30),
        maxPartySize: clamp(config.maxPartySize, 1, 20, 8),
        advanceDays: clamp(config.advanceDays, 1, 60, 14),
        autoConfirm: config.autoConfirm === true,
        maxCoversPerDay: config.maxCoversPerDay
          ? clamp(config.maxCoversPerDay, 1, 1000, 0) || null
          : null,
      };
      toStore = JSON.stringify(normalized);
    }

    await db
      .update(businesses)
      .set({ reservationConfig: toStore, updatedAt: new Date() })
      .where(eq(businesses.id, biz.id));

    res.json({
      success: true,
      config: ReservationAvailabilityService.parseConfig(toStore),
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Reservas del negocio (panel): el dueño ve las de SUS negocios, el admin
// todas. Filtro opcional ?date=YYYY-MM-DD (agenda); sin fecha, pendientes y
// confirmadas como siempre.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/business",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    const dateFilter = String(req.query.date || "");

    const myBusinesses =
      role === "admin" || role === "super_admin"
        ? await db
            .select({ id: businesses.id })
            .from(businesses)
            .limit(500)
        : await db
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.ownerId, userId));
    const businessIds = myBusinesses.map((b: any) => b.id);
    if (businessIds.length === 0) {
      return res.json({ success: true, reservations: [], summary: {} });
    }

    const rows = await db
      .select({
        reservation: reservations,
        businessName: businesses.name,
      })
      .from(reservations)
      .leftJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(
        dateFilter
          ? and(
              inArray(reservations.businessId, businessIds),
              eq(reservations.date, dateFilter),
            )
          : and(
              inArray(reservations.businessId, businessIds),
              inArray(reservations.status, ["pending", "confirmed", "seated"]),
            ),
      )
      .orderBy(desc(reservations.date), desc(reservations.time))
      .limit(200);

    // Resumen del día por negocio (cabecera de la agenda)
    let summary: Record<string, any> = {};
    if (dateFilter) {
      const withDate = await db
        .select()
        .from(businesses)
        .where(inArray(businesses.id, businessIds))
        .limit(500);
      for (const business of withDate) {
        summary[business.id] =
          await ReservationAvailabilityService.getDaySummary(business, dateFilter);
      }
    }

    // Fiabilidad del cliente (para "Cliente fiable" en la agenda): histórico
    // de asistencias vs no-shows por usuario
    const guestIds: string[] = [
      ...new Set(
        rows.map((r: any) => String(r.reservation.userId)) as string[],
      ),
    ];
    const reliability: Record<string, { reliable: boolean; attended: number; noShows: number }> = {};
    if (guestIds.length > 0) {
      const stats = await db
        .select({
          userId: reservations.userId,
          status: reservations.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(reservations)
        .where(
          and(
            inArray(reservations.userId, guestIds),
            inArray(reservations.status, ["completed", "no_show"]),
          ),
        )
        .groupBy(reservations.userId, reservations.status);
      for (const s of stats) {
        const entry = (reliability[s.userId] ||= {
          reliable: false,
          attended: 0,
          noShows: 0,
        });
        if (s.status === "completed") entry.attended = Number(s.count);
        if (s.status === "no_show") entry.noShows = Number(s.count);
      }
      for (const key of Object.keys(reliability)) {
        const e = reliability[key];
        // Fiable: ha venido alguna vez y nunca ha fallado (sin ranking negativo)
        e.reliable = e.attended > 0 && e.noShows === 0;
      }
    }

    res.json({
      success: true,
      date: dateFilter || null,
      summary,
      reservations: rows
        .map((r: any) => ({
          ...r.reservation,
          businessName: r.businessName,
          guestReliability: reliability[r.reservation.userId] || null,
        }))
        .sort((a: any, b: any) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)),
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Confirmar, rechazar o cancelar una reserva (negocio dueño / admin)
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  "/business/:id/status",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const { status, businessNote } = req.body || {};
    if (!["confirmed", "rejected", "cancelled"].includes(status)) {
      throw new ValidationError(
        "Estado inválido (confirmed | rejected | cancelled)",
      );
    }

    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");

    const role = (req as any).user.role;
    const [biz] = await db
      .select({ ownerId: businesses.ownerId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (
      role !== "admin" &&
      role !== "super_admin" &&
      biz?.ownerId !== (req as any).user.id
    ) {
      throw new AuthorizationError("No autorizado");
    }
    if (status === "cancelled") {
      if (!["pending", "confirmed"].includes(r.status)) {
        throw new ValidationError("La reserva ya no se puede cancelar");
      }
    } else if (r.status !== "pending") {
      throw new ValidationError("La reserva ya fue gestionada");
    }

    const code =
      status === "confirmed" && !r.code
        ? await ReservationAvailabilityService.generateCode(r.businessId, r.date)
        : r.code;

    await db
      .update(reservations)
      .set({
        status,
        code,
        cancelledBy: status === "cancelled" ? "business" : r.cancelledBy,
        businessNote: businessNote ? String(businessNote).slice(0, 500) : r.businessNote,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, r.id));

    const updated = {
      ...r,
      status,
      code,
      cancelledBy: status === "cancelled" ? "business" : r.cancelledBy,
      businessNote: businessNote ? String(businessNote).slice(0, 500) : r.businessNote,
    };

    const titles: Record<string, string> = {
      confirmed: "✅ Reserva confirmada",
      rejected: "❌ Reserva rechazada",
      cancelled: "❌ Reserva cancelada",
    };
    const bodies: Record<string, string> = {
      confirmed: `${biz?.name || "El negocio"} confirmó tu reserva del ${r.date} a las ${r.time} (${r.partySize} personas). Código ${code}`,
      rejected: `${biz?.name || "El negocio"} no pudo aceptar tu reserva del ${r.date} a las ${r.time}.`,
      cancelled: `${biz?.name || "El negocio"} canceló tu reserva del ${r.date} a las ${r.time}.${businessNote ? ` Motivo: ${String(businessNote).slice(0, 120)}` : ""}`,
    };
    await sendPushToUser(r.userId, {
      title: titles[status],
      body: bodies[status],
      data: { reservationId: r.id, screen: "MyReservations" },
    });

    // Rewards: puntos al confirmar manualmente una reserva
    if (status === "confirmed") {
      try {
        await LoyaltyService.addPoints(
          r.userId,
          POINTS_RESERVATION_CONFIRMED,
          "reservation_confirmed",
          "Reserva confirmada",
          undefined,
          undefined,
        );
      } catch {}
    }
    // Cancelación/rechazo libera capacidad → avisar a la lista de espera
    if (status === "cancelled" || status === "rejected") {
      notifyFreedCapacity(r.businessId, r.date).catch(() => {});
    }

    try {
      const { notifyReservationStatusChange } = await import("./websocket");
      notifyReservationStatusChange(r.userId, updated);
    } catch {}

    res.json({ success: true, reservation: updated });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Ciclo de vida en el local: llegada (cobra la tarifa), no-show y cierre
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  "/business/:id/action",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const { action } = req.body || {};
    if (!["arrive", "no_show", "close"].includes(action)) {
      throw new ValidationError("Acción inválida (arrive | no_show | close)");
    }

    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");

    const user = (req as any).user;
    const [biz] = await db
      .select({
        id: businesses.id,
        ownerId: businesses.ownerId,
        name: businesses.name,
      })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (
      user.role !== "admin" &&
      user.role !== "super_admin" &&
      biz?.ownerId !== user.id
    ) {
      throw new AuthorizationError("No autorizado");
    }

    const now = new Date();
    let fee: { charged: boolean; feeCents: number } | null = null;

    if (action === "arrive") {
      if (!["pending", "confirmed"].includes(r.status)) {
        throw new ValidationError("Solo se puede marcar llegada de una reserva pendiente o confirmada");
      }
      fee = await chargeReservationFee(r, biz);
      await db
        .update(reservations)
        .set({ status: "seated", seatedAt: now, updatedAt: now })
        .where(eq(reservations.id, r.id));
      // Rewards: puntos por asistir a la reserva
      try {
        await LoyaltyService.addPoints(
          r.userId,
          POINTS_RESERVATION_ATTENDED * ((await passDoublesPoints(r.userId)) ? 2 : 1),
          "reservation_attended",
          "Asistencia a reserva",
          undefined,
          undefined,
        );
      } catch {}
    } else if (action === "no_show") {
      if (!["pending", "confirmed"].includes(r.status)) {
        throw new ValidationError("Solo pendientes o confirmadas pueden marcarse como no-show");
      }
      await db
        .update(reservations)
        .set({ status: "no_show", noShowAt: now, updatedAt: now })
        .where(eq(reservations.id, r.id));
    } else {
      // close
      if (r.status !== "seated") {
        throw new ValidationError("Solo se puede cerrar una reserva con cliente sentado");
      }
      await db
        .update(reservations)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(eq(reservations.id, r.id));
    }

    const [updated] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, r.id))
      .limit(1);

    res.json({
      success: true,
      reservation: updated,
      fee,
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Lista de espera "Avísame": el cliente se apunta a una franja completa y
// recibe push cuando se libera mesa o el negocio publica una mesa flash
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/waitlist",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { businessId, date, time, partySize } = req.body || {};
    if (!businessId || !isValidDate(date) || !isValidTime(time)) {
      throw new ValidationError("Negocio, fecha y hora son obligatorios");
    }
    const party = Math.max(1, Math.min(20, Number(partySize) || 2));

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business || !business.reservationsEnabled) {
      throw new ValidationError("Este negocio no acepta reservas por la app");
    }

    const [dup] = await db
      .select({ id: reservationWaitlist.id })
      .from(reservationWaitlist)
      .where(
        and(
          eq(reservationWaitlist.userId, userId),
          eq(reservationWaitlist.businessId, businessId),
          eq(reservationWaitlist.date, date),
          inArray(reservationWaitlist.status, ["active", "notified"]),
        ),
      )
      .limit(1);
    if (dup) {
      throw new ValidationError(
        "Ya estás en la lista de espera de este negocio para ese día",
      );
    }

    const id = randomUUID();
    await db.insert(reservationWaitlist).values({
      id,
      businessId,
      userId,
      date,
      time,
      partySize: party,
      status: "active",
    });

    res.json({ success: true, waitlistId: id });
  }),
);

// Mis avisos de lista de espera
router.get(
  "/waitlist/mine",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const rows = await db
      .select({
        entry: reservationWaitlist,
        businessName: businesses.name,
        businessImage: businesses.image,
      })
      .from(reservationWaitlist)
      .leftJoin(businesses, eq(businesses.id, reservationWaitlist.businessId))
      .where(
        and(
          eq(reservationWaitlist.userId, userId),
          inArray(reservationWaitlist.status, ["active", "notified"]),
        ),
      )
      .orderBy(desc(reservationWaitlist.createdAt))
      .limit(50);
    res.json({
      success: true,
      entries: rows.map((r: any) => ({
        ...r.entry,
        businessName: r.businessName,
        businessImage: r.businessImage,
      })),
    });
  }),
);

// Salir de la lista de espera
router.post(
  "/waitlist/:id/cancel",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [entry] = await db
      .select()
      .from(reservationWaitlist)
      .where(eq(reservationWaitlist.id, req.params.id as string))
      .limit(1);
    if (!entry) throw new NotFoundError("Aviso no encontrado");
    if (entry.userId !== (req as any).user.id) {
      throw new AuthorizationError("No autorizado");
    }
    await db
      .update(reservationWaitlist)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(reservationWaitlist.id, entry.id));
    res.json({ success: true });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 Últimas mesas / 📍 ComeYa Ahora: franjas libres de todos los negocios
// para una fecha (opcionalmente desde una hora), listadas por hora
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/last-tables",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || todayStr());
    const partySize = Math.max(1, Math.min(20, Number(req.query.partySize) || 2));
    const from = String(req.query.from || ""); // HH:mm opcional (para "Ahora")
    if (!isValidDate(date)) throw new ValidationError("date inválida");

    const list = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.reservationsEnabled, true),
          eq(businesses.isActive, true),
        ),
      )
      .limit(100);

    const out: any[] = [];
    for (const business of list) {
      const { slots } = await ReservationAvailabilityService.getSlotsForDay(
        business,
        date,
        partySize,
      );
      for (const slot of slots) {
        if (slot.isPast || slot.status === "full") continue;
        if (from && isValidTime(from) && slot.time < from) continue;
        out.push({
          businessId: business.id,
          businessName: business.name,
          image: business.image,
          address: business.address,
          rating: business.rating,
          totalRatings: business.totalRatings,
          categories: business.categories,
          time: slot.time,
          status: slot.status,
          remaining: slot.remaining,
        });
      }
    }
    out.sort((a, b) =>
      a.time === b.time
        ? a.businessName.localeCompare(b.businessName)
        : a.time < b.time
          ? -1
          : 1,
    );
    res.json({ success: true, date, partySize, tables: out.slice(0, 60) });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ Mesas flash activas (publicadas por los negocios con caducidad)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/flash",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || todayStr());
    const rows = await db
      .select({
        flash: reservationFlash,
        businessName: businesses.name,
        image: businesses.image,
        address: businesses.address,
        rating: businesses.rating,
      })
      .from(reservationFlash)
      .leftJoin(businesses, eq(businesses.id, reservationFlash.businessId))
      .where(
        and(
          eq(reservationFlash.status, "active"),
          eq(reservationFlash.date, date),
        ),
      )
      .orderBy(reservationFlash.time)
      .limit(30);

    // Caducidad perezosa: expiresAt pasado → expired
    const now = Date.now();
    const active = [];
    for (const r of rows) {
      if (r.flash.expiresAt && new Date(r.flash.expiresAt).getTime() < now) {
        await db
          .update(reservationFlash)
          .set({ status: "expired" })
          .where(eq(reservationFlash.id, r.flash.id));
        continue;
      }
      // Verificar que sigue habiendo sitio real en la franja
      const business =
        await ReservationAvailabilityService.getBusiness(r.flash.businessId);
      let slotStatus: string | null = null;
      if (business) {
        const { slots } = await ReservationAvailabilityService.getSlotsForDay(
          business,
          r.flash.date,
          r.flash.partySize,
        );
        const slot = slots.find((s: any) => s.time === r.flash.time);
        slotStatus = slot ? slot.status : "full";
      }
      active.push({
        ...r.flash,
        businessName: r.businessName,
        image: r.image,
        address: r.address,
        rating: r.rating,
        slotStatus,
      });
    }
    res.json({ success: true, date, flashes: active });
  }),
);

// El negocio publica una mesa flash / rellena huecos (Radar ComeYa)
router.post(
  "/business/flash",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { businessId, date, time, partySize, note } = req.body || {};
    if (!businessId || !isValidDate(date) || !isValidTime(time)) {
      throw new ValidationError("Negocio, fecha y hora son obligatorios");
    }
    const party = Math.max(1, Math.min(20, Number(partySize) || 2));

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business) throw new NotFoundError("Negocio no encontrado");
    const role = (req as any).user.role;
    if (
      role !== "admin" &&
      role !== "super_admin" &&
      business.ownerId !== userId
    ) {
      throw new AuthorizationError("No autorizado");
    }

    // La franja debe existir y tener sitio
    const check = await ReservationAvailabilityService.assertSlotAvailable(
      business,
      date,
      time,
      party,
    );
    if (!check.ok) throw new ValidationError(check.reason || "Franja no disponible");

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min de visibilidad
    await db.insert(reservationFlash).values({
      id,
      businessId,
      date,
      time,
      partySize: party,
      note: note ? String(note).slice(0, 200) : null,
      status: "active",
      expiresAt,
    });

    // Radar: avisar a quien esperaba mesa ese día en este negocio
    notifyFlashToWaitlist(businessId, { date, time, partySize: party }).catch(
      () => {},
    );

    res.json({ success: true, flashId: id, expiresAt });
  }),
);

// Retirar una mesa flash
router.post(
  "/business/flash/:id/cancel",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const [flash] = await db
      .select()
      .from(reservationFlash)
      .where(eq(reservationFlash.id, req.params.id as string))
      .limit(1);
    if (!flash) throw new NotFoundError("Mesa flash no encontrada");
    const [biz] = await db
      .select({ ownerId: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, flash.businessId))
      .limit(1);
    const user = (req as any).user;
    if (
      user.role !== "admin" &&
      user.role !== "super_admin" &&
      biz?.ownerId !== user.id
    ) {
      throw new AuthorizationError("No autorizado");
    }
    await db
      .update(reservationFlash)
      .set({ status: "cancelled" })
      .where(eq(reservationFlash.id, flash.id));
    res.json({ success: true });
  }),
);

// Mesas flash del negocio (panel)
router.get(
  "/business/flash",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const date = String(req.query.date || todayStr());
    const myBusinesses = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, userId))
      .limit(50);
    const ids = myBusinesses.map((b: any) => b.id);
    if (ids.length === 0) return res.json({ success: true, flashes: [] });
    const rows = await db
      .select()
      .from(reservationFlash)
      .where(
        and(
          inArray(reservationFlash.businessId, ids),
          eq(reservationFlash.date, date),
          inArray(reservationFlash.status, ["active", "reserved"]),
        ),
      )
      .orderBy(reservationFlash.time)
      .limit(20);
    res.json({ success: true, flashes: rows });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 🎲 Sorpréndeme: una recomendación aleatoria con mesa disponible
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/surprise",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || todayStr());
    const partySize = Math.max(1, Math.min(20, Number(req.query.partySize) || 2));
    if (!isValidDate(date)) throw new ValidationError("date inválida");

    const list = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.reservationsEnabled, true),
          eq(businesses.isActive, true),
        ),
      )
      .limit(100);

    const candidates: any[] = [];
    for (const business of list) {
      const { slots } = await ReservationAvailabilityService.getSlotsForDay(
        business,
        date,
        partySize,
      );
      const firstFree = slots.find(
        (s: any) => !s.isPast && s.status !== "full",
      );
      if (firstFree) {
        candidates.push({
          id: business.id,
          name: business.name,
          image: business.image,
          address: business.address,
          type: business.type,
          categories: business.categories,
          rating: business.rating,
          totalRatings: business.totalRatings,
          suggestedTime: firstFree.time,
          slotStatus: firstFree.status,
        });
      }
    }
    if (candidates.length === 0) {
      return res.json({ success: true, suggestion: null });
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    res.json({ success: true, suggestion: pick, alternatives: candidates.length - 1 });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 "Pregúntale a ComeYa": recomendador gastronómico (Gemini si hay clave,
// con fallback determinista por palabras clave) + disponibilidad real
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/ai-recommend",
  asyncHandler(async (req, res) => {
    const { query } = req.body || {};
    const date = String((req.body || {}).date || todayStr());
    const partySize = Math.max(
      1,
      Math.min(20, Number((req.body || {}).partySize) || 2),
    );
    if (!query || !String(query).trim()) {
      throw new ValidationError("Cuéntanos qué buscas (p. ej.: 'somos 5, comida mexicana, 25 € por persona')");
    }

    // Candidatas: negocios con reservas activadas y alguna mesa ese día
    const list = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.reservationsEnabled, true),
          eq(businesses.isActive, true),
        ),
      )
      .limit(60);

    const candidates: any[] = [];
    for (const business of list) {
      const { slots } = await ReservationAvailabilityService.getSlotsForDay(
        business,
        date,
        partySize,
      );
      const firstFree = slots.find((s: any) => !s.isPast && s.status !== "full");
      if (!firstFree) continue;
      candidates.push({
        id: business.id,
        name: business.name,
        categories: business.categories || "",
        type: business.type,
        address: business.address || "",
        rating: ((business.rating || 0) / 10).toFixed(1),
        suggestedTime: firstFree.time,
      });
    }

    if (candidates.length === 0) {
      return res.json({
        success: true,
        options: [],
        message: "No hay mesas disponibles para esa búsqueda.",
      });
    }

    // Intentar Gemini; si falla, fallback determinista
    let ranking: Array<{ businessId: string; reason: string }> = [];
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const context = candidates
          .map(
            (c) =>
              `${c.id} | ${c.name} | categorías: ${c.categories} | tipo: ${c.type} | ${c.rating}★ | ${c.address} | mesa libre ${c.suggestedTime}`,
          )
          .join("\n");
        const prompt = `Eres el asistente gastronómico de ComeYa en Soria (España). El usuario pregunta: "${query}". Restaurantes disponibles hoy con mesa (id | nombre | categorías | tipo | rating | dirección | hora libre):\n${context}\n\nDevuelve SOLO JSON válido {"options":[{"businessId":"...","reason":"una frase en español, cálida y concreta"}]} con máximo 3 opciones que encajen con la petición (tipo de comida, ocasión, presupuesto...). Si ninguna encaja bien, devuelve las mejores disponibles y explícalo en la razón.`;
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4 },
            }),
          },
        );
        const data: any = await resp.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          for (const o of parsed.options || []) {
            if (candidates.some((c) => c.id === o.businessId)) {
              ranking.push({ businessId: o.businessId, reason: String(o.reason || "").slice(0, 200) });
            }
          }
        }
      } catch {}
    }

    // Fallback determinista: puntuar por palabras clave contra nombre/categorías
    if (ranking.length === 0) {
      const words = String(query)
        .toLowerCase()
        .split(/[^a-záéíóúñ0-9€]+/)
        .filter((w) => w.length > 2);
      const scored = candidates
        .map((c) => {
          const hay = `${c.name} ${c.categories} ${c.type} ${c.address}`.toLowerCase();
          const score = words.reduce(
            (s, w) => s + (hay.includes(w) ? 1 : 0),
            0,
          );
          return { c, score };
        })
        .sort((a, b) => b.score - a.score || Number(b.c.rating) - Number(a.c.rating));
      for (const s of scored.slice(0, 3)) {
        ranking.push({
          businessId: s.c.id,
          reason:
            s.score > 0
              ? "Encaja con lo que buscas y tiene mesa ahora."
              : `Buena opción con mesa a las ${s.c.suggestedTime}.`,
        });
      }
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const options = ranking
      .slice(0, 3)
      .map((r) => ({ ...byId.get(r.businessId), reason: r.reason }))
      .filter((o) => o && o.id);

    res.json({
      success: true,
      usedAI: ranking.length > 0 && !!apiKey,
      date,
      partySize,
      options,
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Reservas entre amigos: enlace compartido y confirmaciones
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/share",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");
    if (r.userId !== (req as any).user.id) {
      throw new AuthorizationError("No autorizado");
    }

    let token = r.groupToken;
    if (!token) {
      token = randomUUID().slice(0, 12);
      await db
        .update(reservations)
        .set({ groupToken: token })
        .where(eq(reservations.id, r.id));
      // El organizador cuenta como confirmado
      const [already] = await db
        .select({ id: reservationParticipants.id })
        .from(reservationParticipants)
        .where(eq(reservationParticipants.reservationId, r.id))
        .limit(1);
      if (!already) {
        await db.insert(reservationParticipants).values({
          id: randomUUID(),
          reservationId: r.id,
          name: r.customerName || "Organizador",
          status: "confirmed",
        });
      }
    }

    res.json({
      success: true,
      token,
      link: `comeya://reservation/${token}`,
      webLink: `https://app.comeya.es/reserva/${token}`,
    });
  }),
);

// Detalle público del grupo (para la pantalla de confirmar asistencia)
router.get(
  "/group/:token",
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || "");
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.groupToken, token))
      .limit(1);
    if (!r) throw new NotFoundError("Enlace no válido");

    const [biz] = await db
      .select({ name: businesses.name, address: businesses.address })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);

    const participants = await db
      .select()
      .from(reservationParticipants)
      .where(eq(reservationParticipants.reservationId, r.id))
      .orderBy(reservationParticipants.createdAt);

    const confirmed = participants.filter((p: any) => p.status === "confirmed").length;
    res.json({
      success: true,
      reservation: {
        id: r.id,
        businessName: biz?.name,
        businessAddress: biz?.address,
        date: r.date,
        time: r.time,
        partySize: r.partySize,
        code: r.code,
        organizer: r.customerName,
      },
      participants,
      confirmedCount: confirmed,
      spotsLeft: Math.max(0, r.partySize - confirmed),
    });
  }),
);

// Confirmar asistencia desde el enlace (sin cuenta necesaria)
router.post(
  "/group/:token/join",
  asyncHandler(async (req, res) => {
    const { name, phone } = req.body || {};
    const cleanName = String(name || "").trim().slice(0, 255);
    if (!cleanName) throw new ValidationError("Dinos tu nombre");

    const token = String(req.params.token || "");
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.groupToken, token))
      .limit(1);
    if (!r) throw new NotFoundError("Enlace no válido");

    const participants = await db
      .select()
      .from(reservationParticipants)
      .where(eq(reservationParticipants.reservationId, r.id));
    const confirmed = participants.filter((p: any) => p.status === "confirmed").length;
    if (confirmed >= r.partySize) {
      throw new ValidationError(
        "La mesa ya está completa. Habla con el organizador.",
      );
    }

    const id = randomUUID();
    await db.insert(reservationParticipants).values({
      id,
      reservationId: r.id,
      name: cleanName,
      phone: phone ? String(phone).slice(0, 50) : null,
      status: "confirmed",
    });

    // Avisar al organizador
    try {
      await sendPushToUser(r.userId, {
        title: "✅ ¡Un amigo se apunta!",
        body: `${cleanName} confirmó asistencia a tu reserva del ${r.date} a las ${r.time}. Ya van ${confirmed + 1}/${r.partySize}.`,
        data: { reservationId: r.id, screen: "MyReservations" },
      });
    } catch {}

    res.json({ success: true, confirmedCount: confirmed + 1 });
  }),
);

// Declinar desde el enlace
router.post(
  "/group/:token/decline",
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    const cleanName = String(name || "").trim().slice(0, 255);
    if (!cleanName) throw new ValidationError("Dinos tu nombre");

    const token = String(req.params.token || "");
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.groupToken, token))
      .limit(1);
    if (!r) throw new NotFoundError("Enlace no válido");

    await db.insert(reservationParticipants).values({
      id: randomUUID(),
      reservationId: r.id,
      name: cleanName,
      status: "declined",
    });
    res.json({ success: true });
  }),
);

// Participantes de mi reserva (organizador)
router.get(
  "/:id/participants",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, req.params.id as string))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");
    if (r.userId !== (req as any).user.id) {
      throw new AuthorizationError("No autorizado");
    }
    const participants = await db
      .select()
      .from(reservationParticipants)
      .where(eq(reservationParticipants.reservationId, r.id))
      .orderBy(reservationParticipants.createdAt);
    res.json({ success: true, participants, groupToken: r.groupToken });
  }),
);


// ─────────────────────────────────────────────────────────────────────────────
// 💳 Pagar la cuenta desde ComeYa: el negocio genera la cuenta con QR, el
// cliente la paga con su tarjeta (misma pasarela que los pedidos)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/business/bill",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const { reservationId, totalCents, items, tipCents } = req.body || {};
    const total = Math.max(0, Number(totalCents) || 0);
    if (total <= 0) throw new ValidationError("El importe de la cuenta es obligatorio");

    const [r] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, String(reservationId || "")))
      .limit(1);
    if (!r) throw new NotFoundError("Reserva no encontrada");

    const user = (req as any).user;
    const [biz] = await db
      .select({ id: businesses.id, ownerId: businesses.ownerId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, r.businessId))
      .limit(1);
    if (
      user.role !== "admin" &&
      user.role !== "super_admin" &&
      biz?.ownerId !== user.id
    ) {
      throw new AuthorizationError("No autorizado");
    }

    const id = randomUUID();
    await db.insert(restaurantBills).values({
      id,
      businessId: r.businessId,
      reservationId: r.id,
      items: items ? JSON.stringify(items) : null,
      totalCents: total,
      tipCents: Math.max(0, Number(tipCents) || 0),
      status: "open",
    });
    await db
      .update(reservations)
      .set({ billId: id })
      .where(eq(reservations.id, r.id));

    res.json({
      success: true,
      billId: id,
      qrLink: `comeya://bill/${id}`,
      webLink: `https://app.comeya.es/cuenta/${id}`,
    });
  }),
);

// Detalle público de la cuenta (para la pantalla de pago)
router.get(
  "/bill/:id",
  asyncHandler(async (req, res) => {
    const [bill] = await db
      .select()
      .from(restaurantBills)
      .where(eq(restaurantBills.id, req.params.id as string))
      .limit(1);
    if (!bill) throw new NotFoundError("Cuenta no encontrada");

    const [biz] = await db
      .select({ name: businesses.name, address: businesses.address })
      .from(businesses)
      .where(eq(businesses.id, bill.businessId))
      .limit(1);

    const [rsv] = bill.reservationId
      ? await db
          .select({ code: reservations.code, time: reservations.time, date: reservations.date })
          .from(reservations)
          .where(eq(reservations.id, bill.reservationId))
          .limit(1)
      : [null];

    res.json({
      success: true,
      bill: {
        ...bill,
        items: bill.items ? JSON.parse(bill.items) : [],
        payments: bill.payments ? JSON.parse(bill.payments) : [],
        businessName: biz?.name,
        businessAddress: biz?.address,
        reservationCode: rsv?.code || null,
      },
      remainingCents: Math.max(0, bill.totalCents - bill.paidCents),
    });
  }),
);

// Intención de pago de la cuenta (Stripe, misma pasarela que los pedidos)
router.post(
  "/bill/:id/pay-intent",
  authenticateToken,
  asyncHandler(async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ValidationError(
        "Stripe no está configurado. Paga en efectivo en el local.",
      );
    }
    const [bill] = await db
      .select()
      .from(restaurantBills)
      .where(eq(restaurantBills.id, req.params.id as string))
      .limit(1);
    if (!bill) throw new NotFoundError("Cuenta no encontrada");
    const remaining = Math.max(0, bill.totalCents - bill.paidCents);
    const amount = Math.min(remaining, Math.max(50, Number(req.body.amountCents) || remaining));
    if (remaining <= 0) throw new ValidationError("La cuenta ya está pagada");

    const Stripe = (await import("stripe")).default as any;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { billId: bill.id, userId: (req as any).user.id, purpose: "restaurant_bill" },
      description: `Cuenta en ComeYa (${(amount / 100).toFixed(2).replace(".", ",")} €)`,
    });

    res.json({ success: true, clientSecret: intent.client_secret, paymentIntentId: intent.id, amountCents: amount });
  }),
);

// Confirmación del pago verificada en Stripe + idempotente por PaymentIntent
router.post(
  "/bill/:id/confirm",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) throw new ValidationError("paymentIntentId requerido");
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ValidationError("Stripe no está configurado");
    }
    const [bill] = await db
      .select()
      .from(restaurantBills)
      .where(eq(restaurantBills.id, req.params.id as string))
      .limit(1);
    if (!bill) throw new NotFoundError("Cuenta no encontrada");

    const payments: any[] = bill.payments ? JSON.parse(bill.payments) : [];
    if (payments.some((p: any) => p.paymentIntentId === paymentIntentId)) {
      return res.json({ success: true, billId: bill.id, paidCents: bill.paidCents, status: bill.status });
    }

    const Stripe = (await import("stripe")).default as any;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(String(paymentIntentId));
    if (intent.status !== "succeeded") {
      throw new ValidationError("El pago no se completó");
    }

    const paidCents = bill.paidCents + intent.amount;
    const status = paidCents >= bill.totalCents ? "paid" : "open";
    payments.push({
      paymentIntentId: intent.id,
      amountCents: intent.amount,
      at: new Date().toISOString(),
    });

    await db
      .update(restaurantBills)
      .set({
        paidCents,
        status,
        paidAt: status === "paid" ? new Date() : bill.paidAt,
        payments: JSON.stringify(payments),
      })
      .where(eq(restaurantBills.id, bill.id));

    if (status === "paid") {
      const [biz] = await db
        .select({ ownerId: businesses.ownerId })
        .from(businesses)
        .where(eq(businesses.id, bill.businessId))
        .limit(1);
      if (biz?.ownerId) {
        try {
          await sendPushToUser(biz.ownerId, {
            title: "💳 Cuenta pagada",
            body: `El cliente pagó la cuenta completa (${(bill.totalCents / 100).toFixed(2).replace(".", ",")} €) desde la app.`,
            data: { screen: "BusinessReservations" },
          });
        } catch {}
      }
    }

    res.json({ success: true, billId: bill.id, paidCents, status, remainingCents: Math.max(0, bill.totalCents - paidCents) });
  }),
);


// ─────────────────────────────────────────────────────────────────────────────
// 🗓️ ComeYa Plan: sugiere una noche completa (copas → cena → postre) con mesa
// real en cada parada. El cliente reserva cada parada con el flujo normal.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/plan",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || todayStr());
    const partySize = Math.max(1, Math.min(20, Number(req.query.partySize) || 2));
    if (!isValidDate(date)) throw new ValidationError("date inválida");

    const list = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.reservationsEnabled, true),
          eq(businesses.isActive, true),
        ),
      )
      .limit(60);

    // Recoger todas las franjas libres por negocio en una sola pasada
    const all: any[] = [];
    for (const business of list) {
      const { slots } = await ReservationAvailabilityService.getSlotsForDay(
        business,
        date,
        partySize,
      );
      for (const slot of slots) {
        if (slot.isPast || slot.status === "full") continue;
        all.push({
          businessId: business.id,
          name: business.name,
          categories: business.categories || "",
          type: business.type,
          rating: business.rating,
          image: business.image,
          time: slot.time,
        });
      }
    }

    const pick = (
      minTime: string,
      maxTime: string,
      prefer: string[],
      excludeIds: string[],
    ) => {
      const inWindow = all.filter(
        (x) =>
          x.time >= minTime &&
          x.time <= maxTime &&
          !excludeIds.includes(x.businessId),
      );
      // Preferir los que encajen con la categoría de la parada
      const scored = inWindow
        .map((x) => {
          const hay = `${x.name} ${x.categories} ${x.type}`.toLowerCase();
          const catScore = prefer.some((k) => hay.includes(k)) ? 10 : 0;
          return { x, score: catScore + (x.rating || 0) };
        })
        .sort((a, b) => b.score - a.score);
      return scored[0]?.x || null;
    };

    const aperitivo = pick("19:00", "20:30", ["bar", "vinos", "tapas", "copas", "cerveza"], []);
    const cena = pick("20:30", "22:30", ["restaurante", "casera", "asador", "grill", "menu"], [aperitivo?.businessId || ""]);
    const postre = pick("22:00", "23:59", ["caf", "postre", "helad", "churro", "pastel"], [aperitivo?.businessId || "", cena?.businessId || ""]);

    res.json({
      success: true,
      date,
      partySize,
      stops: [
        aperitivo && { stage: "aperitivo", label: "🥂 Copas / aperitivo", ...aperitivo },
        cena && { stage: "cena", label: "🍽️ Cena", ...cena },
        postre && { stage: "postre", label: "🍰 Postre / café", ...postre },
      ].filter(Boolean),
    });
  }),
);

export default router;
