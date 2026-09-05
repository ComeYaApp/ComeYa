// Liquidación de tarifas de reservas: la deuda ya se contabiliza en la wallet
// del dueño (transacciones reservation_fee negativas). Este servicio calcula
// lo pendiente, abona pagos (transacción reservation_fee_settlement positiva)
// y ejecuta el cobro automático off-session con la tarjeta guardada.
import { db } from "./db";
import { users, wallets, transactions } from "@shared/schema-mysql";
import { eq, and, inArray, like, desc, sql } from "drizzle-orm";
import { sendPushToUser } from "./enhancedPushService";

// Umbral para el cobro automático: evita micro-cargos que se comería Stripe
const MIN_AUTOCHARGE_CENTS = Number(
  process.env.RESERVATION_FEE_AUTOCHARGE_MIN_CENTS || 500,
);
// Mínimo de Stripe: no se puede cobrar menos de 0,50 €
export const MIN_PAYABLE_CENTS = 50;

export class ReservationFeeSettlementService {
  // Pendiente de pago: lo que la wallet del dueño debe por tarifas de reservas
  // (fees negativos menos liquidaciones positivas), nunca por debajo de 0
  static async getOutstandingCents(ownerId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          inArray(transactions.type, [
            "reservation_fee",
            "reservation_fee_settlement",
          ]),
          eq(transactions.status, "completed"),
        ),
      );
    const total = Number(rows[0]?.total || 0);
    return Math.max(0, -total);
  }

  // Resumen para la pantalla del negocio: deuda, tarjeta guardada y últimos
  // movimientos de tarifas
  static async getOwnerSummary(ownerId: string) {
    const outstandingCents = await this.getOutstandingCents(ownerId);
    const [user] = await db
      .select({
        name: users.name,
        cardLast4: users.cardLast4,
        cardBrand: users.cardBrand,
        stripePaymentMethodId: users.stripePaymentMethodId,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    const fees = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          inArray(transactions.type, [
            "reservation_fee",
            "reservation_fee_settlement",
          ]),
        ),
      )
      .orderBy(desc(transactions.createdAt))
      .limit(30);

    return {
      outstandingCents,
      autochargeThresholdCents: MIN_AUTOCHARGE_CENTS,
      card: user?.stripePaymentMethodId
        ? { last4: user.cardLast4, brand: user.cardBrand }
        : null,
      transactions: fees,
    };
  }

  // Abona un pago de tarifas: suma saldo a la wallet y deja la transacción
  // positiva que compensa los fees. Idempotencia por clave única (idempotencyKey)
  // para no abonar dos veces el mismo PaymentIntent o comprobante.
  static async creditSettlement(opts: {
    ownerId: string;
    amountCents: number;
    method: "stripe_auto" | "stripe_manual" | "proof";
    description: string;
    idempotencyKey: string;
    metadata?: Record<string, any>;
  }): Promise<{ credited: boolean }> {
    if (opts.amountCents <= 0) return { credited: false };

    // Ya existe una liquidación con esta clave → no repetir
    const [existing] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "reservation_fee_settlement"),
          like(transactions.metadata, `%"idempotencyKey":"${opts.idempotencyKey}"%`),
        ),
      )
      .limit(1);
    if (existing) return { credited: false };

    let [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, opts.ownerId))
      .limit(1);
    if (!wallet) {
      await db.insert(wallets).values({
        userId: opts.ownerId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
      [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, opts.ownerId))
        .limit(1);
    }

    const now = new Date();
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + opts.amountCents;
    await db
      .update(wallets)
      .set({ balance: balanceAfter, updatedAt: now })
      .where(eq(wallets.id, wallet.id));

    await db.insert(transactions).values({
      walletId: wallet.id,
      userId: opts.ownerId,
      type: "reservation_fee_settlement",
      amount: opts.amountCents,
      balanceBefore,
      balanceAfter,
      description: opts.description,
      status: "completed",
      metadata: JSON.stringify({
        ...opts.metadata,
        method: opts.method,
        idempotencyKey: opts.idempotencyKey,
        source: "reservation_fees",
      }),
    });

    return { credited: true };
  }

  // Cobro automático off-session con la tarjeta guardada del dueño.
  // Devuelve el resultado por dueño para que el cron lo registre.
  static async autoChargeOwner(
    ownerId: string,
  ): Promise<
    | { status: "skipped"; reason: string }
    | { status: "charged"; amountCents: number }
    | { status: "failed"; reason: string; pushSent: boolean }
  > {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { status: "skipped", reason: "stripe_not_configured" };
    }

    const outstandingCents = await this.getOutstandingCents(ownerId);
    if (outstandingCents < Math.max(MIN_AUTOCHARGE_CENTS, MIN_PAYABLE_CENTS)) {
      return { status: "skipped", reason: "below_threshold" };
    }

    const [user] = await db
      .select({
        name: users.name,
        stripeCustomerId: users.stripeCustomerId,
        stripePaymentMethodId: users.stripePaymentMethodId,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    if (!user?.stripeCustomerId || !user?.stripePaymentMethodId) {
      return { status: "skipped", reason: "no_saved_card" };
    }

    const Stripe = (await import("stripe")).default as any;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      const intent = await stripe.paymentIntents.create(
        {
          amount: outstandingCents,
          currency: "eur",
          customer: user.stripeCustomerId,
          payment_method: user.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          description: `Tarifas de reservas ComeYa (${(outstandingCents / 100).toFixed(2).replace(".", ",")} €)`,
          metadata: { userId: ownerId, purpose: "reservation_fees" },
        },
        { idempotencyKey: `resvfee_${ownerId}_${dayKey}` },
      );

      if (intent.status !== "succeeded") {
        // Requires action / processing: no abonamos hasta succeeded
        let pushSent = false;
        try {
          await sendPushToUser(ownerId, {
            title: "Pago de tarifas de reservas",
            body: "Tu banco requiere confirmación del cobro. Entra en ComeYa → Reservas → Tarifas para completarlo.",
            data: { screen: "BusinessFees" },
          });
          pushSent = true;
        } catch {}
        return { status: "failed", reason: `pi_status_${intent.status}`, pushSent };
      }

      await this.creditSettlement({
        ownerId,
        amountCents: outstandingCents,
        method: "stripe_auto",
        description: `Cobro automático tarifas de reservas (${(outstandingCents / 100).toFixed(2).replace(".", ",")} €)`,
        idempotencyKey: `pi_${intent.id}`,
        metadata: { paymentIntentId: intent.id },
      });

      try {
        await sendPushToUser(ownerId, {
          title: "💳 Tarifas de reservas cobradas",
          body: `Hemos cobrado ${(outstandingCents / 100).toFixed(2).replace(".", ",")} € correspondientes a tus reservas atendidas.`,
          data: { screen: "BusinessFees" },
        });
      } catch {}

      return { status: "charged", amountCents: outstandingCents };
    } catch (err: any) {
      const reason = err?.code || err?.type || "stripe_error";
      let pushSent = false;
      try {
        await sendPushToUser(ownerId, {
          title: "No pudimos cobrar tus tarifas",
          body: `Tienes ${(outstandingCents / 100).toFixed(2).replace(".", ",")} € en tarifas de reservas pendientes y el cobro con tu tarjeta falló (${reason}). Actualiza tu método de pago o paga desde la app.`,
          data: { screen: "BusinessFees" },
        });
        pushSent = true;
      } catch {}
      return { status: "failed", reason, pushSent };
    }
  }

  // Dueños con deuda igual o superior al umbral (para el cron)
  static async ownersWithOutstanding(): Promise<
    Array<{ ownerId: string; outstandingCents: number }>
  > {
    const rows = await db
      .select({
        ownerId: transactions.userId,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.type, [
            "reservation_fee",
            "reservation_fee_settlement",
          ]),
          eq(transactions.status, "completed"),
        ),
      )
      .groupBy(transactions.userId);

    return rows
      .map((r: any) => ({
        ownerId: r.ownerId,
        outstandingCents: Math.max(0, -Number(r.total || 0)),
      }))
      .filter(
        (r: { ownerId: string; outstandingCents: number }) =>
          r.outstandingCents >= Math.max(MIN_AUTOCHARGE_CENTS, MIN_PAYABLE_CENTS),
      );
  }
}
