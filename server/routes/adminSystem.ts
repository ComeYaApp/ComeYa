import express from "express";
import { sql } from "drizzle-orm";
import { authenticateToken, requireRole } from "../authMiddleware";
import { db } from "../db";

const router = express.Router();

router.use(authenticateToken, requireRole("admin", "super_admin"));

// GET /api/admin/system/health — estado del sistema sin secretos.
router.get("/health", async (_req, res) => {
  const started = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
    dbLatencyMs = Date.now() - started;
  } catch {
    dbOk = false;
  }

  let socket = { initialized: false, clients: 0, adminClients: 0 };
  try {
    const { getIO } = await import("../websocket");
    const io = getIO();
    socket = {
      initialized: true,
      clients: io.sockets.sockets.size,
      adminClients: io.sockets.adapter.rooms.get("admins")?.size ?? 0,
    };
  } catch {
    /* socket aún no inicializado */
  }

  const mem = process.memoryUsage();
  const services = {
    cloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    ),
    gemini: Boolean(
      process.env.GEMINI_API_KEY ||
        process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    ),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN,
    ),
    resend: Boolean(process.env.RESEND_API_KEY),
    expoPush: Boolean(process.env.EXPO_ACCESS_TOKEN),
    googleMaps: Boolean(
      process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_WEB_KEY,
    ),
  };

  const degraded =
    !dbOk ||
    (dbLatencyMs ?? 0) > 1000 ||
    !socket.initialized ||
    (!services.cloudinary && process.env.NODE_ENV === "production") ||
    (!services.twilio && process.env.NODE_ENV === "production");

  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    status: !dbOk ? "unhealthy" : degraded ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    app: {
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      backgroundJobsDisabled:
        process.env.DISABLE_BACKGROUND_JOBS === "true",
    },
    database: { connected: dbOk, latencyMs: dbLatencyMs },
    socket,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    services,
  });
});

export default router;
