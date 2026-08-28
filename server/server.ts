import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { config } from "dotenv";
import { validateEnv } from "./env";
import { createServer } from "http";
import { initializeWebSocket } from "./websocket";

// Cargar variables de entorno antes de todo
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

validateEnv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:3000",
  "https://comeya.es",
  "https://www.comeya.es",
  "https://app.comeya.es",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Permitir requests sin origin (mobile, Postman, etc)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS bloqueado: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 500 : 10000,
    message: "Too many requests from this IP",
    skip: (req) => {
      // No aplicar rate limit a endpoints de polling frecuente con auth
      const skipPaths = [
        "/api/orders",
        "/api/delivery/location",
        "/api/tracking",
        // El centro de operaciones del admin refresca cada pocos segundos y
        // puede estar abierto en varias pestañas a la vez
        "/api/admin/ops",
        "/api/admin/tracking",
      ];
      return skipPaths.some((p) => req.path.startsWith(p.replace("/api", "")));
    },
  }),
);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Los webhooks de Stripe necesitan el raw body SIN parsear para verificar
// la firma: se registran antes del express.json general
app.use("/api/connect/webhook", express.raw({ type: "application/json" }));
app.use(
  "/api/payments/webhook/stripe",
  express.raw({ type: "application/json" }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Forzar charset UTF-8 en todas las respuestas JSON
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  };
  next();
});

// Serve uploaded files
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads")),
);

// Serve public folder (privacy-policy, logos, etc.) — disponible en todos los entornos
app.use(express.static(path.join(process.cwd(), "public"), { index: false }));
app.get("/privacy-policy", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "privacy-policy.html"));
});
app.get("/delete-account", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "delete-account.html"));
});

// Serve client assets (logo, splash, etc.)
app.use("/assets", express.static(path.join(process.cwd(), "client/assets")));

// ─── API ROUTES (modular) ─────────────────────────────────────────────────────
import apiRouter from "./routes";
app.use("/api", apiRouter);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── STATIC / SPA ─────────────────────────────────────────────────────────────
if (isProduction) {
  const distIndex = path.join(process.cwd(), "dist", "index.html");
  const hasFrontendBuild = fs.existsSync(distIndex);
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    // En despliegues solo-backend (Render) no existe dist/: antes explotaba
    // con ENOENT al visitar la raíz. La web vive en Vercel.
    if (!hasFrontendBuild) {
      return res.status(200).send(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ComeYa API</title></head>` +
          `<body style="font-family:system-ui;text-align:center;padding:48px">` +
          `<h1>🛵 ComeYa API</h1><p>El backend está funcionando.</p>` +
          `<p>La app web está en <a href="${process.env.FRONTEND_URL || "https://app.comeya.es"}">${process.env.FRONTEND_URL || "https://app.comeya.es"}</a></p>` +
          `</body></html>`,
      );
    }
    res.sendFile(distIndex);
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      message: "MOUZO API Server",
      frontend: process.env.FRONTEND_URL || "http://localhost:8081",
    });
  });
}

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
app.use((err: any, req: any, res: any, next: any) => {
  // AppError (ValidationError, NotFoundError, AuthorizationError...) conserva
  // su statusCode y mensaje; el resto son errores internos reales (500).
  if (err?.statusCode && err?.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res
    .status(404)
    .json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── START ────────────────────────────────────────────────────────────────────
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);

  // Inicializar WebSocket
  initializeWebSocket(httpServer);
  console.log("🔌 WebSocket initialized");

  if (!process.env.TWILIO_ACCOUNT_SID)
    console.warn("⚠️  Twilio not configured");
  if (!process.env.MOUZO_PAGO_MOVIL_PHONE)
    console.warn(
      "⚠️  Pago Móvil no configurado - agrega MOUZO_PAGO_MOVIL_PHONE en .env",
    );

  // Migraciones de arranque ANTES que los crons: sin esta espera, las
  // queries con columnas nuevas (orders.deleted_at…) fallaban con
  // "Unknown column" durante el primer segundo del deploy
  import("./db")
    .then(({ runStartupMigrations }) => runStartupMigrations())
    .then(() => {
      import("./businessHoursCron")
        .then(({ startBusinessHoursCron }) => startBusinessHoursCron())
        .catch(console.error);
      import("./weeklySettlementCron")
        .then(({ WeeklySettlementCron }) => WeeklySettlementCron.start())
        .catch(console.error);
      import("./autoConfirmDeliveryCron")
        .then(({ startAutoConfirmCron }) => startAutoConfirmCron())
        .catch(console.error);
      import("./pickupNotificationCron")
        .then(({ startPickupNotificationCron }) => startPickupNotificationCron())
        .catch(console.error);
      import("./staleOrdersCron")
        .then(({ startStaleOrdersCron }) => startStaleOrdersCron())
        .catch(console.error);
      // Jobs en segundo plano: liberación de fondos, pedidos programados,
      // desbloqueo de repartidores, limpieza de strikes, etc.
      import("./backgroundJobs")
        .then(({ startBackgroundJobs }) => startBackgroundJobs())
        .catch(console.error);
    })
    .catch((err) => console.error("Startup migrations error:", err.message));
});
