import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq } from "drizzle-orm";

const router = express.Router();

// POST /api/payments/create-session
// Crea una sesión de pago según el provider
router.post("/create-session", authenticateToken, async (req, res) => {
  try {
    const { orderId, amount, provider } = req.body;
    if (!orderId || !amount || !provider) {
      return res.status(400).json({ error: "orderId, amount y provider son requeridos" });
    }

    const { db } = await import("../db");
    const { orders } = await import("../../shared/schema-mysql");

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const amountEur = amount / 100; // amount viene en céntimos

    switch (provider) {
      case "stripe_card":
      case "stripe_bizum": {
        const stripe = (await import("stripe")).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

        const paymentMethods = provider === "stripe_bizum" ? ["bizum"] : ["card"];

        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: paymentMethods as any,
          line_items: [{
            price_data: {
              currency: "eur",
              product_data: { name: `Pedido ComeYa #${orderId.slice(-6)}` },
              unit_amount: amount,
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${process.env.BACKEND_URL}/api/payments/success?orderId=${orderId}&provider=${provider}`,
          cancel_url: `${process.env.BACKEND_URL}/api/payments/cancel?orderId=${orderId}`,
          metadata: { orderId, provider },
        });

        return res.json({ url: session.url, sessionId: session.id });
      }

      case "paypal": {
        const base = process.env.PAYPAL_MODE === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";

        // Obtener token
        const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        });
        const tokenData = await tokenRes.json() as any;

        // Crear orden PayPal
        const orderRes = await fetch(`${base}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenData.access_token}`,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              reference_id: orderId,
              amount: { currency_code: "EUR", value: amountEur.toFixed(2) },
            }],
            application_context: {
              return_url: `${process.env.BACKEND_URL}/api/payments/success?orderId=${orderId}&provider=paypal`,
              cancel_url: `${process.env.BACKEND_URL}/api/payments/cancel?orderId=${orderId}`,
            },
          }),
        });
        const paypalOrder = await orderRes.json() as any;
        const approveLink = paypalOrder.links?.find((l: any) => l.rel === "approve")?.href;

        return res.json({ url: approveLink, paypalOrderId: paypalOrder.id });
      }

      case "binance": {
        const crypto = await import("crypto");
        const nonce = crypto.randomBytes(16).toString("hex");
        const timestamp = Date.now();
        const merchantId = process.env.BINANCE_MERCHANT_ID!;
        const apiKey = process.env.BINANCE_API_KEY!;
        const secretKey = process.env.BINANCE_SECRET_KEY!;

        const body = JSON.stringify({
          env: { terminalType: "APP" },
          merchantTradeNo: orderId.replace(/-/g, "").slice(0, 32),
          orderAmount: amountEur.toFixed(2),
          currency: "EUR",
          goods: {
            goodsType: "01",
            goodsCategory: "Z000",
            referenceGoodsId: orderId,
            goodsName: `Pedido ComeYa #${orderId.slice(-6)}`,
          },
          returnUrl: `${process.env.BACKEND_URL}/api/payments/success?orderId=${orderId}&provider=binance`,
          cancelUrl: `${process.env.BACKEND_URL}/api/payments/cancel?orderId=${orderId}`,
        });

        const payload = `${timestamp}\n${nonce}\n${body}\n`;
        const signature = crypto
          .createHmac("sha512", secretKey)
          .update(payload)
          .digest("hex")
          .toUpperCase();

        const binanceRes = await fetch("https://bpay.binanceapi.com/binancepay/openapi/v2/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "BinancePay-Timestamp": String(timestamp),
            "BinancePay-Nonce": nonce,
            "BinancePay-Certificate-SN": apiKey,
            "BinancePay-Signature": signature,
          },
          body,
        });
        const binanceData = await binanceRes.json() as any;

        return res.json({ url: binanceData.data?.checkoutUrl, binanceOrderId: binanceData.data?.prepayId });
      }

      default:
        return res.status(400).json({ error: "Provider no soportado" });
    }
  } catch (error: any) {
    console.error("Create payment session error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/payments/success — callback tras pago exitoso
router.get("/success", async (req, res) => {
  try {
    const { orderId, provider, token } = req.query as any;
    const { db } = await import("../db");
    const { orders } = await import("../../shared/schema-mysql");

    if (!orderId) {
      return res.status(400).send("<h2>Error: orderId no encontrado</h2>");
    }

    // Para PayPal hay que capturar el pago
    if (provider === "paypal" && token) {
      const base = process.env.PAYPAL_MODE === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });
      const tokenData = await tokenRes.json() as any;

      await fetch(`${base}/v2/checkout/orders/${token}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
    }

    // Confirmar pedido
    await db.update(orders)
      .set({ status: "accepted", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    // Redirigir de vuelta a la app via deep link
    // La app tiene scheme "comeya://" configurado en app.json
    const deepLink = `comeya://order-confirmed?orderId=${orderId}`;
    
    // Pagina HTML que intenta abrir la app y muestra mensaje de exito
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pago completado - ComeYa</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F7F7F7; padding: 24px; text-align: center; }
          .card { background: white; border-radius: 20px; padding: 40px 32px; max-width: 400px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .icon { font-size: 64px; margin-bottom: 16px; }
          h1 { color: #1A1A1A; font-size: 24px; margin-bottom: 8px; }
          p { color: #555; font-size: 16px; margin-bottom: 24px; }
          .btn { display: inline-block; background: #FF6B35; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 16px; }
        </style>
        <script>
          // Intentar abrir la app automaticamente
          window.location.href = '${deepLink}';
          // Si no abre en 2 segundos, mostrar boton
          setTimeout(() => {
            document.getElementById('btn').style.display = 'inline-block';
          }, 2000);
        </script>
      </head>
      <body>
        <div class="card">
          <div class="icon">&#x2705;</div>
          <h1>Pago completado</h1>
          <p>Tu pedido ha sido confirmado. Vuelve a la app para seguir tu pedido.</p>
          <a id="btn" href="${deepLink}" class="btn" style="display:none">Volver a ComeYa</a>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Payment success error:", error);
    res.send(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Error - ComeYa</title>
      <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F7F7;padding:24px;text-align:center;}</style></head>
      <body><div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">&#x26A0;&#xFE0F;</div>
      <h1 style="color:#1A1A1A">Hubo un problema</h1>
      <p style="color:#555">El pago fue procesado pero hubo un error. Contacta soporte con tu pedido.</p>
      <a href="comeya://" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700">Volver a ComeYa</a>
      </div></body></html>
    `);
  }
});

// GET /api/payments/cancel
router.get("/cancel", async (req, res) => {
  const { orderId } = req.query as any;
  res.send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pago cancelado - ComeYa</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F7F7F7;padding:24px;text-align:center;}</style>
    <script>window.location.href='comeya://order-cancelled?orderId=${orderId}';</script>
    </head>
    <body><div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
    <div style="font-size:64px">&#x274C;</div>
    <h1 style="color:#1A1A1A">Pago cancelado</h1>
    <p style="color:#555">No se realizo ningun cargo. Puedes intentarlo de nuevo.</p>
    <a href="comeya://" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700">Volver a ComeYa</a>
    </div></body></html>
  `);
});

// POST /api/payments/webhook/stripe
router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const { handleStripeWebhook } = await import("../webhookHandlers");
    return handleStripeWebhook(req, res);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/payments/webhook/binance
router.post("/webhook/binance", async (req, res) => {
  try {
    const { bizType, data } = req.body;
    if (bizType === "PAY" && data?.merchantTradeNo) {
      const orderId = data.merchantTradeNo;
      const { db } = await import("../db");
      const { orders } = await import("../../shared/schema-mysql");
      await db.update(orders).set({ status: "confirmed", updatedAt: new Date() }).where(eq(orders.id, orderId));
    }
    res.json({ returnCode: "SUCCESS", returnMessage: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
