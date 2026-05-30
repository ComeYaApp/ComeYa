// Stripe Connect Routes — onboarding para negocios y repartidores
import { Router, Request, Response } from "express";
import { authenticateToken } from "../authMiddleware";
import { db } from "../db";
import { getStripe } from "../stripeClient";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStripeAccountId(userId: string): Promise<string | null> {
  const [rows]: any = await db.execute(
    sql`SELECT stripe_account_id FROM users WHERE id = ${userId} LIMIT 1`,
  );
  return rows[0]?.stripe_account_id || null;
}

async function saveStripeAccountId(
  userId: string,
  accountId: string,
  role: string,
) {
  await db.execute(
    sql`UPDATE users SET stripe_account_id = ${accountId} WHERE id = ${userId}`,
  );
  if (role === "business_owner") {
    await db.execute(
      sql`UPDATE businesses SET stripe_account_id = ${accountId}, stripe_account_status = 'pending' WHERE owner_id = ${userId}`,
    );
  }
  if (role === "delivery_driver") {
    await db.execute(
      sql`UPDATE delivery_drivers SET stripe_account_id = ${accountId}, stripe_account_status = 'pending' WHERE user_id = ${userId}`,
    );
  }
}

async function markAccountActive(stripeAccountId: string) {
  await db.execute(
    sql`UPDATE businesses SET stripe_account_status = 'active' WHERE stripe_account_id = ${stripeAccountId}`,
  );
  await db.execute(
    sql`UPDATE delivery_drivers SET stripe_account_status = 'active' WHERE stripe_account_id = ${stripeAccountId}`,
  );
  logger.info(`✅ Stripe account marked active: ${stripeAccountId}`);
}

// ── Webhook (debe ir ANTES de cualquier body parser) ──────────────────────────
// POST /api/connect/webhook
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn("STRIPE_WEBHOOK_SECRET not set, skipping verification");
    return res.json({ received: true });
  }

  let event: any;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "account.updated":
      case "v2.core.account.updated":
      case "v2.core.account[configuration.recipient].capability_status_updated": {
        const account = event.data?.object || event.data;
        const accountId = account?.id || account?.account_id;
        if (!accountId) break;

        // Verificar con Stripe si la cuenta puede recibir transferencias
        const stripe = getStripe();
        const fullAccount = await stripe.accounts
          .retrieve(accountId)
          .catch(() => null);
        if (fullAccount?.payouts_enabled && fullAccount?.details_submitted) {
          await markAccountActive(accountId);
        }
        break;
      }
    }
  } catch (err: any) {
    logger.error(`Webhook handler error: ${err.message}`, {
      eventType: event.type,
    });
  }

  res.json({ received: true });
});

// ── GET /api/connect/status ───────────────────────────────────────────────────
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe();
    const accountId = await getStripeAccountId(req.user!.id);

    if (!accountId) {
      return res.json({
        hasAccount: false,
        onboardingComplete: false,
        canReceivePayments: false,
      });
    }

    const account = await stripe.accounts.retrieve(accountId);
    res.json({
      hasAccount: true,
      accountId,
      onboardingComplete: account.details_submitted,
      canReceivePayments: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/connect/onboard ─────────────────────────────────────────────────
router.post("/onboard", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const stripe = getStripe();
    let accountId = await getStripeAccountId(req.user!.id);

    if (!accountId) {
      const [userRows]: any = await db.execute(
        sql`SELECT name, email FROM users WHERE id = ${req.user!.id} LIMIT 1`,
      );
      const user = userRows[0];
      const account = await stripe.accounts.create({
        type: "express",
        country: "ES",
        capabilities: { transfers: { requested: true } },
        business_type:
          req.user!.role === "delivery_driver" ? "individual" : "company",
        ...(user?.email && { email: user.email }),
        metadata: { userId: req.user!.id, role: req.user!.role },
      });
      accountId = account.id;
      await saveStripeAccountId(req.user!.id, accountId, req.user!.role);
    }

    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/refresh?accountId=${accountId}`,
      return_url: `${baseUrl}/api/connect/return?userId=${req.user!.id}`,
      type: "account_onboarding",
    });

    res.json({ success: true, onboardingUrl: accountLink.url, accountId });
  } catch (error: any) {
    console.error("Stripe Connect onboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/connect/refresh-onboarding ─────────────────────────────────────
router.post("/refresh-onboarding", authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe();
    const { accountId } = req.body;
    if (!accountId)
      return res.status(400).json({ error: "accountId requerido" });

    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/refresh?accountId=${accountId}`,
      return_url: `${baseUrl}/api/connect/return?userId=${req.user!.id}`,
      type: "account_onboarding",
    });

    res.json({ success: true, onboardingUrl: accountLink.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/connect/return — callback tras completar onboarding ──────────────
router.get("/return", async (req, res) => {
  const { userId } = req.query as { userId?: string };

  if (userId) {
    try {
      const stripe = getStripe();
      const [userRows]: any = await db.execute(
        sql`SELECT stripe_account_id FROM users WHERE id = ${userId} LIMIT 1`,
      );
      const stripeAccountId = userRows[0]?.stripe_account_id;
      if (stripeAccountId) {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (account.details_submitted && account.payouts_enabled) {
          await markAccountActive(stripeAccountId);
        }
      }
    } catch (e) {
      /* no bloquear el redirect */
    }
  }

  const deepLink = `comeya://stripe-connect-complete`;
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Stripe configurado - ComeYa</title>
    <script>window.location.href='${deepLink}';</script>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">✅</div>
      <h1 style="color:#1A1A1A">¡Cuenta configurada!</h1>
      <p style="color:#555">Tu cuenta Stripe está lista. Vuelve a la app para continuar.</p>
      <a href="${deepLink}" style="display:inline-block;background:#DC2626;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>`);
});

// ── GET /api/connect/refresh — link expirado ──────────────────────────────────
router.get("/refresh", async (req, res) => {
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Enlace expirado - ComeYa</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">⚠️</div>
      <h1 style="color:#1A1A1A">Enlace expirado</h1>
      <p style="color:#555">El enlace de configuración ha expirado. Vuelve a la app y genera uno nuevo.</p>
      <a href="comeya://" style="display:inline-block;background:#DC2626;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>`);
});

// ── GET /api/connect/dashboard-link ──────────────────────────────────────────
router.get("/dashboard-link", authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe();
    const accountId = await getStripeAccountId(req.user!.id);
    if (!accountId) return res.status(404).json({ error: "Sin cuenta Stripe" });

    const loginLink = await stripe.accounts.createLoginLink(accountId);
    res.json({ success: true, url: loginLink.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/connect/disconnect ───────────────────────────────────────────
router.delete("/disconnect", authenticateToken, async (req, res) => {
  try {
    await db.execute(
      sql`UPDATE users SET stripe_account_id = NULL WHERE id = ${req.user!.id}`,
    );
    await db.execute(
      sql`UPDATE businesses SET stripe_account_id = NULL, stripe_account_status = 'not_connected' WHERE owner_id = ${req.user!.id}`,
    );
    await db.execute(
      sql`UPDATE delivery_drivers SET stripe_account_id = NULL, stripe_account_status = 'not_connected' WHERE user_id = ${req.user!.id}`,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
