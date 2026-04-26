// Stripe Connect Routes — onboarding para negocios y repartidores
import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import { db } from "../db";
import { getStripe } from "../stripeClient";
import { eq, sql } from "drizzle-orm";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStripeAccountId(userId: string): Promise<string | null> {
  const [rows]: any = await db.execute(
    sql`SELECT stripe_account_id FROM users WHERE id = ${userId} LIMIT 1`
  );
  return rows[0]?.stripe_account_id || null;
}

async function saveStripeAccountId(userId: string, accountId: string) {
  await db.execute(
    sql`UPDATE users SET stripe_account_id = ${accountId} WHERE id = ${userId}`
  );
  // También actualizar en businesses si es business_owner
  await db.execute(
    sql`UPDATE businesses SET stripe_account_id = ${accountId} WHERE owner_id = ${userId}`
  );
}

// ── Endpoints compartidos (negocio y repartidor) ──────────────────────────────

// GET /api/connect/status — estado de la cuenta Stripe Connect
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

// POST /api/connect/onboard — iniciar onboarding Stripe Connect
router.post("/onboard", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const stripe = getStripe();
    let accountId = await getStripeAccountId(req.user!.id);

    // Crear cuenta si no existe
    if (!accountId) {
      const [userRows]: any = await db.execute(
        sql`SELECT name, email FROM users WHERE id = ${req.user!.id} LIMIT 1`
      );
      const user = userRows[0];
      const account = await stripe.accounts.create({
        type: "express",
        country: "ES",
        capabilities: { transfers: { requested: true } },
        business_type: req.user!.role === "delivery_driver" ? "individual" : "company",
        ...(user?.email && { email: user.email }),
        metadata: { userId: req.user!.id, role: req.user!.role },
      });
      accountId = account.id;
      await saveStripeAccountId(req.user!.id, accountId);
    }

    // Crear link de onboarding
    const returnUrl  = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/return?userId=${req.user!.id}`;
    const refreshUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/refresh?accountId=${accountId}`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ success: true, onboardingUrl: accountLink.url, accountId });
  } catch (error: any) {
    console.error("Stripe Connect onboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/connect/refresh-onboarding — refrescar link de onboarding
router.post("/refresh-onboarding", authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe();
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: "accountId requerido" });

    const returnUrl  = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/return?userId=${req.user!.id}`;
    const refreshUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/refresh?accountId=${accountId}`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ success: true, onboardingUrl: accountLink.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/connect/return — callback tras completar onboarding (redirige a la app)
router.get("/return", async (req, res) => {
  const deepLink = `comeya://stripe-connect-complete`;
  res.send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Stripe configurado - ComeYa</title>
    <script>window.location.href='${deepLink}';</script>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">✅</div>
      <h1 style="color:#1A1A1A">¡Cuenta configurada!</h1>
      <p style="color:#555">Tu cuenta Stripe está lista. Vuelve a la app para continuar.</p>
      <a href="${deepLink}" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>
  `);
});

// GET /api/connect/refresh — callback cuando el link expira
router.get("/refresh", async (req, res) => {
  res.send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Enlace expirado - ComeYa</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">⚠️</div>
      <h1 style="color:#1A1A1A">Enlace expirado</h1>
      <p style="color:#555">El enlace de configuración ha expirado. Vuelve a la app y genera uno nuevo.</p>
      <a href="comeya://" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>
  `);
});

// ── Endpoints específicos para negocios ───────────────────────────────────────

// GET /api/business/stripe/status
router.get("/business/status", authenticateToken, async (req, res) => {
  try {
    const stripe = getStripe();
    const accountId = await getStripeAccountId(req.user!.id);

    if (!accountId) {
      return res.json({ success: true, connected: false });
    }

    const account = await stripe.accounts.retrieve(accountId);
    res.json({
      success: true,
      connected: true,
      accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/business/stripe/connect
router.post("/business/connect", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const stripe = getStripe();
    let accountId = await getStripeAccountId(req.user!.id);

    if (!accountId) {
      const [userRows]: any = await db.execute(
        sql`SELECT name, email FROM users WHERE id = ${req.user!.id} LIMIT 1`
      );
      const user = userRows[0];
      const account = await stripe.accounts.create({
        type: "express",
        country: "ES",
        capabilities: { transfers: { requested: true } },
        business_type: "company",
        ...(user?.email && { email: user.email }),
        metadata: { userId: req.user!.id, role: "business_owner" },
      });
      accountId = account.id;
      await saveStripeAccountId(req.user!.id, accountId);
    }

    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/refresh?accountId=${accountId}`,
      return_url:  `${baseUrl}/api/connect/return?userId=${req.user!.id}`,
      type: "account_onboarding",
    });

    res.json({ success: true, onboardingUrl: accountLink.url, accountId });
  } catch (error: any) {
    console.error("Business Stripe connect error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/business/stripe/dashboard-link
router.get("/business/dashboard-link", authenticateToken, async (req, res) => {
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

// DELETE /api/business/stripe/disconnect
router.delete("/business/disconnect", authenticateToken, async (req, res) => {
  try {
    await db.execute(
      sql`UPDATE users SET stripe_account_id = NULL WHERE id = ${req.user!.id}`
    );
    await db.execute(
      sql`UPDATE businesses SET stripe_account_id = NULL WHERE owner_id = ${req.user!.id}`
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
