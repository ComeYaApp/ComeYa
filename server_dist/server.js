var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) =>
  typeof require !== "undefined"
    ? require
    : typeof Proxy !== "undefined"
      ? new Proxy(x, {
          get: (a, b) => (typeof require !== "undefined" ? require : a)[b],
        })
      : x)(function (x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) =>
  function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
  };
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/env.ts
import { z } from "zod";
function validateEnv() {
  if (validatedEnv) return validatedEnv;
  try {
    validatedEnv = envSchema.parse(process.env);
    console.log("\u2705 Environment variables validated successfully");
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("\u274C Environment validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\n\u{1F4CB} Required environment variables:");
      console.error("  DATABASE_URL, FRONTEND_URL, BACKEND_URL");
      console.error("\n\u{1F4CB} Optional (for production):");
      console.error(
        "  STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET",
      );
      console.error(
        "  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_VERIFY_SERVICE_SID",
      );
      process.exit(1);
    }
    throw error;
  }
}
var envSchema, validatedEnv;
var init_env = __esm({
  "server/env.ts"() {
    "use strict";
    envSchema = z.object({
      // Database
      DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
      // Server
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
      PORT: z.string().default("5000"),
      FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
      BACKEND_URL: z.string().url("BACKEND_URL must be a valid URL"),
      // Stripe (Optional in development)
      STRIPE_SECRET_KEY: z
        .string()
        .refine(
          (val) => !val || val.startsWith("sk_"),
          "STRIPE_SECRET_KEY must start with sk_ or be empty",
        )
        .optional()
        .default(""),
      STRIPE_PUBLISHABLE_KEY: z
        .string()
        .refine(
          (val) => !val || val.startsWith("pk_"),
          "STRIPE_PUBLISHABLE_KEY must start with pk_ or be empty",
        )
        .optional()
        .default(""),
      STRIPE_WEBHOOK_SECRET: z
        .string()
        .refine(
          (val) => !val || val.startsWith("whsec_"),
          "STRIPE_WEBHOOK_SECRET must start with whsec_ or be empty",
        )
        .optional()
        .default(""),
      // Twilio (Optional in development)
      TWILIO_ACCOUNT_SID: z
        .string()
        .refine(
          (val) => !val || val.startsWith("AC"),
          "TWILIO_ACCOUNT_SID must start with AC or be empty",
        )
        .optional()
        .default(""),
      TWILIO_AUTH_TOKEN: z.string().optional().default(""),
      TWILIO_PHONE_NUMBER: z
        .string()
        .refine(
          (val) => !val || val.startsWith("+"),
          "TWILIO_PHONE_NUMBER must start with + or be empty",
        )
        .optional()
        .default(""),
      TWILIO_VERIFY_SERVICE_SID: z
        .string()
        .refine(
          (val) => !val || val.startsWith("VA"),
          "TWILIO_VERIFY_SERVICE_SID must start with VA or be empty",
        )
        .optional()
        .default(""),
      // Optional services
      RESEND_API_KEY: z.string().optional(),
      OPENAI_API_KEY: z.string().optional(),
    });
    validatedEnv = null;
  },
});

// server/logger.ts
var Logger, logger;
var init_logger = __esm({
  "server/logger.ts"() {
    "use strict";
    Logger = class {
      minLevel = null;
      getMinLevel() {
        if (this.minLevel === null) {
          this.minLevel =
            process.env.NODE_ENV === "production"
              ? 1 /* INFO */
              : 0 /* DEBUG */;
        }
        return this.minLevel;
      }
      formatMessage(level, message, context) {
        const timestamp2 = /* @__PURE__ */ new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : "";
        return `[${timestamp2}] ${level}: ${message}${contextStr}`;
      }
      shouldLog(level) {
        return level >= this.getMinLevel();
      }
      debug(message, context) {
        if (this.shouldLog(0 /* DEBUG */)) {
          console.log(this.formatMessage("DEBUG", message, context));
        }
      }
      info(message, context) {
        if (this.shouldLog(1 /* INFO */)) {
          console.log(this.formatMessage("INFO", message, context));
        }
      }
      warn(message, context) {
        if (this.shouldLog(2 /* WARN */)) {
          console.warn(this.formatMessage("WARN", message, context));
        }
      }
      error(message, error, context) {
        if (this.shouldLog(3 /* ERROR */)) {
          const errorContext = {
            ...context,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : error,
          };
          console.error(this.formatMessage("ERROR", message, errorContext));
        }
      }
      // Specific loggers for common operations
      payment(message, context) {
        this.info(`[PAYMENT] ${message}`, context);
      }
      order(message, context) {
        this.info(`[ORDER] ${message}`, context);
      }
      delivery(message, context) {
        this.info(`[DELIVERY] ${message}`, context);
      }
      webhook(message, context) {
        this.info(`[WEBHOOK] ${message}`, context);
      }
      security(message, context) {
        this.warn(`[SECURITY] ${message}`, context);
      }
    };
    logger = new Logger();
  },
});

// server/websocket.ts
var websocket_exports = {};
__export(websocket_exports, {
  getIO: () => getIO,
  initializeWebSocket: () => initializeWebSocket,
  notifyAdminFraud: () => notifyAdminFraud,
  notifyAdminNewPayout: () => notifyAdminNewPayout,
  notifyAdminNewProof: () => notifyAdminNewProof,
  notifyAdminNewTicket: () => notifyAdminNewTicket,
  notifyAdminOrderStuck: () => notifyAdminOrderStuck,
  notifyDriverAssigned: () => notifyDriverAssigned,
  notifyNewOrder: () => notifyNewOrder,
  notifyOrderStatusChange: () => notifyOrderStatusChange,
  notifyPaymentVerified: () => notifyPaymentVerified,
});
import { Server as SocketIOServer } from "socket.io";
function initializeWebSocket(httpServer2) {
  io = new SocketIOServer(httpServer2, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.on("connection", (socket) => {
    logger.info(`\u{1F50C} WebSocket connected: ${socket.id}`);
    socket.on("join", (data) => {
      socket.join(`user:${data.userId}`);
      if (data.role === "business_owner" && data.businessId) {
        socket.join(`business:${data.businessId}`);
        logger.info(`\u{1F454} Business ${data.businessId} joined room`);
      }
      if (data.role === "delivery_driver") {
        socket.join("drivers");
        logger.info(`\u{1F697} Driver ${data.userId} joined drivers room`);
      }
      if (data.role === "admin") {
        socket.join("admins");
        logger.info(
          `\u{1F468}\u200D\u{1F4BC} Admin ${data.userId} joined admins room`,
        );
      }
    });
    socket.on("disconnect", () => {
      logger.info(`\u{1F50C} WebSocket disconnected: ${socket.id}`);
    });
  });
  return io;
}
function getIO() {
  if (!io) throw new Error("WebSocket not initialized");
  return io;
}
function notifyNewOrder(businessId, order) {
  if (!io) return;
  io.to(`business:${businessId}`).emit("new_order", order);
  io.to("admins").emit("new_order", order);
  logger.info(
    `\u{1F4E6} New order notification sent to business ${businessId}`,
  );
}
function notifyOrderStatusChange(userId, orderId, status) {
  if (!io) return;
  io.to(`user:${userId}`).emit("order_status_changed", { orderId, status });
}
function notifyDriverAssigned(driverId, order) {
  if (!io) return;
  io.to(`user:${driverId}`).emit("order_assigned", order);
}
function notifyPaymentVerified(businessId, orderId) {
  if (!io) return;
  io.to(`business:${businessId}`).emit("payment_verified", { orderId });
}
function notifyAdminFraud(data) {
  if (!io) return;
  io.to("admins").emit("admin_fraud_detected", {
    ...data,
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
  logger.warn(`\u{1F6A8} Fraud alert sent to admins: ${data.reason}`);
}
function notifyAdminNewProof(data) {
  if (!io) return;
  io.to("admins").emit("admin_new_proof", {
    ...data,
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
}
function notifyAdminNewPayout(data) {
  if (!io) return;
  io.to("admins").emit("admin_new_payout", {
    ...data,
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
}
function notifyAdminNewTicket(data) {
  if (!io) return;
  io.to("admins").emit("admin_new_ticket", {
    ...data,
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
}
function notifyAdminOrderStuck(data) {
  if (!io) return;
  io.to("admins").emit("admin_order_stuck", {
    ...data,
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
}
var io;
var init_websocket = __esm({
  "server/websocket.ts"() {
    "use strict";
    init_logger();
    io = null;
  },
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  connection: () => connection,
  db: () => db,
  ensureTestSchema: () => ensureTestSchema,
});
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
function createConnectionConfig() {
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (mysqlUrl) {
    const url = new URL(mysqlUrl);
    const config4 = {
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      // Remove leading /
      waitForConnections: true,
      connectionLimit: 3,
      maxIdle: 3,
      idleTimeout: 6e4,
      queueLimit: 0,
      connectTimeout: 3e4,
      enableKeepAlive: true,
      keepAliveInitialDelay: 1e4,
      charset: "utf8mb4",
    };
    if (url.searchParams.get("ssl-mode") === "DISABLED") {
      config4.ssl = false;
      console.log("\u274C SSL disabled for MySQL connection");
    } else if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      config4.ssl = false;
      console.log("\u{1F3E0} SSL disabled for localhost connection");
    } else {
      const caEnv = process.env.AIVEN_CA_CERT;
      const caPath = path.join(process.cwd(), "ca.pem");
      const ca = caEnv
        ? Buffer.from(caEnv, "base64").toString("utf-8")
        : fs.existsSync(caPath)
          ? fs.readFileSync(caPath, "utf-8")
          : null;
      if (ca) {
        config4.ssl = { ca, rejectUnauthorized: true };
        console.log("\u{1F4DC} Using SSL certificate for MySQL connection");
      } else {
        config4.ssl = { rejectUnauthorized: false };
        console.log("\u{1F512} Using SSL without CA certificate");
      }
    }
    return config4;
  }
  const host = process.env.DB_HOST || "localhost";
  const config3 = {
    host,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
  const fallbackCharset = process.env.DB_CHARSET || "utf8mb4";
  config3.charset = normalizeCharset(fallbackCharset);
  if (host !== "localhost" && host !== "127.0.0.1") {
    config3.ssl = {
      rejectUnauthorized: false,
    };
    console.log(
      "\u{1F512} Using SSL with disabled certificate verification for",
      host,
    );
  }
  return config3;
}
function normalizeCharset(charset) {
  const normalized = charset.toLowerCase();
  if (normalized === "cesu8" || normalized === "cesu-8") {
    return "utf8mb4";
  }
  return charset;
}
async function ensureColumn(conn, tableName, columnName, addSql) {
  const [rows] = await conn.query(
    `
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName],
  );
  const count3 = Array.isArray(rows) ? rows[0]?.count : 0;
  if (!count3) {
    await conn.query(addSql);
  }
}
async function ensureTestSchema() {
  if (useDbStubs) {
    return;
  }
  const conn = await connection.getConnection();
  try {
    await ensureColumn(
      conn,
      "users",
      "profile_image",
      "ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT NULL",
    );
    await ensureColumn(
      conn,
      "users",
      "stripe_account_id",
      "ALTER TABLE users ADD COLUMN stripe_account_id TEXT DEFAULT NULL",
    );
    await ensureColumn(
      conn,
      "users",
      "bank_account",
      "ALTER TABLE users ADD COLUMN bank_account TEXT DEFAULT NULL",
    );
  } finally {
    conn.release();
  }
}
var isTest, useDbStubs, connection, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    config({ path: ".env.local", override: true });
    config({ path: ".env", override: false });
    isTest = process.env.NODE_ENV === "test";
    useDbStubs = process.env.USE_DB_STUBS === "true";
    if (isTest && useDbStubs) {
      console.log("\u{1F9EA} Test mode: using in-memory stubs for db");
      connection = {
        getConnection: async () => ({ release() {} }),
      };
      db = {
        select: () => ({
          from: () => ({
            where: () => ({ limit: async () => [] }),
          }),
        }),
        insert: () => ({ values: async () => ({}) }),
        update: () => ({ set: () => ({ where: async () => ({}) }) }),
      };
    } else {
      connection = mysql.createPool(createConnectionConfig());
      const originalGetConnection = connection.getConnection.bind(connection);
      connection.getConnection = async () => {
        const conn = await originalGetConnection();
        await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        return conn;
      };
      db = drizzle(connection);
      if (!isTest) {
        connection
          .getConnection()
          .then(async (conn) => {
            console.log("\u2705 Database connected successfully");
            try {
              await conn.query(
                `ALTER TABLE businesses ADD COLUMN custom_commission INT DEFAULT NULL`,
              );
              console.log("Added custom_commission to businesses");
            } catch (err) {
              if (err.code !== "ER_DUP_FIELDNAME")
                console.log("Migration note:", err.message);
            }
            try {
              await conn.query(
                `ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT NULL`,
              );
              console.log("Added profile_image to users");
            } catch (err) {
              if (err.code !== "ER_DUP_FIELDNAME")
                console.log("Migration note:", err.message);
            }
            try {
              await conn.query(
                `ALTER TABLE users ADD COLUMN bank_account TEXT DEFAULT NULL`,
              );
              console.log("Added bank_account to users");
            } catch (err) {
              if (err.code !== "ER_DUP_FIELDNAME")
                console.log("Migration note:", err.message);
            }
            conn.release();
          })
          .catch((err) => {
            console.error("\u274C Database connection failed:", err.message);
          });
      }
    }
  },
});

// shared/schema-mysql.ts
var schema_mysql_exports = {};
__export(schema_mysql_exports, {
  achievements: () => achievements,
  addresses: () => addresses,
  aiRecommendations: () => aiRecommendations,
  auditLogs: () => auditLogs,
  businessCategories: () => businessCategories,
  businesses: () => businesses,
  callLogs: () => callLogs,
  couponUsage: () => couponUsage,
  coupons: () => coupons,
  deliveryDrivers: () => deliveryDrivers,
  deliveryHeatmap: () => deliveryHeatmap,
  deliveryProofs: () => deliveryProofs,
  deliveryZones: () => deliveryZones,
  drivers: () => drivers,
  favorites: () => favorites,
  giftCardDesigns: () => giftCardDesigns,
  giftCardTransactions: () => giftCardTransactions,
  giftCards: () => giftCards,
  groupOrderInvitations: () => groupOrderInvitations,
  groupOrderParticipants: () => groupOrderParticipants,
  groupOrders: () => groupOrders,
  insertOrderSchema: () => insertOrderSchema,
  insertUserSchema: () => insertUserSchema,
  loyaltyChallengeProgress: () => loyaltyChallengeProgress,
  loyaltyChallenges: () => loyaltyChallenges,
  loyaltyPoints: () => loyaltyPoints,
  loyaltyRedemptions: () => loyaltyRedemptions,
  loyaltyRewards: () => loyaltyRewards,
  loyaltyTransactions: () => loyaltyTransactions,
  orders: () => orders,
  pagoMovilVerifications: () => pagoMovilVerifications,
  paymentAccounts: () => paymentAccounts,
  paymentMethods: () => paymentMethods,
  paymentProofs: () => paymentProofs,
  payments: () => payments,
  payouts: () => payouts,
  products: () => products,
  proximityAlerts: () => proximityAlerts,
  refreshTokens: () => refreshTokens,
  reviewResponses: () => reviewResponses,
  reviewTags: () => reviewTags,
  reviews: () => reviews,
  scheduledOrders: () => scheduledOrders,
  subscriptionBenefits: () => subscriptionBenefits,
  subscriptionPlans: () => subscriptionPlans,
  subscriptions: () => subscriptions,
  supportChats: () => supportChats,
  supportMessages: () => supportMessages,
  supportTickets: () => supportTickets,
  systemSettings: () => systemSettings,
  ticketMessages: () => ticketMessages,
  transactions: () => transactions,
  userAchievements: () => userAchievements,
  userFavorites: () => userFavorites,
  userPreferences: () => userPreferences,
  users: () => users,
  walletTransactions: () => walletTransactions,
  wallets: () => wallets,
  withdrawalRequests: () => withdrawalRequests,
  withdrawals: () => withdrawals,
});
import { sql } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  timestamp,
  int,
  decimal,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z as z2 } from "zod";
var users,
  addresses,
  orders,
  businesses,
  wallets,
  transactions,
  payments,
  walletTransactions,
  insertUserSchema,
  insertOrderSchema,
  systemSettings,
  products,
  pagoMovilVerifications,
  paymentAccounts,
  payouts,
  withdrawals,
  withdrawalRequests,
  deliveryDrivers,
  auditLogs,
  drivers,
  refreshTokens,
  scheduledOrders,
  supportChats,
  supportMessages,
  reviews,
  reviewResponses,
  reviewTags,
  callLogs,
  deliveryZones,
  coupons,
  favorites,
  deliveryHeatmap,
  proximityAlerts,
  deliveryProofs,
  paymentMethods,
  paymentProofs,
  couponUsage,
  loyaltyPoints,
  loyaltyTransactions,
  loyaltyRewards,
  loyaltyRedemptions,
  loyaltyChallenges,
  loyaltyChallengeProgress,
  achievements,
  userAchievements,
  userFavorites,
  userPreferences,
  aiRecommendations,
  supportTickets,
  groupOrders,
  groupOrderParticipants,
  groupOrderInvitations,
  subscriptions,
  subscriptionBenefits,
  subscriptionPlans,
  giftCards,
  giftCardTransactions,
  giftCardDesigns,
  ticketMessages,
  businessCategories;
var init_schema_mysql = __esm({
  "shared/schema-mysql.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      email: text("email"),
      password: text("password"),
      name: text("name").notNull(),
      phone: text("phone").notNull(),
      role: text("role").notNull().default("customer"),
      emailVerified: boolean("email_verified").notNull().default(false),
      phoneVerified: boolean("phone_verified").notNull().default(false),
      biometricEnabled: boolean("biometric_enabled").notNull().default(false),
      verificationCode: text("verification_code"),
      verificationExpires: timestamp("verification_expires"),
      // Datos personales España
      dni: varchar("dni", { length: 20 }),
      // DNI/NIE
      address: text("address"),
      // Dirección completa
      // Verificación de identidad
      idDocumentUrl: text("id_document_url"),
      // Foto DNI/NIE
      autonomoDocumentUrl: text("autonomo_document_url"),
      // Cert. autónomo/empresa
      verificationStatus: varchar("verification_status", {
        length: 20,
      }).default("pending"),
      // pending, verified, rejected
      verificationNotes: text("verification_notes"),
      // Legacy Venezuela (mantener para no romper)
      // Legacy — mantener columnas para no romper BD existente
      pagoMovilPhone: text("pago_movil_phone"),
      pagoMovilBank: text("pago_movil_bank"),
      pagoMovilCedula: text("pago_movil_cedula"),
      bankAccount: text("bank_account"),
      isActive: boolean("is_active").notNull().default(true),
      isOnline: boolean("is_online").notNull().default(false),
      lastActiveAt: timestamp("last_active_at"),
      profileImage: text("profile_image"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    addresses = mysqlTable("addresses", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      label: text("label").notNull(),
      street: text("street").notNull(),
      city: text("city").notNull(),
      state: text("state").notNull(),
      zipCode: text("zip_code"),
      isDefault: boolean("is_default").notNull().default(false),
      latitude: text("latitude"),
      longitude: text("longitude"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    orders = mysqlTable("orders", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      businessId: text("business_id").notNull(),
      businessName: text("business_name").notNull(),
      businessImage: text("business_image"),
      items: text("items").notNull(),
      status: text("status").notNull().default("pending"),
      // pending, accepted, preparing, on_the_way, delivered, cancelled
      subtotal: int("subtotal").notNull(),
      productosBase: int("productos_base").default(0),
      // Precio base sin markup MOUZO
      nemyCommission: int("nemy_commission").default(0),
      // 15% markup MOUZO
      deliveryFee: int("delivery_fee").notNull(),
      total: int("total").notNull(),
      paymentMethod: text("payment_method").notNull(),
      paymentProvider: varchar("payment_provider", { length: 50 }).default(
        "stripe_bizum",
      ),
      orderType: text("order_type"),
      // delivery | pickup
      estimatedPickupTime: int("estimated_pickup_time"),
      // minutos estimados para pickup
      pickupReadyAt: timestamp("pickup_ready_at"),
      // cuando el pedido estuvo listo para recoger
      customerArrivedAt: timestamp("customer_arrived_at"),
      // cuando el cliente avisó que llegó
      pickupCode: varchar("pickup_code", { length: 6 }),
      // código de 6 dígitos para recoger
      pickupQrCode: text("pickup_qr_code"),
      // QR code único para escanear
      // Referencia de pago (Stripe/PayPal)
      paymentReference: text("pago_movil_reference"),
      paymentProofUrl: text("pago_movil_proof_url"),
      deliveryAddress: text("delivery_address").notNull(),
      deliveryPersonId: text("delivery_person_id"),
      notes: text("notes"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      estimatedDelivery: timestamp("estimated_delivery"),
      // Campos para cancelación y comisiones
      cancelledAt: timestamp("cancelled_at"),
      cancelledBy: varchar("cancelled_by", { length: 255 }),
      cancellationReason: text("cancellation_reason"),
      refundAmount: int("refund_amount"),
      penaltyAmount: int("penalty_amount"),
      // penalización por cancelación
      refundStatus: text("refund_status"),
      // pending, processed, failed
      businessResponseAt: timestamp("business_response_at"),
      // cuando el negocio respondió
      platformFee: int("platform_fee"),
      // comisión MOUZO
      businessEarnings: int("business_earnings"),
      // ganancia negocio
      deliveryEarnings: int("delivery_earnings"),
      // ganancia repartidor
      distanceKm: int("distance_km"),
      // distancia en metros x100
      deliveredAt: timestamp("delivered_at"),
      // cuando se entregó
      deliveryLatitude: text("delivery_latitude"),
      deliveryLongitude: text("delivery_longitude"),
      // Preferencias de sustitución (Stock Out)
      substitutionPreference: text("substitution_preference").default("refund"),
      // refund, call, substitute
      itemSubstitutionPreferences: text("item_substitution_preferences"),
      // JSON: {productId: "refund"|"call"|"substitute"}
      // Pago en efectivo
      cashPaymentAmount: int("cash_payment_amount"),
      // Con cuánto paga el cliente (centavos)
      cashChangeAmount: int("cash_change_amount"),
      // Cambio a entregar (centavos)
      // Cronómetro de arrepentimiento
      regretPeriodEndsAt: timestamp("regret_period_ends_at"),
      // Cuando termina el periodo de 60s
      regretPeriodConfirmed: boolean("regret_period_confirmed").default(false),
      // Cliente confirmó después de 60s (no va a cancelar)
      regretPeriodConfirmedAt: timestamp("regret_period_confirmed_at"),
      // Cuándo confirmó el período
      confirmedToBusinessAt: timestamp("confirmed_to_business_at"),
      // Cuando se notificó al negocio
      // Llamada automática al negocio
      callAttempted: boolean("call_attempted").default(false),
      // Si ya se intentó llamar al negocio
      callAttemptedAt: timestamp("call_attempted_at"),
      // Cuando se intentó la llamada
      // Campos adicionales de pago
      paidAt: timestamp("paid_at"),
      refundedAt: timestamp("refunded_at"),
      driverPaidAt: timestamp("driver_paid_at"),
      driverPaymentStatus: text("driver_payment_status").default("pending"),
      // Confirmación de recepción por cliente (para liberar fondos)
      confirmedByCustomer: boolean("confirmed_by_customer").default(false),
      // Si el cliente confirmó que RECIBIÓ el pedido
      confirmedByCustomerAt: timestamp("confirmed_by_customer_at"),
      // Cuándo confirmó la recepción
      fundsReleased: boolean("funds_released").default(false),
      // Si ya se liberaron los fondos
      fundsReleasedAt: timestamp("funds_released_at"),
      // Cuándo se liberaron
      businessTransferId: text("business_transfer_id"),
      // ID de transfer a negocio
      driverTransferId: text("driver_transfer_id"),
      // ID de transfer a repartidor
      // Asignación de repartidor
      assignedAt: timestamp("assigned_at"),
      // Cuando se asignó el repartidor
      driverPickedUpAt: timestamp("driver_picked_up_at"),
      // Cuando repartidor recogió el pedido
      driverArrivedAt: timestamp("driver_arrived_at"),
      // Cuando repartidor llegó con el cliente
      // Liquidación de efectivo (para pedidos cash)
      cashCollected: boolean("cash_collected").default(false),
      // Si el repartidor ya cobró el efectivo
      cashSettled: boolean("cash_settled").default(false),
      // Si ya liquidó con negocio/plataforma
      cashSettledAt: timestamp("cash_settled_at"),
      // Cuando liquidó
      // Prueba de entrega
      deliveryProofPhoto: text("delivery_proof_photo"),
      // URL de foto de entrega
      deliveryProofPhotoTimestamp: timestamp("delivery_proof_photo_timestamp"),
      deliveryRoute: text("delivery_route"),
      // JSON con ruta completa del repartidor
      deliveryDistance: int("delivery_distance"),
      // Distancia real recorrida en metros
      // Validación GPS
      deliveryGpsAccuracy: int("delivery_gps_accuracy"),
      // Precisión del GPS en metros
      deliveryGpsValidated: boolean("delivery_gps_validated").default(false),
      // Si se validó la ubicación
      // Compartir tracking
      trackingToken: varchar("tracking_token", { length: 255 }),
      // Token para compartir tracking
      trackingTokenExpires: timestamp("tracking_token_expires"),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    businesses = mysqlTable("businesses", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      ownerId: varchar("owner_id", { length: 255 }),
      name: text("name").notNull(),
      description: text("description"),
      type: text("type").notNull().default("restaurant"),
      // restaurant, market
      image: text("image"),
      coverImage: text("cover_image"),
      address: text("address"),
      phone: text("phone"),
      phoneVerified: boolean("phone_verified").notNull().default(false),
      email: text("email"),
      rating: int("rating").default(0),
      // stored as 0-50 (for 0.0-5.0)
      totalRatings: int("total_ratings").default(0),
      deliveryTime: text("delivery_time").default("30-45 min"),
      deliveryFee: int("delivery_fee").default(300),
      // en centavos de euro (3€)
      minOrder: int("min_order").default(1e3),
      // en centavos de euro (10€ mínimo)
      isActive: boolean("is_active").notNull().default(true),
      isOpen: boolean("is_open").notNull().default(true),
      openingHours: text("opening_hours"),
      // JSON string
      categories: text("categories"),
      // comma-separated
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      // Campos para ubicación y zonas de entrega
      latitude: text("latitude"),
      longitude: text("longitude"),
      maxDeliveryRadiusKm: int("max_delivery_radius_km").default(10),
      // Radio máximo de entrega
      baseFeePerKm: int("base_fee_per_km").default(500),
      // Costo por km en centavos
      verificationStatus: text("verification_status").default("pending"),
      // pending, verified, rejected
      verificationDocuments: text("verification_documents"),
      // JSON con URLs de documentos
      // Control operativo de negocios
      maxSimultaneousOrders: int("max_simultaneous_orders").default(10),
      // Límite de pedidos activos
      isPaused: boolean("is_paused").notNull().default(false),
      // Pausado por sistema o manual
      pauseReason: text("pause_reason"),
      // Razón de pausa: manual, too_many_orders, delayed_orders
      pausedAt: timestamp("paused_at"),
      pausedUntil: timestamp("paused_until"),
      // Pausa temporal
      autoResumeEnabled: boolean("auto_resume_enabled").notNull().default(true),
      isFeatured: boolean("is_featured").notNull().default(false),
      // Destacado en pantalla de login
      featuredOrder: int("featured_order").default(0),
      // Orden de aparición en carrusel
      // Modo Slammed (Saturado)
      isSlammed: boolean("is_slammed").notNull().default(false),
      // Negocio saturado
      slammedExtraMinutes: int("slammed_extra_minutes").default(20),
      // Minutos extra cuando está saturado
      slammedAt: timestamp("slammed_at"),
      // Cuando se activó el modo saturado
      pagoMovilPhone: text("pago_movil_phone"),
      pagoMovilBank: text("pago_movil_bank"),
      pagoMovilCedula: text("pago_movil_cedula"),
      verificationCode: text("verification_code"),
      verificationExpires: timestamp("verification_expires"),
      // Niveles de partner
      partnerLevel: varchar("partner_level", { length: 20 }).default("bronze"),
      // bronze, silver, gold, platinum
      partnerLevelUpdatedAt: timestamp("partner_level_updated_at"),
      customCommission: int("custom_commission"),
      // null = usa global, numero = % especifico para este negocio
      totalOrdersCompleted: int("total_orders_completed").default(0),
      totalRevenueGenerated: int("total_revenue_generated").default(0),
      // en centavos
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    wallets = mysqlTable("wallets", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      balance: int("balance").notNull().default(0),
      // en centavos - saldo disponible
      pendingBalance: int("pending_balance").notNull().default(0),
      // dinero en tránsito
      cashOwed: int("cash_owed").notNull().default(0),
      // efectivo que debe liquidar (para repartidores)
      totalEarned: int("total_earned").notNull().default(0),
      totalWithdrawn: int("total_withdrawn").notNull().default(0),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    transactions = mysqlTable("transactions", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      walletId: varchar("wallet_id", { length: 255 }),
      orderId: varchar("order_id", { length: 255 }),
      businessId: varchar("business_id", { length: 255 }),
      userId: varchar("user_id", { length: 255 }),
      type: text("type").notNull(),
      // income, commission, withdrawal, refund, penalty, tip, payment, transfer, delivery_payment
      amount: int("amount").notNull(),
      // en centavos (positivo = ingreso, negativo = egreso)
      balanceBefore: int("balance_before"),
      balanceAfter: int("balance_after"),
      description: text("description"),
      status: text("status").notNull().default("completed"),
      // pending, completed, failed, cancelled
      metadata: text("metadata"),
      // JSON con info adicional
      pagoMovilReference: text("pago_movil_reference"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    payments = mysqlTable("payments", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      customerId: varchar("customer_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      driverId: varchar("driver_id", { length: 255 }),
      amount: int("amount").notNull(),
      // en centavos
      currency: text("currency").notNull().default("EUR"),
      status: text("status").notNull().default("pending"),
      paymentMethod: text("payment_method").notNull().default("stripe_bizum"),
      orderType: text("order_type").notNull().default("delivery"),
      // delivery | pickup
      pagoMovilReference: text("pago_movil_reference"),
      processedAt: timestamp("processed_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    walletTransactions = transactions;
    insertUserSchema = createInsertSchema(users)
      .pick({
        email: true,
        password: true,
        name: true,
        phone: true,
        role: true,
      })
      .extend({
        phone: z2.string().min(10, "Phone number is required"),
        name: z2.string().min(1, "Name is required"),
        email: z2.string().email().optional().nullable(),
        password: z2.string().optional().nullable(),
      });
    insertOrderSchema = createInsertSchema(orders).pick({
      userId: true,
      businessId: true,
      businessName: true,
      businessImage: true,
      items: true,
      status: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      paymentMethod: true,
      paymentIntentId: true,
      deliveryAddress: true,
      notes: true,
      substitutionPreference: true,
      itemSubstitutionPreferences: true,
      cashPaymentAmount: true,
      cashChangeAmount: true,
    });
    systemSettings = mysqlTable("system_settings", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      key: varchar("key", { length: 255 }).notNull().unique(),
      value: text("value").notNull(),
      type: text("type").notNull().default("string"),
      // string, number, boolean, json
      category: text("category").notNull(),
      // payments, commissions, operations, security
      description: text("description"),
      isPublic: boolean("is_public").notNull().default(false),
      // Si es visible para clientes
      updatedBy: varchar("updated_by", { length: 255 }),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    products = mysqlTable("products", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      name: text("name").notNull(),
      description: text("description"),
      price: int("price").notNull(),
      // en centavos
      image: text("image"),
      category: text("category"),
      isAvailable: boolean("is_available").notNull().default(true),
      is86: boolean("is_86").notNull().default(false),
      // Menú 86 (agotado temporalmente)
      soldByWeight: boolean("sold_by_weight").notNull().default(false),
      weightUnit: text("weight_unit").default("kg"),
      // kg, lb, g
      stock: int("stock"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    pagoMovilVerifications = mysqlTable("pago_movil_verifications", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      userId: varchar("user_id", { length: 255 }).notNull(),
      reference: varchar("reference", { length: 50 }).notNull().unique(),
      amount: int("amount").notNull(),
      proofUrl: text("proof_url"),
      clientPhone: varchar("client_phone", { length: 20 }),
      clientBank: varchar("client_bank", { length: 50 }),
      destPhone: varchar("dest_phone", { length: 20 }),
      destBank: varchar("dest_bank", { length: 50 }),
      destCedula: varchar("dest_cedula", { length: 20 }),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      verifiedBy: varchar("verified_by", { length: 255 }),
      verifiedAt: timestamp("verified_at"),
      rejectedReason: text("rejected_reason"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    paymentAccounts = mysqlTable("payment_accounts", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      method: varchar("method", { length: 50 }).notNull(),
      // pago_movil, binance, zinli, zelle, cash
      isDefault: boolean("is_default").notNull().default(false),
      // Pago Móvil
      pagoMovilPhone: varchar("pago_movil_phone", { length: 20 }),
      pagoMovilBank: varchar("pago_movil_bank", { length: 50 }),
      pagoMovilCedula: varchar("pago_movil_cedula", { length: 20 }),
      // Binance
      binanceId: varchar("binance_id", { length: 100 }),
      binanceEmail: varchar("binance_email", { length: 255 }),
      // Zinli / Zelle
      zinliEmail: varchar("zinli_email", { length: 255 }),
      zelleEmail: varchar("zelle_email", { length: 255 }),
      zellePhone: varchar("zelle_phone", { length: 20 }),
      // Metadata
      label: varchar("label", { length: 100 }),
      // ej: "Mi Banesco principal"
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    payouts = mysqlTable("payouts", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      recipientId: varchar("recipient_id", { length: 255 }).notNull(),
      // negocio o driver
      recipientType: varchar("recipient_type", { length: 20 }).notNull(),
      // business, driver
      amount: int("amount").notNull(),
      // en centavos
      method: varchar("method", { length: 50 }),
      // pago_movil, binance, zinli, zelle, cash
      // Snapshot de la cuenta destino al momento del pago
      accountSnapshot: text("account_snapshot"),
      // JSON con datos de la cuenta usada
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      // pending, paid
      paidBy: varchar("paid_by", { length: 255 }),
      // admin que marcó como pagado
      paidAt: timestamp("paid_at"),
      notes: text("notes"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    withdrawals = payouts;
    withdrawalRequests = payouts;
    deliveryDrivers = mysqlTable("delivery_drivers", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      vehicleType: text("vehicle_type").notNull(),
      // bike, motorcycle, car
      vehiclePlate: text("vehicle_plate"),
      vehiclePhoto: text("vehicle_photo"),
      vehicleBrand: varchar("vehicle_brand", { length: 100 }),
      vehicleModel: varchar("vehicle_model", { length: 100 }),
      vehicleColor: varchar("vehicle_color", { length: 50 }),
      isAvailable: boolean("is_available").notNull().default(false),
      currentLatitude: text("current_latitude"),
      currentLongitude: text("current_longitude"),
      lastLocationUpdate: timestamp("last_location_update"),
      totalDeliveries: int("total_deliveries").notNull().default(0),
      rating: int("rating").default(0),
      // stored as 0-50 (for 0.0-5.0)
      totalRatings: int("total_ratings").default(0),
      strikes: int("strikes").notNull().default(0),
      // Sistema de strikes
      isBlocked: boolean("is_blocked").notNull().default(false),
      blockedReason: text("blocked_reason"),
      blockedUntil: timestamp("blocked_until"),
      // GPS tracking y ruta
      routeHistory: text("route_history"),
      // JSON con historial de rutas
      totalDistanceTraveled: int("total_distance_traveled").default(0),
      // metros totales
      averageSpeed: int("average_speed").default(0),
      // km/h promedio
      gpsAccuracyAverage: int("gps_accuracy_average").default(0),
      // precisión promedio en metros
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    auditLogs = mysqlTable("audit_logs", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      action: text("action").notNull(),
      // create_order, cancel_order, update_settings, etc
      entityType: text("entity_type").notNull(),
      // order, user, business, settings
      entityId: varchar("entity_id", { length: 255 }),
      changes: text("changes"),
      // JSON con cambios realizados
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    drivers = deliveryDrivers;
    refreshTokens = mysqlTable("refresh_tokens", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      token: text("token").notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      revoked: boolean("revoked").notNull().default(false),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    scheduledOrders = mysqlTable("scheduled_orders", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      items: text("items").notNull(),
      // JSON
      scheduledFor: timestamp("scheduled_for").notNull(),
      deliveryAddress: text("delivery_address").notNull(),
      deliveryLatitude: text("delivery_latitude"),
      deliveryLongitude: text("delivery_longitude"),
      paymentMethod: text("payment_method").notNull(),
      notes: text("notes"),
      status: text("status").notNull().default("pending"),
      // pending, processed, failed, cancelled
      orderId: varchar("order_id", { length: 255 }),
      // ID del pedido creado
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    supportChats = mysqlTable("support_chats", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      status: text("status").notNull().default("active"),
      // active, closed, escalated
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    supportMessages = mysqlTable("support_messages", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      chatId: varchar("chat_id", { length: 255 }).notNull(),
      userId: varchar("user_id", { length: 255 }),
      // null si es del bot
      message: text("message").notNull(),
      isBot: boolean("is_bot").notNull().default(false),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    reviews = mysqlTable("reviews", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      rating: int("rating").notNull(),
      // 1-5 (rating general, legacy)
      foodRating: int("food_rating"),
      // 1-5
      deliveryRating: int("delivery_rating"),
      // 1-5
      packagingRating: int("packaging_rating"),
      // 1-5
      deliveryPersonId: varchar("delivery_person_id", { length: 255 }),
      deliveryPersonRating: int("delivery_person_rating"),
      // 1-5
      comment: text("comment"),
      photos: text("photos"),
      // JSON array de URLs
      tags: text("tags"),
      // JSON array de tag IDs
      approved: boolean("approved").notNull().default(true),
      flagged: boolean("flagged").notNull().default(false),
      moderationReason: text("moderation_reason"),
      businessResponse: text("business_response"),
      businessResponseAt: timestamp("business_response_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    reviewResponses = mysqlTable("review_responses", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      reviewId: varchar("review_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      responseText: text("response_text").notNull(),
      respondedBy: varchar("responded_by", { length: 255 }).notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    reviewTags = mysqlTable("review_tags", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      tagName: varchar("tag_name", { length: 100 }).notNull().unique(),
      category: varchar("category", { length: 50 }).notNull(),
      icon: varchar("icon", { length: 50 }),
      isPositive: boolean("is_positive").default(true),
      displayOrder: int("display_order").default(0),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    callLogs = mysqlTable("call_logs", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      callSid: varchar("call_sid", { length: 255 }),
      phoneNumber: varchar("phone_number", { length: 50 }),
      purpose: varchar("purpose", { length: 50 }).default("order_notification"),
      // order_notification, reminder
      status: varchar("status", { length: 50 }).default("initiated"),
      // initiated, ringing, answered, completed, failed, no-answer
      duration: int("duration"),
      // in seconds
      outcome: varchar("outcome", { length: 50 }),
      // accepted, rejected, no-answer
      response: varchar("response", { length: 10 }),
      // digits pressed by business
      responseAction: varchar("response_action", { length: 50 }),
      // accept, reject
      retryCount: int("retry_count").default(0),
      error: text("error"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      completedAt: timestamp("completed_at"),
      updatedAt: timestamp("updated_at"),
    });
    deliveryZones = mysqlTable("delivery_zones", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      name: text("name").notNull(),
      description: text("description"),
      deliveryFee: int("deliveryFee").notNull(),
      // en centavos
      maxDeliveryTime: int("maxDeliveryTime").default(45),
      // minutos
      isActive: boolean("isActive").notNull().default(true),
      coordinates: text("coordinates"),
      // JSON con polígono de coordenadas
      centerLatitude: text("centerLatitude"),
      centerLongitude: text("centerLongitude"),
      radiusKm: int("radiusKm").default(5),
      createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updatedAt").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    coupons = mysqlTable("coupons", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      code: varchar("code", { length: 50 }).notNull().unique(),
      discountType: varchar("discount_type", { length: 20 }).notNull(),
      // percentage, fixed
      discountValue: int("discount_value").notNull(),
      // en centavos o porcentaje
      minOrderAmount: int("min_order_amount").default(0),
      // mínimo de pedido en centavos
      maxUses: int("max_uses"),
      // null = ilimitado
      maxUsesPerUser: int("max_uses_per_user").default(1),
      usedCount: int("used_count").notNull().default(0),
      expiresAt: timestamp("expires_at"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    favorites = mysqlTable("favorites", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }),
      productId: varchar("product_id", { length: 255 }),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    deliveryHeatmap = mysqlTable("delivery_heatmap", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      latitude: text("latitude").notNull(),
      longitude: text("longitude").notNull(),
      orderCount: int("order_count").notNull().default(1),
      totalRevenue: int("total_revenue").notNull().default(0),
      // en centavos
      averageDeliveryTime: int("average_delivery_time").default(0),
      // en segundos
      lastOrderAt: timestamp("last_order_at"),
      gridCell: varchar("grid_cell", { length: 50 }),
      // Para agrupar por celda de grid
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    proximityAlerts = mysqlTable("proximity_alerts", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      driverId: varchar("driver_id", { length: 255 }).notNull(),
      alertType: varchar("alert_type", { length: 50 }).notNull(),
      // approaching, nearby, arrived
      distance: int("distance").notNull(),
      // metros
      destinationType: varchar("destination_type", { length: 50 }).notNull(),
      // business, customer
      notificationSent: boolean("notification_sent").default(false),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    deliveryProofs = mysqlTable("delivery_proofs", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }).notNull().unique(),
      driverId: varchar("driver_id", { length: 255 }).notNull(),
      photoUrl: text("photo_url").notNull(),
      photoBase64: text("photo_base64"),
      // Backup en base64
      latitude: text("latitude").notNull(),
      longitude: text("longitude").notNull(),
      accuracy: int("accuracy"),
      // Precisión GPS en metros
      route: text("route"),
      // JSON con breadcrumbs de la ruta
      routeDistance: int("route_distance"),
      // Distancia total en metros
      timestamp: timestamp("timestamp").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    paymentMethods = mysqlTable("payment_methods", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      name: varchar("name", { length: 100 }).notNull(),
      provider: varchar("provider", { length: 50 }).notNull().unique(),
      displayName: varchar("display_name", { length: 100 }).notNull(),
      isActive: boolean("is_active").default(true),
      requiresManualVerification: boolean(
        "requires_manual_verification",
      ).default(false),
      commissionPercentage: decimal("commission_percentage", {
        precision: 5,
        scale: 2,
      }).default("0.00"),
      iconUrl: varchar("icon_url", { length: 255 }),
      instructions: text("instructions"),
      config: text("config"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    paymentProofs = mysqlTable("payment_proofs", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      orderId: varchar("order_id", { length: 255 }),
      giftCardId: varchar("gift_card_id", { length: 255 }),
      userId: varchar("user_id", { length: 255 }).notNull(),
      paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
      proofImageUrl: varchar("proof_image_url", { length: 500 }),
      referenceNumber: varchar("reference_number", { length: 100 }),
      amount: int("amount").notNull(),
      status: varchar("status", { length: 20 }).default("pending"),
      verifiedBy: varchar("verified_by", { length: 255 }),
      verifiedAt: timestamp("verified_at"),
      verificationNotes: text("verification_notes"),
      submittedAt: timestamp("submitted_at").default(sql`CURRENT_TIMESTAMP`),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    couponUsage = mysqlTable("coupon_usage", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      couponId: varchar("coupon_id", { length: 255 }).notNull(),
      userId: varchar("user_id", { length: 255 }).notNull(),
      orderId: varchar("order_id", { length: 255 }).notNull(),
      discountApplied: int("discount_applied").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    loyaltyPoints = mysqlTable("loyalty_points", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      currentPoints: int("current_points").default(0),
      totalEarned: int("total_earned").default(0),
      totalRedeemed: int("total_redeemed").default(0),
      tier: varchar("tier", { length: 20 }).default("bronze"),
      tierUpdatedAt: timestamp("tier_updated_at"),
      pointsToNextTier: int("points_to_next_tier").default(1e3),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    loyaltyTransactions = mysqlTable("loyalty_transactions", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      type: varchar("type", { length: 50 }).notNull(),
      points: int("points").notNull(),
      description: text("description"),
      orderId: varchar("order_id", { length: 255 }),
      rewardId: varchar("reward_id", { length: 255 }),
      metadata: text("metadata"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    loyaltyRewards = mysqlTable("loyalty_rewards", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description"),
      pointsCost: int("points_cost").notNull(),
      type: varchar("type", { length: 50 }).notNull(),
      value: int("value").notNull(),
      isAvailable: boolean("is_available").default(true),
      minTier: varchar("min_tier", { length: 20 }),
      maxRedemptions: int("max_redemptions"),
      currentRedemptions: int("current_redemptions").default(0),
      expiresAt: timestamp("expires_at"),
      imageUrl: text("image_url"),
      terms: text("terms"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    loyaltyRedemptions = mysqlTable("loyalty_redemptions", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      rewardId: varchar("reward_id", { length: 255 }).notNull(),
      pointsSpent: int("points_spent").notNull(),
      status: varchar("status", { length: 20 }).default("active"),
      couponCode: varchar("coupon_code", { length: 50 }),
      usedAt: timestamp("used_at"),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    loyaltyChallenges = mysqlTable("loyalty_challenges", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description"),
      type: varchar("type", { length: 50 }).notNull(),
      target: int("target").notNull(),
      rewardPoints: int("reward_points").notNull(),
      isActive: boolean("is_active").default(true),
      startsAt: timestamp("starts_at"),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    loyaltyChallengeProgress = mysqlTable("loyalty_challenge_progress", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      challengeId: varchar("challenge_id", { length: 255 }).notNull(),
      progress: int("progress").default(0),
      completed: boolean("completed").default(false),
      completedAt: timestamp("completed_at"),
      claimed: boolean("claimed").default(false),
      claimedAt: timestamp("claimed_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    achievements = mysqlTable("achievements", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      icon: varchar("icon", { length: 100 }),
      category: varchar("category", { length: 50 }),
      requirementType: varchar("requirement_type", { length: 50 }),
      requirementValue: int("requirement_value"),
      rewardPoints: int("reward_points").default(0),
      badgeImageUrl: text("badge_image_url"),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    userAchievements = mysqlTable("user_achievements", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      achievementId: varchar("achievement_id", { length: 255 }).notNull(),
      unlockedAt: timestamp("unlocked_at").default(sql`CURRENT_TIMESTAMP`),
    });
    userFavorites = mysqlTable("user_favorites", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      itemType: varchar("item_type", { length: 50 }).notNull(),
      itemId: varchar("item_id", { length: 255 }).notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    userPreferences = mysqlTable("user_preferences", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      cuisineTypes: text("cuisine_types"),
      priceRange: varchar("price_range", { length: 20 }).default("mid"),
      dietaryRestrictions: text("dietary_restrictions"),
      preferredOrderTimes: text("preferred_order_times"),
      favoriteCategories: text("favorite_categories"),
      spiceLevel: int("spice_level").default(3),
      healthScore: int("health_score").default(5),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    aiRecommendations = mysqlTable("ai_recommendations", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      recommendationType: varchar("recommendation_type", {
        length: 50,
      }).notNull(),
      itemType: varchar("item_type", { length: 50 }).notNull(),
      itemId: varchar("item_id", { length: 255 }).notNull(),
      confidenceScore: int("confidence_score").notNull(),
      reason: text("reason"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      expiresAt: timestamp("expires_at"),
      clicked: boolean("clicked").default(false),
      ordered: boolean("ordered").default(false),
    });
    supportTickets = mysqlTable("support_tickets", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      orderId: varchar("order_id", { length: 255 }),
      subject: varchar("subject", { length: 255 }).notNull(),
      category: varchar("category", { length: 50 }),
      priority: varchar("priority", { length: 20 }).default("medium"),
      status: varchar("status", { length: 50 }).default("open"),
      assignedTo: varchar("assigned_to", { length: 255 }),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
      resolvedAt: timestamp("resolved_at"),
    });
    groupOrders = mysqlTable("group_orders", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      creatorId: varchar("creator_id", { length: 255 }).notNull(),
      businessId: varchar("business_id", { length: 255 }).notNull(),
      businessName: varchar("business_name", { length: 255 }).notNull(),
      deliveryAddress: text("delivery_address").notNull(),
      deliveryLatitude: text("delivery_latitude"),
      deliveryLongitude: text("delivery_longitude"),
      status: varchar("status", { length: 50 }).notNull().default("open"),
      shareToken: varchar("share_token", { length: 255 }).notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      orderId: varchar("order_id", { length: 255 }),
      totalAmount: int("total_amount").default(0),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      lockedAt: timestamp("locked_at"),
      orderedAt: timestamp("ordered_at"),
    });
    groupOrderParticipants = mysqlTable("group_order_participants", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      groupOrderId: varchar("group_order_id", { length: 255 }).notNull(),
      userId: varchar("user_id", { length: 255 }).notNull(),
      userName: varchar("user_name", { length: 255 }).notNull(),
      items: text("items").notNull(),
      subtotal: int("subtotal").notNull(),
      paymentStatus: varchar("payment_status", { length: 50 }).default(
        "pending",
      ),
      paymentMethod: varchar("payment_method", { length: 50 }),
      paymentProofUrl: text("payment_proof_url"),
      joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`),
      paidAt: timestamp("paid_at"),
    });
    groupOrderInvitations = mysqlTable("group_order_invitations", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      groupOrderId: varchar("group_order_id", { length: 255 }).notNull(),
      invitedBy: varchar("invited_by", { length: 255 }).notNull(),
      invitedUserId: varchar("invited_user_id", { length: 255 }),
      invitedPhone: varchar("invited_phone", { length: 20 }),
      status: varchar("status", { length: 50 }).default("pending"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      respondedAt: timestamp("responded_at"),
    });
    subscriptions = mysqlTable("subscriptions", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      plan: varchar("plan", { length: 50 }).notNull().default("free"),
      status: varchar("status", { length: 50 }).notNull().default("active"),
      price: int("price").notNull().default(0),
      billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"),
      autoRenew: boolean("auto_renew").notNull().default(true),
      currentPeriodStart: timestamp("current_period_start").notNull(),
      currentPeriodEnd: timestamp("current_period_end").notNull(),
      cancelledAt: timestamp("cancelled_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    subscriptionBenefits = mysqlTable("subscription_benefits", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      plan: varchar("plan", { length: 50 }).notNull(),
      benefitType: varchar("benefit_type", { length: 50 }).notNull(),
      benefitValue: int("benefit_value"),
      description: text("description"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    subscriptionPlans = mysqlTable("subscription_plans", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      planKey: varchar("plan_key", { length: 50 }).notNull().unique(),
      name: varchar("name", { length: 100 }).notNull(),
      description: text("description"),
      price: int("price").notNull().default(0),
      billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"),
      isActive: boolean("is_active").notNull().default(true),
      displayOrder: int("display_order").default(0),
      color: varchar("color", { length: 20 }).default("#DC2626"),
      icon: varchar("icon", { length: 50 }).default("star"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
    giftCards = mysqlTable("gift_cards", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      code: varchar("code", { length: 50 }).notNull().unique(),
      amount: int("original_amount").notNull(),
      balance: int("balance").notNull(),
      status: varchar("status", { length: 20 }).notNull().default("active"),
      purchasedBy: varchar("from_user_id", { length: 255 }),
      recipientEmail: varchar("to_email", { length: 255 }),
      recipientPhone: varchar("to_phone", { length: 20 }),
      toUserId: varchar("to_user_id", { length: 255 }),
      message: text("message"),
      design: varchar("design", { length: 50 }).default("default"),
      expiresAt: timestamp("expires_at"),
      redeemedAt: timestamp("redeemed_at"),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    giftCardTransactions = mysqlTable("gift_card_transactions", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      giftCardId: varchar("gift_card_id", { length: 255 }).notNull(),
      orderId: varchar("order_id", { length: 255 }),
      amount: int("amount").notNull(),
      balanceAfter: int("balance_after").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    giftCardDesigns = mysqlTable("gift_card_designs", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      name: varchar("name", { length: 100 }).notNull().unique(),
      imageUrl: text("image_url").notNull(),
      category: varchar("category", { length: 50 }).default("general"),
      isActive: boolean("is_active").default(true),
      displayOrder: int("display_order").default(0),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    ticketMessages = mysqlTable("ticket_messages", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      ticketId: varchar("ticket_id", { length: 255 }).notNull(),
      senderId: varchar("sender_id", { length: 255 }).notNull(),
      senderType: varchar("sender_type", { length: 20 }).notNull(),
      // user, admin
      message: text("message").notNull(),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
    });
    businessCategories = mysqlTable("business_categories", {
      id: varchar("id", { length: 255 })
        .primaryKey()
        .default(sql`(UUID())`),
      name: varchar("name", { length: 100 }).notNull(),
      slug: varchar("slug", { length: 100 }).notNull().unique(),
      icon: varchar("icon", { length: 50 }).notNull().default("grid"),
      color: varchar("color", { length: 20 }).notNull().default("#6B7280"),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      displayOrder: int("display_order").notNull().default(0),
      createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
      updatedAt: timestamp("updated_at").default(
        sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      ),
    });
  },
});

// server/smsService.ts
var smsService_exports = {};
__export(smsService_exports, {
  generateVerificationCode: () => generateVerificationCode,
  sendVerificationCode: () => sendVerificationCode,
  sendVerificationSMS: () => sendVerificationSMS,
  verifyCode: () => verifyCode,
});
import twilio from "twilio";
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.warn(
      "Twilio credentials not configured. SMS will be bypassed in development.",
    );
    return null;
  }
  return twilio(accountSid, authToken);
}
function getVerifyServiceSid() {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) {
    console.warn("TWILIO_VERIFY_SERVICE_SID not configured");
    return null;
  }
  return serviceSid;
}
function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("52")) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+58${cleaned}`;
  }
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  return `+${cleaned}`;
}
function generateVerificationCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
async function sendVerificationSMS(toPhoneNumber, code) {
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.TWILIO_ACCOUNT_SID
  ) {
    console.log(
      `\u{1F527} DEV MODE: SMS bypass for ${toPhoneNumber}, use code: 1234`,
    );
    return true;
  }
  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    if (!client || !serviceSid) {
      console.log(
        `\u{1F527} Twilio not configured, bypassing SMS for ${toPhoneNumber}`,
      );
      return true;
    }
    const formattedPhone = formatPhoneNumber(toPhoneNumber);
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
      });
    console.log(
      `Twilio Verify SMS sent to ${formattedPhone}, status: ${verification.status}`,
    );
    return verification.status === "pending";
  } catch (error) {
    console.error("Failed to send verification SMS:", error?.message || error);
    return false;
  }
}
async function verifyCode(toPhoneNumber, code) {
  if (code === "1234" || code === "123456") {
    console.log(
      `\u{1F527} C\xF3digo de desarrollo aceptado para ${toPhoneNumber}`,
    );
    return true;
  }
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.TWILIO_ACCOUNT_SID
  ) {
    console.log(
      `\u{1F527} DEV MODE: Code verification for ${toPhoneNumber}, code: ${code}`,
    );
    return false;
  }
  try {
    const client = getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    if (!client || !serviceSid) {
      console.log(
        `\u{1F527} Twilio not configured, rejecting code for ${toPhoneNumber}`,
      );
      return false;
    }
    const formattedPhone = formatPhoneNumber(toPhoneNumber);
    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: formattedPhone,
        code,
      });
    console.log(
      `Twilio Verify check for ${formattedPhone}, status: ${verificationCheck.status}`,
    );
    return verificationCheck.status === "approved";
  } catch (error) {
    console.error("Failed to verify code:", error?.message || error);
    return false;
  }
}
var sendVerificationCode;
var init_smsService = __esm({
  "server/smsService.ts"() {
    "use strict";
    sendVerificationCode = sendVerificationSMS;
  },
});

// server/config.ts
var config_exports = {};
__export(config_exports, {
  CONFIG: () => CONFIG,
  invalidateSettingsCache: () => invalidateSettingsCache,
});
async function getSettings() {
  if (Date.now() < cacheExpiry && Object.keys(cache).length > 0) return cache;
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { systemSettings: systemSettings2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const rows = await db2.select().from(systemSettings2);
    cache = {};
    for (const row of rows) cache[row.key] = row.value;
    cacheExpiry = Date.now() + CACHE_TTL;
  } catch {}
  return cache;
}
async function get(key, def) {
  const s = await getSettings();
  return s[key] ?? def;
}
async function getNum(key, def) {
  const v = await get(key, String(def));
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}
function invalidateSettingsCache() {
  cache = {};
  cacheExpiry = 0;
}
var cache, cacheExpiry, CACHE_TTL, CONFIG;
var init_config = __esm({
  "server/config.ts"() {
    "use strict";
    cache = {};
    cacheExpiry = 0;
    CACHE_TTL = 60 * 1e3;
    CONFIG = {
      // Comisiones — key existente en BD: "comeya_commission_pct" o "nemy_commission"
      async commission() {
        return (await getNum("comeya_commission_pct", 15)) / 100;
      },
      async commissionDivisor() {
        return 1 + (await CONFIG.commission());
      },
      // Delivery
      async deliveryFee() {
        return getNum("default_delivery_fee_cents", 300);
      },
      async deliveryTime() {
        return get("default_delivery_time", "30-45 min");
      },
      // Datos de pago ComeYa — editables por el admin desde el panel
      async bizumPhone() {
        return get("comeya_bizum_phone", "600 000 000");
      },
      async iban() {
        return get("comeya_iban", "ES00 0000 0000 0000 0000 0000");
      },
      async paypalEmail() {
        return get("comeya_paypal_email", "pagos@comeya.es");
      },
      async titular() {
        return get("comeya_titular", "ComeYa S.L.");
      },
      async banco() {
        return get("comeya_banco", "Banco Santander");
      },
    };
  },
});

// server/cloudinaryService.ts
var cloudinaryService_exports = {};
__export(cloudinaryService_exports, {
  CloudinaryService: () => CloudinaryService,
});
import { v2 as cloudinary } from "cloudinary";
var CloudinaryService;
var init_cloudinaryService = __esm({
  "server/cloudinaryService.ts"() {
    "use strict";
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    CloudinaryService = class {
      /**
       * Sube una imagen base64 a Cloudinary
       * @param base64Image - Imagen en formato data:image/...;base64,xxx
       * @param folder - Carpeta destino en Cloudinary
       * @param publicId - ID público opcional (si no se provee, Cloudinary genera uno)
       * @returns URL segura de la imagen subida
       */
      static async uploadImage(base64Image, folder, publicId) {
        try {
          const result = await cloudinary.uploader.upload(base64Image, {
            folder: `comeya/${folder}`,
            public_id: publicId,
            resource_type: "image",
            transformation: [
              { quality: "auto:good" },
              { fetch_format: "auto" },
            ],
          });
          return result.secure_url;
        } catch (error) {
          console.error("Cloudinary upload error:", error);
          throw new Error(`Error al subir imagen: ${error.message}`);
        }
      }
      /**
       * Elimina una imagen de Cloudinary
       * @param publicId - ID público de la imagen (ej: comeya/profiles/user-123)
       */
      static async deleteImage(publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (error) {
          console.error("Cloudinary delete error:", error);
          throw new Error(`Error al eliminar imagen: ${error.message}`);
        }
      }
      /**
       * Extrae el public_id de una URL de Cloudinary
       * @param url - URL completa de Cloudinary
       * @returns public_id sin extensión
       */
      static extractPublicId(url) {
        try {
          const match = url.match(/\/v\d+\/(.+)\.\w+$/);
          return match ? match[1] : null;
        } catch {
          return null;
        }
      }
    };
  },
});

// server/dbHelper.ts
var dbHelper_exports = {};
__export(dbHelper_exports, {
  executeWithRetry: () => executeWithRetry,
  queryWithRetry: () => queryWithRetry,
});
async function executeWithRetry(queryFn, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let conn;
    try {
      console.log(`\u{1F504} Database query attempt ${attempt}/${maxRetries}`);
      conn = await connection.getConnection();
      const result = await queryFn(conn);
      console.log(`\u2705 Query successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `\u274C Attempt ${attempt} failed:`,
        error.message,
        error.code,
      );
      if (
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        if (attempt < maxRetries) {
          const delay = Math.min(1e3 * Math.pow(2, attempt - 1), 5e3);
          console.log(`\u23F3 Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } else {
        throw error;
      }
    } finally {
      if (conn) {
        try {
          conn.release();
        } catch (releaseError) {
          console.error("Error releasing connection:", releaseError);
        }
      }
    }
  }
  console.error("\u274C All retry attempts exhausted");
  throw lastError;
}
async function queryWithRetry(sql15, params = []) {
  return executeWithRetry(async (conn) => {
    const [rows] = await conn.query(sql15, params);
    return rows;
  });
}
var init_dbHelper = __esm({
  "server/dbHelper.ts"() {
    "use strict";
    init_db();
  },
});

// server/paymentService.ts
var paymentService_exports = {};
__export(paymentService_exports, {
  confirmPaymentIntent: () => confirmPaymentIntent,
  createPaymentIntent: () => createPaymentIntent,
  createSetupIntent: () => createSetupIntent,
  creditWallet: () => creditWallet,
  processDeliveredOrder: () => processDeliveredOrder,
  processSuccessfulPayment: () => processSuccessfulPayment,
});
import Stripe from "stripe";
import { eq as eq5 } from "drizzle-orm";
function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "Stripe is not configured. Please add STRIPE_SECRET_KEY.",
      );
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripeInstance;
}
async function createPaymentIntent(params) {
  try {
    const { orderId, amount, customerId, businessId, driverId, paymentMethod } =
      params;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      // Convert to cents
      currency: "mxn",
      payment_method: paymentMethod,
      confirmation_method: "manual",
      confirm: paymentMethod ? true : false,
      metadata: {
        orderId,
        customerId,
        businessId,
        driverId: driverId || "",
        type: "order_payment",
      },
    });
    await db.insert(payments).values({
      id: paymentIntent.id,
      orderId,
      customerId,
      businessId,
      driverId,
      amount,
      currency: "MXN",
      status: paymentIntent.status,
      paymentMethod: paymentMethod || "card",
      stripePaymentIntentId: paymentIntent.id,
      createdAt: /* @__PURE__ */ new Date(),
    });
    return {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      },
    };
  } catch (error) {
    console.error("Create PaymentIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function confirmPaymentIntent(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    await db
      .update(payments)
      .set({
        status: paymentIntent.status,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq5(payments.stripePaymentIntentId, paymentIntentId));
    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error("Confirm PaymentIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function creditWallet(userId, amount, type, orderId, description) {
  return await db.transaction(async (tx) => {
    let [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq5(wallets.userId, userId))
      .limit(1);
    if (!wallet) {
      const result = await tx
        .insert(wallets)
        .values({
          userId,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          cashOwed: 0,
        })
        .$returningId();
      const newId = Array.isArray(result) ? result[0].id : result.insertId;
      [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq5(wallets.id, newId))
        .limit(1);
    }
    const newBalance = (wallet?.balance || 0) + amount;
    await tx
      .update(wallets)
      .set({
        balance: newBalance,
        totalEarned: (wallet?.totalEarned || 0) + amount,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq5(wallets.userId, userId));
    await tx.insert(transactions).values({
      walletId: wallet.id,
      userId,
      amount,
      type,
      status: "completed",
      description: description || `${type} - Orden ${orderId ?? ""}`.trim(),
      orderId,
      createdAt: /* @__PURE__ */ new Date(),
    });
    return { success: true, newBalance };
  });
}
async function processSuccessfulPayment(paymentIntentId) {
  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq5(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    if (!payment) {
      throw new Error("Payment not found");
    }
    const [order] = await db
      .select()
      .from(orders)
      .where(eq5(orders.id, payment.orderId))
      .limit(1);
    if (!order) {
      throw new Error(
        `Order ${payment.orderId} not found for payment ${paymentIntentId}`,
      );
    }
    const commissions = await financialService.calculateCommissions(
      payment.amount,
      order.deliveryFee || 0,
      order.productosBase || void 0,
      order.nemyCommission || void 0,
    );
    const platformAmount = commissions.platform;
    const businessAmount = commissions.business;
    const driverAmount = payment.driverId ? commissions.driver : 0;
    await financialService.updateWalletBalance(
      payment.businessId,
      businessAmount,
      "commission",
      payment.orderId,
      `Venta con tarjeta - Pedido ${payment.orderId}`,
    );
    if (payment.driverId && driverAmount > 0) {
      await financialService.updateWalletBalance(
        payment.driverId,
        driverAmount,
        "delivery_fee",
        payment.orderId,
        `Tarifa de entrega - Pedido ${payment.orderId}`,
      );
    }
    await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq5(orders.id, payment.orderId));
    await db
      .update(payments)
      .set({
        status: "succeeded",
        processedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq5(payments.id, payment.id));
    return {
      success: true,
      distribution: {
        platform: platformAmount,
        business: businessAmount,
        driver: driverAmount,
      },
    };
  } catch (error) {
    console.error("Process successful payment error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function createSetupIntent(customerId) {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });
    return {
      success: true,
      setupIntent: {
        id: setupIntent.id,
        clientSecret: setupIntent.client_secret,
      },
    };
  } catch (error) {
    console.error("Create SetupIntent error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function processDeliveredOrder(orderId) {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq5(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new Error("Order not found");
    }
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq5(payments.orderId, orderId))
      .limit(1);
    if (payment && payment.status === "succeeded") {
      await db
        .update(orders)
        .set({
          status: "delivered",
          deliveredAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq5(orders.id, orderId));
      return {
        success: true,
        message: "Order marked as delivered, funds already distributed",
      };
    }
    return {
      success: false,
      error: "Payment not found or not succeeded",
    };
  } catch (error) {
    console.error("Process delivered order error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
var stripeInstance, stripe;
var init_paymentService = __esm({
  "server/paymentService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_unifiedFinancialService();
    stripeInstance = null;
    stripe = new Proxy(
      {},
      {
        get(_, prop) {
          return getStripe()[prop];
        },
      },
    );
  },
});

// server/cashPaymentService.ts
var cashPaymentService_exports = {};
__export(cashPaymentService_exports, {
  calculateChange: () => calculateChange,
  confirmCashDelivery: () => confirmCashDelivery,
  getCashPaymentDetails: () => getCashPaymentDetails,
  processCashPayment: () => processCashPayment,
});
import { eq as eq6 } from "drizzle-orm";
async function processCashPayment(params) {
  try {
    const { orderId, customerId, businessId, cashReceived, orderTotal } =
      params;
    if (cashReceived < orderTotal) {
      return {
        success: false,
        error: `Efectivo insuficiente. Se requieren $${orderTotal}, recibido $${cashReceived}`,
      };
    }
    const change = cashReceived - orderTotal;
    const result = await db.insert(payments).values({
      orderId,
      customerId,
      businessId,
      amount: orderTotal,
      currency: "MXN",
      status: "succeeded",
      paymentMethod: "cash",
      processedAt: /* @__PURE__ */ new Date(),
    });
    const paymentId = result[0].insertId.toString();
    await db
      .update(orders)
      .set({
        status: "paid",
        paymentMethod: "cash",
        paidAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq6(orders.id, orderId));
    return {
      success: true,
      change,
      paymentId,
    };
  } catch (error) {
    console.error("Process cash payment error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function confirmCashDelivery(orderId, driverId) {
  try {
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq6(orders.id, orderId));
    await processCashCommissions(orderId);
    return {
      success: true,
      message: "Cash delivery confirmed",
    };
  } catch (error) {
    console.error("Confirm cash delivery error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function processCashCommissions(orderId) {
  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq6(orders.id, orderId))
      .limit(1);
    if (!order) return;
    const commissions = await financialService.calculateCommissions(
      order.total,
      order.deliveryFee || 0,
      order.productosBase || void 0,
      order.nemyCommission || void 0,
    );
    const platformAmount = commissions.platform;
    const businessAmount = commissions.business;
    const driverAmount = commissions.driver;
    const { creditWallet: creditWallet2 } = await Promise.resolve().then(
      () => (init_paymentService(), paymentService_exports),
    );
    await creditWallet2(
      order.businessId,
      businessAmount,
      "cash_commission",
      orderId,
    );
    if (order.deliveryPersonId) {
      await creditWallet2(
        order.deliveryPersonId,
        driverAmount,
        "cash_delivery_fee",
        orderId,
      );
    }
    if (platformAmount > 0) {
      console.log(
        `\u2139\uFE0F Plataforma debe registrar $${platformAmount} para pedido ${orderId}`,
      );
    }
    console.log(`\u{1F4B0} Cash commissions processed for order ${orderId}`);
  } catch (error) {
    console.error("Process cash commissions error:", error);
  }
}
async function getCashPaymentDetails(orderId) {
  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq6(payments.orderId, orderId))
      .limit(1);
    if (!payment) {
      return {
        success: false,
        error: "Cash payment not found",
      };
    }
    return {
      success: true,
      payment,
    };
  } catch (error) {
    console.error("Get cash payment details error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
async function calculateChange(orderTotal, cashReceived) {
  if (cashReceived < orderTotal) {
    return {
      success: false,
      error: "Efectivo insuficiente",
      shortage: orderTotal - cashReceived,
    };
  }
  const change = cashReceived - orderTotal;
  const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  const changeBreakdown = {};
  let remainingChange = change;
  for (const denom of denominations) {
    if (remainingChange >= denom) {
      const count3 = Math.floor(remainingChange / denom);
      changeBreakdown[`$${denom}`] = count3;
      remainingChange =
        Math.round((remainingChange - count3 * denom) * 100) / 100;
    }
  }
  return {
    success: true,
    change,
    breakdown: changeBreakdown,
    message: change === 0 ? "Pago exacto" : `Cambio: $${change}`,
  };
}
var init_cashPaymentService = __esm({
  "server/cashPaymentService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_unifiedFinancialService();
  },
});

// server/unifiedFinancialService.ts
var unifiedFinancialService_exports = {};
__export(unifiedFinancialService_exports, {
  UnifiedFinancialService: () => UnifiedFinancialService,
  financialService: () => financialService,
});
import { eq as eq7 } from "drizzle-orm";
var UnifiedFinancialService, financialService;
var init_unifiedFinancialService = __esm({
  "server/unifiedFinancialService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
    UnifiedFinancialService = class _UnifiedFinancialService {
      static instance;
      cachedRates = null;
      cacheExpiry = 0;
      CACHE_DURATION = 5 * 60 * 1e3;
      // 5 minutes
      constructor() {}
      static getInstance() {
        if (!_UnifiedFinancialService.instance) {
          _UnifiedFinancialService.instance = new _UnifiedFinancialService();
        }
        return _UnifiedFinancialService.instance;
      }
      // Get commission rates with caching and validation
      async getCommissionRates() {
        const now = Date.now();
        if (this.cachedRates && now < this.cacheExpiry) {
          return this.cachedRates;
        }
        try {
          const settings = await db
            .select()
            .from(systemSettings)
            .where(eq7(systemSettings.category, "commissions"));
          const platformRate = parseFloat(
            settings.find((s) => s.key === "platform_commission_rate")?.value ||
              "0.15",
          );
          const businessRate = parseFloat(
            settings.find((s) => s.key === "business_commission_rate")?.value ||
              "1.00",
          );
          const driverRate = parseFloat(
            settings.find((s) => s.key === "driver_commission_rate")?.value ||
              "1.00",
          );
          if (platformRate < 0 || platformRate > 1) {
            throw new Error(
              `Platform commission (markup) must be between 0% and 100% of products. Current: ${(platformRate * 100).toFixed(2)}%`,
            );
          }
          if (businessRate <= 0 || businessRate > 1) {
            throw new Error(
              `Business share must be between 0 and 1 (representa % del precio base de productos). Current: ${businessRate}`,
            );
          }
          if (driverRate <= 0 || driverRate > 1) {
            throw new Error(
              `Driver share must be between 0 and 1 (representa % de la tarifa de entrega). Current: ${driverRate}`,
            );
          }
          this.cachedRates = {
            platform: platformRate,
            business: businessRate,
            driver: driverRate,
          };
          this.cacheExpiry = now + this.CACHE_DURATION;
          return this.cachedRates;
        } catch (error) {
          console.error("Error getting commission rates:", error);
          throw error;
        }
      }
      // Calculate commissions - Modelo: 100% producto al negocio, 15% del producto a MOUZO, 100% delivery fee al driver
      async calculateCommissions(
        totalAmount,
        deliveryFee = 0,
        productosBase,
        nemyCommission,
      ) {
        const safeTotal = Math.max(0, totalAmount || 0);
        const safeDeliveryFee = Math.max(0, deliveryFee || 0);
        let productBase =
          productosBase && productosBase > 0
            ? productosBase
            : safeTotal - safeDeliveryFee;
        if (!productosBase || productosBase <= 0) {
          const baseWithoutDelivery = safeTotal - safeDeliveryFee;
          productBase =
            baseWithoutDelivery > 0
              ? Math.round(baseWithoutDelivery / 1.15)
              : 0;
        }
        const platformAmount =
          nemyCommission && nemyCommission > 0
            ? nemyCommission
            : Math.round(productBase * 0.15);
        const businessAmount = productBase;
        const driverAmount = safeDeliveryFee;
        let distributedTotal = platformAmount + businessAmount + driverAmount;
        if (distributedTotal !== safeTotal) {
          const delta = safeTotal - distributedTotal;
          distributedTotal += delta;
          productBase += delta;
        }
        return {
          platform: platformAmount,
          business: productBase,
          driver: driverAmount,
          total: platformAmount + productBase + driverAmount,
        };
      }
      // Update cash owed (for cash deliveries) with COMPLETE AUDIT TRAIL
      async updateCashOwed(userId, amount, orderId, description) {
        return await db.transaction(async (tx) => {
          let [wallet] = await tx
            .select()
            .from(wallets)
            .where(eq7(wallets.userId, userId))
            .limit(1);
          if (!wallet) {
            throw new Error(`Wallet not found for user ${userId}`);
          }
          const newCashOwed = wallet.cashOwed + amount;
          await tx
            .update(wallets)
            .set({
              cashOwed: newCashOwed,
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq7(wallets.userId, userId));
          await tx.insert(transactions).values({
            walletId: wallet.id,
            userId,
            orderId,
            type: "cash_debt",
            amount,
            balanceBefore: wallet.cashOwed,
            balanceAfter: newCashOwed,
            description: description || `Cash debt from order`,
            status: "completed",
            createdAt: /* @__PURE__ */ new Date(),
            metadata: JSON.stringify({
              previousDebt: wallet.cashOwed,
              newDebt: newCashOwed,
              debtIncrease: amount,
              timestamp: /* @__PURE__ */ new Date().toISOString(),
              source: "cash_delivery_system",
            }),
          });
          logger.warn(
            `\u{1F4B5} Cash debt updated: User ${userId} - $${(amount / 100).toFixed(2)} - Total debt: $${(newCashOwed / 100).toFixed(2)}`,
            {
              userId,
              amount,
              orderId,
              previousDebt: wallet.cashOwed,
              newDebt: newCashOwed,
            },
          );
        });
      }
      // Atomic wallet update with validation and COMPLETE TRANSACTION LOGGING
      async updateWalletBalance(
        userId,
        amount,
        type,
        orderId,
        description,
        usePendingBalance = false,
      ) {
        return await db.transaction(async (tx) => {
          const { users: users7 } = await Promise.resolve().then(
            () => (init_schema_mysql(), schema_mysql_exports),
          );
          const [user] = await tx
            .select()
            .from(users7)
            .where(eq7(users7.id, userId))
            .limit(1);
          if (!user) {
            throw new Error(`User ${userId} not found`);
          }
          let [wallet] = await tx
            .select()
            .from(wallets)
            .where(eq7(wallets.userId, userId))
            .limit(1);
          if (!wallet) {
            await tx.insert(wallets).values({
              userId,
              balance: 0,
              pendingBalance: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
            });
            [wallet] = await tx
              .select()
              .from(wallets)
              .where(eq7(wallets.userId, userId))
              .limit(1);
          }
          if (!wallet) {
            throw new Error(`Failed to create wallet for user ${userId}`);
          }
          const targetBalance = usePendingBalance
            ? wallet.pendingBalance
            : wallet.balance;
          const newBalance = targetBalance + amount;
          if (newBalance < 0) {
            throw new Error(
              `Insufficient balance. Current: ${targetBalance}, Requested: ${amount}`,
            );
          }
          if (usePendingBalance) {
            await tx
              .update(wallets)
              .set({
                pendingBalance: newBalance,
                totalEarned:
                  amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned,
                updatedAt: /* @__PURE__ */ new Date(),
              })
              .where(eq7(wallets.userId, userId));
          } else {
            await tx
              .update(wallets)
              .set({
                balance: newBalance,
                totalEarned:
                  amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned,
                updatedAt: /* @__PURE__ */ new Date(),
              })
              .where(eq7(wallets.userId, userId));
          }
          await tx.insert(transactions).values({
            walletId: wallet.id,
            userId,
            orderId,
            type,
            amount,
            balanceBefore: targetBalance,
            balanceAfter: newBalance,
            description: description || `${type} transaction`,
            status: "completed",
            createdAt: /* @__PURE__ */ new Date(),
            metadata: JSON.stringify({
              userType: user.role,
              userName: user.name,
              timestamp: /* @__PURE__ */ new Date().toISOString(),
              source: "unified_financial_service",
              isPending: usePendingBalance,
            }),
          });
          const balanceType = usePendingBalance ? "pending" : "available";
          logger.info(
            `\u{1F4B0} Wallet updated (${balanceType}): ${user.name} (${userId}) - ${type} - $${(amount / 100).toFixed(2)}`,
            {
              userId,
              type,
              amount,
              orderId,
              balanceBefore: targetBalance,
              balanceAfter: newBalance,
              isPending: usePendingBalance,
            },
          );
        });
      }
      // Validate order total calculation
      validateOrderTotal(subtotal, deliveryFee, tax, total) {
        const calculatedTotal = subtotal + deliveryFee + tax;
        return calculatedTotal === total;
      }
      // Convert between pesos and centavos safely
      pesosTocentavos(pesos) {
        return Math.round(pesos * 100);
      }
      centavosToPesos(centavos) {
        return Math.round(centavos) / 100;
      }
      // Clear cache (for testing or admin updates)
      clearCache() {
        this.cachedRates = null;
        this.cacheExpiry = 0;
      }
      // Get or create wallet for any user
      async getWallet(userId) {
        let [wallet] = await db
          .select()
          .from(wallets)
          .where(eq7(wallets.userId, userId))
          .limit(1);
        if (!wallet) {
          await db.insert(wallets).values({
            userId,
            balance: 0,
            pendingBalance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            cashOwed: 0,
          });
          [wallet] = await db
            .select()
            .from(wallets)
            .where(eq7(wallets.userId, userId))
            .limit(1);
        }
        return wallet;
      }
      // Check if user can withdraw
      async canUserWithdraw(userId, userRole) {
        if (
          !["business_owner", "delivery_driver", "admin"].includes(userRole)
        ) {
          return {
            allowed: false,
            reason:
              "Solo negocios, repartidores y administradores pueden retirar",
          };
        }
        const wallet = await this.getWallet(userId);
        const MINIMUM_WITHDRAWAL = 5e3;
        const availableBalance = wallet.balance - (wallet.cashOwed || 0);
        if (availableBalance < MINIMUM_WITHDRAWAL) {
          return {
            allowed: false,
            reason: `Saldo m\xEDnimo para retiro: $${MINIMUM_WITHDRAWAL / 100} MXN`,
          };
        }
        if (wallet.cashOwed > 0) {
          return {
            allowed: false,
            reason: "Debes liquidar tu efectivo pendiente antes de retirar",
          };
        }
        return { allowed: true };
      }
      // Get available payment methods by role
      async getPaymentMethods(userId, userRole) {
        const methods = [];
        methods.push({
          id: "card",
          name: "Tarjeta",
          icon: "card-outline",
          available: true,
        });
        methods.push({
          id: "cash",
          name: "Efectivo",
          icon: "cash-outline",
          available: true,
        });
        const wallet = await this.getWallet(userId);
        methods.push({
          id: "wallet",
          name: "Billetera MOUZO",
          icon: "wallet-outline",
          available: wallet.balance > 0,
          balance: wallet.balance,
        });
        return methods;
      }
      // Universal payment processor
      async processPayment(options) {
        const { userId, orderId, amount, method, businessId, driverId } =
          options;
        try {
          switch (method) {
            case "card":
              const { createPaymentIntent: createPaymentIntent2 } =
                await Promise.resolve().then(
                  () => (init_paymentService(), paymentService_exports),
                );
              return await createPaymentIntent2({
                orderId,
                amount,
                customerId: userId,
                businessId,
                driverId,
              });
            case "cash":
              const { processCashPayment: processCashPayment2 } =
                await Promise.resolve().then(
                  () => (init_cashPaymentService(), cashPaymentService_exports),
                );
              return await processCashPayment2({
                orderId,
                customerId: userId,
                businessId,
                cashReceived: amount,
                orderTotal: amount,
              });
            case "wallet":
              return await this.processWalletPayment(
                userId,
                orderId,
                amount,
                businessId,
                driverId,
              );
            default:
              return {
                success: false,
                error: "M\xE9todo de pago no soportado",
              };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      // Process wallet payment
      async processWalletPayment(
        userId,
        orderId,
        amount,
        businessId,
        driverId,
      ) {
        return await db.transaction(async (tx) => {
          const [wallet] = await tx
            .select()
            .from(wallets)
            .where(eq7(wallets.userId, userId))
            .limit(1);
          if (!wallet || wallet.balance < amount) {
            throw new Error("Saldo insuficiente en billetera");
          }
          await tx
            .update(wallets)
            .set({
              balance: wallet.balance - amount,
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq7(wallets.userId, userId));
          const { payments: payments2 } = await Promise.resolve().then(
            () => (init_schema_mysql(), schema_mysql_exports),
          );
          await tx.insert(payments2).values({
            orderId,
            customerId: userId,
            businessId,
            driverId,
            amount,
            currency: "MXN",
            status: "succeeded",
            paymentMethod: "wallet",
            processedAt: /* @__PURE__ */ new Date(),
          });
          await tx.insert(transactions).values({
            walletId: wallet.id,
            userId,
            orderId,
            type: "wallet_payment",
            amount: -amount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - amount,
            description: `Pago con billetera - Pedido #${orderId.slice(-6)}`,
            status: "completed",
          });
          const { orders: orders2 } = await Promise.resolve().then(
            () => (init_schema_mysql(), schema_mysql_exports),
          );
          await tx
            .update(orders2)
            .set({
              status: "paid",
              paymentMethod: "wallet",
              paidAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq7(orders2.id, orderId));
          return { success: true, message: "Pago procesado con billetera" };
        });
      }
    };
    financialService = UnifiedFinancialService.getInstance();
  },
});

// server/systemSettingsService.ts
var systemSettingsService_exports = {};
__export(systemSettingsService_exports, {
  createSetting: () => createSetting,
  deleteSetting: () => deleteSetting,
  getAllSettings: () => getAllSettings,
  getPublicSettings: () => getPublicSettings,
  getSetting: () => getSetting,
  getSettingValue: () => getSettingValue,
  getSettingsByCategory: () => getSettingsByCategory,
  initializeDefaultSettings: () => initializeDefaultSettings,
  updateSetting: () => updateSetting,
});
import { eq as eq10 } from "drizzle-orm";
async function initializeDefaultSettings() {
  try {
    for (const setting of DEFAULT_SETTINGS) {
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq10(systemSettings.key, setting.key))
        .limit(1);
      if (!existing) {
        await db.insert(systemSettings).values(setting);
      }
    }
    console.log("\u2705 Default settings initialized");
    return { success: true };
  } catch (error) {
    console.error("Error initializing settings:", error);
    return { success: false, error: error.message };
  }
}
async function getAllSettings() {
  try {
    const settings = await db.select().from(systemSettings);
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function getSettingsByCategory(category) {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.category, category));
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function getPublicSettings() {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.isPublic, true));
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function getSetting(key) {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.key, key))
      .limit(1);
    if (!setting) {
      return { success: false, error: "Setting not found" };
    }
    return { success: true, setting };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function updateSetting(params) {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.key, params.key))
      .limit(1);
    if (!existing) {
      return { success: false, error: "Setting not found" };
    }
    if (existing.type === "number" && isNaN(parseFloat(params.value))) {
      return { success: false, error: "Invalid number value" };
    }
    if (
      existing.type === "boolean" &&
      !["true", "false"].includes(params.value)
    ) {
      return { success: false, error: "Invalid boolean value" };
    }
    await db
      .update(systemSettings)
      .set({
        value: params.value,
        updatedBy: params.updatedBy,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq10(systemSettings.key, params.key));
    await db.insert(auditLogs).values({
      userId: params.updatedBy,
      action: "update_setting",
      entityType: "system_setting",
      entityId: params.key,
      changes: JSON.stringify({
        key: params.key,
        oldValue: existing.value,
        newValue: params.value,
      }),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function createSetting(params) {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.key, params.key))
      .limit(1);
    if (existing) {
      return { success: false, error: "Setting already exists" };
    }
    await db.insert(systemSettings).values({
      key: params.key,
      value: params.value,
      type: params.type,
      category: params.category,
      description: params.description,
      isPublic: params.isPublic || false,
      updatedBy: params.createdBy,
    });
    await db.insert(auditLogs).values({
      userId: params.createdBy,
      action: "create_setting",
      entityType: "system_setting",
      entityId: params.key,
      changes: JSON.stringify(params),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function deleteSetting(key, deletedBy) {
  try {
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.key, key))
      .limit(1);
    if (!existing) {
      return { success: false, error: "Setting not found" };
    }
    await db.delete(systemSettings).where(eq10(systemSettings.key, key));
    await db.insert(auditLogs).values({
      userId: deletedBy,
      action: "delete_setting",
      entityType: "system_setting",
      entityId: key,
      changes: JSON.stringify(existing),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function getSettingValue(key, defaultValue = null) {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq10(systemSettings.key, key))
      .limit(1);
    if (!setting) return defaultValue;
    switch (setting.type) {
      case "number":
        return parseFloat(setting.value);
      case "boolean":
        return setting.value === "true";
      case "json":
        return JSON.parse(setting.value);
      default:
        return setting.value;
    }
  } catch (error) {
    return defaultValue;
  }
}
var DEFAULT_SETTINGS;
var init_systemSettingsService = __esm({
  "server/systemSettingsService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    DEFAULT_SETTINGS = [
      // Commissions
      {
        key: "platform_commission_rate",
        value: "0.15",
        type: "number",
        category: "commissions",
        description: "Markup de la plataforma sobre productos (15%)",
        isPublic: false,
      },
      {
        key: "business_commission_rate",
        value: "1.00",
        type: "number",
        category: "commissions",
        description:
          "Porcentaje del precio base de productos que recibe el negocio (100%)",
        isPublic: false,
      },
      {
        key: "driver_commission_rate",
        value: "1.00",
        type: "number",
        category: "commissions",
        description:
          "Porcentaje de la tarifa de entrega que recibe el repartidor (100%)",
        isPublic: false,
      },
      // Payments
      {
        key: "min_withdrawal_amount",
        value: "10000",
        type: "number",
        category: "payments",
        description: "Monto m\xEDnimo de retiro (centavos)",
        isPublic: false,
      },
      {
        key: "fund_hold_duration_hours",
        value: "0",
        type: "number",
        category: "payments",
        description: "Horas de retenci\xF3n de fondos (0 = pago inmediato)",
        isPublic: false,
      },
      {
        key: "max_daily_transactions",
        value: "100",
        type: "number",
        category: "payments",
        description: "M\xE1ximo de transacciones diarias por usuario",
        isPublic: false,
      },
      {
        key: "max_transaction_amount",
        value: "1000000",
        type: "number",
        category: "payments",
        description: "Monto m\xE1ximo por transacci\xF3n (centavos)",
        isPublic: false,
      },
      // Operations
      {
        key: "delivery_base_fee",
        value: "300",
        type: "number",
        category: "operations",
        description: "Tarifa base de entrega (centavos de euro)",
        isPublic: true,
      },
      {
        key: "delivery_fee_per_km",
        value: "50",
        type: "number",
        category: "operations",
        description: "Tarifa por kil\xF3metro (centavos de euro)",
        isPublic: true,
      },
      {
        key: "delivery_min_fee",
        value: "300",
        type: "number",
        category: "operations",
        description: "Tarifa m\xEDnima de entrega (centavos de euro)",
        isPublic: true,
      },
      {
        key: "delivery_max_fee",
        value: "500",
        type: "number",
        category: "operations",
        description: "Tarifa m\xE1xima de entrega (centavos de euro)",
        isPublic: true,
      },
      {
        key: "business_default_delivery_fee",
        value: "300",
        type: "number",
        category: "operations",
        description:
          "Tarifa de entrega por defecto para nuevos negocios (centavos de euro)",
        isPublic: true,
      },
      {
        key: "business_default_min_order",
        value: "1000",
        type: "number",
        category: "operations",
        description:
          "Pedido m\xEDnimo por defecto para nuevos negocios (centavos de euro)",
        isPublic: true,
      },
      {
        key: "max_delivery_radius_km",
        value: "10",
        type: "number",
        category: "operations",
        description: "Radio m\xE1ximo de entrega (km)",
        isPublic: true,
      },
      {
        key: "delivery_average_speed_kmh",
        value: "20",
        type: "number",
        category: "operations",
        description: "Velocidad promedio de repartidores (km/h)",
        isPublic: false,
      },
      {
        key: "delivery_stop_time_minutes",
        value: "10",
        type: "number",
        category: "operations",
        description: "Tiempo promedio por parada de entrega (minutos)",
        isPublic: false,
      },
      {
        key: "order_regret_period_seconds",
        value: "60",
        type: "number",
        category: "operations",
        description: "Per\xEDodo de arrepentimiento (segundos)",
        isPublic: true,
      },
      {
        key: "pending_order_call_minutes",
        value: "3",
        type: "number",
        category: "operations",
        description: "Minutos antes de llamar al negocio",
        isPublic: false,
      },
      {
        key: "max_simultaneous_orders",
        value: "10",
        type: "number",
        category: "operations",
        description: "M\xE1ximo de pedidos simult\xE1neos por negocio",
        isPublic: false,
      },
      // Security
      {
        key: "max_login_attempts",
        value: "5",
        type: "number",
        category: "security",
        description: "Intentos m\xE1ximos de login",
        isPublic: false,
      },
      {
        key: "rate_limit_requests_per_minute",
        value: "60",
        type: "number",
        category: "security",
        description: "L\xEDmite de requests por minuto",
        isPublic: false,
      },
      {
        key: "driver_max_strikes",
        value: "3",
        type: "number",
        category: "security",
        description: "Strikes m\xE1ximos antes de bloqueo",
        isPublic: false,
      },
      // App Settings
      {
        key: "app_maintenance_mode",
        value: "false",
        type: "boolean",
        category: "app",
        description: "Modo mantenimiento",
        isPublic: true,
      },
      {
        key: "app_version_required",
        value: "1.0.0",
        type: "string",
        category: "app",
        description: "Versi\xF3n m\xEDnima requerida",
        isPublic: true,
      },
      {
        key: "support_phone",
        value: "+583171234567",
        type: "string",
        category: "app",
        description: "Tel\xE9fono de soporte",
        isPublic: true,
      },
      {
        key: "support_email",
        value: "soporte@mouzo.mx",
        type: "string",
        category: "app",
        description: "Email de soporte",
        isPublic: true,
      },
      // Twilio Configuration
      {
        key: "twilio_phone_number",
        value: process.env.TWILIO_PHONE_NUMBER || "",
        type: "string",
        category: "twilio",
        description: "N\xFAmero de tel\xE9fono Twilio",
        isPublic: false,
      },
      {
        key: "twilio_studio_flow_sid",
        value: process.env.TWILIO_STUDIO_FLOW_SID || "",
        type: "string",
        category: "twilio",
        description: "Twilio Studio Flow SID para llamadas",
        isPublic: false,
      },
    ];
  },
});

// server/utils/distance.ts
var distance_exports = {};
__export(distance_exports, {
  calculateDeliveryFee: () => calculateDeliveryFee,
  calculateDeliveryFeeSync: () => calculateDeliveryFeeSync,
  calculateDistance: () => calculateDistance,
  estimateDeliveryTime: () => estimateDeliveryTime,
  isInCoverageArea: () => isInCoverageArea,
  isInCoverageAreaSync: () => isInCoverageAreaSync,
});
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(deg) {
  return deg * (Math.PI / 180);
}
async function calculateDeliveryFee(distance) {
  return calculateDeliveryFeeSync(distance);
}
function calculateDeliveryFeeSync(distance) {
  let euros;
  if (distance <= 2) {
    euros = 2.5;
  } else if (distance <= 3) {
    euros = 4;
  } else if (distance <= 4) {
    euros = 5;
  } else {
    euros = 5 + Math.ceil(distance - 4);
  }
  return Math.round(euros * 100);
}
function estimateDeliveryTime(distance, prepTime = 20) {
  const SPEED_KM_PER_MIN = 0.5;
  const travelTime = distance / SPEED_KM_PER_MIN;
  return Math.ceil(prepTime + travelTime);
}
async function isInCoverageArea(latitude, longitude) {
  const CENTER_LAT = 41.7636;
  const CENTER_LNG = -2.4677;
  const maxRadius = await getSettingValue("max_delivery_radius_km", 10);
  const distance = calculateDistance(
    latitude,
    longitude,
    CENTER_LAT,
    CENTER_LNG,
  );
  return distance <= maxRadius;
}
function isInCoverageAreaSync(latitude, longitude, maxRadius = 10) {
  const CENTER_LAT = 41.7636;
  const CENTER_LNG = -2.4677;
  const distance = calculateDistance(
    latitude,
    longitude,
    CENTER_LAT,
    CENTER_LNG,
  );
  return distance <= maxRadius;
}
var init_distance = __esm({
  "server/utils/distance.ts"() {
    "use strict";
    init_systemSettingsService();
  },
});

// server/enhancedPushService.ts
var enhancedPushService_exports = {};
__export(enhancedPushService_exports, {
  notifyDriverNewOrder: () => notifyDriverNewOrder,
  notifyPagoMovilStatus: () => notifyPagoMovilStatus,
  sendOrderStatusNotification: () => sendOrderStatusNotification,
  sendPushToUser: () => sendPushToUser,
});
import { eq as eq11 } from "drizzle-orm";
async function sendOrderStatusNotification(orderId, userId, newStatus) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq11(orders.id, orderId))
    .limit(1);
  if (!order) return;
  const [user] = await db
    .select()
    .from(users)
    .where(eq11(users.id, userId))
    .limit(1);
  if (!user || !user.pushToken) return;
  let notification = null;
  switch (newStatus) {
    case "accepted":
      notification = {
        title: "\xA1Pedido aceptado! \u{1F389}",
        body: `${order.businessName} acept\xF3 tu pedido - Listo en ${order.estimatedPrepTime || 25} min`,
        data: { orderId, screen: "OrderTracking" },
      };
      break;
    case "preparing":
      notification = {
        title: "Preparando tu pedido \u{1F468}\u200D\u{1F373}",
        body: `${order.businessName} est\xE1 preparando tu pedido`,
        data: { orderId, screen: "OrderTracking" },
      };
      break;
    case "ready":
      notification = {
        title: "Tu pedido est\xE1 listo \u{1F4E6}",
        body: "Esperando a que un repartidor lo recoja",
        data: { orderId, screen: "OrderTracking" },
      };
      break;
    case "assigned_driver":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq11(users.id, order.deliveryPersonId))
          .limit(1);
        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        notification = {
          title: `${driverName} fue asignado \u{1F697}`,
          body: "Pronto recoger\xE1 tu pedido",
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;
    case "picked_up":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq11(users.id, order.deliveryPersonId))
          .limit(1);
        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        const eta = order.estimatedDeliveryTime || 15;
        notification = {
          title: `${driverName} va en camino \u{1F697}`,
          body: `Llega en ${eta} min`,
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;
    case "arriving":
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(users)
          .where(eq11(users.id, order.deliveryPersonId))
          .limit(1);
        const driverName = driver?.name?.split(" ")[0] || "Tu repartidor";
        notification = {
          title: `${driverName} est\xE1 cerca \u26A1`,
          body: "Llega en 2 minutos",
          data: { orderId, screen: "OrderTracking" },
        };
      }
      break;
    case "delivered":
      notification = {
        title: "\xA1Pedido entregado! \u{1F389}",
        body: "\xA1Disfruta tu comida! No olvides calificar tu experiencia",
        data: { orderId, screen: "OrderDetails" },
      };
      break;
    case "cancelled":
      notification = {
        title: "Pedido cancelado",
        body: "Tu pedido ha sido cancelado",
        data: { orderId, screen: "OrderDetails" },
      };
      break;
  }
  if (notification) {
    await sendPushNotification(user.pushToken, notification);
  }
}
async function sendPushNotification(pushToken, payload) {
  try {
    const message = {
      to: pushToken,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    };
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    console.log(`\u{1F4F1} Push notification sent: ${payload.title}`);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}
async function notifyPagoMovilStatus(userId, status, orderId, reason) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq11(users.id, userId))
    .limit(1);
  if (!user || !user.pushToken) return;
  const notification =
    status === "verified"
      ? {
          title: "\u2705 Pago verificado",
          body: "Tu pago fue confirmado. Tu pedido est\xE1 siendo procesado.",
          data: { orderId, screen: "OrderTracking" },
        }
      : {
          title: "\u274C Pago rechazado",
          body:
            reason ||
            "Tu comprobante fue rechazado. Por favor verifica los datos.",
          data: { orderId, screen: "PaymentProofUpload" },
        };
  await sendPushNotification(user.pushToken, notification);
}
async function sendPushToUser(userId, payload) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq11(users.id, userId))
    .limit(1);
  if (!user?.pushToken) return;
  await sendPushNotification(user.pushToken, payload);
}
async function notifyDriverNewOrder(driverId, orderId) {
  const [driver] = await db
    .select()
    .from(users)
    .where(eq11(users.id, driverId))
    .limit(1);
  if (!driver || !driver.pushToken) return;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq11(orders.id, orderId))
    .limit(1);
  if (!order) return;
  const earning = Math.round((order.total * 0.15) / 100);
  await sendPushNotification(driver.pushToken, {
    title: "Nuevo pedido disponible \u{1F4E6}",
    body: `${order.businessName} - Gana $${earning}`,
    data: { orderId, screen: "DriverAvailable" },
  });
}
var init_enhancedPushService = __esm({
  "server/enhancedPushService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
  },
});

// server/loyaltyService.ts
var loyaltyService_exports = {};
__export(loyaltyService_exports, {
  LoyaltyService: () => LoyaltyService,
});
import { eq as eq12, and as and4, desc as desc2 } from "drizzle-orm";
var LoyaltyService;
var init_loyaltyService = __esm({
  "server/loyaltyService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    LoyaltyService = class {
      /**
       * Obtener o crear puntos de lealtad para un usuario
       */
      static async getOrCreateLoyaltyPoints(userId) {
        try {
          const [existing] = await db
            .select()
            .from(loyaltyPoints)
            .where(eq12(loyaltyPoints.userId, userId))
            .limit(1);
          if (existing) return existing;
          const newPoints = {
            id: crypto.randomUUID(),
            userId,
            currentPoints: 0,
            totalEarned: 0,
            totalRedeemed: 0,
            tier: "bronze",
            pointsToNextTier: 1e3,
          };
          await db.insert(loyaltyPoints).values(newPoints);
          return newPoints;
        } catch (error) {
          console.error("Error getting/creating loyalty points:", error);
          throw error;
        }
      }
      /**
       * Agregar puntos por pedido completado
       */
      static async awardPointsForOrder(userId, orderId, orderTotal) {
        try {
          const points = Math.floor(orderTotal / 100);
          if (points <= 0) return;
          await this.addPoints(
            userId,
            points,
            "earned",
            `Pedido completado #${orderId.slice(-6)}`,
            orderId,
          );
          await this.updateChallengeProgress(userId, "orders", 1);
          await this.updateChallengeProgress(userId, "spending", orderTotal);
        } catch (error) {
          console.error("Error awarding points for order:", error);
          throw error;
        }
      }
      /**
       * Agregar puntos
       */
      static async addPoints(
        userId,
        points,
        type,
        description,
        orderId,
        rewardId,
      ) {
        try {
          const userPoints = await this.getOrCreateLoyaltyPoints(userId);
          const newCurrent = userPoints.currentPoints + points;
          const newTotal = userPoints.totalEarned + points;
          await db
            .update(loyaltyPoints)
            .set({
              currentPoints: newCurrent,
              totalEarned: newTotal,
            })
            .where(eq12(loyaltyPoints.userId, userId));
          await db.insert(loyaltyTransactions).values({
            id: crypto.randomUUID(),
            userId,
            type,
            points,
            description,
            orderId,
            rewardId,
          });
          await this.updateTier(userId, newTotal);
          return newCurrent;
        } catch (error) {
          console.error("Error adding points:", error);
          throw error;
        }
      }
      /**
       * Actualizar tier basado en puntos totales
       */
      static async updateTier(userId, totalEarned) {
        try {
          let newTier = "bronze";
          let pointsToNext = 1e3;
          if (totalEarned >= 1e4) {
            newTier = "diamond";
            pointsToNext = 0;
          } else if (totalEarned >= 5e3) {
            newTier = "platinum";
            pointsToNext = 1e4 - totalEarned;
          } else if (totalEarned >= 2500) {
            newTier = "gold";
            pointsToNext = 5e3 - totalEarned;
          } else if (totalEarned >= 1e3) {
            newTier = "silver";
            pointsToNext = 2500 - totalEarned;
          } else {
            pointsToNext = 1e3 - totalEarned;
          }
          await db
            .update(loyaltyPoints)
            .set({
              tier: newTier,
              tierUpdatedAt: /* @__PURE__ */ new Date(),
              pointsToNextTier,
            })
            .where(eq12(loyaltyPoints.userId, userId));
        } catch (error) {
          console.error("Error updating tier:", error);
          throw error;
        }
      }
      /**
       * Canjear recompensa
       */
      static async redeemReward(userId, rewardId) {
        try {
          const [reward] = await db
            .select()
            .from(loyaltyRewards)
            .where(eq12(loyaltyRewards.id, rewardId))
            .limit(1);
          if (!reward || !reward.isAvailable) {
            throw new Error("Recompensa no disponible");
          }
          const userPoints = await this.getOrCreateLoyaltyPoints(userId);
          if (userPoints.currentPoints < reward.pointsCost) {
            throw new Error("Puntos insuficientes");
          }
          if (reward.minTier) {
            const tiers = ["bronze", "silver", "gold", "platinum", "diamond"];
            const userTierIndex = tiers.indexOf(userPoints.tier);
            const minTierIndex = tiers.indexOf(reward.minTier);
            if (userTierIndex < minTierIndex) {
              throw new Error(`Requiere tier ${reward.minTier} o superior`);
            }
          }
          if (
            reward.maxRedemptions &&
            reward.currentRedemptions >= reward.maxRedemptions
          ) {
            throw new Error("L\xEDmite de canjes alcanzado");
          }
          await db
            .update(loyaltyPoints)
            .set({
              currentPoints: userPoints.currentPoints - reward.pointsCost,
              totalRedeemed: userPoints.totalRedeemed + reward.pointsCost,
            })
            .where(eq12(loyaltyPoints.userId, userId));
          await db.insert(loyaltyTransactions).values({
            id: crypto.randomUUID(),
            userId,
            type: "redeemed",
            points: -reward.pointsCost,
            description: `Canjeado: ${reward.title}`,
            rewardId,
          });
          const redemptionId = crypto.randomUUID();
          const expiresAt =
            reward.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
          await db.insert(loyaltyRedemptions).values({
            id: redemptionId,
            userId,
            rewardId,
            pointsSpent: reward.pointsCost,
            status: "active",
            expiresAt,
          });
          await db
            .update(loyaltyRewards)
            .set({ currentRedemptions: reward.currentRedemptions + 1 })
            .where(eq12(loyaltyRewards.id, rewardId));
          return { redemptionId, reward };
        } catch (error) {
          console.error("Error redeeming reward:", error);
          throw error;
        }
      }
      /**
       * Obtener historial de transacciones
       */
      static async getTransactionHistory(userId, limit = 50) {
        try {
          return await db
            .select()
            .from(loyaltyTransactions)
            .where(eq12(loyaltyTransactions.userId, userId))
            .orderBy(desc2(loyaltyTransactions.createdAt))
            .limit(limit);
        } catch (error) {
          console.error("Error getting transaction history:", error);
          return [];
        }
      }
      /**
       * Obtener recompensas disponibles para un usuario
       */
      static async getAvailableRewards(userId) {
        try {
          const userPoints = await this.getOrCreateLoyaltyPoints(userId);
          const allRewards = await db
            .select()
            .from(loyaltyRewards)
            .where(eq12(loyaltyRewards.isAvailable, true));
          return allRewards.filter((reward) => {
            if (reward.minTier) {
              const tiers = ["bronze", "silver", "gold", "platinum", "diamond"];
              const userTierIndex = tiers.indexOf(userPoints.tier);
              const minTierIndex = tiers.indexOf(reward.minTier);
              if (userTierIndex < minTierIndex) return false;
            }
            if (
              reward.maxRedemptions &&
              reward.currentRedemptions >= reward.maxRedemptions
            ) {
              return false;
            }
            return true;
          });
        } catch (error) {
          console.error("Error getting available rewards:", error);
          return [];
        }
      }
      /**
       * Actualizar progreso de challenges
       */
      static async updateChallengeProgress(userId, type, increment) {
        try {
          const activeChallenges = await db
            .select()
            .from(loyaltyChallenges)
            .where(
              and4(
                eq12(loyaltyChallenges.isActive, true),
                eq12(loyaltyChallenges.type, type),
              ),
            );
          for (const challenge of activeChallenges) {
            if (
              challenge.expiresAt &&
              new Date(challenge.expiresAt) < /* @__PURE__ */ new Date()
            ) {
              continue;
            }
            const [progress] = await db
              .select()
              .from(loyaltyChallengeProgress)
              .where(
                and4(
                  eq12(loyaltyChallengeProgress.userId, userId),
                  eq12(loyaltyChallengeProgress.challengeId, challenge.id),
                ),
              )
              .limit(1);
            if (progress) {
              if (!progress.completed) {
                const newProgress = Math.min(
                  progress.progress + increment,
                  challenge.target,
                );
                const completed = newProgress >= challenge.target;
                await db
                  .update(loyaltyChallengeProgress)
                  .set({
                    progress: newProgress,
                    completed,
                    completedAt: completed ? /* @__PURE__ */ new Date() : null,
                  })
                  .where(eq12(loyaltyChallengeProgress.id, progress.id));
              }
            } else {
              const newProgress = Math.min(increment, challenge.target);
              const completed = newProgress >= challenge.target;
              await db.insert(loyaltyChallengeProgress).values({
                id: crypto.randomUUID(),
                userId,
                challengeId: challenge.id,
                progress: newProgress,
                completed,
                completedAt: completed ? /* @__PURE__ */ new Date() : null,
              });
            }
          }
        } catch (error) {
          console.error("Error updating challenge progress:", error);
        }
      }
      /**
       * Reclamar recompensa de challenge completado
       */
      static async claimChallengeReward(userId, challengeId) {
        try {
          const [progress] = await db
            .select()
            .from(loyaltyChallengeProgress)
            .where(
              and4(
                eq12(loyaltyChallengeProgress.userId, userId),
                eq12(loyaltyChallengeProgress.challengeId, challengeId),
              ),
            )
            .limit(1);
          if (!progress || !progress.completed || progress.claimed) {
            throw new Error("Challenge no completado o ya reclamado");
          }
          const [challenge] = await db
            .select()
            .from(loyaltyChallenges)
            .where(eq12(loyaltyChallenges.id, challengeId))
            .limit(1);
          if (!challenge) {
            throw new Error("Challenge no encontrado");
          }
          await db
            .update(loyaltyChallengeProgress)
            .set({
              claimed: true,
              claimedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq12(loyaltyChallengeProgress.id, progress.id));
          await this.addPoints(
            userId,
            challenge.rewardPoints,
            "bonus",
            `Challenge completado: ${challenge.title}`,
          );
          return challenge.rewardPoints;
        } catch (error) {
          console.error("Error claiming challenge reward:", error);
          throw error;
        }
      }
      /**
       * Obtener challenges del usuario con progreso
       */
      static async getUserChallenges(userId) {
        try {
          const activeChallenges = await db
            .select()
            .from(loyaltyChallenges)
            .where(eq12(loyaltyChallenges.isActive, true));
          const result = [];
          for (const challenge of activeChallenges) {
            const [progress] = await db
              .select()
              .from(loyaltyChallengeProgress)
              .where(
                and4(
                  eq12(loyaltyChallengeProgress.userId, userId),
                  eq12(loyaltyChallengeProgress.challengeId, challenge.id),
                ),
              )
              .limit(1);
            result.push({
              ...challenge,
              progress: progress?.progress || 0,
              completed: progress?.completed || false,
              claimed: progress?.claimed || false,
            });
          }
          return result;
        } catch (error) {
          console.error("Error getting user challenges:", error);
          return [];
        }
      }
    };
  },
});

// server/subscriptionService.ts
var subscriptionService_exports = {};
__export(subscriptionService_exports, {
  SubscriptionService: () => SubscriptionService,
});
import { eq as eq13, and as and5 } from "drizzle-orm";
var SubscriptionService;
var init_subscriptionService = __esm({
  "server/subscriptionService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    SubscriptionService = class {
      // Planes hardcoded como fallback si la BD no tiene datos
      static PLANS_FALLBACK = {
        free: {
          name: "Free",
          price: 0,
          benefits: {
            freeDelivery: false,
            discountPercentage: 0,
            prioritySupport: false,
            exclusiveDeals: false,
            noMinimumOrder: false,
          },
        },
        premium: {
          name: "Premium",
          price: 1500,
          benefits: {
            freeDelivery: true,
            discountPercentage: 10,
            prioritySupport: true,
            exclusiveDeals: true,
            noMinimumOrder: false,
          },
        },
        business: {
          name: "Business",
          price: 3e3,
          benefits: {
            freeDelivery: true,
            discountPercentage: 15,
            prioritySupport: true,
            exclusiveDeals: true,
            noMinimumOrder: true,
          },
        },
      };
      // Leer planes desde BD (con fallback)
      static async getPlansFromDB() {
        try {
          const plans = await db
            .select()
            .from(subscriptionPlans)
            .orderBy(subscriptionPlans.displayOrder);
          const benefits = await db.select().from(subscriptionBenefits);
          if (!plans.length) return this.PLANS_FALLBACK;
          const result = {};
          for (const plan of plans) {
            const planBenefits = benefits.filter(
              (b) => b.plan === plan.planKey,
            );
            const discountBenefit = planBenefits.find(
              (b) => b.benefitType === "discount",
            );
            const active = (b) => (b.benefitValue ?? 0) > 0;
            result[plan.planKey] = {
              name: plan.name,
              price: plan.price,
              description: plan.description,
              color: plan.color,
              icon: plan.icon,
              benefits: {
                freeDelivery: planBenefits.some(
                  (b) => b.benefitType === "free_delivery" && active(b),
                ),
                discountPercentage: discountBenefit
                  ? (discountBenefit.benefitValue ?? 0)
                  : 0,
                prioritySupport: planBenefits.some(
                  (b) => b.benefitType === "priority_support" && active(b),
                ),
                exclusiveDeals: planBenefits.some(
                  (b) => b.benefitType === "exclusive_deals" && active(b),
                ),
                noMinimumOrder: planBenefits.some(
                  (b) => b.benefitType === "no_minimum" && active(b),
                ),
              },
              benefitsList: planBenefits.map((b) => ({
                id: b.id,
                type: b.benefitType,
                value: b.benefitValue,
                description: b.description,
              })),
            };
          }
          return result;
        } catch {
          return this.PLANS_FALLBACK;
        }
      }
      // Compatibilidad: PLANS como getter que devuelve fallback (para código que lo usa síncronamente)
      static get PLANS() {
        return this.PLANS_FALLBACK;
      }
      // Obtener suscripción del usuario
      static async getUserSubscription(userId) {
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq13(subscriptions.userId, userId))
          .limit(1);
        if (!subscription || subscription.status === "pending_payment") {
          return {
            plan: subscription?.plan || "free",
            status: subscription?.status || "active",
            benefits: this.PLANS_FALLBACK.free.benefits,
          };
        }
        const now = /* @__PURE__ */ new Date();
        if (
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd < now &&
          subscription.status === "active"
        ) {
          await db
            .update(subscriptions)
            .set({ status: "expired" })
            .where(eq13(subscriptions.id, subscription.id));
          return {
            plan: "free",
            status: "expired",
            benefits: this.PLANS_FALLBACK.free.benefits,
          };
        }
        const plans = await this.getPlansFromDB();
        const planData = plans[subscription.plan] || plans["free"];
        const planBenefits =
          subscription.status === "active"
            ? planData.benefits
            : this.PLANS_FALLBACK.free.benefits;
        return {
          ...subscription,
          benefits: planBenefits,
          planDetails: planData,
        };
      }
      // Iniciar suscripción — crea registro pending_payment, el usuario debe pagar y subir comprobante
      static async initSubscription(userId, plan, billingCycle = "monthly") {
        const plans = await this.getPlansFromDB();
        const planData = plans[plan];
        if (!planData) throw new Error("Plan inv\xE1lido");
        const [existing] = await db
          .select()
          .from(subscriptions)
          .where(eq13(subscriptions.userId, userId))
          .limit(1);
        if (existing) {
          if (existing.status === "active" && existing.plan === plan) {
            return {
              success: true,
              subscriptionId: existing.id,
              amount: planData.price,
              plan,
              alreadyActive: true,
            };
          }
          await db
            .update(subscriptions)
            .set({
              plan,
              status: "pending_payment",
              price: planData.price,
              billingCycle,
              autoRenew: true,
            })
            .where(eq13(subscriptions.id, existing.id));
          return {
            success: true,
            subscriptionId: existing.id,
            amount: planData.price,
            plan,
          };
        } else {
          const { randomUUID: randomUUID2 } = await import("crypto");
          const id = randomUUID2();
          await db.insert(subscriptions).values({
            id,
            userId,
            plan,
            status: "pending_payment",
            price: planData.price,
            billingCycle,
            autoRenew: true,
          });
          return {
            success: true,
            subscriptionId: id,
            amount: planData.price,
            plan,
          };
        }
      }
      // ELIMINADO: subscribe() activaba sin cobrar. Usar initSubscription() + confirmación de pago.
      // El método se mantiene solo para compatibilidad interna pero lanza error si se llama directamente.
      static async subscribe(_userId, _plan, _billingCycle) {
        throw new Error(
          "Uso incorrecto: usa initSubscription() y confirma el pago antes de activar.",
        );
      }
      // Cancelar suscripción
      static async cancelSubscription(userId) {
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq13(subscriptions.userId, userId))
          .limit(1);
        if (!subscription) {
          throw new Error("No tienes suscripci\xF3n activa");
        }
        await db
          .update(subscriptions)
          .set({
            autoRenew: false,
            cancelledAt: /* @__PURE__ */ new Date(),
          })
          .where(eq13(subscriptions.id, subscription.id));
        return {
          success: true,
          message:
            "Suscripci\xF3n cancelada. Seguir\xE1s teniendo acceso hasta el final del per\xEDodo",
        };
      }
      static async applySubscriptionBenefits(userId, orderTotal, deliveryFee) {
        const subscription = await this.getUserSubscription(userId);
        if (subscription.plan === "free" || subscription.status !== "active") {
          return {
            discount: 0,
            deliveryFee,
            appliedBenefits: [],
            freeDelivery: false,
            discountPercentage: 0,
          };
        }
        const benefits = await db
          .select()
          .from(subscriptionBenefits)
          .where(eq13(subscriptionBenefits.plan, subscription.plan));
        const appliedBenefits = [];
        let finalDeliveryFee = deliveryFee;
        let discount = 0;
        let discountPercentage = 0;
        let freeDelivery = false;
        for (const b of benefits) {
          const val = b.benefitValue ?? 0;
          if (val <= 0) continue;
          switch (b.benefitType) {
            case "free_delivery":
              finalDeliveryFee = 0;
              freeDelivery = true;
              appliedBenefits.push(b.description || "Env\xEDo gratis");
              break;
            case "discount":
            case "discount_percentage":
              discountPercentage = val;
              discount = Math.round(orderTotal * (val / 100));
              appliedBenefits.push(b.description || `${val}% descuento`);
              break;
            // Beneficios informativos (no afectan al precio, se muestran al cliente)
            case "priority_support":
            case "exclusive_deals":
            case "no_minimum":
            case "analytics":
            default:
              if (b.description) appliedBenefits.push(b.description);
              break;
          }
        }
        return {
          discount,
          deliveryFee: finalDeliveryFee,
          appliedBenefits,
          freeDelivery,
          discountPercentage,
        };
      }
      // Renovar suscripciones vencidas (cron job)
      static async renewSubscriptions() {
        const now = /* @__PURE__ */ new Date();
        const expiredSubs = await db
          .select()
          .from(subscriptions)
          .where(
            and5(
              eq13(subscriptions.status, "active"),
              eq13(subscriptions.autoRenew, true),
            ),
          );
        const renewed = [];
        for (const sub of expiredSubs) {
          if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
            const newPeriodEnd = new Date(sub.currentPeriodEnd);
            if (sub.billingCycle === "monthly") {
              newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
            } else {
              newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
            }
            await db
              .update(subscriptions)
              .set({
                currentPeriodStart: sub.currentPeriodEnd,
                currentPeriodEnd: newPeriodEnd,
              })
              .where(eq13(subscriptions.id, sub.id));
            renewed.push(sub.id);
          }
        }
        return { success: true, renewed: renewed.length };
      }
    };
  },
});

// server/autoVerificationService.ts
var autoVerificationService_exports = {};
__export(autoVerificationService_exports, {
  AutoVerificationService: () => AutoVerificationService,
  autoVerificationService: () => autoVerificationService,
});
import {
  eq as eq16,
  and as and7,
  gte,
  desc as desc3,
  sql as sql2,
} from "drizzle-orm";
var AutoVerificationService, autoVerificationService;
var init_autoVerificationService = __esm({
  "server/autoVerificationService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
    AutoVerificationService = class _AutoVerificationService {
      static instance;
      // Configuración de seguridad
      MIN_CONFIDENCE = 0.75;
      // 75% confianza mínima para auto-aprobar
      MAX_RISK_SCORE = 0.3;
      // 30% riesgo máximo
      MIN_SUCCESSFUL_ORDERS = 3;
      // Mínimo 3 pedidos exitosos
      MAX_DISPUTE_RATE = 0.1;
      // Máximo 10% de disputas
      MAX_AMOUNT_TOLERANCE = 500;
      // ±5 Bs de tolerancia
      MIN_ACCOUNT_AGE_DAYS = 7;
      // Cuenta mínima 7 días
      MAX_ORDERS_PER_HOUR = 5;
      // Máximo 5 pedidos por hora
      MAX_ORDERS_PER_DAY = 20;
      // Máximo 20 pedidos por día
      constructor() {}
      static getInstance() {
        if (!_AutoVerificationService.instance) {
          _AutoVerificationService.instance = new _AutoVerificationService();
        }
        return _AutoVerificationService.instance;
      }
      /**
       * Verifica si un comprobante debe ser auto-aprobado
       */
      async shouldAutoApprove(proofId) {
        try {
          const [proof] = await db
            .select()
            .from(paymentProofs)
            .where(eq16(paymentProofs.id, proofId))
            .limit(1);
          if (!proof) {
            throw new Error("Comprobante no encontrado");
          }
          const [order] = await db
            .select()
            .from(orders)
            .where(eq16(orders.id, proof.orderId))
            .limit(1);
          if (!order) {
            throw new Error("Orden no encontrada");
          }
          const [user] = await db
            .select()
            .from(users)
            .where(eq16(users.id, proof.userId))
            .limit(1);
          if (!user) {
            throw new Error("Usuario no encontrado");
          }
          const checks = {
            referenceFormat: await this.checkReferenceFormat(
              proof.referenceNumber,
            ),
            amountMatch: await this.checkAmountMatch(proof.amount, order.total),
            userTrustworthy: await this.checkUserTrustworthiness(proof.userId),
            timeValid: await this.checkTimeValidity(proof.submittedAt),
            imageValid: await this.checkImageValidity(proof.proofImageUrl),
            duplicateCheck: await this.checkDuplicateReference(
              proof.referenceNumber,
              proof.id,
            ),
            velocityCheck: await this.checkVelocity(proof.userId),
          };
          const { confidence, riskScore, reason } =
            await this.calculateConfidenceAndRisk(checks, proof, order, user);
          const autoApprove =
            confidence >= this.MIN_CONFIDENCE &&
            riskScore <= this.MAX_RISK_SCORE &&
            Object.values(checks).every((check) => check === true);
          logger.info(
            `\u{1F916} Auto-verification result for proof ${proofId}`,
            {
              proofId,
              orderId: order.id,
              userId: user.id,
              autoApprove,
              confidence,
              riskScore,
              checks,
            },
          );
          return {
            autoApprove,
            reason,
            confidence,
            riskScore,
            checks,
          };
        } catch (error) {
          logger.error("Error in auto-verification:", error);
          return {
            autoApprove: false,
            reason: `Error en verificaci\xF3n: ${error.message}`,
            confidence: 0,
            riskScore: 1,
            checks: {
              referenceFormat: false,
              amountMatch: false,
              userTrustworthy: false,
              timeValid: false,
              imageValid: false,
              duplicateCheck: false,
              velocityCheck: false,
            },
          };
        }
      }
      /**
       * 1. Verificar formato de referencia
       * Debe ser 8-10 dígitos numéricos
       */
      async checkReferenceFormat(reference) {
        if (!reference) return false;
        const isValid = /^\d{8,10}$/.test(reference);
        const isSequential =
          /^(\d)\1+$/.test(reference) ||
          reference === "12345678" ||
          reference === "87654321";
        return isValid && !isSequential;
      }
      /**
       * 2. Verificar que el monto coincida
       * Tolerancia de ±5 Bs
       */
      async checkAmountMatch(proofAmount, orderTotal) {
        const difference = Math.abs(proofAmount - orderTotal);
        return difference <= this.MAX_AMOUNT_TOLERANCE;
      }
      /**
       * 3. Verificar confiabilidad del usuario
       */
      async checkUserTrustworthiness(userId) {
        const stats = await this.getUserStats(userId);
        if (stats.accountAge < this.MIN_ACCOUNT_AGE_DAYS) {
          return false;
        }
        if (stats.totalOrders === 0) {
          return false;
        }
        if (stats.successfulOrders < this.MIN_SUCCESSFUL_ORDERS) {
          return false;
        }
        if (stats.disputeRate > this.MAX_DISPUTE_RATE) {
          return false;
        }
        return true;
      }
      /**
       * 4. Verificar validez temporal
       * No más de 48 horas desde el envío
       * No en horario sospechoso (2am-6am)
       */
      async checkTimeValidity(submittedAt) {
        const now = /* @__PURE__ */ new Date();
        const hoursSinceSubmit =
          (now.getTime() - new Date(submittedAt).getTime()) / (1e3 * 60 * 60);
        if (hoursSinceSubmit > 48) {
          return false;
        }
        const hour = new Date(submittedAt).getHours();
        if (hour >= 2 && hour <= 6) {
          return false;
        }
        return true;
      }
      /**
       * 5. Verificar validez de la imagen
       * Debe existir y tener URL válida
       */
      async checkImageValidity(imageUrl) {
        if (!imageUrl) return false;
        try {
          new URL(imageUrl);
          return true;
        } catch {
          return false;
        }
      }
      /**
       * 6. Verificar que la referencia no esté duplicada
       * CRÍTICO para prevenir fraude
       */
      async checkDuplicateReference(reference, currentProofId) {
        const duplicates = await db
          .select()
          .from(paymentProofs)
          .where(
            and7(
              eq16(paymentProofs.referenceNumber, reference),
              sql2`${paymentProofs.id} != ${currentProofId}`,
            ),
          )
          .limit(1);
        return duplicates.length === 0;
      }
      /**
       * 7. Verificar velocidad de pedidos (Velocity Check)
       * Detecta comportamiento anormal
       */
      async checkVelocity(userId) {
        const now = /* @__PURE__ */ new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
        const ordersLastHour = await db
          .select({ count: sql2`count(*)` })
          .from(orders)
          .where(
            and7(
              eq16(orders.userId, userId),
              gte(orders.createdAt, oneHourAgo),
            ),
          );
        const countLastHour = Number(ordersLastHour[0]?.count || 0);
        if (countLastHour > this.MAX_ORDERS_PER_HOUR) {
          logger.warn(
            `\u26A0\uFE0F Velocity check failed: ${countLastHour} orders in last hour`,
            { userId },
          );
          return false;
        }
        const ordersLastDay = await db
          .select({ count: sql2`count(*)` })
          .from(orders)
          .where(
            and7(eq16(orders.userId, userId), gte(orders.createdAt, oneDayAgo)),
          );
        const countLastDay = Number(ordersLastDay[0]?.count || 0);
        if (countLastDay > this.MAX_ORDERS_PER_DAY) {
          logger.warn(
            `\u26A0\uFE0F Velocity check failed: ${countLastDay} orders in last day`,
            { userId },
          );
          return false;
        }
        return true;
      }
      /**
       * Obtener estadísticas del usuario
       */
      async getUserStats(userId) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq16(users.id, userId))
          .limit(1);
        if (!user) {
          return {
            totalOrders: 0,
            successfulOrders: 0,
            disputedOrders: 0,
            disputeRate: 0,
            avgOrderValue: 0,
            accountAge: 0,
            lastOrderDate: null,
          };
        }
        const userOrders = await db
          .select()
          .from(orders)
          .where(eq16(orders.userId, userId))
          .orderBy(desc3(orders.createdAt));
        const totalOrders = userOrders.length;
        const successfulOrders = userOrders.filter(
          (o) => o.status === "completed",
        ).length;
        const disputedOrders = userOrders.filter(
          (o) => o.status === "disputed",
        ).length;
        const disputeRate = totalOrders > 0 ? disputedOrders / totalOrders : 0;
        const totalValue = userOrders.reduce((sum3, o) => sum3 + o.total, 0);
        const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
        const accountAge = Math.floor(
          (Date.now() - new Date(user.createdAt).getTime()) /
            (1e3 * 60 * 60 * 24),
        );
        const lastOrderDate =
          userOrders.length > 0 ? userOrders[0].createdAt : null;
        return {
          totalOrders,
          successfulOrders,
          disputedOrders,
          disputeRate,
          avgOrderValue,
          accountAge,
          lastOrderDate,
        };
      }
      /**
       * Calcular confianza y riesgo
       */
      async calculateConfidenceAndRisk(checks, proof, order, user) {
        let confidence = 1;
        let riskScore = 0;
        const reasons = [];
        if (!checks.referenceFormat) {
          confidence -= 0.3;
          riskScore += 0.4;
          reasons.push("Formato de referencia inv\xE1lido");
        }
        if (!checks.amountMatch) {
          confidence -= 0.4;
          riskScore += 0.5;
          reasons.push("Monto no coincide");
        }
        if (!checks.userTrustworthy) {
          confidence -= 0.3;
          riskScore += 0.3;
          reasons.push("Usuario no confiable");
        }
        if (!checks.timeValid) {
          confidence -= 0.2;
          riskScore += 0.2;
          reasons.push("Tiempo inv\xE1lido o hora sospechosa");
        }
        if (!checks.imageValid) {
          confidence -= 0.2;
          riskScore += 0.2;
          reasons.push("Imagen inv\xE1lida");
        }
        if (!checks.duplicateCheck) {
          confidence -= 0.5;
          riskScore += 0.8;
          reasons.push("\u26A0\uFE0F REFERENCIA DUPLICADA - POSIBLE FRAUDE");
        }
        if (!checks.velocityCheck) {
          confidence -= 0.3;
          riskScore += 0.4;
          reasons.push("\u26A0\uFE0F VELOCIDAD ANORMAL - POSIBLE FRAUDE");
        }
        const stats = await this.getUserStats(user.id);
        if (stats.successfulOrders >= 10 && stats.disputeRate === 0) {
          confidence += 0.1;
          riskScore -= 0.1;
          reasons.push("\u2705 Usuario con excelente historial");
        }
        confidence = Math.max(0, Math.min(1, confidence));
        riskScore = Math.max(0, Math.min(1, riskScore));
        const reason =
          reasons.length > 0
            ? reasons.join(", ")
            : "Todas las validaciones pasaron correctamente";
        return { confidence, riskScore, reason };
      }
      /**
       * Registrar intento de fraude
       */
      async logFraudAttempt(userId, proofId, reason) {
        logger.error(`\u{1F6A8} FRAUD ATTEMPT DETECTED`, {
          userId,
          proofId,
          reason,
          timestamp: /* @__PURE__ */ new Date().toISOString(),
        });
        const { auditLogs: auditLogs2 } = await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
        await db.insert(auditLogs2).values({
          userId,
          action: "fraud_attempt",
          entityType: "payment_proof",
          entityId: proofId,
          changes: JSON.stringify({ reason }),
        });
        try {
          const { notifyAdminFraud: notifyAdminFraud2 } =
            await Promise.resolve().then(
              () => (init_websocket(), websocket_exports),
            );
          const [user] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq16(users.id, userId))
            .limit(1);
          notifyAdminFraud2({
            userId,
            userName: user?.name ?? "Usuario desconocido",
            proofId,
            reason,
          });
        } catch {}
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
        const recentFraud = await db
          .select({ count: sql2`count(*)` })
          .from(auditLogs2)
          .where(
            and7(
              eq16(auditLogs2.userId, userId),
              eq16(auditLogs2.action, "fraud_attempt"),
              gte(auditLogs2.createdAt, since),
            ),
          );
        const fraudCount = Number(recentFraud[0]?.count || 0);
        if (fraudCount >= 3) {
          await db
            .update(users)
            .set({ isActive: false })
            .where(eq16(users.id, userId));
          logger.error(
            `\u{1F512} User ${userId} BLOCKED after ${fraudCount} fraud attempts`,
          );
        }
      }
    };
    autoVerificationService = AutoVerificationService.getInstance();
  },
});

// server/stripeClient.ts
var stripeClient_exports = {};
__export(stripeClient_exports, {
  getStripe: () => getStripe2,
});
import Stripe2 from "stripe";
function getStripe2() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY no configurado");
  }
  if (!stripeInstance2) {
    stripeInstance2 = new Stripe2(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }
  return stripeInstance2;
}
var stripeInstance2;
var init_stripeClient = __esm({
  "server/stripeClient.ts"() {
    "use strict";
    stripeInstance2 = null;
  },
});

// server/webhookHandlers.ts
var webhookHandlers_exports = {};
__export(webhookHandlers_exports, {
  handleStripeWebhook: () => handleStripeWebhook,
});
import { eq as eq17 } from "drizzle-orm";
function logWebhookEvent(context, message, data) {
  console.log(
    `[WEBHOOK ${context.eventId}] ${context.eventType} - ${message}`,
    {
      timestamp: context.timestamp,
      accountId: context.accountId,
      data,
    },
  );
}
function logWebhookError(context, error, details) {
  console.error(`[WEBHOOK ${context.eventId}] ERROR - ${error}`, {
    eventType: context.eventType,
    timestamp: context.timestamp,
    accountId: context.accountId,
    details,
  });
}
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    console.error("Missing Stripe signature header");
    return res.status(400).json({ error: "Missing signature" });
  }
  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }
  let event;
  try {
    const stripe2 = getStripe2();
    event = stripe2.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }
  const context = {
    eventId: event.id,
    eventType: event.type,
    timestamp: new Date(event.created * 1e3),
    accountId: event.account || void 0,
  };
  logWebhookEvent(context, "Received webhook event");
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object, context);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object, context);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object, context);
        break;
      case "transfer.created":
        await handleTransferCreated(event.data.object, context);
        break;
      case "payout.paid":
        await handlePayoutPaid(event.data.object, context);
        break;
      case "payout.failed":
        await handlePayoutFailed(event.data.object, context);
        break;
      default:
        logWebhookEvent(context, `Unhandled event type: ${event.type}`);
    }
    logWebhookEvent(context, "Webhook processed successfully");
    res.status(200).json({ received: true });
  } catch (error) {
    logWebhookError(context, "Failed to process webhook", {
      error: error.message,
      stack: error.stack,
    });
    if (
      error.message.includes("Order not found") ||
      error.message.includes("Business not found")
    ) {
      res.status(200).json({ received: true, warning: "Resource not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
async function handlePaymentIntentSucceeded(paymentIntent, context) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    logWebhookError(context, "Missing orderId in payment intent metadata");
    return;
  }
  logWebhookEvent(
    context,
    `Processing successful payment for order ${orderId}`,
    {
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  );
  try {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq17(orders.id, orderId))
      .limit(1);
    if (!existingOrder) {
      throw new Error(`Order not found: ${orderId}`);
    }
    await db
      .update(orders)
      .set({
        status: "accepted",
        paidAt: /* @__PURE__ */ new Date(),
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq17(orders.id, orderId));
    await db.insert(transactions).values({
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      businessId: existingOrder.businessId,
      userId: existingOrder.userId,
      amount: paymentIntent.amount,
      type: "payment",
      status: "completed",
      stripePaymentIntentId: paymentIntent.id,
      metadata: JSON.stringify({
        paymentMethod: paymentIntent.payment_method,
        currency: paymentIntent.currency,
      }),
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
    });
    logWebhookEvent(
      context,
      `Order ${orderId} marked as accepted and transaction recorded`,
    );
  } catch (error) {
    logWebhookError(context, `Failed to update order ${orderId}`, error);
    throw error;
  }
}
async function handlePaymentIntentFailed(paymentIntent, context) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    logWebhookError(
      context,
      "Missing orderId in failed payment intent metadata",
    );
    return;
  }
  logWebhookEvent(context, `Processing failed payment for order ${orderId}`, {
    lastPaymentError: paymentIntent.last_payment_error,
  });
  try {
    await db
      .update(orders)
      .set({
        status: "payment_failed",
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq17(orders.id, orderId));
    logWebhookEvent(context, `Order ${orderId} marked as payment failed`);
  } catch (error) {
    logWebhookError(
      context,
      `Failed to update failed payment for order ${orderId}`,
      error,
    );
    throw error;
  }
}
async function handleAccountUpdated(account, context) {
  logWebhookEvent(context, `Account updated: ${account.id}`, {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
  try {
    await db
      .update(businesses)
      .set({
        stripeAccountStatus:
          account.charges_enabled && account.payouts_enabled
            ? "active"
            : "pending",
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq17(businesses.stripeAccountId, account.id));
    logWebhookEvent(
      context,
      `Business account status updated for Stripe account ${account.id}`,
    );
  } catch (error) {
    logWebhookError(
      context,
      `Failed to update business for account ${account.id}`,
      error,
    );
    throw error;
  }
}
async function handleTransferCreated(transfer, context) {
  logWebhookEvent(context, `Transfer created: ${transfer.id}`, {
    amount: transfer.amount,
    destination: transfer.destination,
    currency: transfer.currency,
  });
  const orderId = transfer.metadata?.orderId;
  if (orderId) {
    try {
      await db.insert(transactions).values({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId,
        businessId: transfer.metadata?.businessId || "",
        userId: transfer.metadata?.userId || "",
        amount: transfer.amount,
        type: "transfer",
        status: "completed",
        stripeTransferId: transfer.id,
        metadata: JSON.stringify({
          destination: transfer.destination,
          currency: transfer.currency,
        }),
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      });
      logWebhookEvent(
        context,
        `Transfer transaction recorded for order ${orderId}`,
      );
    } catch (error) {
      logWebhookError(context, `Failed to record transfer transaction`, error);
    }
  }
}
async function handlePayoutPaid(payout, context) {
  logWebhookEvent(context, `Payout paid: ${payout.id}`, {
    amount: payout.amount,
    currency: payout.currency,
    method: payout.method,
  });
}
async function handlePayoutFailed(payout, context) {
  logWebhookError(context, `Payout failed: ${payout.id}`, {
    amount: payout.amount,
    currency: payout.currency,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
  });
}
var WEBHOOK_SECRET;
var init_webhookHandlers = __esm({
  "server/webhookHandlers.ts"() {
    "use strict";
    init_stripeClient();
    init_db();
    init_schema_mysql();
    WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  },
});

// server/strikeService.ts
var strikeService_exports = {};
__export(strikeService_exports, {
  addStrike: () => addStrike,
  removeStrike: () => removeStrike,
  unblockDriver: () => unblockDriver,
});
import { eq as eq20 } from "drizzle-orm";
async function addStrike(driverId, reason, orderId) {
  const [driver] = await db
    .select()
    .from(deliveryDrivers)
    .where(eq20(deliveryDrivers.userId, driverId))
    .limit(1);
  if (!driver) return;
  const newStrikes = driver.strikes + 1;
  const shouldBlock = newStrikes >= 3;
  await db
    .update(deliveryDrivers)
    .set({
      strikes: newStrikes,
      isBlocked: shouldBlock,
      blockedReason: shouldBlock ? `3 strikes: ${reason}` : null,
      blockedUntil: shouldBlock
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
        : null,
    })
    .where(eq20(deliveryDrivers.userId, driverId));
  logger.security(`Strike added to driver`, {
    driverId,
    strikes: newStrikes,
    reason,
    orderId,
    blocked: shouldBlock,
  });
  if (shouldBlock) {
    await sendPushToUser(driverId, {
      title: "\u26D4 Cuenta suspendida",
      body: "Recibiste 3 strikes. Tu cuenta est\xE1 suspendida por 7 d\xEDas.",
      data: { screen: "DriverProfile" },
    });
  } else {
    await sendPushToUser(driverId, {
      title: `\u26A0\uFE0F Strike ${newStrikes}/3`,
      body: `${reason}. Al llegar a 3 strikes tu cuenta ser\xE1 suspendida.`,
      data: { screen: "DriverProfile" },
    });
  }
}
async function removeStrike(driverId) {
  const [driver] = await db
    .select()
    .from(deliveryDrivers)
    .where(eq20(deliveryDrivers.userId, driverId))
    .limit(1);
  if (!driver || driver.strikes === 0) return;
  await db
    .update(deliveryDrivers)
    .set({
      strikes: Math.max(0, driver.strikes - 1),
    })
    .where(eq20(deliveryDrivers.userId, driverId));
  logger.info("Strike removed from driver", { driverId });
}
async function unblockDriver(driverId) {
  await db
    .update(deliveryDrivers)
    .set({
      isBlocked: false,
      blockedReason: null,
      blockedUntil: null,
      strikes: 0,
    })
    .where(eq20(deliveryDrivers.userId, driverId));
  logger.info("Driver unblocked", { driverId });
}
var init_strikeService = __esm({
  "server/strikeService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
    init_enhancedPushService();
  },
});

// server/giftCardService.ts
var giftCardService_exports = {};
__export(giftCardService_exports, {
  GiftCardService: () => GiftCardService,
});
import { eq as eq21, and as and8, or } from "drizzle-orm";
var GiftCardService;
var init_giftCardService = __esm({
  "server/giftCardService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    GiftCardService = class {
      static EXPIRY_DAYS = 30;
      static generateCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 16; i++) {
          if (i > 0 && i % 4 === 0) code += "-";
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      }
      // Crear gift card tras pago confirmado (llamado desde webhook Stripe o aprobación manual)
      static async purchaseGiftCard(data) {
        const {
          purchasedBy,
          amount,
          recipientEmail,
          recipientPhone,
          message,
          design = "default",
          activateImmediately = false,
        } = data;
        if (amount < 1e3)
          return { success: false, error: "Monto m\xEDnimo: \u20AC10" };
        const code = this.generateCode();
        const giftCardId = crypto.randomUUID();
        const expiresAt = activateImmediately
          ? new Date(Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1e3)
          : null;
        await db.insert(giftCards).values({
          id: giftCardId,
          code,
          amount,
          balance: activateImmediately ? amount : 0,
          status: activateImmediately ? "active" : "pending_payment",
          purchasedBy,
          recipientEmail: recipientEmail || null,
          recipientPhone: recipientPhone || null,
          message: message || null,
          design,
          expiresAt,
        });
        if (activateImmediately) {
          await db.insert(giftCardTransactions).values({
            id: crypto.randomUUID(),
            giftCardId,
            amount,
            balanceAfter: amount,
          });
        }
        return {
          success: true,
          giftCard: {
            id: giftCardId,
            code,
            amount: amount / 100,
            status: activateImmediately ? "active" : "pending_payment",
            expiresAt,
          },
        };
      }
      // Subir comprobante de pago para una gift card
      static async submitPaymentProof(data) {
        const {
          giftCardId,
          userId,
          paymentProvider,
          proofImageUrl,
          referenceNumber,
          amount,
        } = data;
        const [gc] = await db
          .select()
          .from(giftCards)
          .where(eq21(giftCards.id, giftCardId))
          .limit(1);
        if (!gc) return { success: false, error: "Gift card no encontrada" };
        if (gc.purchasedBy !== userId)
          return { success: false, error: "No autorizado" };
        if (gc.status !== "pending_payment")
          return {
            success: false,
            error: "Esta gift card ya tiene pago registrado",
          };
        await db.insert(paymentProofs).values({
          id: crypto.randomUUID(),
          orderId: null,
          giftCardId,
          userId,
          paymentProvider,
          proofImageUrl,
          referenceNumber: referenceNumber || null,
          amount,
          status: "pending",
        });
        return {
          success: true,
          message: "Comprobante enviado. El admin lo verificar\xE1 pronto.",
        };
      }
      // Admin: obtener gift cards pendientes de activación
      static async getPendingGiftCards() {
        const pending = await db
          .select()
          .from(giftCards)
          .where(
            or(
              eq21(giftCards.status, "pending_payment"),
              eq21(giftCards.status, "pending_verification"),
            ),
          );
        return {
          success: true,
          giftCards: pending.map((gc) => ({ ...gc, amount: gc.amount / 100 })),
        };
      }
      // Admin: activar gift card tras verificar pago
      static async activateGiftCard(giftCardId, adminId) {
        const [gc] = await db
          .select()
          .from(giftCards)
          .where(eq21(giftCards.id, giftCardId))
          .limit(1);
        if (!gc) return { success: false, error: "Gift card no encontrada" };
        const expiresAt = new Date(
          Date.now() + this.EXPIRY_DAYS * 24 * 60 * 60 * 1e3,
        );
        await db
          .update(giftCards)
          .set({
            status: "active",
            balance: gc.amount,
            expiresAt,
          })
          .where(eq21(giftCards.id, giftCardId));
        await db
          .update(paymentProofs)
          .set({
            status: "approved",
            verifiedBy: adminId,
            verifiedAt: /* @__PURE__ */ new Date(),
          })
          .where(
            and8(
              eq21(paymentProofs.giftCardId, giftCardId),
              eq21(paymentProofs.status, "pending"),
            ),
          );
        await db.insert(giftCardTransactions).values({
          id: crypto.randomUUID(),
          giftCardId,
          amount: gc.amount,
          balanceAfter: gc.amount,
        });
        return { success: true, message: "Gift card activada", expiresAt };
      }
      // Admin: rechazar gift card
      static async rejectGiftCard(giftCardId, adminId, reason) {
        await db
          .update(giftCards)
          .set({ status: "rejected" })
          .where(eq21(giftCards.id, giftCardId));
        await db
          .update(paymentProofs)
          .set({
            status: "rejected",
            verifiedBy: adminId,
            verifiedAt: /* @__PURE__ */ new Date(),
            verificationNotes: reason,
          })
          .where(
            and8(
              eq21(paymentProofs.giftCardId, giftCardId),
              eq21(paymentProofs.status, "pending"),
            ),
          );
        return { success: true, message: "Gift card rechazada" };
      }
      // Validar gift card en checkout
      static async validateGiftCard(code) {
        const [gc] = await db
          .select()
          .from(giftCards)
          .where(eq21(giftCards.code, code.toUpperCase()))
          .limit(1);
        if (!gc) return { success: false, error: "Tarjeta no encontrada" };
        if (gc.status !== "active")
          return {
            success: false,
            error:
              gc.status === "pending_payment"
                ? "Tarjeta pendiente de activaci\xF3n"
                : "Tarjeta no activa",
          };
        if (
          gc.expiresAt &&
          /* @__PURE__ */ new Date() > new Date(gc.expiresAt)
        ) {
          await db
            .update(giftCards)
            .set({ status: "expired" })
            .where(eq21(giftCards.id, gc.id));
          return { success: false, error: "Tarjeta expirada" };
        }
        if (gc.balance <= 0)
          return { success: false, error: "Tarjeta sin saldo" };
        return {
          success: true,
          giftCard: {
            id: gc.id,
            code: gc.code,
            balance: gc.balance / 100,
            amount: gc.amount / 100,
            expiresAt: gc.expiresAt,
          },
        };
      }
      // Canjear gift card en pedido
      static async redeemGiftCard(data) {
        const { code, orderId, amountToUse } = data;
        const validation = await this.validateGiftCard(code);
        if (!validation.success) return validation;
        const [gc] = await db
          .select()
          .from(giftCards)
          .where(eq21(giftCards.code, code.toUpperCase()))
          .limit(1);
        if (!gc || amountToUse > gc.balance)
          return { success: false, error: "Saldo insuficiente" };
        const newBalance = gc.balance - amountToUse;
        await db
          .update(giftCards)
          .set({
            balance: newBalance,
            redeemedAt: /* @__PURE__ */ new Date(),
            status: newBalance === 0 ? "redeemed" : "active",
          })
          .where(eq21(giftCards.id, gc.id));
        await db.insert(giftCardTransactions).values({
          id: crypto.randomUUID(),
          giftCardId: gc.id,
          orderId,
          amount: -amountToUse,
          balanceAfter: newBalance,
        });
        return {
          success: true,
          amountRedeemed: amountToUse / 100,
          remainingBalance: newBalance / 100,
        };
      }
      // Obtener gift cards del usuario
      static async getUserGiftCards(userId) {
        try {
          const purchased = await db
            .select()
            .from(giftCards)
            .where(eq21(giftCards.purchasedBy, userId));
          return {
            success: true,
            purchased: purchased.map((gc) => ({
              ...gc,
              amount: gc.amount / 100,
              balance: gc.balance / 100,
            })),
            redeemed: [],
          };
        } catch (error) {
          return { success: true, purchased: [], redeemed: [] };
        }
      }
      static async getDesigns() {
        try {
          const designs = await db
            .select()
            .from(giftCardDesigns)
            .where(eq21(giftCardDesigns.isActive, true))
            .orderBy(giftCardDesigns.displayOrder);
          return { success: true, designs };
        } catch {
          return { success: true, designs: [] };
        }
      }
      static async getTransactionHistory(giftCardId) {
        const transactions3 = await db
          .select()
          .from(giftCardTransactions)
          .where(eq21(giftCardTransactions.giftCardId, giftCardId));
        return {
          success: true,
          transactions: transactions3.map((t) => ({
            ...t,
            amount: t.amount / 100,
            balanceAfter: t.balanceAfter / 100,
          })),
        };
      }
    };
  },
});

// server/exchangeRateService.ts
var exchangeRateService_exports = {};
__export(exchangeRateService_exports, {
  ExchangeRateService: () => ExchangeRateService,
  exchangeRateService: () => exchangeRateService,
});
import { eq as eq22 } from "drizzle-orm";
var ExchangeRateService, exchangeRateService;
var init_exchangeRateService = __esm({
  "server/exchangeRateService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
    ExchangeRateService = class _ExchangeRateService {
      static instance;
      cachedRate = null;
      lastFetch = null;
      CACHE_DURATION_MS = 5 * 60 * 1e3;
      // 5 minutos
      FALLBACK_RATE = 36.5;
      constructor() {}
      static getInstance() {
        if (!_ExchangeRateService.instance) {
          _ExchangeRateService.instance = new _ExchangeRateService();
        }
        return _ExchangeRateService.instance;
      }
      /**
       * Obtiene la tasa USDT desde alcambio.app
       * Scraping del HTML ya que no tienen API pública
       */
      async fetchFromAlCambio() {
        try {
          logger.info("\u{1F4CA} Fetching USDT rate from alcambio.app...");
          const response = await fetch("https://alcambio.app/tasas", {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          if (!response.ok) {
            logger.warn(`\u274C AlCambio returned status ${response.status}`);
            return null;
          }
          const html = await response.text();
          const usdtMatch = html.match(
            /Tasa USDT[\s\S]*?Promedio[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*Bs/i,
          );
          if (usdtMatch && usdtMatch[1]) {
            const rateStr = usdtMatch[1].replace(/,/g, "");
            const rate = parseFloat(rateStr);
            if (!isNaN(rate) && rate > 0) {
              logger.info(`\u2705 USDT rate from AlCambio: ${rate} Bs`);
              return rate;
            }
          }
          logger.warn(
            "\u26A0\uFE0F Could not parse USDT rate from AlCambio HTML",
          );
          return null;
        } catch (error) {
          logger.error("\u274C Error fetching from AlCambio:", error.message);
          return null;
        }
      }
      /**
       * Obtiene la tasa manual configurada por el admin
       */
      async getManualRate() {
        try {
          const [setting] = await db
            .select()
            .from(systemSettings)
            .where(eq22(systemSettings.key, "usd_exchange_rate"))
            .limit(1);
          if (setting?.value) {
            const rate = parseFloat(setting.value);
            if (!isNaN(rate) && rate > 0) {
              return rate;
            }
          }
          return null;
        } catch (error) {
          logger.error("Error getting manual rate:", error);
          return null;
        }
      }
      /**
       * Verifica si el admin ha deshabilitado la actualización automática
       */
      async isAutoUpdateEnabled() {
        try {
          const [setting] = await db
            .select()
            .from(systemSettings)
            .where(eq22(systemSettings.key, "exchange_rate_auto_update"))
            .limit(1);
          return setting?.value !== "false";
        } catch (error) {
          return true;
        }
      }
      /**
       * Obtiene la tasa de cambio con la siguiente prioridad:
       * 1. Si auto-update está deshabilitado → tasa manual
       * 2. Si está habilitado → alcambio.app (con cache de 5 min)
       * 3. Fallback → tasa manual
       * 4. Fallback final → 36.50
       */
      async getCurrentRate() {
        const autoUpdateEnabled = await this.isAutoUpdateEnabled();
        if (!autoUpdateEnabled) {
          const manualRate2 = await this.getManualRate();
          if (manualRate2) {
            return {
              success: true,
              rate: manualRate2,
              source: "manual",
            };
          }
          return {
            success: true,
            rate: this.FALLBACK_RATE,
            source: "fallback",
          };
        }
        const now = /* @__PURE__ */ new Date();
        if (
          this.cachedRate &&
          this.lastFetch &&
          now.getTime() - this.lastFetch.getTime() < this.CACHE_DURATION_MS
        ) {
          return {
            success: true,
            rate: this.cachedRate,
            source: "alcambio",
            lastUpdated: this.lastFetch,
          };
        }
        const alcambioRate = await this.fetchFromAlCambio();
        if (alcambioRate) {
          this.cachedRate = alcambioRate;
          this.lastFetch = now;
          await this.saveRateToHistory(alcambioRate, "alcambio");
          return {
            success: true,
            rate: alcambioRate,
            source: "alcambio",
            lastUpdated: now,
          };
        }
        const manualRate = await this.getManualRate();
        if (manualRate) {
          return {
            success: true,
            rate: manualRate,
            source: "manual",
          };
        }
        return {
          success: true,
          rate: this.FALLBACK_RATE,
          source: "fallback",
        };
      }
      /**
       * Actualiza la tasa manual (solo admin)
       */
      async updateManualRate(rate, adminId) {
        try {
          if (rate <= 0) {
            return { success: false, message: "La tasa debe ser mayor a 0" };
          }
          const [existing] = await db
            .select()
            .from(systemSettings)
            .where(eq22(systemSettings.key, "usd_exchange_rate"))
            .limit(1);
          if (existing) {
            await db
              .update(systemSettings)
              .set({
                value: rate.toString(),
                updatedAt: /* @__PURE__ */ new Date(),
              })
              .where(eq22(systemSettings.key, "usd_exchange_rate"));
          } else {
            await db.insert(systemSettings).values({
              category: "currency",
              key: "usd_exchange_rate",
              value: rate.toString(),
              description: "Tasa de cambio BsD/USD manual",
            });
          }
          await this.saveRateToHistory(rate, "manual", adminId);
          this.cachedRate = null;
          this.lastFetch = null;
          logger.info(
            `\u{1F4B0} Exchange rate updated manually by ${adminId}: ${rate} Bs/USD`,
          );
          return {
            success: true,
            message: `Tasa actualizada a ${rate} Bs/USD`,
          };
        } catch (error) {
          logger.error("Error updating manual rate:", error);
          return { success: false, message: error.message };
        }
      }
      /**
       * Habilita/deshabilita la actualización automática
       */
      async toggleAutoUpdate(enabled, adminId) {
        try {
          const [existing] = await db
            .select()
            .from(systemSettings)
            .where(eq22(systemSettings.key, "exchange_rate_auto_update"))
            .limit(1);
          if (existing) {
            await db
              .update(systemSettings)
              .set({
                value: enabled ? "true" : "false",
                updatedAt: /* @__PURE__ */ new Date(),
              })
              .where(eq22(systemSettings.key, "exchange_rate_auto_update"));
          } else {
            await db.insert(systemSettings).values({
              category: "currency",
              key: "exchange_rate_auto_update",
              value: enabled ? "true" : "false",
              description:
                "Actualizaci\xF3n autom\xE1tica de tasa desde alcambio.app",
            });
          }
          logger.info(
            `\u{1F504} Auto-update ${enabled ? "enabled" : "disabled"} by ${adminId}`,
          );
          return {
            success: true,
            message: `Actualizaci\xF3n autom\xE1tica ${enabled ? "habilitada" : "deshabilitada"}`,
          };
        } catch (error) {
          logger.error("Error toggling auto-update:", error);
          return { success: false, message: error.message };
        }
      }
      /**
       * Guarda la tasa en un historial (opcional, para analytics)
       */
      async saveRateToHistory(rate, source, adminId) {
        try {
          logger.info(
            `\u{1F4CA} Rate saved to history: ${rate} Bs/USD (source: ${source})`,
          );
        } catch (error) {}
      }
      /**
       * Fuerza una actualización inmediata desde alcambio.app
       */
      async forceUpdate() {
        this.cachedRate = null;
        this.lastFetch = null;
        return await this.getCurrentRate();
      }
    };
    exchangeRateService = ExchangeRateService.getInstance();
  },
});

// server/cashSettlementService.ts
var cashSettlementService_exports = {};
__export(cashSettlementService_exports, {
  CashSettlementService: () => CashSettlementService,
  cashSettlementService: () => cashSettlementService,
});
import { eq as eq23, and as and9 } from "drizzle-orm";
var CashSettlementService, cashSettlementService;
var init_cashSettlementService = __esm({
  "server/cashSettlementService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_unifiedFinancialService();
    CashSettlementService = class {
      // Registrar deuda de efectivo al entregar pedido
      async registerCashDebt(
        orderId,
        driverId,
        businessId,
        total,
        deliveryFee,
      ) {
        const commissions = await financialService.calculateCommissions(
          total,
          deliveryFee,
        );
        const [business] = await db
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq23(businesses.id, businessId))
          .limit(1);
        const businessOwnerId = business?.ownerId || businessId;
        await db.transaction(async (tx) => {
          let [driverWallet] = await tx
            .select()
            .from(wallets)
            .where(eq23(wallets.userId, driverId))
            .limit(1);
          if (!driverWallet) {
            await tx.insert(wallets).values({
              userId: driverId,
              balance: 0,
              pendingBalance: 0,
              cashOwed: 0,
              cashPending: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
            });
            [driverWallet] = await tx
              .select()
              .from(wallets)
              .where(eq23(wallets.userId, driverId))
              .limit(1);
          }
          const debtAmount = commissions.business + commissions.platform;
          await tx
            .update(wallets)
            .set({
              balance: driverWallet.balance + commissions.driver,
              cashOwed: driverWallet.cashOwed + debtAmount,
              totalEarned: driverWallet.totalEarned + commissions.driver,
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq23(wallets.userId, driverId));
          let [businessWallet] = await tx
            .select()
            .from(wallets)
            .where(eq23(wallets.userId, businessOwnerId))
            .limit(1);
          if (!businessWallet) {
            await tx.insert(wallets).values({
              userId: businessOwnerId,
              balance: 0,
              pendingBalance: 0,
              cashOwed: 0,
              cashPending: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
            });
            [businessWallet] = await tx
              .select()
              .from(wallets)
              .where(eq23(wallets.userId, businessOwnerId))
              .limit(1);
          }
          await tx
            .update(wallets)
            .set({
              cashPending: businessWallet.cashPending + commissions.business,
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq23(wallets.userId, businessOwnerId));
          await tx.insert(transactions).values([
            {
              walletId: driverWallet.id,
              userId: driverId,
              orderId,
              type: "delivery_payment",
              amount: commissions.driver,
              balanceBefore: driverWallet.balance,
              balanceAfter: driverWallet.balance + commissions.driver,
              description: `Delivery en efectivo - Pedido #${orderId.slice(-8)}`,
              status: "completed",
            },
            {
              walletId: driverWallet.id,
              userId: driverId,
              orderId,
              type: "cash_debt",
              amount: -debtAmount,
              balanceBefore: driverWallet.cashOwed,
              balanceAfter: driverWallet.cashOwed + debtAmount,
              description: `Efectivo a liquidar - Pedido #${orderId.slice(-8)}`,
              status: "pending",
            },
          ]);
        });
      }
      // Descuento automático de futuras ganancias con tarjeta
      async autoDeductCashDebt(driverId, orderId, earnings) {
        const [driverWallet] = await db
          .select()
          .from(wallets)
          .where(eq23(wallets.userId, driverId))
          .limit(1);
        if (!driverWallet || driverWallet.cashOwed === 0) {
          return { netEarnings: earnings, debtPaid: 0 };
        }
        const debtPayment = Math.min(earnings, driverWallet.cashOwed);
        const netEarnings = earnings - debtPayment;
        await db.transaction(async (tx) => {
          await tx
            .update(wallets)
            .set({
              balance: driverWallet.balance + netEarnings,
              cashOwed: driverWallet.cashOwed - debtPayment,
              totalEarned: driverWallet.totalEarned + earnings,
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq23(wallets.userId, driverId));
          await tx.insert(transactions).values({
            walletId: driverWallet.id,
            userId: driverId,
            orderId,
            type: "cash_debt_payment",
            amount: -debtPayment,
            balanceBefore: driverWallet.cashOwed,
            balanceAfter: driverWallet.cashOwed - debtPayment,
            description: `Descuento autom\xE1tico de deuda - Pedido #${orderId.slice(-6)}`,
            status: "completed",
          });
          if (debtPayment > 0) {
            await this.settleCashToBusinesses(tx, driverId, debtPayment);
          }
        });
        return { netEarnings, debtPaid: debtPayment };
      }
      // Liberar fondos al negocio cuando se liquida efectivo
      async settleCashToBusinesses(tx, driverId, amount) {
        const cashOrders = await tx
          .select()
          .from(orders)
          .where(
            and9(
              eq23(orders.deliveryPersonId, driverId),
              eq23(orders.paymentMethod, "cash"),
              eq23(orders.status, "delivered"),
              eq23(orders.cashSettled, false),
            ),
          )
          .orderBy(orders.deliveredAt);
        let remainingAmount = amount;
        for (const order of cashOrders) {
          if (remainingAmount <= 0) break;
          const commissions = await financialService.calculateCommissions(
            order.total,
            order.deliveryFee,
          );
          const orderDebt = commissions.business + commissions.platform;
          if (remainingAmount >= orderDebt) {
            const [business] = await tx
              .select({ ownerId: businesses.ownerId })
              .from(businesses)
              .where(eq23(businesses.id, order.businessId))
              .limit(1);
            const businessOwnerId = business?.ownerId || order.businessId;
            const [businessWallet] = await tx
              .select()
              .from(wallets)
              .where(eq23(wallets.userId, businessOwnerId))
              .limit(1);
            if (businessWallet) {
              await tx
                .update(wallets)
                .set({
                  cashPending:
                    businessWallet.cashPending - commissions.business,
                  updatedAt: /* @__PURE__ */ new Date(),
                })
                .where(eq23(wallets.userId, businessOwnerId));
              await tx.insert(transactions).values({
                walletId: businessWallet.id,
                userId: businessOwnerId,
                orderId: order.id,
                type: "cash_settlement",
                amount: commissions.business,
                balanceBefore: businessWallet.balance,
                balanceAfter: businessWallet.balance,
                description: `Efectivo liquidado - Pedido #${order.id.slice(-8)}`,
                status: "completed",
              });
            }
            await tx
              .update(orders)
              .set({
                cashSettled: true,
                cashSettledAt: /* @__PURE__ */ new Date(),
              })
              .where(eq23(orders.id, order.id));
            remainingAmount -= orderDebt;
          }
        }
      }
      // Obtener deuda pendiente del repartidor
      async getDriverDebt(driverId) {
        const [wallet] = await db
          .select()
          .from(wallets)
          .where(eq23(wallets.userId, driverId))
          .limit(1);
        if (!wallet || wallet.cashOwed === 0) {
          return { totalDebt: 0, pendingOrders: [] };
        }
        const cashOrders = await db
          .select()
          .from(orders)
          .where(
            and9(
              eq23(orders.deliveryPersonId, driverId),
              eq23(orders.paymentMethod, "cash"),
              eq23(orders.status, "delivered"),
              eq23(orders.cashSettled, false),
            ),
          )
          .orderBy(orders.deliveredAt);
        const pendingOrders = await Promise.all(
          cashOrders.map(async (order) => {
            const commissions = await financialService.calculateCommissions(
              order.total,
              order.deliveryFee,
            );
            return {
              orderId: order.id,
              amount: commissions.business + commissions.platform,
              deliveredAt: order.deliveredAt,
              businessName: order.businessName,
            };
          }),
        );
        return {
          totalDebt: wallet.cashOwed,
          pendingOrders,
        };
      }
    };
    cashSettlementService = new CashSettlementService();
  },
});

// server/withdrawalService.ts
var withdrawalService_exports = {};
__export(withdrawalService_exports, {
  WithdrawalService: () => WithdrawalService,
  cancelWithdrawal: () => cancelWithdrawal,
  getWalletBalance: () => getWalletBalance,
  getWithdrawalHistory: () => getWithdrawalHistory,
  requestWithdrawal: () => requestWithdrawal,
  withdrawalService: () => withdrawalService,
});
import { eq as eq24, and as and10, desc as desc5 } from "drizzle-orm";
async function getWalletBalance(userId) {
  try {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq24(wallets.userId, userId))
      .limit(1);
    if (!wallet) {
      await db.insert(wallets).values({
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        cashOwed: 0,
      });
      return {
        success: true,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        cashOwed: 0,
        availableForWithdrawal: 0,
      };
    }
    const availableForWithdrawal = Math.max(
      0,
      wallet.balance - (wallet.cashOwed || 0),
    );
    return {
      success: true,
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance || 0,
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      cashOwed: wallet.cashOwed || 0,
      availableForWithdrawal,
    };
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    throw new Error("Error al obtener balance de wallet");
  }
}
async function getWithdrawalHistory(userId) {
  try {
    const withdrawals2 = await db
      .select({
        id: withdrawalRequests.id,
        amount: withdrawalRequests.amount,
        method: withdrawalRequests.method,
        status: withdrawalRequests.status,
        requestedAt: withdrawalRequests.requestedAt,
        completedAt: withdrawalRequests.completedAt,
        errorMessage: withdrawalRequests.errorMessage,
      })
      .from(withdrawalRequests)
      .where(eq24(withdrawalRequests.userId, userId))
      .orderBy(desc5(withdrawalRequests.requestedAt));
    return {
      success: true,
      withdrawals: withdrawals2,
    };
  } catch (error) {
    console.error("Error getting withdrawal history:", error);
    throw new Error("Error al obtener historial de retiros");
  }
}
async function requestWithdrawal(request) {
  return await withdrawalService.requestWithdrawal(request);
}
async function cancelWithdrawal(withdrawalId, userId) {
  try {
    const [withdrawal] = await db
      .select()
      .from(withdrawalRequests)
      .where(
        and10(
          eq24(withdrawalRequests.id, withdrawalId),
          eq24(withdrawalRequests.userId, userId),
          eq24(withdrawalRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (!withdrawal) {
      throw new Error(
        "Solicitud de retiro no encontrada o no se puede cancelar",
      );
    }
    await db
      .update(withdrawalRequests)
      .set({
        status: "cancelled",
        completedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq24(withdrawalRequests.id, withdrawalId));
    return {
      success: true,
      message: "Solicitud de retiro cancelada",
    };
  } catch (error) {
    console.error("Error cancelling withdrawal:", error);
    throw new Error("Error al cancelar retiro");
  }
}
var WithdrawalService, withdrawalService;
var init_withdrawalService = __esm({
  "server/withdrawalService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    WithdrawalService = class {
      async requestWithdrawal(request) {
        const { financialService: financialService2 } =
          await Promise.resolve().then(
            () => (
              init_unifiedFinancialService(),
              unifiedFinancialService_exports
            ),
          );
        const { users: users7 } = await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
        const [user] = await db
          .select()
          .from(users7)
          .where(eq24(users7.id, request.userId))
          .limit(1);
        if (!user) {
          throw new Error("Usuario no encontrado");
        }
        const canWithdraw = await financialService2.canUserWithdraw(
          request.userId,
          user.role,
        );
        if (!canWithdraw.allowed) {
          throw new Error(
            canWithdraw.reason || "No puedes retirar en este momento",
          );
        }
        const wallet = await financialService2.getWallet(request.userId);
        const availableBalance = wallet.balance - (wallet.cashOwed || 0);
        if (request.amount > availableBalance) {
          throw new Error("Saldo insuficiente");
        }
        await db.insert(withdrawalRequests).values({
          userId: request.userId,
          walletId: wallet.id,
          amount: request.amount,
          method: request.method,
          pagoMovilPhone: request.pagoMovilPhone,
          pagoMovilBank: request.pagoMovilBank,
          pagoMovilCedula: request.pagoMovilCedula,
          bankAccountNumber: request.bankAccount?.accountNumber,
          bankName: request.bankAccount?.bankName,
          accountHolder: request.bankAccount?.accountHolder,
          accountType: request.bankAccount?.accountType,
          status: "pending",
          requestedAt: /* @__PURE__ */ new Date(),
        });
        const [withdrawal] = await db
          .select()
          .from(withdrawalRequests)
          .where(eq24(withdrawalRequests.userId, request.userId))
          .orderBy(desc5(withdrawalRequests.requestedAt))
          .limit(1);
        return withdrawal;
      }
      async getWithdrawalHistory(userId) {
        return await db
          .select({
            id: withdrawalRequests.id,
            amount: withdrawalRequests.amount,
            method: withdrawalRequests.method,
            status: withdrawalRequests.status,
            requestedAt: withdrawalRequests.requestedAt,
            completedAt: withdrawalRequests.completedAt,
            errorMessage: withdrawalRequests.errorMessage,
          })
          .from(withdrawalRequests)
          .where(eq24(withdrawalRequests.userId, userId))
          .orderBy(desc5(withdrawalRequests.requestedAt));
      }
      // Admin: Aprobar retiro bancario manual
      async approveWithdrawal(withdrawalId, adminId) {
        const [withdrawal] = await db
          .select()
          .from(withdrawalRequests)
          .where(eq24(withdrawalRequests.id, withdrawalId))
          .limit(1);
        if (!withdrawal || withdrawal.status !== "pending") {
          throw new Error("Solicitud no v\xE1lida");
        }
        await db.transaction(async (tx) => {
          await tx
            .update(withdrawalRequests)
            .set({
              status: "completed",
              completedAt: /* @__PURE__ */ new Date(),
              approvedBy: adminId,
            })
            .where(eq24(withdrawalRequests.id, withdrawalId));
          await tx
            .update(wallets)
            .set({
              balance: db.raw(`balance - ${withdrawal.amount}`),
            })
            .where(eq24(wallets.userId, withdrawal.userId));
        });
        return { success: true };
      }
    };
    withdrawalService = new WithdrawalService();
  },
});

// server/weeklySettlementService.ts
import { sql as sql4 } from "drizzle-orm";
var WeeklySettlementService;
var init_weeklySettlementService = __esm({
  "server/weeklySettlementService.ts"() {
    "use strict";
    init_db();
    init_logger();
    WeeklySettlementService = class {
      static getRows(result) {
        if (Array.isArray(result)) {
          return Array.isArray(result[0]) ? result[0] : result;
        }
        return result?.rows || [];
      }
      /**
       * FLUJO RESTRICTIVO VIERNES: Cierra la semana y crea liquidaciones
       * Se ejecuta cada viernes a las 11:59 PM
       * BLOQUEA inmediatamente a drivers con deuda para forzar liquidación
       */
      static async closeWeek() {
        const today = /* @__PURE__ */ new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        const weekEnd = new Date(today);
        const driversWithDebt = await db.execute(sql4`
      SELECT w.user_id, w.cash_owed, u.name, u.phone
      FROM wallets w
      JOIN users u ON w.user_id = u.id
      WHERE w.cash_owed > 0
    `);
        let settlementsCreated = 0;
        const driverRows = this.getRows(driversWithDebt);
        for (const driver of driverRows) {
          await db.execute(sql4`
        INSERT INTO weekly_settlements 
        (id, driver_id, week_start, week_end, amount_owed, status, created_at, deadline)
        VALUES (UUID(), ${driver.user_id}, ${weekStart.toISOString().split("T")[0]}, 
                ${weekEnd.toISOString().split("T")[0]}, ${driver.cash_owed}, 'pending', NOW(), 
                DATE_ADD(NOW(), INTERVAL 48 HOUR))
      `);
          await db.execute(sql4`
        UPDATE users 
        SET is_active = 0, blocked_reason = CONCAT('Deuda semanal: $', ${(driver.cash_owed / 100).toFixed(2)}, '. Liquida antes del lunes.')
        WHERE id = ${driver.user_id}
      `);
          await db.execute(sql4`
        UPDATE delivery_drivers 
        SET is_available = 0 
        WHERE user_id = ${driver.user_id}
      `);
          settlementsCreated++;
          logger.info(
            `\u{1F6AB} Driver ${driver.name} bloqueado por deuda: $${(driver.cash_owed / 100).toFixed(2)}`,
          );
        }
        await db.execute(sql4`
      INSERT INTO audit_logs (action, details, created_at)
      VALUES ('weekly_close', JSON_OBJECT('settlements_created', ${settlementsCreated}, 'drivers_blocked', ${settlementsCreated}), NOW())
    `);
        console.log(
          `\u2705 FLUJO RESTRICTIVO: Semana cerrada. ${settlementsCreated} drivers bloqueados hasta liquidar.`,
        );
        return {
          success: true,
          count: settlementsCreated,
          blocked: settlementsCreated,
        };
      }
      /**
       * BLOQUEO LUNES: Bloquea drivers que no pagaron en 48 horas
       * Se ejecuta cada lunes a las 12:00 AM
       * Garantiza que cuentas se bloqueen si no liquidan
       */
      static async blockUnpaidDrivers() {
        const now = /* @__PURE__ */ new Date();
        const overdueSettlements = await db.execute(sql4`
      SELECT DISTINCT ws.driver_id, ws.amount_owed, u.name, u.phone
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.status = 'pending' 
      AND ws.deadline < NOW()
      AND u.is_active = 1
    `);
        let driversBlocked = 0;
        const overdueRows = this.getRows(overdueSettlements);
        for (const settlement of overdueRows) {
          await db.execute(sql4`
        UPDATE users 
        SET is_active = 0, 
            blocked_reason = CONCAT('Deuda vencida: $', ${(settlement.amount_owed / 100).toFixed(2)}, '. Contacta soporte para reactivar.'),
            blocked_at = NOW()
        WHERE id = ${settlement.driver_id}
      `);
          await db.execute(sql4`
        UPDATE delivery_drivers 
        SET is_available = 0, 
            blocked_reason = 'Deuda vencida sin liquidar'
        WHERE user_id = ${settlement.driver_id}
      `);
          await db.execute(sql4`
        UPDATE weekly_settlements 
        SET status = 'overdue', 
            notes = 'Driver bloqueado por falta de pago'
        WHERE driver_id = ${settlement.driver_id} AND status = 'pending'
      `);
          driversBlocked++;
          logger.error(
            `\u{1F6AB} Driver ${settlement.name} BLOQUEADO por deuda vencida: $${(settlement.amount_owed / 100).toFixed(2)}`,
          );
        }
        await db.execute(sql4`
      INSERT INTO audit_logs (action, details, created_at)
      VALUES ('monday_block', JSON_OBJECT('drivers_blocked', ${driversBlocked}), NOW())
    `);
        console.log(
          `\u{1F6AB} BLOQUEO LUNES: ${driversBlocked} drivers bloqueados por falta de pago.`,
        );
        return { success: true, blocked: driversBlocked };
      }
      /**
       * Obtener liquidación pendiente del driver
       */
      static async getDriverPendingSettlement(driverId) {
        const result = await db.execute(sql4`
      SELECT * FROM weekly_settlements 
      WHERE driver_id = ${driverId} 
      AND status IN ('pending', 'submitted')
      ORDER BY created_at DESC 
      LIMIT 1
    `);
        const rows = this.getRows(result);
        return rows[0] || null;
      }
      /**
       * Driver sube comprobante de pago
       */
      static async submitPaymentProof(settlementId, proofUrl) {
        await db.execute(sql4`
      UPDATE weekly_settlements 
      SET status = 'submitted', 
          payment_proof_url = ${proofUrl},
          submitted_at = NOW()
      WHERE id = ${settlementId}
    `);
        return { success: true };
      }
      /**
       * Admin aprueba liquidación - marca payout como pagado y desbloquea driver
       */
      static async approveSettlement(settlementId, adminId) {
        const result = await db.execute(sql4`
      SELECT ws.driver_id, ws.amount_owed, u.name
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.id = ${settlementId}
    `);
        const rows = this.getRows(result);
        const settlement = rows[0];
        if (!settlement) throw new Error("Liquidaci\xF3n no encontrada");
        await db.execute(sql4`
      UPDATE weekly_settlements 
      SET status = 'approved', approved_at = NOW(), approved_by = ${adminId}
      WHERE id = ${settlementId}
    `);
        await db.execute(sql4`
      UPDATE wallets 
      SET cash_owed = GREATEST(0, cash_owed - ${settlement.amount_owed})
      WHERE user_id = ${settlement.driver_id}
    `);
        await db.execute(sql4`
      UPDATE users SET is_active = 1, blocked_reason = NULL WHERE id = ${settlement.driver_id}
    `);
        await db.execute(sql4`
      UPDATE delivery_drivers SET is_available = 1, blocked_reason = NULL WHERE user_id = ${settlement.driver_id}
    `);
        logger.info(
          `\u2705 Liquidaci\xF3n aprobada: ${settlement.name} - $${(settlement.amount_owed / 100).toFixed(2)}`,
        );
        return { success: true };
      }
      /**
       * Admin rechaza liquidación
       */
      static async rejectSettlement(settlementId, adminId, notes) {
        await db.execute(sql4`
      UPDATE weekly_settlements 
      SET status = 'rejected', 
          approved_by = ${adminId},
          notes = ${notes},
          approved_at = NOW()
      WHERE id = ${settlementId}
    `);
        return { success: true };
      }
      /**
       * Obtener todas las liquidaciones pendientes (Admin)
       */
      static async getAllPendingSettlements() {
        const result = await db.execute(sql4`
      SELECT ws.*, u.name as driver_name, u.phone as driver_phone
      FROM weekly_settlements ws
      JOIN users u ON ws.driver_id = u.id
      WHERE ws.status IN ('pending', 'submitted')
      ORDER BY ws.created_at DESC
    `);
        return this.getRows(result);
      }
      /**
       * Calcular ganancias semanales del driver para transferencia Stripe
       */
      static async calculateDriverWeeklyEarnings(driverId) {
        const weekAgo = /* @__PURE__ */ new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const result = await db.execute(sql4`
      SELECT COALESCE(SUM(delivery_earnings), 0) as total_earnings
      FROM orders 
      WHERE delivery_person_id = ${driverId}
      AND status = 'delivered'
      AND delivered_at >= ${weekAgo.toISOString()}
      AND payment_method = 'card'
    `);
        const earnings = result.rows[0]?.total_earnings || 0;
        return Math.max(0, earnings);
      }
      /**
       * Obtener historial completo de transacciones para auditoría
       */
      static async getTransactionHistory(driverId, limit = 100) {
        let query = sql4`
      SELECT 
        t.id,
        t.type,
        t.amount,
        t.description,
        t.status,
        t.created_at,
        t.order_id,
        u.name as user_name,
        o.total as order_total,
        o.payment_method
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN orders o ON t.order_id = o.id
    `;
        if (driverId) {
          query = sql4`${query} WHERE t.user_id = ${driverId}`;
        }
        query = sql4`${query} ORDER BY t.created_at DESC LIMIT ${limit}`;
        const result = await db.execute(query);
        return result.rows;
      }
    };
  },
});

// server/errors.ts
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
var AppError, ValidationError, AuthorizationError, NotFoundError;
var init_errors = __esm({
  "server/errors.ts"() {
    "use strict";
    init_logger();
    init_env();
    AppError = class _AppError extends Error {
      constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, _AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
      }
    };
    ValidationError = class extends AppError {
      constructor(message) {
        super(400, message);
      }
    };
    AuthorizationError = class extends AppError {
      constructor(message = "Insufficient permissions") {
        super(403, message);
      }
    };
    NotFoundError = class extends AppError {
      constructor(resource = "Resource") {
        super(404, `${resource} not found`);
      }
    };
  },
});

// server/arrivingStatusService.ts
var arrivingStatusService_exports = {};
__export(arrivingStatusService_exports, {
  checkAllActiveOrdersForArriving: () => checkAllActiveOrdersForArriving,
  checkAndUpdateArrivingStatus: () => checkAndUpdateArrivingStatus,
});
import { eq as eq32, and as and12, inArray as inArray2 } from "drizzle-orm";
function calculateDistance2(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad2(lat2 - lat1);
  const dLon = toRad2(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad2(lat1)) *
      Math.cos(toRad2(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad2(degrees) {
  return degrees * (Math.PI / 180);
}
async function checkAndUpdateArrivingStatus(orderId, driverLat, driverLng) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq32(orders.id, orderId))
    .limit(1);
  if (!order || !order.deliveryLatitude || !order.deliveryLongitude) {
    return false;
  }
  if (!["picked_up", "on_the_way", "in_transit"].includes(order.status)) {
    return false;
  }
  const deliveryLat = parseFloat(order.deliveryLatitude);
  const deliveryLng = parseFloat(order.deliveryLongitude);
  const distance = calculateDistance2(
    driverLat,
    driverLng,
    deliveryLat,
    deliveryLng,
  );
  if (distance <= 0.5) {
    await db
      .update(orders)
      .set({ status: "arriving" })
      .where(eq32(orders.id, orderId));
    return true;
  }
  return false;
}
async function checkAllActiveOrdersForArriving() {
  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      and12(
        inArray2(orders.status, ["picked_up", "on_the_way", "in_transit"]),
        eq32(orders.deliveryPersonId, null),
        // Tiene driver asignado
      ),
    );
  for (const order of activeOrders) {
    if (!order.deliveryPersonId) continue;
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq32(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);
    if (
      driver &&
      driver.currentLatitude &&
      driver.currentLongitude &&
      order.deliveryLatitude &&
      order.deliveryLongitude
    ) {
      await checkAndUpdateArrivingStatus(
        order.id,
        parseFloat(driver.currentLatitude),
        parseFloat(driver.currentLongitude),
      );
    }
  }
}
var init_arrivingStatusService = __esm({
  "server/arrivingStatusService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
  },
});

// server/commissionService.ts
var commissionService_exports = {};
__export(commissionService_exports, {
  calculateAndDistributeCommissions: () => calculateAndDistributeCommissions,
  releasePendingFunds: () => releasePendingFunds,
});
import { eq as eq33 } from "drizzle-orm";
async function calculateAndDistributeCommissions(orderId) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq33(orders.id, orderId))
    .limit(1);
  if (!order) {
    throw new AppError(404, `Order ${orderId} not found`);
  }
  if (order.status !== "delivered") {
    throw new AppError(400, `Order ${orderId} is not delivered yet`);
  }
  if (order.platformFee && order.businessEarnings && order.deliveryEarnings) {
    logger.warn("Commissions already calculated", { orderId });
    return;
  }
  const commissions = await financialService.calculateCommissions(
    order.total,
    order.deliveryFee || 0,
  );
  const totalCommissions =
    commissions.platform + commissions.business + commissions.driver;
  if (totalCommissions !== order.total) {
    logger.error("Commission distribution validation failed", {
      orderId,
      total: order.total,
      distributed: totalCommissions,
      breakdown: commissions,
    });
    throw new AppError(
      500,
      `Commission sum mismatch: total ${order.total}, distributed ${totalCommissions}`,
    );
  }
  await db
    .update(orders)
    .set({
      platformFee: commissions.platform,
      businessEarnings: commissions.business,
      deliveryEarnings: commissions.driver,
    })
    .where(eq33(orders.id, orderId));
  await distributeToWallets(order, commissions.business, commissions.driver);
  logger.payment("Commissions calculated and distributed", {
    orderId,
    total: order.total,
    platformFee: commissions.platform,
    businessEarnings: commissions.business,
    deliveryEarnings: commissions.driver,
  });
}
async function distributeToWallets(order, businessEarnings, deliveryEarnings) {
  try {
    const isCash = order.paymentMethod === "cash";
    await financialService.updateWalletBalance(
      order.businessId,
      businessEarnings,
      isCash ? "cash_income" : "income",
      order.id,
      `Earnings from order #${order.id.slice(-6)}${isCash ? " (efectivo)" : ""}`,
    );
    if (order.deliveryPersonId) {
      if (isCash) {
        await financialService.updateWalletBalance(
          order.deliveryPersonId,
          deliveryEarnings,
          "cash_income",
          order.id,
          `Comisi\xF3n de entrega - Pedido #${order.id.slice(-6)} (efectivo cobrado)`,
        );
        const platformFee = order.platformFee || Math.round(order.total * 0.15);
        const debtAmount = order.total - deliveryEarnings;
        await financialService.updateCashOwed(
          order.deliveryPersonId,
          debtAmount,
          order.id,
          `Deuda por pedido #${order.id.slice(-6)} en efectivo`,
        );
      } else {
        await financialService.updateWalletBalance(
          order.deliveryPersonId,
          deliveryEarnings,
          "income",
          order.id,
          `Comisi\xF3n de entrega - Pedido #${order.id.slice(-6)}`,
        );
      }
    }
  } catch (error) {
    logger.error("Error distributing to wallets", { orderId: order.id, error });
    throw error;
  }
}
async function releasePendingFunds(orderId) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq33(orders.id, orderId))
    .limit(1);
  if (!order || !order.businessEarnings) return;
  logger.payment("Funds released immediately", {
    orderId,
    amount: order.businessEarnings,
  });
}
var init_commissionService = __esm({
  "server/commissionService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
    init_errors();
    init_unifiedFinancialService();
  },
});

// server/metricsService.ts
var metricsService_exports = {};
__export(metricsService_exports, {
  calculateETAAccuracy: () => calculateETAAccuracy,
  updateBusinessPrepTimeMetrics: () => updateBusinessPrepTimeMetrics,
  updateDriverSpeedMetrics: () => updateDriverSpeedMetrics,
});
import { eq as eq34, sql as sql7 } from "drizzle-orm";
async function updateBusinessPrepTimeMetrics(businessId) {
  const completedOrders = await db
    .select()
    .from(orders)
    .where(
      sql7`business_id = ${businessId} AND status = 'delivered' AND actual_prep_time IS NOT NULL`,
    )
    .limit(50);
  if (completedOrders.length === 0) return;
  const avgPrepTime = Math.round(
    completedOrders.reduce((sum3, o) => sum3 + (o.actualPrepTime || 0), 0) /
      completedOrders.length,
  );
  await db
    .update(businesses)
    .set({ avgPrepTime })
    .where(eq34(businesses.id, businessId));
  console.log(
    `\u{1F4CA} Business ${businessId} avg prep time updated: ${avgPrepTime} min`,
  );
}
async function updateDriverSpeedMetrics(driverId) {
  const completedDeliveries = await db
    .select()
    .from(orders)
    .where(
      sql7`delivery_person_id = ${driverId} AND status = 'delivered' AND actual_delivery_time IS NOT NULL`,
    )
    .limit(50);
  if (completedDeliveries.length === 0) return;
  let totalSpeed = 0;
  let validDeliveries = 0;
  for (const order of completedDeliveries) {
    if (order.actualDeliveryTime && order.actualDeliveryTime > 0) {
      const estimatedDistance = 3;
      const timeInHours = order.actualDeliveryTime / 60;
      const speed = estimatedDistance / timeInHours;
      if (speed > 5 && speed < 60) {
        totalSpeed += speed;
        validDeliveries++;
      }
    }
  }
  if (validDeliveries > 0) {
    const avgSpeed = totalSpeed / validDeliveries;
    await db
      .update(deliveryDrivers)
      .set({ avgSpeed: Math.round(avgSpeed * 100) / 100 })
      .where(eq34(deliveryDrivers.userId, driverId));
    console.log(
      `\u{1F4CA} Driver ${driverId} avg speed updated: ${avgSpeed.toFixed(2)} km/h`,
    );
  }
}
async function calculateETAAccuracy(orderId) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq34(orders.id, orderId))
    .limit(1);
  if (
    !order ||
    !order.estimatedTotalTime ||
    !order.deliveredAt ||
    !order.createdAt
  ) {
    return 0;
  }
  const actualTime = Math.floor(
    (new Date(order.deliveredAt).getTime() -
      new Date(order.createdAt).getTime()) /
      6e4,
  );
  const estimatedTime = order.estimatedTotalTime;
  const difference = Math.abs(actualTime - estimatedTime);
  const accuracy = Math.max(0, 100 - (difference / estimatedTime) * 100);
  return Math.round(accuracy);
}
var init_metricsService = __esm({
  "server/metricsService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
  },
});

// server/payoutService.ts
var payoutService_exports = {};
__export(payoutService_exports, {
  createPayoutsForOrder: () => createPayoutsForOrder,
  deletePaymentAccount: () => deletePaymentAccount,
  getPayoutHistory: () => getPayoutHistory,
  getPendingPayouts: () => getPendingPayouts,
  getUserPaymentAccounts: () => getUserPaymentAccounts,
  markPayoutPaid: () => markPayoutPaid,
  savePaymentAccount: () => savePaymentAccount,
});
import { eq as eq38, and as and17 } from "drizzle-orm";
async function createPayoutsForOrder(orderId) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq38(orders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Pedido no encontrado");
  const existing = await db
    .select()
    .from(payouts)
    .where(eq38(payouts.orderId, orderId));
  if (existing.length > 0) return;
  const inserts = [];
  if (order.businessEarnings && order.businessEarnings > 0) {
    const account = await getDefaultAccount(order.businessId);
    inserts.push({
      orderId,
      recipientId: order.businessId,
      recipientType: "business",
      amount: order.businessEarnings,
      method: account?.method || null,
      accountSnapshot: account ? JSON.stringify(account) : null,
      status: "pending",
    });
  }
  if (
    order.deliveryPersonId &&
    order.deliveryEarnings &&
    order.deliveryEarnings > 0
  ) {
    const account = await getDefaultAccount(order.deliveryPersonId);
    inserts.push({
      orderId,
      recipientId: order.deliveryPersonId,
      recipientType: "driver",
      amount: order.deliveryEarnings,
      method: account?.method || null,
      accountSnapshot: account ? JSON.stringify(account) : null,
      status: "pending",
    });
  }
  if (inserts.length > 0) {
    await db.insert(payouts).values(inserts);
    logger.info(`\u{1F4B0} Payouts created for order ${orderId}`, {
      count: inserts.length,
    });
  }
}
async function markPayoutPaid(payoutId, adminId, notes) {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq38(payouts.id, payoutId))
    .limit(1);
  if (!payout) throw new Error("Payout no encontrado");
  if (payout.status === "paid") throw new Error("Ya fue marcado como pagado");
  await db
    .update(payouts)
    .set({
      status: "paid",
      paidBy: adminId,
      paidAt: /* @__PURE__ */ new Date(),
      notes: notes || null,
    })
    .where(eq38(payouts.id, payoutId));
  await db.insert(transactions).values({
    orderId: payout.orderId,
    userId: payout.recipientId,
    type: "payout_paid",
    amount: payout.amount,
    description: `Pago enviado por admin - Pedido #${payout.orderId.slice(-6)}`,
    status: "completed",
    metadata: JSON.stringify({
      payoutId,
      adminId,
      method: payout.method,
      notes,
    }),
  });
  logger.info(`\u2705 Payout ${payoutId} marked as paid by admin ${adminId}`);
}
async function getPendingPayouts() {
  const rows = await db.execute(
    db
      .select({
        id: payouts.id,
        orderId: payouts.orderId,
        recipientId: payouts.recipientId,
        recipientType: payouts.recipientType,
        amount: payouts.amount,
        method: payouts.method,
        accountSnapshot: payouts.accountSnapshot,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .where(eq38(payouts.status, "pending"))
      .toSQL(),
  );
  return rows;
}
async function getPayoutHistory(recipientId) {
  return db
    .select()
    .from(payouts)
    .where(eq38(payouts.recipientId, recipientId));
}
async function getDefaultAccount(userId) {
  const [account] = await db
    .select()
    .from(paymentAccounts)
    .where(
      and17(
        eq38(paymentAccounts.userId, userId),
        eq38(paymentAccounts.isDefault, true),
      ),
    )
    .limit(1);
  return account || null;
}
async function savePaymentAccount(userId, data) {
  if (data.isDefault) {
    await db
      .update(paymentAccounts)
      .set({ isDefault: false })
      .where(
        and17(
          eq38(paymentAccounts.userId, userId),
          eq38(paymentAccounts.method, data.method),
        ),
      );
  }
  await db.insert(paymentAccounts).values({
    userId,
    method: data.method,
    isDefault: data.isDefault ?? false,
    label: data.label || null,
    pagoMovilPhone: data.pagoMovilPhone || null,
    binanceId: data.binanceId || null,
    zelleEmail: data.zelleEmail || null,
    zinliEmail: data.zinliEmail || null,
    zellePhone: data.zellePhone || null,
    // No usados en España
    pagoMovilBank: null,
    pagoMovilCedula: null,
    binanceEmail: null,
  });
}
async function getUserPaymentAccounts(userId) {
  return db
    .select()
    .from(paymentAccounts)
    .where(eq38(paymentAccounts.userId, userId));
}
async function deletePaymentAccount(accountId, userId) {
  await db
    .delete(paymentAccounts)
    .where(
      and17(
        eq38(paymentAccounts.id, accountId),
        eq38(paymentAccounts.userId, userId),
      ),
    );
}
var init_payoutService = __esm({
  "server/payoutService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_logger();
  },
});

// server/gamificationService.ts
var gamificationService_exports = {};
__export(gamificationService_exports, {
  GamificationService: () => GamificationService,
});
import { eq as eq51, and as and27, desc as desc9 } from "drizzle-orm";
var GamificationService;
var init_gamificationService = __esm({
  "server/gamificationService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    GamificationService = class {
      // Inicializar puntos de usuario
      static async initializeUserPoints(userId) {
        const [existing] = await db
          .select()
          .from(loyaltyPoints)
          .where(eq51(loyaltyPoints.userId, userId))
          .limit(1);
        if (!existing) {
          await db.insert(loyaltyPoints).values({
            id: crypto.randomUUID(),
            userId,
            currentPoints: 0,
            totalEarned: 0,
            totalRedeemed: 0,
            tier: "bronze",
            pointsToNextTier: 1e3,
          });
        }
      }
      // Otorgar puntos
      static async awardPoints(data) {
        const { userId, points, type, description, orderId } = data;
        await this.initializeUserPoints(userId);
        const [userPoints] = await db
          .select()
          .from(loyaltyPoints)
          .where(eq51(loyaltyPoints.userId, userId))
          .limit(1);
        if (!userPoints)
          return { success: false, error: "Usuario no encontrado" };
        const newPoints = userPoints.currentPoints + points;
        const newTotalEarned = userPoints.totalEarned + points;
        await db
          .update(loyaltyPoints)
          .set({
            currentPoints: newPoints,
            totalEarned: newTotalEarned,
          })
          .where(eq51(loyaltyPoints.userId, userId));
        await db.insert(loyaltyTransactions).values({
          id: crypto.randomUUID(),
          userId,
          type,
          points,
          description,
          orderId: orderId || null,
        });
        await this.checkTierUpgrade(userId, newTotalEarned);
        await this.checkAchievements(userId);
        return { success: true, newPoints, pointsAwarded: points };
      }
      // Verificar upgrade de tier
      static async checkTierUpgrade(userId, totalEarned) {
        let newTier = "bronze";
        let pointsToNext = 1e3;
        if (totalEarned >= 1e4) {
          newTier = "platinum";
          pointsToNext = 0;
        } else if (totalEarned >= 5e3) {
          newTier = "gold";
          pointsToNext = 1e4 - totalEarned;
        } else if (totalEarned >= 2e3) {
          newTier = "silver";
          pointsToNext = 5e3 - totalEarned;
        } else {
          pointsToNext = 2e3 - totalEarned;
        }
        await db
          .update(loyaltyPoints)
          .set({
            tier: newTier,
            pointsToNextTier: pointsToNext,
            tierUpdatedAt: /* @__PURE__ */ new Date(),
          })
          .where(eq51(loyaltyPoints.userId, userId));
      }
      // Verificar y desbloquear achievements
      static async checkAchievements(userId) {
        const userOrders = await db
          .select()
          .from(orders)
          .where(eq51(orders.userId, userId));
        const completedOrders = userOrders.filter(
          (o) => o.status === "delivered",
        );
        const orderCount = completedOrders.length;
        const totalSpent = completedOrders.reduce(
          (sum3, o) => sum3 + (o.total || 0),
          0,
        );
        const allAchievements = await db
          .select()
          .from(achievements)
          .where(eq51(achievements.isActive, true));
        for (const achievement of allAchievements) {
          let qualifies = false;
          if (achievement.requirementType === "order_count")
            qualifies = orderCount >= achievement.requirementValue;
          if (achievement.requirementType === "total_spent")
            qualifies = totalSpent >= achievement.requirementValue;
          if (qualifies) await this.unlockAchievement(userId, achievement.id);
        }
      }
      // Desbloquear achievement por ID
      static async unlockAchievement(userId, achievementId) {
        const [achievement] = await db
          .select()
          .from(achievements)
          .where(eq51(achievements.id, achievementId))
          .limit(1);
        if (!achievement) return;
        const [existing] = await db
          .select()
          .from(userAchievements)
          .where(
            and27(
              eq51(userAchievements.userId, userId),
              eq51(userAchievements.achievementId, achievementId),
            ),
          )
          .limit(1);
        if (existing) return;
        await db.insert(userAchievements).values({
          id: crypto.randomUUID(),
          userId,
          achievementId,
        });
        if (achievement.rewardPoints > 0) {
          await this.awardPoints({
            userId,
            points: achievement.rewardPoints,
            type: "achievement",
            description: `Logro desbloqueado: ${achievement.name}`,
          });
        }
      }
      // Obtener puntos del usuario
      static async getUserPoints(userId) {
        await this.initializeUserPoints(userId);
        const [points] = await db
          .select()
          .from(loyaltyPoints)
          .where(eq51(loyaltyPoints.userId, userId))
          .limit(1);
        return { success: true, points };
      }
      // Obtener leaderboard
      static async getLeaderboard(limit = 50) {
        const topUsers = await db
          .select({
            userId: loyaltyPoints.userId,
            currentPoints: loyaltyPoints.currentPoints,
            totalEarned: loyaltyPoints.totalEarned,
            tier: loyaltyPoints.tier,
            userName: users.name,
            userImage: users.profileImage,
          })
          .from(loyaltyPoints)
          .leftJoin(users, eq51(loyaltyPoints.userId, users.id))
          .orderBy(desc9(loyaltyPoints.totalEarned))
          .limit(limit);
        return { success: true, leaderboard: topUsers };
      }
      // Obtener achievements del usuario
      static async getUserAchievements(userId) {
        const unlocked = await db
          .select({
            achievement: achievements,
            unlockedAt: userAchievements.unlockedAt,
          })
          .from(userAchievements)
          .leftJoin(
            achievements,
            eq51(userAchievements.achievementId, achievements.id),
          )
          .where(eq51(userAchievements.userId, userId));
        const allAchievements = await db
          .select()
          .from(achievements)
          .where(eq51(achievements.isActive, true));
        const unlockedIds = unlocked.map((u) => u.achievement?.id);
        const locked = allAchievements.filter(
          (a) => !unlockedIds.includes(a.id),
        );
        return {
          success: true,
          unlocked: unlocked.map((u) => ({
            ...u.achievement,
            unlockedAt: u.unlockedAt,
          })),
          locked,
        };
      }
      // Canjear recompensa
      static async redeemReward(userId, rewardId) {
        const [reward] = await db
          .select()
          .from(loyaltyRewards)
          .where(eq51(loyaltyRewards.id, rewardId))
          .limit(1);
        if (!reward) {
          return { success: false, error: "Recompensa no encontrada" };
        }
        if (!reward.isAvailable) {
          return { success: false, error: "Recompensa no disponible" };
        }
        const [userPoints] = await db
          .select()
          .from(loyaltyPoints)
          .where(eq51(loyaltyPoints.userId, userId))
          .limit(1);
        if (!userPoints || userPoints.currentPoints < reward.pointsCost) {
          return { success: false, error: "Puntos insuficientes" };
        }
        await db
          .update(loyaltyPoints)
          .set({
            currentPoints: userPoints.currentPoints - reward.pointsCost,
            totalRedeemed: userPoints.totalRedeemed + reward.pointsCost,
          })
          .where(eq51(loyaltyPoints.userId, userId));
        await db.insert(loyaltyTransactions).values({
          id: crypto.randomUUID(),
          userId,
          type: "redemption",
          points: -reward.pointsCost,
          description: `Canjeado: ${reward.title}`,
          rewardId,
        });
        const redemptionId = crypto.randomUUID();
        await db.insert(loyaltyRedemptions).values({
          id: redemptionId,
          userId,
          rewardId,
          pointsSpent: reward.pointsCost,
          status: "active",
          expiresAt: reward.expiresAt || null,
        });
        return { success: true, redemptionId };
      }
      // Obtener recompensas disponibles
      static async getAvailableRewards(userId) {
        const [userPoints] = await db
          .select()
          .from(loyaltyPoints)
          .where(eq51(loyaltyPoints.userId, userId))
          .limit(1);
        const rewards = await db
          .select()
          .from(loyaltyRewards)
          .where(eq51(loyaltyRewards.isAvailable, true));
        return {
          success: true,
          rewards: rewards.map((r) => ({
            ...r,
            canAfford: userPoints
              ? userPoints.currentPoints >= r.pointsCost
              : false,
          })),
          userPoints: userPoints?.currentPoints || 0,
        };
      }
    };
  },
});

// server/pickupService.ts
import { eq as eq58 } from "drizzle-orm";
function generatePickupCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
function generateQRData(orderId, pickupCode) {
  return JSON.stringify({
    orderId,
    pickupCode,
    timestamp: Date.now(),
    type: "pickup",
  });
}
var pickupService;
var init_pickupService = __esm({
  "server/pickupService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_enhancedPushService();
    pickupService = {
      // Crear pedido pickup con código
      async createPickupOrder(orderId, estimatedMinutes) {
        const pickupCode = generatePickupCode();
        const qrData = generateQRData(orderId, pickupCode);
        await db
          .update(orders)
          .set({
            pickupCode,
            pickupQrCode: qrData,
            estimatedPickupTime: estimatedMinutes,
          })
          .where(eq58(orders.id, orderId));
        return { pickupCode, qrData };
      },
      // Calcular tiempo restante
      getTimeRemaining(order) {
        if (!order.estimatedPickupTime || !order.createdAt) return null;
        const createdAt = new Date(order.createdAt).getTime();
        const now = Date.now();
        const estimatedMs = order.estimatedPickupTime * 60 * 1e3;
        const elapsed = now - createdAt;
        const remaining = Math.max(0, estimatedMs - elapsed);
        return Math.ceil(remaining / 6e4);
      },
      // Calcular progreso (0-100)
      getProgress(order) {
        if (!order.estimatedPickupTime || !order.createdAt) return 0;
        const createdAt = new Date(order.createdAt).getTime();
        const now = Date.now();
        const estimatedMs = order.estimatedPickupTime * 60 * 1e3;
        const elapsed = now - createdAt;
        return Math.min(100, Math.round((elapsed / estimatedMs) * 100));
      },
      // Enviar notificación según progreso
      async sendProgressNotification(orderId, userId, progress) {
        let title = "";
        let body = "";
        if (progress >= 25 && progress < 30) {
          title = "\u{1F373} Preparando tu pedido";
          body = "Tu pedido est\xE1 en preparaci\xF3n. Quedan aprox. 15 min";
        } else if (progress >= 50 && progress < 55) {
          title = "\u23F1\uFE0F A mitad de camino";
          body = "Tu pedido va por la mitad. Quedan aprox. 10 min";
        } else if (progress >= 75 && progress < 80) {
          title = "\u{1F525} \xA1Casi listo!";
          body = "Tu pedido est\xE1 casi listo. Quedan aprox. 5 min";
        } else {
          return;
        }
        await sendPushToUser(userId, {
          title,
          body,
          data: { orderId, screen: "OrderTracking" },
        });
      },
      // Marcar como listo para recoger
      async markReadyForPickup(orderId, userId) {
        await db
          .update(orders)
          .set({
            status: "ready",
            pickupReadyAt: /* @__PURE__ */ new Date(),
          })
          .where(eq58(orders.id, orderId));
        await sendPushToUser(userId, {
          title: "\u2705 \xA1Tu pedido est\xE1 listo!",
          body: "Puedes venir a recogerlo cuando quieras",
          data: { orderId, screen: "OrderTracking" },
          sound: "default",
          priority: "high",
        });
      },
      // Cliente avisa que llegó
      async customerArrived(orderId, businessOwnerId) {
        await db
          .update(orders)
          .set({
            customerArrivedAt: /* @__PURE__ */ new Date(),
          })
          .where(eq58(orders.id, orderId));
        await sendPushToUser(businessOwnerId, {
          title: "\u{1F6B6} Cliente en el local",
          body: `El cliente lleg\xF3 a recoger el pedido #${orderId.slice(-6)}`,
          data: { orderId, screen: "BusinessOrders" },
        });
      },
      // Validar código de pickup
      async validatePickupCode(orderId, code) {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq58(orders.id, orderId))
          .limit(1);
        return order?.pickupCode === code;
      },
      // Obtener estadísticas de tiempos por negocio
      async getBusinessAverageTime(businessId) {
        const result = await db
          .select()
          .from(orders)
          .where(eq58(orders.businessId, businessId));
        const pickupOrders = result.filter(
          (o) => o.orderType === "pickup" && o.pickupReadyAt && o.createdAt,
        );
        if (pickupOrders.length === 0) return 20;
        const totalMinutes = pickupOrders.reduce((sum3, order) => {
          const created = new Date(order.createdAt).getTime();
          const ready = new Date(order.pickupReadyAt).getTime();
          return sum3 + (ready - created) / 6e4;
        }, 0);
        return Math.round(totalMinutes / pickupOrders.length);
      },
      // Contar pedidos pendientes del negocio (zona de espera)
      async getPendingOrdersCount(businessId, beforeOrderId) {
        const allOrders = await db
          .select()
          .from(orders)
          .where(eq58(orders.businessId, businessId));
        const targetOrder = allOrders.find((o) => o.id === beforeOrderId);
        if (!targetOrder) return 0;
        const targetCreatedAt = new Date(targetOrder.createdAt).getTime();
        return allOrders.filter(
          (o) =>
            o.orderType === "pickup" &&
            ["accepted", "preparing"].includes(o.status) &&
            new Date(o.createdAt).getTime() < targetCreatedAt,
        ).length;
      },
    };
  },
});

// server/businessHoursService.ts
import { eq as eq62 } from "drizzle-orm";
function getZonedNow() {
  const timezone = process.env.BUSINESS_TIMEZONE || "America/Venezuela_City";
  return new Date(
    /* @__PURE__ */ new Date().toLocaleString("en-US", { timeZone: timezone }),
  );
}
function normalizeDayName(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function resolveTodaySchedule(hours, dayOfWeek) {
  if (!hours) return null;
  if (Array.isArray(hours)) {
    const byIndex = hours[dayOfWeek];
    if (byIndex?.openTime && byIndex?.closeTime) {
      return byIndex;
    }
    const todayName2 = normalizeDayName(
      [
        "domingo",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
      ][dayOfWeek],
    );
    const byName = hours.find(
      (entry) => normalizeDayName(entry?.day) === todayName2,
    );
    return byName || null;
  }
  const byKey = hours[dayOfWeek] || hours[String(dayOfWeek)];
  if (byKey?.openTime && byKey?.closeTime) {
    return byKey;
  }
  const todayName = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ][dayOfWeek];
  const dayNameKeys = Object.keys(hours);
  const namedKey = dayNameKeys.find(
    (key) => normalizeDayName(key) === todayName,
  );
  return namedKey ? hours[namedKey] : null;
}
function parseTimeToMinutes(timeValue) {
  if (!timeValue || typeof timeValue !== "string") return null;
  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}
var BusinessHoursService;
var init_businessHoursService = __esm({
  "server/businessHoursService.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    BusinessHoursService = class {
      // Check if business should be open based on current time
      static async isBusinessOpen(businessId) {
        const [business] = await db
          .select()
          .from(businesses)
          .where(eq62(businesses.id, businessId))
          .limit(1);
        if (!business || !business.openingHours) return true;
        try {
          const hours = JSON.parse(business.openingHours);
          const now = getZonedNow();
          const dayOfWeek = now.getDay();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          const todayHours = resolveTodaySchedule(hours, dayOfWeek);
          if (!todayHours || !todayHours.isOpen) return false;
          const openTimeInMinutes = parseTimeToMinutes(todayHours.openTime);
          const closeTimeInMinutes = parseTimeToMinutes(todayHours.closeTime);
          if (openTimeInMinutes === null || closeTimeInMinutes === null) {
            return true;
          }
          if (closeTimeInMinutes < openTimeInMinutes) {
            return (
              currentTimeInMinutes >= openTimeInMinutes ||
              currentTimeInMinutes <= closeTimeInMinutes
            );
          }
          return (
            currentTimeInMinutes >= openTimeInMinutes &&
            currentTimeInMinutes <= closeTimeInMinutes
          );
        } catch {
          return true;
        }
      }
      // Update all businesses based on their schedules
      static async updateAllBusinessStatuses() {
        const allBusinesses = await db.select().from(businesses);
        for (const business of allBusinesses) {
          if (!business.openingHours) continue;
          const shouldBeOpen = await this.isBusinessOpen(business.id);
          if (business.isOpen !== shouldBeOpen) {
            await db
              .update(businesses)
              .set({ isOpen: shouldBeOpen })
              .where(eq62(businesses.id, business.id));
            console.log(
              `\u{1F4CD} ${business.name}: ${shouldBeOpen ? "ABIERTO" : "CERRADO"}`,
            );
          }
        }
      }
    };
  },
});

// server/businessHoursCron.ts
var businessHoursCron_exports = {};
__export(businessHoursCron_exports, {
  startBusinessHoursCron: () => startBusinessHoursCron,
});
function startBusinessHoursCron() {
  const INTERVAL = 5 * 60 * 1e3;
  console.log(
    "\u{1F550} Business hours cron started - checking every 5 minutes",
  );
  BusinessHoursService.updateAllBusinessStatuses().catch(console.error);
  setInterval(() => {
    BusinessHoursService.updateAllBusinessStatuses().catch(console.error);
  }, INTERVAL);
}
var init_businessHoursCron = __esm({
  "server/businessHoursCron.ts"() {
    "use strict";
    init_businessHoursService();
  },
});

// server/weeklySettlementCron.ts
var weeklySettlementCron_exports = {};
__export(weeklySettlementCron_exports, {
  WeeklySettlementCron: () => WeeklySettlementCron,
});
import cron from "node-cron";
var WeeklySettlementCron;
var init_weeklySettlementCron = __esm({
  "server/weeklySettlementCron.ts"() {
    "use strict";
    init_weeklySettlementService();
    WeeklySettlementCron = class {
      /**
       * Iniciar todos los cron jobs
       */
      static start() {
        cron.schedule("59 23 * * 5", async () => {
          console.log(
            "\u{1F550} FLUJO RESTRICTIVO VIERNES: Cerrando semana y bloqueando drivers con deuda...",
          );
          try {
            const result = await WeeklySettlementService.closeWeek();
            console.log(
              `\u2705 Semana cerrada: ${result.count} liquidaciones creadas, ${result.blocked} drivers bloqueados`,
            );
          } catch (error) {
            console.error("\u274C Error al cerrar semana:", error);
          }
        });
        cron.schedule("0 0 * * 1", async () => {
          console.log("\u{1F550} Ejecutando bloqueo de drivers...");
          try {
            const result = await WeeklySettlementService.blockUnpaidDrivers();
            console.log(`\u{1F6AB} ${result.blocked} drivers bloqueados`);
          } catch (error) {
            console.error("\u274C Error al bloquear drivers:", error);
          }
        });
        console.log("\u23F0 Cron jobs de liquidaci\xF3n semanal iniciados:");
        console.log(
          "   - Viernes 11:59 PM: FLUJO RESTRICTIVO - Cierre y bloqueo inmediato",
        );
        console.log(
          "   - Lunes 12:00 AM: Bloqueo definitivo de drivers sin pago",
        );
      }
    };
  },
});

// server/autoConfirmDeliveryCron.ts
var autoConfirmDeliveryCron_exports = {};
__export(autoConfirmDeliveryCron_exports, {
  startAutoConfirmCron: () => startAutoConfirmCron,
});
import cron2 from "node-cron";
import {
  eq as eq63,
  and as and32,
  lt as lt2,
  isNull as isNull3,
} from "drizzle-orm";
function startAutoConfirmCron() {
  cron2.schedule("0 * * * *", async () => {
    try {
      console.log("\u{1F504} Running auto-confirm delivery cron...");
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1e3);
      const ordersToConfirm = await db
        .select()
        .from(orders)
        .where(
          and32(
            eq63(orders.status, "delivered"),
            isNull3(orders.confirmedByCustomer),
            lt2(orders.deliveredAt, twelveHoursAgo),
          ),
        );
      console.log(
        `\u{1F4E6} Found ${ordersToConfirm.length} orders to auto-confirm`,
      );
      for (const order of ordersToConfirm) {
        try {
          const { financialService: financialService2 } =
            await Promise.resolve().then(
              () => (
                init_unifiedFinancialService(),
                unifiedFinancialService_exports
              ),
            );
          const commissions = await financialService2.calculateCommissions(
            order.total,
            order.deliveryFee,
            order.productosBase || order.subtotal,
            order.nemyCommission || void 0,
          );
          await db
            .update(orders)
            .set({
              confirmedByCustomer: true,
              confirmedByCustomerAt: /* @__PURE__ */ new Date(),
              platformFee: commissions.platform,
              businessEarnings: commissions.business,
              deliveryEarnings: commissions.driver,
            })
            .where(eq63(orders.id, order.id));
          const [business] = await db
            .select({ ownerId: businesses.ownerId })
            .from(businesses)
            .where(eq63(businesses.id, order.businessId))
            .limit(1);
          const businessOwnerId = business?.ownerId || order.businessId;
          if (order.paymentMethod === "cash") {
            const { cashSettlementService: cashSettlementService2 } =
              await Promise.resolve().then(
                () => (
                  init_cashSettlementService(),
                  cashSettlementService_exports
                ),
              );
            await cashSettlementService2.registerCashDebt(
              order.id,
              order.deliveryPersonId,
              order.businessId,
              order.total,
              order.deliveryFee,
            );
          } else {
            const [businessWallet] = await db
              .select()
              .from(wallets)
              .where(eq63(wallets.userId, businessOwnerId))
              .limit(1);
            if (businessWallet) {
              await db
                .update(wallets)
                .set({
                  balance: businessWallet.balance + commissions.business,
                  totalEarned:
                    businessWallet.totalEarned + commissions.business,
                })
                .where(eq63(wallets.userId, businessOwnerId));
            } else {
              await db.insert(wallets).values({
                userId: businessOwnerId,
                balance: commissions.business,
                pendingBalance: 0,
                totalEarned: commissions.business,
                totalWithdrawn: 0,
              });
            }
            if (order.deliveryPersonId) {
              const [driverWallet] = await db
                .select()
                .from(wallets)
                .where(eq63(wallets.userId, order.deliveryPersonId))
                .limit(1);
              if (driverWallet) {
                await db
                  .update(wallets)
                  .set({
                    balance: driverWallet.balance + commissions.driver,
                    totalEarned: driverWallet.totalEarned + commissions.driver,
                  })
                  .where(eq63(wallets.userId, order.deliveryPersonId));
              } else {
                await db.insert(wallets).values({
                  userId: order.deliveryPersonId,
                  balance: commissions.driver,
                  pendingBalance: 0,
                  totalEarned: commissions.driver,
                  totalWithdrawn: 0,
                });
              }
            }
            await db.insert(transactions).values([
              {
                userId: businessOwnerId,
                type: "order_payment",
                amount: commissions.business,
                status: "completed",
                description: `Pago autom\xE1tico por pedido #${order.id.slice(-8)}`,
                orderId: order.id,
              },
              {
                userId: order.deliveryPersonId,
                type: "delivery_payment",
                amount: commissions.driver,
                status: "completed",
                description: `Pago autom\xE1tico entrega #${order.id.slice(-8)}`,
                orderId: order.id,
              },
            ]);
          }
          console.log(`\u2705 Auto-confirmed order ${order.id.slice(-8)}`);
        } catch (error) {
          console.error(
            `\u274C Error auto-confirming order ${order.id}:`,
            error,
          );
        }
      }
      console.log("\u2705 Auto-confirm cron completed");
    } catch (error) {
      console.error("\u274C Auto-confirm cron error:", error);
    }
  });
  console.log("\u23F0 Auto-confirm delivery cron started (runs every hour)");
}
var init_autoConfirmDeliveryCron = __esm({
  "server/autoConfirmDeliveryCron.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
  },
});

// server/pickupNotificationCron.ts
var pickupNotificationCron_exports = {};
__export(pickupNotificationCron_exports, {
  startPickupNotificationCron: () => startPickupNotificationCron,
});
import cron3 from "node-cron";
function startPickupNotificationCron() {
  cron3.schedule("*/5 * * * *", async () => {
    try {
      console.log("\u{1F514} Running pickup notification cron...");
      const activeOrders = await db.select().from(orders);
      for (const order of activeOrders) {
        if (
          order.orderType !== "pickup" ||
          !["accepted", "preparing"].includes(order.status)
        ) {
          continue;
        }
        const progress = pickupService.getProgress(order);
        if (!sentNotifications.has(order.id)) {
          sentNotifications.set(order.id, /* @__PURE__ */ new Set());
        }
        const sent = sentNotifications.get(order.id);
        if (progress >= 25 && progress < 30 && !sent.has(25)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            25,
          );
          sent.add(25);
          console.log(
            `\u{1F4F2} Sent 25% notification for order ${order.id.slice(-6)}`,
          );
        } else if (progress >= 50 && progress < 55 && !sent.has(50)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            50,
          );
          sent.add(50);
          console.log(
            `\u{1F4F2} Sent 50% notification for order ${order.id.slice(-6)}`,
          );
        } else if (progress >= 75 && progress < 80 && !sent.has(75)) {
          await pickupService.sendProgressNotification(
            order.id,
            order.userId,
            75,
          );
          sent.add(75);
          console.log(
            `\u{1F4F2} Sent 75% notification for order ${order.id.slice(-6)}`,
          );
        }
      }
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1e3;
      for (const [orderId, _] of sentNotifications.entries()) {
        const order = activeOrders.find((o) => o.id === orderId);
        if (!order || new Date(order.createdAt).getTime() < twoHoursAgo) {
          sentNotifications.delete(orderId);
        }
      }
    } catch (error) {
      console.error("\u274C Pickup notification cron error:", error);
    }
  });
  console.log("\u2705 Pickup notification cron started (every 5 minutes)");
}
var sentNotifications;
var init_pickupNotificationCron = __esm({
  "server/pickupNotificationCron.ts"() {
    "use strict";
    init_db();
    init_schema_mysql();
    init_pickupService();
    sentNotifications = /* @__PURE__ */ new Map();
  },
});

// server/server.ts
init_env();
init_websocket();
import express39 from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path2 from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { config as config2 } from "dotenv";
import { createServer } from "http";

// server/routes.ts
import express38 from "express";

// server/authMiddleware.ts
init_db();
init_schema_mysql();
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "mouzo_local_secret_key",
    );
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    req.user = {
      userId: user.id,
      // Add userId field for compatibility
      id: user.id,
      email: user.email || void 0,
      name: user.name,
      phone: user.phone,
      role: user.role,
      phoneVerified: user.phoneVerified,
    };
    next();
  } catch (error) {
    console.error("\u274C Auth error:", error);
    return res.status(401).json({ error: "Token inv\xE1lido" });
  }
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "No tienes permisos para esta acci\xF3n",
        requiredRole: allowedRoles,
        yourRole: req.user.role,
      });
    }
    next();
  };
}
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({
      error: "Solo administradores pueden acceder",
      yourRole: req.user.role,
    });
  }
  next();
}
function auditAction(action, entityType) {
  return async (req, res, next) => {
    if (req.user) {
      try {
        await db.insert(auditLogs).values({
          userId: req.user.id,
          action,
          entityType,
          entityId: req.params.id || req.body.id,
          changes: JSON.stringify({
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query,
          }),
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      } catch (error) {
        console.error("Audit log error:", error);
      }
    }
    next();
  };
}

// server/routes/auth.ts
import express from "express";
import { eq as eq2 } from "drizzle-orm";
import jwt2 from "jsonwebtoken";
var router = express.Router();
var signToken = (userId) =>
  jwt2.sign(
    { id: userId },
    process.env.JWT_SECRET || "mouzo_local_secret_key",
    { expiresIn: "7d" },
  );
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Tel\xE9fono requerido" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.phone, phone))
      .limit(1);
    if (!user) return res.json({ userNotFound: true });
    if (process.env.TWILIO_ACCOUNT_SID) {
      const { sendVerificationCode: sendVerificationCode2 } =
        await Promise.resolve().then(
          () => (init_smsService(), smsService_exports),
        );
      const code = "123456";
      await sendVerificationCode2(phone, code);
    } else {
      console.log(`[DEV] C\xF3digo SMS para ${phone}: 123456`);
    }
    res.json({ success: true, requiresVerification: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/phone-login", async (req, res) => {
  try {
    const { phone, code, signupData } = req.body;
    if (!phone || !code)
      return res
        .status(400)
        .json({ error: "Tel\xE9fono y c\xF3digo requeridos" });
    let isValid = false;
    if (process.env.TWILIO_ACCOUNT_SID) {
      const { verifyCode: verifyCode2 } = await Promise.resolve().then(
        () => (init_smsService(), smsService_exports),
      );
      isValid = await verifyCode2(phone, code);
    } else {
      isValid = code === "123456" || code === "1234";
    }
    if (!isValid)
      return res.status(400).json({ error: "C\xF3digo inv\xE1lido" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    let [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.phone, phone))
      .limit(1);
    if (!user) {
      if (signupData) {
        let hashedPassword = null;
        if (signupData.password) {
          const bcrypt = await import("bcrypt");
          hashedPassword = await bcrypt.hash(signupData.password, 10);
        }
        const newUser = {
          id: crypto.randomUUID(),
          phone,
          name: signupData.name,
          email: signupData.email || null,
          password: hashedPassword,
          role: signupData.role || "customer",
          isActive: signupData.role === "customer" ? true : false,
          // Solo clientes activos inmediatamente
          phoneVerified: true,
          createdAt: /* @__PURE__ */ new Date(),
        };
        await db2.insert(users7).values(newUser);
        user = newUser;
      } else {
        const newUser = {
          id: crypto.randomUUID(),
          phone,
          name: `Usuario ${phone.slice(-4)}`,
          role: "customer",
          isActive: true,
          phoneVerified: true,
          createdAt: /* @__PURE__ */ new Date(),
        };
        await db2.insert(users7).values(newUser);
        user = newUser;
      }
    } else {
      await db2
        .update(users7)
        .set({ phoneVerified: true, isActive: true })
        .where(eq2(users7.id, user.id));
      user.phoneVerified = true;
      user.isActive = true;
    }
    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/phone-signup", async (req, res) => {
  try {
    const { name, role, phone, email, password } = req.body;
    if (!phone || !name)
      return res.status(400).json({ error: "Nombre y tel\xE9fono requeridos" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [existing] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.phone, phone))
      .limit(1);
    if (existing)
      return res
        .status(400)
        .json({ error: "El tel\xE9fono ya est\xE1 registrado" });
    if (process.env.TWILIO_ACCOUNT_SID) {
      const { sendVerificationCode: sendVerificationCode2 } =
        await Promise.resolve().then(
          () => (init_smsService(), smsService_exports),
        );
      const code = "123456";
      await sendVerificationCode2(phone, code);
    } else {
      console.log(`[DEV] C\xF3digo SMS para ${phone}: 123456 o 1234`);
    }
    res.json({ success: true, requiresVerification: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/dev-email-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email y contrase\xF1a requeridos" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.email, email))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.password) {
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid)
        return res
          .status(401)
          .json({
            error:
              "Credenciales incorrectas. Verifica tu correo y contrase\xF1a.",
          });
    } else {
      return res
        .status(401)
        .json({
          error:
            "Esta cuenta no tiene contrase\xF1a configurada. Inicia sesi\xF3n con c\xF3digo SMS.",
        });
    }
    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/biometric-login", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Tel\xE9fono requerido" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.phone, phone))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        phoneVerified: user.phoneVerified,
        biometricEnabled: user.biometricEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/enable-biometric", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    await db2
      .update(users7)
      .set({ biometricEnabled: true })
      .where(eq2(users7.id, req.user.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/disable-biometric", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    await db2
      .update(users7)
      .set({ biometricEnabled: false })
      .where(eq2(users7.id, req.user.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Faltan campos" });
    if (newPassword.length < 8)
      return res
        .status(400)
        .json({ error: "La contrase\xF1a debe tener al menos 8 caracteres" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const bcrypt = await import("bcrypt");
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.id, req.user.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.password) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res
          .status(401)
          .json({ success: false, error: "Contrase\xF1a actual incorrecta" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db2
      .update(users7)
      .set({ password: hashed })
      .where(eq2(users7.id, req.user.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/logout", authenticateToken, async (req, res) => {
  res.json({ success: true, message: "Sesi\xF3n cerrada" });
});
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq2(users7.id, req.user.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var auth_default = router;

// server/routes/business.ts
import express2 from "express";
import { eq as eq4, and as and2, desc } from "drizzle-orm";

// server/partnerLevelService.ts
init_db();
init_schema_mysql();
import { eq as eq3, and, count, sum } from "drizzle-orm";
var LEVELS = [
  {
    level: "platinum",
    minOrders: 200,
    minRevenue: 5e7,
    commission: 0.12,
    badge: "\u{1F48E}",
  },
  {
    level: "gold",
    minOrders: 100,
    minRevenue: 2e7,
    commission: 0.13,
    badge: "\u{1F947}",
  },
  {
    level: "silver",
    minOrders: 50,
    minRevenue: 8e6,
    commission: 0.14,
    badge: "\u{1F948}",
  },
  {
    level: "bronze",
    minOrders: 0,
    minRevenue: 0,
    commission: 0.15,
    badge: "\u{1F949}",
  },
];
function getLevelInfo(level) {
  return LEVELS.find((l) => l.level === level) || LEVELS[3];
}
async function updatePartnerLevel(businessId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const [stats] = await db
    .select({ orderCount: count(), revenue: sum(orders.total) })
    .from(orders)
    .where(
      and(eq3(orders.businessId, businessId), eq3(orders.status, "delivered")),
    );
  const orderCount = stats?.orderCount || 0;
  const revenue = Number(stats?.revenue) || 0;
  const newLevel =
    LEVELS.find((l) => orderCount >= l.minOrders && revenue >= l.minRevenue)
      ?.level || "bronze";
  await db
    .update(businesses)
    .set({
      partnerLevel: newLevel,
      partnerLevelUpdatedAt: /* @__PURE__ */ new Date(),
      totalOrdersCompleted: orderCount,
      totalRevenueGenerated: revenue,
    })
    .where(eq3(businesses.id, businessId));
  return newLevel;
}
async function getPartnerStatus(businessId) {
  const [business] = await db
    .select({
      partnerLevel: businesses.partnerLevel,
      totalOrdersCompleted: businesses.totalOrdersCompleted,
      totalRevenueGenerated: businesses.totalRevenueGenerated,
      partnerLevelUpdatedAt: businesses.partnerLevelUpdatedAt,
    })
    .from(businesses)
    .where(eq3(businesses.id, businessId))
    .limit(1);
  if (!business) throw new Error("Negocio no encontrado");
  const level = business.partnerLevel || "bronze";
  const info = getLevelInfo(level);
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.level === level) - 1];
  return {
    level,
    badge: info.badge,
    commission: info.commission,
    totalOrders: business.totalOrdersCompleted || 0,
    totalRevenue: business.totalRevenueGenerated || 0,
    updatedAt: business.partnerLevelUpdatedAt,
    nextLevel: nextLevel
      ? {
          level: nextLevel.level,
          badge: nextLevel.badge,
          ordersNeeded: Math.max(
            0,
            nextLevel.minOrders - (business.totalOrdersCompleted || 0),
          ),
          revenueNeeded: Math.max(
            0,
            nextLevel.minRevenue - (business.totalRevenueGenerated || 0),
          ),
        }
      : null,
  };
}

// server/routes/business.ts
init_config();
var router2 = express2.Router();
router2.get(
  "/partner-level",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const status = await getPartnerStatus(business.id);
      res.json({ success: true, ...status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
router2.post(
  "/partner-level/recalculate",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.body;
      const newLevel = await updatePartnerLevel(businessId);
      res.json({ success: true, level: newLevel });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
router2.get("/featured", async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { sql: sql15 } = await import("drizzle-orm");
    const [rows] = await db2.execute(
      sql15`SELECT * FROM businesses WHERE is_featured = 1 AND is_active = 1 LIMIT 10`,
    );
    res.json({ success: true, businesses: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/nearby", async (req, res) => {
  try {
    const { businesses: businesses3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const allBusinesses = await db2
      .select()
      .from(businesses3)
      .where(eq4(businesses3.isActive, true));
    res.json({ success: true, businesses: allBusinesses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get(
  "/dashboard",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const { businesses: businesses3, orders: orders2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const businessOrders = await db2
        .select()
        .from(orders2)
        .where(eq4(orders2.businessId, business.id))
        .orderBy(desc(orders2.createdAt));
      const today = /* @__PURE__ */ new Date();
      const todayOrders = businessOrders.filter(
        (o) => new Date(o.createdAt).toDateString() === today.toDateString(),
      );
      const pendingOrders = businessOrders.filter(
        (o) => o.status === "pending",
      );
      const todayRevenue = todayOrders
        .filter((o) => o.status === "delivered")
        .reduce((sum3, o) => sum3 + (o.subtotal || 0), 0);
      res.json({
        success: true,
        dashboard: {
          business,
          isOpen: business.isOpen || false,
          pendingOrders: pendingOrders.length,
          todayOrders: todayOrders.length,
          todayRevenue: Math.round(todayRevenue / 100),
          totalOrders: businessOrders.length,
          recentOrders: businessOrders.slice(0, 10).map((o) => ({
            ...o,
            subtotal: Math.round((o.subtotal || 0) / 100),
            deliveryFee: Math.round((o.deliveryFee || 0) / 100),
            total: Math.round((o.total || 0) / 100),
          })),
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/stats",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const {
        businesses: businesses3,
        orders: orders2,
        products: products3,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const businessOrders = await db2
        .select()
        .from(orders2)
        .where(eq4(orders2.businessId, business.id));
      const today = /* @__PURE__ */ new Date();
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const revenue = (list) =>
        list
          .filter((o) => o.status === "delivered")
          .reduce((s, o) => s + (o.subtotal || 0), 0);
      const todayOrders = businessOrders.filter(
        (o) => new Date(o.createdAt).toDateString() === today.toDateString(),
      );
      const weekOrders = businessOrders.filter(
        (o) => new Date(o.createdAt) >= thisWeek,
      );
      const monthOrders = businessOrders.filter(
        (o) => new Date(o.createdAt) >= thisMonth,
      );
      const completedOrders = businessOrders.filter(
        (o) => o.status === "delivered",
      );
      const cancelledOrders = businessOrders.filter(
        (o) => o.status === "cancelled",
      );
      const totalRevenue = revenue(businessOrders);
      const avgValue =
        completedOrders.length > 0
          ? Math.round(totalRevenue / completedOrders.length)
          : 0;
      const [topProductRows] = await db2.execute(sql15`
      SELECT 
        p.name,
        SUM(JSON_EXTRACT(oi.value, '$.quantity')) as quantity,
        SUM(JSON_EXTRACT(oi.value, '$.quantity') * JSON_EXTRACT(oi.value, '$.price')) as revenue
      FROM orders o
      CROSS JOIN JSON_TABLE(
        o.items,
        '$[*]' COLUMNS(
          value JSON PATH '$'
        )
      ) oi
      JOIN products p ON p.id = JSON_EXTRACT(oi.value, '$.productId')
      WHERE o.business_id = ${business.id}
        AND o.status = 'delivered'
      GROUP BY p.id, p.name
      ORDER BY quantity DESC
      LIMIT 5
    `);
      const topProducts = topProductRows.map((row) => ({
        name: row.name,
        quantity: parseInt(row.quantity) || 0,
        revenue: (parseInt(row.revenue) || 0) / 100,
      }));
      res.json({
        success: true,
        revenue: {
          today: Math.round(revenue(todayOrders) / 100),
          week: Math.round(revenue(weekOrders) / 100),
          month: Math.round(revenue(monthOrders) / 100),
          total: Math.round(totalRevenue / 100),
        },
        orders: {
          total: businessOrders.length,
          completed: completedOrders.length,
          cancelled: cancelledOrders.length,
          avgValue: Math.round(avgValue / 100),
        },
        topProducts,
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/limits",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    res.json({
      success: true,
      limits: {
        maxProducts: 100,
        maxCategories: 20,
        maxImages: 10,
        maxOrdersPerHour: 50,
        maxDeliveryRadius: 10,
        minOrderAmount: 1e3,
        maxOrderAmount: 1e5,
      },
    });
  },
);
router2.get(
  "/my-businesses",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3, orders: orders2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { inArray: inArray4 } = await import("drizzle-orm");
      const ownerBusinesses = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id));
      const businessIds = ownerBusinesses.map((b) => b.id);
      const allOrders =
        businessIds.length > 0
          ? await db2
              .select()
              .from(orders2)
              .where(inArray4(orders2.businessId, businessIds))
          : [];
      const result = ownerBusinesses.map((business) => {
        const bOrders = allOrders.filter((o) => o.businessId === business.id);
        const deliveredOrders = bOrders.filter((o) => o.status === "delivered");
        const pendingOrders = bOrders.filter((o) =>
          ["pending", "accepted", "preparing"].includes(o.status),
        );
        return {
          ...business,
          stats: {
            pendingOrders: pendingOrders.length,
            totalOrders: deliveredOrders.length,
            totalRevenue: deliveredOrders.reduce(
              (s, o) => s + (o.subtotal || 0),
              0,
            ),
          },
        };
      });
      res.json({ success: true, businesses: result });
    } catch (error) {
      console.error("My businesses error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/orders",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const {
        businesses: businesses3,
        orders: orders2,
        users: users7,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const [orderRows] = await db2.execute(sql15`
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.business_id = ${business.id}
      ORDER BY o.created_at DESC
    `);
      const formattedOrders = orderRows.map((row) => {
        let addressObj = null;
        if (row.delivery_address) {
          try {
            addressObj = JSON.parse(row.delivery_address);
          } catch {
            addressObj = { street: row.delivery_address };
          }
        }
        return {
          id: row.id,
          userId: row.user_id,
          businessId: row.business_id,
          businessName: row.business_name,
          businessImage: row.business_image,
          items: row.items,
          status: row.status,
          subtotal: row.subtotal,
          deliveryFee: row.delivery_fee,
          total: row.total,
          paymentMethod: row.payment_method,
          deliveryAddress: row.delivery_address,
          notes: row.notes,
          createdAt: row.created_at,
          customer: row.customer_name
            ? {
                name: row.customer_name,
                phone: row.customer_phone,
              }
            : null,
          address: addressObj,
        };
      });
      res.json({ success: true, orders: formattedOrders });
    } catch (error) {
      console.error("Business orders error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/products",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const { businesses: businesses3, products: products3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const businessProducts = await db2
        .select()
        .from(products3)
        .where(eq4(products3.businessId, business.id));
      res.json({ success: true, products: businessProducts });
    } catch (error) {
      console.error("Business products error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/payouts",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const { businesses: businesses3, payouts: payouts2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { desc: desc12 } = await import("drizzle-orm");
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const businessPayouts = await db2
        .select()
        .from(payouts2)
        .where(eq4(payouts2.recipientId, business.id))
        .orderBy(desc12(payouts2.createdAt));
      res.json({ success: true, payouts: businessPayouts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/finances",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId, period = "week" } = req.query;
      const {
        businesses: businesses3,
        orders: orders2,
        users: users7,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const today = /* @__PURE__ */ new Date();
      let startDate;
      switch (period) {
        case "week":
          startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
          break;
        case "month":
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case "all":
        default:
          startDate = /* @__PURE__ */ new Date(0);
          break;
      }
      const [transactionRows] = await db2.execute(sql15`
      SELECT 
        o.id,
        o.subtotal,
        o.delivery_fee,
        o.total,
        o.status,
        o.payment_method,
        o.delivery_address,
        o.notes,
        o.created_at,
        u.name as customer_name,
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.business_id = ${business.id}
        AND o.created_at >= ${startDate.toISOString()}
      ORDER BY o.created_at DESC
    `);
      const transactions3 = transactionRows.map((row) => {
        let address = null;
        if (row.delivery_address) {
          try {
            address = JSON.parse(row.delivery_address);
          } catch {
            address = { street: row.delivery_address };
          }
        }
        return {
          id: row.id,
          orderId: row.id,
          subtotal: row.subtotal || 0,
          deliveryFee: row.delivery_fee || 0,
          total: row.total || 0,
          status: row.status,
          paymentMethod: row.payment_method,
          deliveryAddress: address,
          notes: row.notes,
          createdAt: row.created_at,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
        };
      });
      const completedOrders = transactions3.filter(
        (t) => t.status === "delivered",
      );
      const pendingOrders = transactions3.filter((t) =>
        ["pending", "accepted", "preparing", "on_the_way"].includes(t.status),
      );
      const completedAmount = completedOrders.reduce(
        (sum3, t) => sum3 + (t.subtotal || 0),
        0,
      );
      const pendingAmount = pendingOrders.reduce(
        (sum3, t) => sum3 + (t.subtotal || 0),
        0,
      );
      res.json({
        success: true,
        transactions: transactions3,
        summary: {
          totalEarnings: completedAmount + pendingAmount,
          completedAmount,
          pendingAmount,
          transactionCount: transactions3.length,
        },
      });
    } catch (error) {
      console.error("Business finances error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/hours",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId } = req.query;
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const defaultHours = {
        monday: { open: "09:00", close: "22:00", closed: false },
        tuesday: { open: "09:00", close: "22:00", closed: false },
        wednesday: { open: "09:00", close: "22:00", closed: false },
        thursday: { open: "09:00", close: "22:00", closed: false },
        friday: { open: "09:00", close: "22:00", closed: false },
        saturday: { open: "09:00", close: "22:00", closed: false },
        sunday: { open: "09:00", close: "22:00", closed: false },
      };
      const hours = business.openingHours
        ? JSON.parse(business.openingHours)
        : defaultHours;
      res.json({ success: true, hours });
    } catch (error) {
      console.error("Business hours error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.put(
  "/hours",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId, hours } = req.body;
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = businessId
        ? await db2
            .select()
            .from(businesses3)
            .where(
              and2(
                eq4(businesses3.id, businessId),
                eq4(businesses3.ownerId, req.user.id),
              ),
            )
            .limit(1)
        : await db2
            .select()
            .from(businesses3)
            .where(eq4(businesses3.ownerId, req.user.id))
            .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      await db2
        .update(businesses3)
        .set({ openingHours: JSON.stringify(hours) })
        .where(eq4(businesses3.id, business.id));
      res.json({ success: true, message: "Horarios actualizados" });
    } catch (error) {
      console.error("Update hours error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.post(
  "/products",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3, products: products3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { CloudinaryService: CloudinaryService2 } =
        await Promise.resolve().then(
          () => (init_cloudinaryService(), cloudinaryService_exports),
        );
      const { name, description, price, image } = req.body;
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      let imageUrl = null;
      if (image && image.startsWith("data:image/")) {
        const productId = crypto.randomUUID();
        imageUrl = await CloudinaryService2.uploadImage(
          image,
          "products",
          `product-${productId}`,
        );
      }
      const newProduct = {
        id: crypto.randomUUID(),
        businessId: business.id,
        name,
        description: description || null,
        price,
        image: imageUrl,
        isAvailable: true,
        createdAt: /* @__PURE__ */ new Date(),
      };
      await db2.insert(products3).values(newProduct);
      res.json({ success: true, product: newProduct });
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.put(
  "/products/:id",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3, products: products3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { CloudinaryService: CloudinaryService2 } =
        await Promise.resolve().then(
          () => (init_cloudinaryService(), cloudinaryService_exports),
        );
      const [product] = await db2
        .select()
        .from(products3)
        .where(eq4(products3.id, req.params.id))
        .limit(1);
      if (!product)
        return res.status(404).json({ error: "Producto no encontrado" });
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, product.businessId),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business) return res.status(403).json({ error: "No autorizado" });
      const updates = {};
      if (req.body.name !== void 0) updates.name = req.body.name;
      if (req.body.description !== void 0)
        updates.description = req.body.description;
      if (req.body.price !== void 0) updates.price = req.body.price;
      if (req.body.image !== void 0) {
        if (req.body.image && req.body.image.startsWith("data:image/")) {
          if (product.image && product.image.includes("cloudinary")) {
            const oldPublicId = CloudinaryService2.extractPublicId(
              product.image,
            );
            if (oldPublicId)
              await CloudinaryService2.deleteImage(oldPublicId).catch(() => {});
          }
          updates.image = await CloudinaryService2.uploadImage(
            req.body.image,
            "products",
            `product-${req.params.id}`,
          );
        } else {
          updates.image = req.body.image;
        }
      }
      await db2
        .update(products3)
        .set(updates)
        .where(eq4(products3.id, req.params.id));
      res.json({ success: true, message: "Producto actualizado" });
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.put(
  "/products/:id/availability",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3, products: products3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { isAvailable } = req.body;
      const [product] = await db2
        .select()
        .from(products3)
        .where(eq4(products3.id, req.params.id))
        .limit(1);
      if (!product)
        return res.status(404).json({ error: "Producto no encontrado" });
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, product.businessId),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business) return res.status(403).json({ error: "No autorizado" });
      await db2
        .update(products3)
        .set({ isAvailable })
        .where(eq4(products3.id, req.params.id));
      res.json({ success: true, message: "Disponibilidad actualizada" });
    } catch (error) {
      console.error("Update availability error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.delete(
  "/products/:id",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3, products: products3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [product] = await db2
        .select()
        .from(products3)
        .where(eq4(products3.id, req.params.id))
        .limit(1);
      if (!product)
        return res.status(404).json({ error: "Producto no encontrado" });
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, product.businessId),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business) return res.status(403).json({ error: "No autorizado" });
      await db2.delete(products3).where(eq4(products3.id, req.params.id));
      res.json({ success: true, message: "Producto eliminado" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.put(
  "/orders/:id/status",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const { businesses: businesses3, orders: orders2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq4(orders2.id, req.params.id))
        .limit(1);
      if (!order)
        return res.status(404).json({ error: "Pedido no encontrado" });
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, order.businessId),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (
        !business &&
        req.user.role !== "admin" &&
        req.user.role !== "super_admin"
      ) {
        return res.status(403).json({ error: "No autorizado" });
      }
      const updates = { status, updatedAt: /* @__PURE__ */ new Date() };
      if (status === "accepted")
        updates.businessResponseAt = /* @__PURE__ */ new Date();
      if (status === "preparing")
        updates.assignedAt = /* @__PURE__ */ new Date();
      await db2
        .update(orders2)
        .set(updates)
        .where(eq4(orders2.id, req.params.id));
      res.json({ success: true, message: "Estado actualizado" });
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get("/", async (req, res) => {
  try {
    const { queryWithRetry: queryWithRetry2 } = await Promise.resolve().then(
      () => (init_dbHelper(), dbHelper_exports),
    );
    console.log("\u{1F4CD} GET /api/businesses called");
    const rows = await queryWithRetry2(
      "SELECT * FROM businesses WHERE is_active = 1",
    );
    console.log(`\u2705 Found ${rows.length} active businesses`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({ success: true, businesses: rows });
  } catch (error) {
    console.error("\u274C Error in /api/businesses:", error);
    res.status(500).json({
      error: "Failed to fetch businesses",
      details: error.message,
      code: error.code,
    });
  }
});
router2.post(
  "/",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { CloudinaryService: CloudinaryService2 } =
        await Promise.resolve().then(
          () => (init_cloudinaryService(), cloudinaryService_exports),
        );
      const {
        name,
        description,
        type,
        image,
        address,
        phone,
        categories,
        latitude,
        longitude,
      } = req.body;
      if (!name)
        return res
          .status(400)
          .json({ error: "El nombre del negocio es requerido" });
      let imageUrl = null;
      if (image && image.startsWith("data:image/")) {
        const businessId = crypto.randomUUID();
        imageUrl = await CloudinaryService2.uploadImage(
          image,
          "businesses",
          `business-${businessId}`,
        );
      }
      const newBusiness = {
        id: crypto.randomUUID(),
        ownerId: req.user.id,
        name,
        description: description || null,
        type: type || "restaurant",
        image: imageUrl,
        address: address || null,
        phone: phone || null,
        categories: categories || null,
        latitude: latitude || null,
        longitude: longitude || null,
        isActive: true,
        isOpen: false,
        rating: 0,
        totalRatings: 0,
        deliveryTime: CONFIG.DEFAULT_DELIVERY_TIME,
        deliveryFee: CONFIG.DEFAULT_DELIVERY_FEE,
        minOrder: 1e3,
        createdAt: /* @__PURE__ */ new Date(),
      };
      await db2.insert(businesses3).values(newBusiness);
      res.json({ success: true, business: newBusiness });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get("/:id", async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { sql: sql15 } = await import("drizzle-orm");
    const [bizRows] = await db2.execute(sql15`
      SELECT * FROM businesses WHERE id = ${req.params.id} LIMIT 1
    `);
    const business = bizRows[0];
    if (!business)
      return res.status(404).json({ error: "Negocio no encontrado" });
    if (!business.is_active)
      return res.status(404).json({ error: "Negocio no encontrado" });
    const [productRows] = await db2.execute(sql15`
      SELECT * FROM products
      WHERE business_id = ${req.params.id}
        AND (is_available = 1 OR is_available = true)
    `);
    res.json({
      success: true,
      business: { ...business, products: productRows },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.put(
  "/:id",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { CloudinaryService: CloudinaryService2 } =
        await Promise.resolve().then(
          () => (init_cloudinaryService(), cloudinaryService_exports),
        );
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, req.params.id),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const allowed = [
        "name",
        "description",
        "type",
        "image",
        "address",
        "phone",
        "categories",
        "isOpen",
        "deliveryTime",
        "deliveryFee",
        "minOrder",
        "latitude",
        "longitude",
      ];
      const updates = {};
      for (const field of allowed) {
        if (req.body[field] !== void 0) {
          if (
            field === "image" &&
            req.body[field] &&
            req.body[field].startsWith("data:image/")
          ) {
            if (business.image && business.image.includes("cloudinary")) {
              const oldPublicId = CloudinaryService2.extractPublicId(
                business.image,
              );
              if (oldPublicId)
                await CloudinaryService2.deleteImage(oldPublicId).catch(
                  () => {},
                );
            }
            updates.image = await CloudinaryService2.uploadImage(
              req.body[field],
              "businesses",
              `business-${req.params.id}`,
            );
          } else {
            updates[field] = req.body[field];
          }
        }
      }
      await db2
        .update(businesses3)
        .set(updates)
        .where(eq4(businesses3.id, req.params.id));
      res.json({ success: true, message: "Negocio actualizado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router2.post(
  "/:id/geocode",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, req.params.id),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      if (!business.address)
        return res
          .status(400)
          .json({ error: "El negocio no tiene direcci\xF3n" });
      const GMAPS_KEY =
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        "";
      if (!GMAPS_KEY)
        return res
          .status(500)
          .json({ error: "Google Maps API key no configurada" });
      const query = encodeURIComponent(`${business.address}, Soria, Espa\xF1a`);
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GMAPS_KEY}`,
      );
      const geoData = await geoRes.json();
      if (geoData.status !== "OK" || !geoData.results[0]) {
        return res
          .status(400)
          .json({ error: "No se pudo geocodificar la direcci\xF3n" });
      }
      const { lat, lng } = geoData.results[0].geometry.location;
      await db2
        .update(businesses3)
        .set({ latitude: String(lat), longitude: String(lng) })
        .where(eq4(businesses3.id, req.params.id));
      res.json({ success: true, latitude: lat, longitude: lng });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router2.put(
  "/:id/toggle-status",
  authenticateToken,
  requireRole("business_owner", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(
          and2(
            eq4(businesses3.id, req.params.id),
            eq4(businesses3.ownerId, req.user.id),
          ),
        )
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      const newStatus = !business.isOpen;
      await db2
        .update(businesses3)
        .set({ isOpen: newStatus })
        .where(eq4(businesses3.id, req.params.id));
      res.json({
        success: true,
        isOpen: newStatus,
        message: newStatus ? "Negocio abierto" : "Negocio cerrado",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router2.post(
  "/stripe/connect",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const stripe2 = __require("stripe")(process.env.STRIPE_SECRET_KEY);
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      if (business.stripeAccountId) {
        const accountLink2 = await stripe2.accountLinks.create({
          account: business.stripeAccountId,
          refresh_url: `${process.env.FRONTEND_URL || "http://localhost:8081"}/business/stripe/refresh`,
          return_url: `${process.env.FRONTEND_URL || "http://localhost:8081"}/business/stripe/success`,
          type: "account_onboarding",
        });
        return res.json({
          success: true,
          onboardingUrl: accountLink2.url,
          accountId: business.stripeAccountId,
        });
      }
      const account = await stripe2.accounts.create({
        type: "express",
        country: "ES",
        email: req.user.email || void 0,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          name: business.name,
          product_description: business.description || "Negocio local",
        },
      });
      await db2
        .update(businesses3)
        .set({ stripeAccountId: account.id })
        .where(eq4(businesses3.id, business.id));
      const accountLink = await stripe2.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.FRONTEND_URL || "http://localhost:8081"}/business/stripe/refresh`,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:8081"}/business/stripe/success`,
        type: "account_onboarding",
      });
      res.json({
        success: true,
        onboardingUrl: accountLink.url,
        accountId: account.id,
      });
    } catch (error) {
      console.error("Stripe connect error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/stripe/status",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const stripe2 = __require("stripe")(process.env.STRIPE_SECRET_KEY);
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business || !business.stripeAccountId) {
        return res.json({
          success: true,
          connected: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        });
      }
      const account = await stripe2.accounts.retrieve(business.stripeAccountId);
      res.json({
        success: true,
        connected: true,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        accountId: account.id,
      });
    } catch (error) {
      console.error("Stripe status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.get(
  "/stripe/dashboard-link",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const stripe2 = __require("stripe")(process.env.STRIPE_SECRET_KEY);
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business?.stripeAccountId) {
        return res.status(404).json({ error: "Cuenta de Stripe no conectada" });
      }
      const loginLink = await stripe2.accounts.createLoginLink(
        business.stripeAccountId,
      );
      res.json({
        success: true,
        url: loginLink.url,
      });
    } catch (error) {
      console.error("Stripe dashboard link error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router2.delete(
  "/stripe/disconnect",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [business] = await db2
        .select()
        .from(businesses3)
        .where(eq4(businesses3.ownerId, req.user.id))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Negocio no encontrado" });
      await db2
        .update(businesses3)
        .set({ stripeAccountId: null })
        .where(eq4(businesses3.id, business.id));
      res.json({
        success: true,
        message: "Cuenta de Stripe desconectada",
      });
    } catch (error) {
      console.error("Stripe disconnect error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
var business_default = router2;

// server/routes/orderRoutes.ts
import express3 from "express";

// server/financialIntegrity.ts
init_db();
init_schema_mysql();
init_unifiedFinancialService();
import { eq as eq8 } from "drizzle-orm";
var ROLE_WITHDRAWAL_LIMITS = {
  business_owner: {
    minAmount: 1e4,
    // $100 MXN
    maxDaily: 5e6,
    // $50,000 MXN
    maxPerTransaction: 5e6,
  },
  delivery_driver: {
    minAmount: 5e3,
    // $50 MXN
    maxDaily: 1e6,
    // $10,000 MXN
    maxPerTransaction: 5e5,
    // $5,000 MXN
  },
  customer: {
    minAmount: 0,
    maxDaily: 0,
    maxPerTransaction: 0,
  },
};
var FinancialIntegrity = class {
  // Validar pedido completo
  static async validateOrder(order) {
    const subtotalTotal = order.subtotal + order.deliveryFee;
    const hasMarkup =
      order.productosBase !== void 0 &&
      order.productosBase !== null &&
      order.nemyCommission !== void 0 &&
      order.nemyCommission !== null;
    const markupTotal = hasMarkup
      ? (order.productosBase || 0) +
        (order.nemyCommission || 0) +
        order.deliveryFee
      : subtotalTotal;
    if (order.total !== subtotalTotal && order.total !== markupTotal) {
      return {
        valid: false,
        error: "Total del pedido inv\xE1lido",
        details: {
          expected: hasMarkup ? markupTotal : subtotalTotal,
          received: order.total,
          subtotal: order.subtotal,
          productosBase: order.productosBase,
          nemyCommission: order.nemyCommission,
          deliveryFee: order.deliveryFee,
        },
      };
    }
    if (
      order.platformFee !== void 0 &&
      order.businessEarnings !== void 0 &&
      order.deliveryEarnings !== void 0
    ) {
      const commissionTotal =
        order.platformFee + order.businessEarnings + order.deliveryEarnings;
      if (commissionTotal !== order.total) {
        return {
          valid: false,
          error: "Comisiones no suman el total del pedido",
          details: {
            platform: order.platformFee,
            business: order.businessEarnings,
            driver: order.deliveryEarnings,
            commissionTotal,
            orderTotal: order.total,
            difference: order.total - commissionTotal,
          },
        };
      }
      const expectedCommissions = await financialService.calculateCommissions(
        order.total,
        order.deliveryFee || 0,
        order.productosBase || void 0,
        order.nemyCommission || void 0,
      );
      if (
        order.platformFee !== expectedCommissions.platform ||
        order.businessEarnings !== expectedCommissions.business ||
        order.deliveryEarnings !== expectedCommissions.driver
      ) {
        return {
          valid: false,
          error: "Comisiones no coinciden con rates del sistema",
          details: {
            expected: expectedCommissions,
            received: {
              platform: order.platformFee,
              business: order.businessEarnings,
              driver: order.deliveryEarnings,
            },
          },
        };
      }
    }
    return { valid: true };
  }
  // Validar transacción de wallet
  static async validateWalletTransaction(userId, amount, type) {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq8(wallets.userId, userId))
      .limit(1);
    if (!wallet) {
      return { valid: false, error: "Wallet no existe para este usuario" };
    }
    if (amount < 0) {
      const newBalance = wallet.balance + amount;
      if (newBalance < 0) {
        return {
          valid: false,
          error: "Balance insuficiente",
          details: {
            currentBalance: wallet.balance,
            requestedAmount: Math.abs(amount),
            shortfall: Math.abs(newBalance),
          },
        };
      }
    }
    if (type === "withdrawal") {
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq8(users.id, userId))
        .limit(1);
      if (!user) {
        return { valid: false, error: "Usuario no encontrado" };
      }
      const limits =
        ROLE_WITHDRAWAL_LIMITS[user.role] || ROLE_WITHDRAWAL_LIMITS.customer;
      const withdrawalAmount = Math.abs(amount);
      if (withdrawalAmount < limits.minAmount) {
        return {
          valid: false,
          error: `Monto m\xEDnimo de retiro: $${(limits.minAmount / 100).toFixed(2)} MXN`,
          details: { minAmount: limits.minAmount, requested: withdrawalAmount },
        };
      }
      if (withdrawalAmount > limits.maxPerTransaction) {
        return {
          valid: false,
          error: `Monto m\xE1ximo por transacci\xF3n: $${(limits.maxPerTransaction / 100).toFixed(2)} MXN`,
          details: {
            maxAmount: limits.maxPerTransaction,
            requested: withdrawalAmount,
          },
        };
      }
    }
    return { valid: true };
  }
  // Validar que comisiones del sistema sumen 100%
  static async validateSystemCommissionRates() {
    try {
      const rates = await financialService.getCommissionRates();
      const total = rates.platform + rates.business + rates.driver;
      if (Math.abs(total - 1) > 1e-3) {
        return {
          valid: false,
          error: "Comisiones del sistema no suman 100%",
          details: {
            platform: `${(rates.platform * 100).toFixed(2)}%`,
            business: `${(rates.business * 100).toFixed(2)}%`,
            driver: `${(rates.driver * 100).toFixed(2)}%`,
            total: `${(total * 100).toFixed(2)}%`,
          },
        };
      }
      return { valid: true, details: rates };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  // Reconciliar pedido - verificar integridad financiera
  static async reconcileOrder(orderId) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq8(orders.id, orderId))
      .limit(1);
    if (!order) {
      return { valid: false, error: "Pedido no encontrado" };
    }
    const orderForValidation =
      order.status === "delivered"
        ? order
        : {
            ...order,
            platformFee: void 0,
            businessEarnings: void 0,
            deliveryEarnings: void 0,
          };
    const orderValidation = await this.validateOrder(orderForValidation);
    if (!orderValidation.valid) {
      return orderValidation;
    }
    if (order.status === "delivered") {
      if (
        !order.platformFee ||
        !order.businessEarnings ||
        !order.deliveryEarnings
      ) {
        return {
          valid: false,
          error: "Pedido entregado sin comisiones calculadas",
          details: { orderId, status: order.status },
        };
      }
    }
    return { valid: true };
  }
  // Obtener límites de retiro para un usuario
  static async getWithdrawalLimits(userId) {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq8(users.id, userId))
      .limit(1);
    if (!user) {
      return ROLE_WITHDRAWAL_LIMITS.customer;
    }
    return ROLE_WITHDRAWAL_LIMITS[user.role] || ROLE_WITHDRAWAL_LIMITS.customer;
  }
};

// server/financialMiddleware.ts
init_unifiedFinancialService();
async function validateOrderFinancials(req, res, next) {
  try {
    const {
      subtotal,
      deliveryFee,
      total,
      productosBase,
      nemyCommission,
      couponDiscount,
    } = req.body;
    if (subtotal === void 0 || deliveryFee === void 0 || total === void 0) {
      return res.status(400).json({
        error: "Campos financieros requeridos: subtotal, deliveryFee, total",
      });
    }
    if (subtotal < 0 || deliveryFee < 0 || total < 0) {
      return res.status(400).json({
        error: "Los montos deben ser positivos",
      });
    }
    const baseSubtotal = productosBase ?? subtotal;
    const platformCommission =
      typeof nemyCommission === "number" && nemyCommission > 0
        ? nemyCommission
        : Math.round(baseSubtotal * 0.15);
    const discount = couponDiscount || 0;
    const calculatedTotal =
      baseSubtotal + platformCommission + deliveryFee - discount;
    if (Math.abs(calculatedTotal - total) > 1) {
      return res.status(400).json({
        error: "Total inv\xE1lido",
        expected: calculatedTotal,
        received: total,
        breakdown: { baseSubtotal, platformCommission, deliveryFee, discount },
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
async function validateOrderCompletion(req, res, next) {
  try {
    const paramId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const paramOrderId = Array.isArray(req.params.orderId)
      ? req.params.orderId[0]
      : req.params.orderId;
    const orderId = paramId || paramOrderId;
    const validation = await FinancialIntegrity.reconcileOrder(orderId);
    if (!validation.valid) {
      if (
        validation.error === "Comisiones no suman el total del pedido" ||
        validation.error === "Pedido entregado sin comisiones calculadas"
      ) {
        return next();
      }
      return res.status(400).json({
        error: "El pedido tiene problemas de integridad financiera",
        details: validation.error,
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// server/validateOwnership.ts
init_db();
init_schema_mysql();
import { eq as eq9 } from "drizzle-orm";
async function validateDriverOrderOwnership(req, res, next) {
  try {
    const orderId = req.params.id || req.params.orderId;
    const userId = req.user.id;
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      return next();
    }
    const [order] = await db
      .select({ deliveryPersonId: orders.deliveryPersonId })
      .from(orders)
      .where(eq9(orders.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.deliveryPersonId !== userId) {
      return res.status(403).json({
        error: "This order is not assigned to you",
      });
    }
    next();
  } catch (error) {
    console.error("Error validating driver order ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
async function validateCustomerOrderOwnership(req, res, next) {
  try {
    const orderId = req.params.id || req.params.orderId;
    const userId = req.user.id;
    const role = req.user.role;
    if (role === "admin" || role === "super_admin") return next();
    const [order] = await db
      .select({
        userId: orders.userId,
        deliveryPersonId: orders.deliveryPersonId,
      })
      .from(orders)
      .where(eq9(orders.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.userId !== userId && role !== "business_owner") {
      return res.status(403).json({
        error: "Solo el cliente puede realizar esta acci\xF3n",
      });
    }
    next();
  } catch (error) {
    console.error("Error validating customer order ownership:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// server/routes/orderRoutes.ts
init_distance();
init_enhancedPushService();
init_loyaltyService();
var router3 = express3.Router();
router3.post("/calculate-delivery", authenticateToken, async (req, res) => {
  try {
    const { businessLat, businessLng, deliveryLat, deliveryLng } = req.body;
    if (!businessLat || !businessLng || !deliveryLat || !deliveryLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }
    const distance = calculateDistance(
      businessLat,
      businessLng,
      deliveryLat,
      deliveryLng,
    );
    const deliveryFee = await calculateDeliveryFee(distance);
    const estimatedTime = estimateDeliveryTime(distance);
    res.json({
      success: true,
      distance: Math.round(distance * 100) / 100,
      deliveryFee,
      estimatedTime,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.post(
  "/",
  authenticateToken,
  validateOrderFinancials,
  async (req, res) => {
    try {
      const {
        orders: orders2,
        businesses: businesses3,
        addresses: addresses2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
      let deliveryFee = req.body.deliveryFee;
      let estimatedDeliveryTime = req.body.estimatedDeliveryTime;
      if (req.body.deliveryAddressId && req.body.businessId) {
        const [business] = await db2
          .select()
          .from(businesses3)
          .where(eq64(businesses3.id, req.body.businessId))
          .limit(1);
        const [address] = await db2
          .select()
          .from(addresses2)
          .where(eq64(addresses2.id, req.body.deliveryAddressId))
          .limit(1);
        if (
          business &&
          address &&
          business.latitude &&
          business.longitude &&
          address.latitude &&
          address.longitude
        ) {
          const distance = calculateDistance(
            business.latitude,
            business.longitude,
            address.latitude,
            address.longitude,
          );
          deliveryFee = await calculateDeliveryFee(distance);
          estimatedDeliveryTime = estimateDeliveryTime(
            distance,
            business.prepTime || 20,
          );
        } else {
          deliveryFee = Math.max(deliveryFee || 0, 250);
        }
      }
      const subtotal = req.body.subtotal;
      const couponDiscount = req.body.couponDiscount || 0;
      const { SubscriptionService: SubscriptionService2 } =
        await Promise.resolve().then(
          () => (init_subscriptionService(), subscriptionService_exports),
        );
      const rawDeliveryFee =
        req.body.orderType === "pickup" ? 0 : deliveryFee || 0;
      const subBenefits = await SubscriptionService2.applySubscriptionBenefits(
        req.user.id,
        req.body.subtotal || 0,
        rawDeliveryFee,
      );
      const subDiscount = subBenefits.discount;
      const subDeliveryFee = subBenefits.deliveryFee;
      const finalDeliveryFee =
        req.body.orderType === "pickup" ? 0 : subDeliveryFee;
      const calculatedTotal = Math.max(
        0,
        subtotal + finalDeliveryFee - couponDiscount - subDiscount,
      );
      const orderData = {
        userId: req.user.id,
        businessId: req.body.businessId,
        businessName: req.body.businessName,
        businessImage: req.body.businessImage,
        items: req.body.items,
        status: req.body.status || "pending",
        subtotal,
        productosBase: req.body.productosBase || null,
        nemyCommission: req.body.nemyCommission || null,
        deliveryFee: finalDeliveryFee,
        total: calculatedTotal,
        paymentMethod: req.body.paymentMethod,
        orderType: req.body.orderType === "pickup" ? "pickup" : "delivery",
        deliveryAddress: req.body.deliveryAddress,
        notes: req.body.notes,
        substitutionPreference: req.body.substitutionPreference,
        itemSubstitutionPreferences: req.body.itemSubstitutionPreferences,
        cashPaymentAmount: req.body.cashPaymentAmount,
        cashChangeAmount: req.body.cashChangeAmount,
        estimatedDeliveryTime,
      };
      await db2.insert(orders2).values(orderData);
      const createdOrder = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.userId, req.user.id))
        .orderBy(desc12(orders2.createdAt))
        .limit(1);
      const orderId = createdOrder[0].id;
      res.json({
        success: true,
        id: orderId,
        orderId,
        order: { id: orderId },
        deliveryFee,
        estimatedDeliveryTime,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router3.get("/", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, inArray: inArray4 } = await import("drizzle-orm");
    let userOrders;
    if (req.query.status === "active") {
      userOrders = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.userId, req.user.id));
      userOrders = userOrders.filter((o) =>
        ["pending", "confirmed", "preparing", "ready", "on_the_way"].includes(
          o.status,
        ),
      );
    } else {
      userOrders = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.userId, req.user.id));
    }
    res.json({ success: true, orders: userOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64 } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq64(orders2.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const { id: userId, role } = req.user;
    const isCustomer = order.userId === userId;
    const isDriver = order.deliveryPersonId === userId;
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: "No autorizado" });
    }
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.post("/:id/assign-driver", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2, users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, and: and33 } = await import("drizzle-orm");
    const orderId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const availableDrivers = await db2
      .select()
      .from(users7)
      .where(
        and33(
          eq64(users7.role, "delivery_driver"),
          eq64(users7.isActive, true),
        ),
      )
      .limit(10);
    if (availableDrivers.length === 0) {
      return res.json({
        success: false,
        message: "No hay repartidores disponibles",
      });
    }
    const driver = availableDrivers[0];
    await db2
      .update(orders2)
      .set({
        deliveryPersonId: driver.id,
        status: "picked_up",
      })
      .where(eq64(orders2.id, orderId));
    res.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.post(
  "/:id/cancel-regret",
  authenticateToken,
  validateCustomerOrderOwnership,
  async (req, res) => {
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.status !== "pending") {
        return res
          .status(400)
          .json({ error: "Solo se pueden cancelar pedidos pendientes" });
      }
      await db2
        .update(orders2)
        .set({ status: "cancelled" })
        .where(eq64(orders2.id, orderId));
      res.json({ success: true, message: "Pedido cancelado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router3.post(
  "/:id/confirm",
  authenticateToken,
  validateCustomerOrderOwnership,
  async (req, res) => {
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      await db2
        .update(orders2)
        .set({
          regretPeriodConfirmed: true,
          regretPeriodConfirmedAt: /* @__PURE__ */ new Date(),
          confirmedToBusinessAt: /* @__PURE__ */ new Date(),
        })
        .where(eq64(orders2.id, orderId));
      res.json({ success: true, message: "Pedido confirmado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router3.post(
  "/:id/complete-delivery",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { calculateDistance: calculateDistance4 } =
        await Promise.resolve().then(() => (init_distance(), distance_exports));
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const driverLat = req.body.latitude ?? req.body.lat;
      const driverLng = req.body.longitude ?? req.body.lng;
      const hasDriverCoords =
        typeof driverLat === "number" && typeof driverLng === "number";
      if (process.env.NODE_ENV === "production") {
        if (!hasDriverCoords) {
          return res
            .status(400)
            .json({ error: "Ubicaci\xF3n requerida para marcar entregado" });
        }
        const deliveryLat =
          order.deliveryLatitude ?? order.deliveryLat ?? order.latitude;
        const deliveryLng =
          order.deliveryLongitude ?? order.deliveryLng ?? order.longitude;
        const hasDeliveryCoords =
          typeof deliveryLat === "number" && typeof deliveryLng === "number";
        if (hasDeliveryCoords) {
          const distanceKm = calculateDistance4(
            Number(driverLat),
            Number(driverLng),
            Number(deliveryLat),
            Number(deliveryLng),
          );
          const maxDistanceMeters = 200;
          if (distanceKm * 1e3 > maxDistanceMeters) {
            return res.status(400).json({
              error:
                "Debes estar m\xE1s cerca del cliente para marcar entregado",
              distanceMeters: Math.round(distanceKm * 1e3),
              maxDistanceMeters,
            });
          }
        }
      }
      await db2
        .update(orders2)
        .set({
          status: "delivered",
          deliveredAt: /* @__PURE__ */ new Date(),
          driverArrivedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq64(orders2.id, orderId));
      if (req.body.deliveryPhoto) {
        try {
          const { CloudinaryService: CloudinaryService2 } =
            await Promise.resolve().then(
              () => (init_cloudinaryService(), cloudinaryService_exports),
            );
          const { deliveryProofs: deliveryProofs2 } =
            await Promise.resolve().then(
              () => (init_schema_mysql(), schema_mysql_exports),
            );
          const photoUrl = await CloudinaryService2.uploadImage(
            req.body.deliveryPhoto,
            "delivery-proofs",
            `proof-${orderId}-${Date.now()}`,
          );
          await db2.insert(deliveryProofs2).values({
            id: crypto.randomUUID(),
            orderId,
            driverId: req.user.id,
            photoUrl,
            latitude: driverLat ? String(driverLat) : "0",
            longitude: driverLng ? String(driverLng) : "0",
            timestamp: /* @__PURE__ */ new Date(),
          });
          await db2
            .update(orders2)
            .set({ deliveryProofPhoto: photoUrl })
            .where(eq64(orders2.id, orderId));
        } catch (photoErr) {
          console.error("Error uploading delivery photo:", photoErr);
        }
      }
      await sendOrderStatusNotification(orderId, order.userId, "delivered");
      res.json({
        success: true,
        message:
          "Pedido marcado como entregado. Esperando confirmaci\xF3n del cliente.",
      });
    } catch (error) {
      console.error("Complete delivery error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router3.post(
  "/:id/confirm-receipt",
  authenticateToken,
  validateCustomerOrderOwnership,
  validateOrderCompletion,
  async (req, res) => {
    try {
      if (
        req.user.role !== "customer" &&
        req.user.role !== "admin" &&
        req.user.role !== "super_admin"
      ) {
        return res
          .status(403)
          .json({
            error: "Solo el cliente puede confirmar la recepci\xF3n del pedido",
          });
      }
      const {
        orders: orders2,
        businesses: businesses3,
        payouts: payouts2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== "delivered")
        return res
          .status(400)
          .json({ error: "El pedido debe estar entregado primero" });
      if (order.confirmedByCustomer)
        return res.status(400).json({ error: "Ya confirmaste este pedido" });
      try {
        await LoyaltyService.awardPointsForOrder(
          order.userId,
          order.id,
          order.total,
        );
      } catch (e) {
        console.error("Error awarding loyalty points:", e);
      }
      const productosBase =
        order.productosBase && order.productosBase > 0
          ? order.productosBase
          : Math.round((order.subtotal || order.total) / 1.15);
      const businessAmount = productosBase;
      const driverAmount = order.deliveryFee || 0;
      const platformAmount =
        order.nemyCommission || Math.round(productosBase * 0.15);
      await db2
        .update(orders2)
        .set({
          confirmedByCustomer: true,
          confirmedByCustomerAt: /* @__PURE__ */ new Date(),
          fundsReleased: true,
          fundsReleasedAt: /* @__PURE__ */ new Date(),
          platformFee: platformAmount,
          businessEarnings: businessAmount,
          deliveryEarnings: driverAmount,
        })
        .where(eq64(orders2.id, orderId));
      const [business] = await db2
        .select({ ownerId: businesses3.ownerId })
        .from(businesses3)
        .where(eq64(businesses3.id, order.businessId))
        .limit(1);
      const businessOwnerId = business?.ownerId || order.businessId;
      const payoutInserts = [];
      if (businessAmount > 0) {
        payoutInserts.push({
          orderId: order.id,
          recipientId: businessOwnerId,
          recipientType: "business",
          amount: businessAmount,
          status: "pending",
        });
      }
      if (order.deliveryPersonId && driverAmount > 0) {
        payoutInserts.push({
          orderId: order.id,
          recipientId: order.deliveryPersonId,
          recipientType: "driver",
          amount: driverAmount,
          status: "pending",
        });
      }
      if (payoutInserts.length > 0) {
        await db2.insert(payouts2).values(payoutInserts);
      }
      res.json({
        success: true,
        message:
          "Pedido confirmado. Payouts creados para negocio y repartidor.",
      });
      if (businessOwnerId) {
        await sendPushToUser(businessOwnerId, {
          title: "\u{1F4B0} Pago liberado",
          body: `El cliente confirm\xF3 la entrega del pedido #${order.id.slice(-6)}`,
          data: { orderId: order.id, screen: "BusinessEarnings" },
        });
      }
      if (order.deliveryPersonId) {
        await sendPushToUser(order.deliveryPersonId, {
          title: "\u{1F4B0} Pago liberado",
          body: `Pedido #${order.id.slice(-6)} confirmado. Tu pago est\xE1 disponible.`,
          data: { orderId: order.id, screen: "DriverEarnings" },
        });
      }
    } catch (error) {
      console.error("Confirm receipt error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router3.post(
  "/:id/pickup",
  authenticateToken,
  requireRole("delivery_driver"),
  validateDriverOrderOwnership,
  async (req, res) => {
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }
      if (!["ready", "picked_up", "preparing"].includes(order.status)) {
        return res.status(400).json({
          error: `No puedes recoger este pedido. Estado actual: ${order.status}`,
        });
      }
      if (order.deliveryPersonId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Este pedido no est\xE1 asignado a ti" });
      }
      await db2
        .update(orders2)
        .set({
          status: "on_the_way",
          driverPickedUpAt: /* @__PURE__ */ new Date(),
        })
        .where(eq64(orders2.id, orderId));
      await sendOrderStatusNotification(orderId, order.userId, "picked_up");
      res.json({
        success: true,
        message: "Pedido recogido. Ahora en camino al cliente.",
        order: {
          id: order.id,
          status: "on_the_way",
          driverPickedUpAt: /* @__PURE__ */ new Date(),
        },
      });
    } catch (error) {
      console.error("Pickup order error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
var orderRoutes_default = router3;

// server/routes/users.ts
import express4 from "express";
import { eq as eq14 } from "drizzle-orm";
var router4 = express4.Router();
router4.put("/push-token", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || !token.startsWith("ExponentPushToken[")) {
      return res.status(400).json({ error: "Token inv\xE1lido" });
    }
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    await db2
      .update(users7)
      .set({ pushToken: token, updatedAt: /* @__PURE__ */ new Date() })
      .where(eq14(users7.id, req.user.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router4.get("/profile/full", authenticateToken, async (req, res) => {
  try {
    const { users: users7, deliveryDrivers: deliveryDrivers3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq14(users7.id, req.user.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    let vehicleType = null,
      vehiclePlate = null,
      vehiclePhoto = null;
    let vehicleBrand = null,
      vehicleModel = null,
      vehicleColor = null,
      vehicleYear = null;
    let vehiclePlatePhoto = null,
      vehicleItvPhoto = null,
      vehicleInsurancePhoto = null,
      vehicleLicensePhoto = null;
    if (user.role === "delivery_driver") {
      const [dd] = await db2
        .select()
        .from(deliveryDrivers3)
        .where(eq14(deliveryDrivers3.userId, user.id))
        .limit(1);
      vehicleType = dd?.vehicleType ?? null;
      vehiclePlate = dd?.vehiclePlate ?? null;
      vehiclePhoto = dd?.vehiclePhoto ?? null;
      vehicleBrand = dd?.vehicleBrand ?? null;
      vehicleModel = dd?.vehicleModel ?? null;
      vehicleColor = dd?.vehicleColor ?? null;
      vehicleYear = dd?.vehicleYear ?? null;
      vehiclePlatePhoto = dd?.vehiclePlatePhoto ?? null;
      vehicleItvPhoto = dd?.vehicleItvPhoto ?? null;
      vehicleInsurancePhoto = dd?.vehicleInsurancePhoto ?? null;
      vehicleLicensePhoto = dd?.vehicleLicensePhoto ?? null;
    }
    res.json({
      success: true,
      dni: user.dni,
      address: user.address,
      vehicleType,
      vehiclePlate,
      vehiclePhoto,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleYear,
      vehiclePlatePhoto,
      vehicleItvPhoto,
      vehicleInsurancePhoto,
      vehicleLicensePhoto,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router4.put("/vehicle", authenticateToken, async (req, res) => {
  try {
    const { deliveryDrivers: deliveryDrivers3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { CloudinaryService: CloudinaryService2 } =
      await Promise.resolve().then(
        () => (init_cloudinaryService(), cloudinaryService_exports),
      );
    const {
      vehicleType,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehicleYear,
      vehiclePlatePhoto,
      vehicleItvPhoto,
      vehicleInsurancePhoto,
      vehicleLicensePhoto,
    } = req.body;
    const updates = {};
    if (vehicleType !== void 0) updates.vehicleType = vehicleType || null;
    if (vehiclePlate !== void 0) updates.vehiclePlate = vehiclePlate || null;
    if (vehicleBrand !== void 0) updates.vehicleBrand = vehicleBrand || null;
    if (vehicleModel !== void 0) updates.vehicleModel = vehicleModel || null;
    if (vehicleColor !== void 0) updates.vehicleColor = vehicleColor || null;
    if (vehicleYear !== void 0) updates.vehicleYear = vehicleYear || null;
    const uploadDoc = async (b64, key) => {
      if (!b64) return void 0;
      if (b64.startsWith("data:image/")) {
        return await CloudinaryService2.uploadImage(
          b64,
          "profiles",
          `driver-${req.user.id}-${key}`,
        );
      }
      return b64;
    };
    const plateUrl = await uploadDoc(vehiclePlatePhoto, "plate");
    const itvUrl = await uploadDoc(vehicleItvPhoto, "itv");
    const insuranceUrl = await uploadDoc(vehicleInsurancePhoto, "insurance");
    const licenseUrl = await uploadDoc(vehicleLicensePhoto, "license");
    if (plateUrl !== void 0) updates.vehiclePlatePhoto = plateUrl;
    if (itvUrl !== void 0) updates.vehicleItvPhoto = itvUrl;
    if (insuranceUrl !== void 0) updates.vehicleInsurancePhoto = insuranceUrl;
    if (licenseUrl !== void 0) updates.vehicleLicensePhoto = licenseUrl;
    const [existing] = await db2
      .select()
      .from(deliveryDrivers3)
      .where(eq14(deliveryDrivers3.userId, req.user.id))
      .limit(1);
    if (existing) {
      await db2
        .update(deliveryDrivers3)
        .set(updates)
        .where(eq14(deliveryDrivers3.userId, req.user.id));
    } else {
      await db2
        .insert(deliveryDrivers3)
        .values({ id: crypto.randomUUID(), userId: req.user.id, ...updates });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router4.get("/profile", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq14(users7.id, req.user.id))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select()
      .from(users7)
      .where(eq14(users7.id, req.params.userId))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profileImage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { name, email, profileImage, dni, address, phone } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== void 0) updates.phone = phone || null;
    if (email !== void 0) updates.email = email || null;
    if (profileImage) updates.profileImage = profileImage;
    if (dni !== void 0) updates.dni = dni || null;
    if (address !== void 0) updates.address = address || null;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar" });
    }
    updates.updatedAt = /* @__PURE__ */ new Date();
    await db2.update(users7).set(updates).where(eq14(users7.id, req.user.id));
    if (address) {
      const { addresses: addresses2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const existing = await db2
        .select()
        .from(addresses2)
        .where(eq14(addresses2.userId, req.user.id))
        .limit(10);
      const defaultAddr = existing.find((a) => a.isDefault) || existing[0];
      if (defaultAddr) {
        await db2
          .update(addresses2)
          .set({ street: address })
          .where(eq14(addresses2.id, defaultAddr.id));
      } else {
        await db2.insert(addresses2).values({
          id: crypto.randomUUID(),
          userId: req.user.id,
          label: "Casa",
          street: address,
          city: "Soria",
          state: "Castilla y Le\xF3n",
          isDefault: true,
        });
      }
    }
    res.json({ success: true, message: "Perfil actualizado" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.post("/profile-image", authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Imagen requerida" });
    if (!image.startsWith("data:image/"))
      return res.status(400).json({ error: "Formato de imagen inv\xE1lido" });
    const estimatedBytes = Math.ceil(image.length * 0.75);
    if (estimatedBytes > 2 * 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "La imagen es muy pesada. M\xE1ximo 2MB" });
    }
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { CloudinaryService: CloudinaryService2 } =
      await Promise.resolve().then(
        () => (init_cloudinaryService(), cloudinaryService_exports),
      );
    const [currentUser] = await db2
      .select()
      .from(users7)
      .where(eq14(users7.id, req.user.id))
      .limit(1);
    if (
      currentUser?.profileImage &&
      currentUser.profileImage.includes("cloudinary")
    ) {
      const oldPublicId = CloudinaryService2.extractPublicId(
        currentUser.profileImage,
      );
      if (oldPublicId)
        await CloudinaryService2.deleteImage(oldPublicId).catch(() => {});
    }
    const imageUrl = await CloudinaryService2.uploadImage(
      image,
      "profiles",
      `user-${req.user.id}`,
    );
    await db2
      .update(users7)
      .set({ profileImage: imageUrl })
      .where(eq14(users7.id, req.user.id));
    res.json({
      success: true,
      profileImage: imageUrl,
      message: "Imagen actualizada",
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ error: error.message });
  }
});
var getAddresses = async (req, res) => {
  try {
    const { addresses: addresses2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const userId = req.params.id || req.user.id;
    const list = await db2
      .select()
      .from(addresses2)
      .where(eq14(addresses2.userId, userId));
    res.json({ success: true, addresses: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router4.get("/addresses", authenticateToken, getAddresses);
router4.get("/:id/addresses", authenticateToken, getAddresses);
var postAddress = async (req, res) => {
  try {
    const { addresses: addresses2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const userId = req.params.id || req.user.id;
    const {
      label,
      street,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault,
    } = req.body;
    if (!label || !street)
      return res.status(400).json({ error: "label y street son requeridos" });
    if (isDefault) {
      await db2
        .update(addresses2)
        .set({ isDefault: false })
        .where(eq14(addresses2.userId, userId));
    }
    const id = crypto.randomUUID();
    await db2.insert(addresses2).values({
      id,
      userId,
      label,
      street,
      city: city || "Soria",
      state: state || "Castilla y Le\xF3n",
      zipCode: zipCode || null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      isDefault: isDefault || false,
    });
    const [saved] = await db2
      .select()
      .from(addresses2)
      .where(eq14(addresses2.id, id))
      .limit(1);
    res.json({ success: true, address: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router4.post("/addresses", authenticateToken, postAddress);
router4.post("/:id/addresses", authenticateToken, postAddress);
router4.put(
  "/:id/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    try {
      const { addresses: addresses2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const {
        label,
        street,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        isDefault,
      } = req.body;
      const updates = {};
      if (label) updates.label = label;
      if (street) updates.street = street;
      if (city) updates.city = city;
      if (state) updates.state = state;
      if (zipCode !== void 0) updates.zipCode = zipCode;
      if (latitude !== void 0) updates.latitude = String(latitude);
      if (longitude !== void 0) updates.longitude = String(longitude);
      if (isDefault !== void 0) updates.isDefault = isDefault;
      await db2
        .update(addresses2)
        .set(updates)
        .where(eq14(addresses2.id, req.params.addressId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router4.delete(
  "/:id/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    try {
      const { addresses: addresses2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      await db2
        .delete(addresses2)
        .where(eq14(addresses2.id, req.params.addressId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router4.post("/addresses", authenticateToken, async (req, res) => {
  try {
    const { address, label, isDefault } = req.body;
    if (!address) {
      return res.status(400).json({ error: "Direcci\xF3n requerida" });
    }
    res.json({
      success: true,
      message: "Direcci\xF3n guardada",
      address: {
        id: crypto.randomUUID(),
        address,
        label: label || "Casa",
        isDefault: isDefault || false,
      },
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ error: error.message });
  }
});
router4.get(
  "/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7, orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      const [userCount] = await db2.execute(
        sql15`SELECT COUNT(*) as count FROM users`,
      );
      const [orderCount] = await db2.execute(
        sql15`SELECT COUNT(*) as count FROM orders`,
      );
      const [activeUsers] = await db2.execute(sql15`
      SELECT COUNT(DISTINCT userId) as count 
      FROM orders 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
      res.json({
        success: true,
        stats: {
          totalUsers: userCount.count,
          totalOrders: orderCount.count,
          activeUsers: activeUsers.count,
        },
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router4.post(
  "/:id/verification-documents",
  authenticateToken,
  async (req, res) => {
    try {
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const userId = req.params.id;
      const { idDocumentUrl, autonomoDocumentUrl } = req.body;
      const updates = { verificationStatus: "pending" };
      if (idDocumentUrl) updates.idDocumentUrl = idDocumentUrl;
      if (autonomoDocumentUrl)
        updates.autonomoDocumentUrl = autonomoDocumentUrl;
      await db2.update(users7).set(updates).where(eq14(users7.id, userId));
      res.json({
        success: true,
        message: "Documentos recibidos. Tu cuenta est\xE1 en revisi\xF3n.",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router4.get("/:id/verification-status", authenticateToken, async (req, res) => {
  try {
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [user] = await db2
      .select({
        verificationStatus: users7.verificationStatus,
        verificationNotes: users7.verificationNotes,
      })
      .from(users7)
      .where(eq14(users7.id, req.params.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true, ...user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router4.post("/change-phone", authenticateToken, async (req, res) => {
  try {
    const { newPhone } = req.body;
    if (!newPhone)
      return res.status(400).json({ error: "Tel\xE9fono requerido" });
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [existing] = await db2
      .select()
      .from(users7)
      .where(eq14(users7.phone, newPhone))
      .limit(1);
    if (existing && existing.id !== req.user.id) {
      return res
        .status(400)
        .json({ error: "Este tel\xE9fono ya est\xE1 registrado" });
    }
    const twilio2 = __require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    await twilio2.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: newPhone,
        channel: "sms",
      });
    res.json({
      success: true,
      message: "C\xF3digo enviado al nuevo tel\xE9fono",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router4.post("/verify-phone-change", authenticateToken, async (req, res) => {
  try {
    const { newPhone, code } = req.body;
    if (!newPhone || !code)
      return res
        .status(400)
        .json({ error: "Tel\xE9fono y c\xF3digo requeridos" });
    const twilio2 = __require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    const check = await twilio2.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: newPhone,
        code,
      });
    if (check.status !== "approved") {
      return res.status(400).json({ error: "C\xF3digo incorrecto" });
    }
    const { users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    await db2
      .update(users7)
      .set({ phone: newPhone, updatedAt: /* @__PURE__ */ new Date() })
      .where(eq14(users7.id, req.user.id));
    res.json({
      success: true,
      message: "Tel\xE9fono actualizado correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var users_default = router4;

// server/routes/delivery.ts
import express5 from "express";
import { eq as eq15, and as and6, inArray } from "drizzle-orm";
var router5 = express5.Router();
router5.get("/config", (req, res) => {
  res.json({
    success: true,
    config: { tier1: 2.5, tier2: 4, tier3: 5, extraPerKm: 1 },
  });
});
router5.get(
  "/active-order",
  authenticateToken,
  requireRole("delivery_driver"),
  async (req, res) => {
    try {
      const { orders: orders2, businesses: businesses3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const activeOrders = await db2
        .select()
        .from(orders2)
        .where(
          and6(
            eq15(orders2.deliveryPersonId, req.user.id),
            inArray(orders2.status, ["picked_up", "on_the_way", "ready"]),
          ),
        )
        .limit(1);
      if (!activeOrders.length) return res.json({ success: true, order: null });
      const order = activeOrders[0];
      const [biz] = await db2
        .select({ name: businesses3.name, address: businesses3.address })
        .from(businesses3)
        .where(eq15(businesses3.id, order.businessId))
        .limit(1);
      res.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          businessName: biz?.name ?? order.businessName ?? "Negocio",
          deliveryAddress: order.deliveryAddress,
          deliveryLatitude: order.deliveryLatitude,
          deliveryLongitude: order.deliveryLongitude,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router5.get(
  "/drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const drivers3 = await db2
        .select({
          id: users7.id,
          name: users7.name,
          phone: users7.phone,
          isActive: users7.isActive,
          createdAt: users7.createdAt,
        })
        .from(users7)
        .where(
          and6(
            eq15(users7.role, "delivery_driver"),
            eq15(users7.isActive, true),
          ),
        );
      res.json({ success: true, drivers: drivers3 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router5.post(
  "/assign",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orderId, driverId } = req.body;
      if (!orderId || !driverId)
        return res
          .status(400)
          .json({ error: "ID de pedido y conductor requeridos" });
      const { orders: orders2, users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq15(orders2.id, orderId))
        .limit(1);
      if (!order)
        return res.status(404).json({ error: "Pedido no encontrado" });
      const [driver] = await db2
        .select()
        .from(users7)
        .where(
          and6(
            eq15(users7.id, driverId),
            eq15(users7.role, "delivery_driver"),
            eq15(users7.isActive, true),
          ),
        )
        .limit(1);
      if (!driver)
        return res.status(404).json({ error: "Conductor no encontrado" });
      await db2
        .update(orders2)
        .set({
          driverId,
          status: "picked_up",
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq15(orders2.id, orderId));
      res.json({ success: true, message: "Conductor asignado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var delivery_default = router5;

// server/routes/payments.ts
import express6 from "express";
import { eq as eq18 } from "drizzle-orm";
var router6 = express6.Router();
router6.get("/info", authenticateToken, async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [rows] = await db2.execute(
      "SELECT provider, account_data FROM payment_receiving_accounts WHERE is_active = TRUE",
    );
    const data = {
      success: true,
      bizum: "",
      iban: "",
      paypalEmail: "",
      titular: "ComeYa S.L.",
      banco: "",
    };
    rows.forEach((row) => {
      const d = row.account_data;
      if (row.provider === "bizum") {
        data.bizum = d.phone || "";
        data.titular = d.name || data.titular;
      }
      if (row.provider === "transferencia") {
        data.iban = d.iban || "";
        data.titular = d.titular || data.titular;
        data.banco = d.banco || "";
      }
      if (row.provider === "paypal") {
        data.paypalEmail = d.email || "";
      }
    });
    res.json(data);
  } catch (error) {
    const { CONFIG: CONFIG2 } = await Promise.resolve().then(
      () => (init_config(), config_exports),
    );
    res.json({
      success: true,
      bizum: await CONFIG2.bizumPhone(),
      iban: await CONFIG2.iban(),
      paypalEmail: await CONFIG2.paypalEmail(),
      titular: await CONFIG2.titular(),
      banco: await CONFIG2.banco(),
    });
  }
});
router6.post("/upload-proof-image", authenticateToken, async (req, res) => {
  try {
    const multer = (await import("multer")).default;
    const cloudinary2 = (await import("cloudinary")).v2;
    cloudinary2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const upload = multer({ storage: multer.memoryStorage() }).single("file");
    upload(req, res, async (err) => {
      if (err)
        return res.status(400).json({ success: false, error: err.message });
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, error: "No se recibi\xF3 archivo" });
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary2.uploader.upload_stream(
          { folder: "payment_proofs", resource_type: "image" },
          (error, result2) => (error ? reject(error) : resolve(result2)),
        );
        stream.end(req.file.buffer);
      });
      res.json({ success: true, url: result.secure_url });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router6.post("/submit-proof", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      imageUrl,
      referenceNumber,
      senderName,
      amount,
      paymentMethod,
    } = req.body;
    const userId = req.user?.id;
    if (!orderId || !imageUrl || !referenceNumber) {
      return res
        .status(400)
        .json({ error: "orderId, imageUrl y referenceNumber son requeridos" });
    }
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { orders: orders2, paymentProofs: paymentProofs2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { randomUUID: randomUUID2 } = await import("crypto");
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq18(orders2.id, orderId))
      .limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    const { sql: drizzleSql } = await import("drizzle-orm");
    const [existing] = await db2
      .select()
      .from(paymentProofs2)
      .where(
        drizzleSql`reference_number = ${referenceNumber.trim()} AND id != 'none'`,
      )
      .limit(1);
    if (existing) {
      return res
        .status(409)
        .json({ error: "Este comprobante ya fue enviado anteriormente" });
    }
    const proofId = randomUUID2();
    await db2.insert(paymentProofs2).values({
      id: proofId,
      orderId,
      userId,
      paymentProvider: paymentMethod || order.paymentMethod || "bizum",
      proofImageUrl: imageUrl,
      referenceNumber: referenceNumber.trim(),
      amount: amount || order.total,
      status: "pending",
      submittedAt: /* @__PURE__ */ new Date(),
    });
    if (senderName) {
      await db2.execute(
        drizzleSql`UPDATE payment_proofs SET verification_notes = ${`Remitente: ${senderName}`} WHERE id = ${proofId}`,
      );
    }
    try {
      const { autoVerificationService: autoVerificationService2 } =
        await Promise.resolve().then(
          () => (
            init_autoVerificationService(),
            autoVerificationService_exports
          ),
        );
      const result = await autoVerificationService2.shouldAutoApprove(proofId);
      if (result.autoApprove) {
        await db2
          .update(orders2)
          .set({
            status: "confirmed",
            paidAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date(),
          })
          .where(eq18(orders2.id, orderId));
        await db2.execute(
          drizzleSql`UPDATE payment_proofs SET status = 'approved', verified_at = NOW() WHERE id = ${proofId}`,
        );
        return res.json({
          success: true,
          proofId,
          autoApproved: true,
          message: "Pago verificado autom\xE1ticamente",
        });
      }
    } catch {}
    try {
      const { notifyAdminNewProof: notifyAdminNewProof2 } =
        await Promise.resolve().then(
          () => (init_websocket(), websocket_exports),
        );
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [u] = await db2
        .select({ name: users7.name })
        .from(users7)
        .where(eq18(users7.id, userId))
        .limit(1);
      notifyAdminNewProof2({
        proofId,
        orderId,
        userName: u?.name ?? "Cliente",
        amount: amount || order.total,
        method: paymentMethod || order.paymentMethod || "bizum",
      });
    } catch {}
    res.json({
      success: true,
      proofId,
      autoApproved: false,
      message: "Comprobante recibido. Ser\xE1 verificado en breve.",
    });
  } catch (error) {
    console.error("Submit proof error:", error);
    res.status(500).json({ error: error.message });
  }
});
router6.get("/proofs/pending", authenticateToken, async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { sql: drizzleSql } = await import("drizzle-orm");
    const [rows] = await db2.execute(
      drizzleSql`
        SELECT pp.*, o.business_name, o.total as order_total, u.name as user_name, u.phone as user_phone
        FROM payment_proofs pp
        LEFT JOIN orders o ON pp.order_id = o.id
        LEFT JOIN users u ON pp.user_id = u.id
        WHERE pp.status = 'pending'
        ORDER BY pp.submitted_at DESC
      `,
    );
    res.json({ success: true, proofs: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router6.post(
  "/proofs/:proofId/approve",
  authenticateToken,
  async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { orders: orders2, paymentProofs: paymentProofs2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { sql: drizzleSql } = await import("drizzle-orm");
      const { proofId } = req.params;
      const [proof] = await db2
        .select()
        .from(paymentProofs2)
        .where(drizzleSql`id = ${proofId}`)
        .limit(1);
      if (!proof)
        return res.status(404).json({ error: "Comprobante no encontrado" });
      await db2.execute(
        drizzleSql`UPDATE payment_proofs SET status = 'approved', verified_by = ${req.user.id}, verified_at = NOW() WHERE id = ${proofId}`,
      );
      await db2
        .update(orders2)
        .set({
          status: "confirmed",
          paidAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq18(orders2.id, proof.orderId));
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        await sendPushToUser2(proof.userId, {
          title: "\u2705 Pago confirmado",
          body: "Tu comprobante fue verificado. Tu pedido est\xE1 confirmado.",
          data: { orderId: proof.orderId, screen: "OrderTracking" },
        });
      } catch {}
      res.json({ success: true, message: "Comprobante aprobado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router6.post("/proofs/:proofId/reject", authenticateToken, async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { paymentProofs: paymentProofs2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { sql: drizzleSql } = await import("drizzle-orm");
    const { proofId } = req.params;
    const { reason } = req.body;
    const [proof] = await db2
      .select()
      .from(paymentProofs2)
      .where(drizzleSql`id = ${proofId}`)
      .limit(1);
    if (!proof)
      return res.status(404).json({ error: "Comprobante no encontrado" });
    await db2.execute(
      drizzleSql`UPDATE payment_proofs SET status = 'rejected', verified_by = ${req.user.id}, verified_at = NOW(), verification_notes = ${reason || "Rechazado por admin"} WHERE id = ${proofId}`,
    );
    try {
      const { sendPushToUser: sendPushToUser2 } = await Promise.resolve().then(
        () => (init_enhancedPushService(), enhancedPushService_exports),
      );
      await sendPushToUser2(proof.userId, {
        title: "\u274C Comprobante rechazado",
        body:
          reason || "Tu comprobante no pudo ser verificado. Contacta soporte.",
        data: { orderId: proof.orderId, screen: "OrderTracking" },
      });
    } catch {}
    res.json({ success: true, message: "Comprobante rechazado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router6.post("/analyze-proof", authenticateToken, async (req, res) => {
  try {
    const { imageBase64, expectedAmount, paymentMethod } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: "imageBase64 requerido" });
    const { GoogleGenerativeAI: GoogleGenerativeAI2 } = await import(
      "@google/generative-ai"
    );
    const genAI = new GoogleGenerativeAI2(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analiza este comprobante de pago bancario/transferencia y extrae:
1. referenceNumber: n\xFAmero de referencia, localizador o ID de transacci\xF3n
2. amount: importe en euros (solo n\xFAmero)
3. senderName: nombre del remitente
4. date: fecha de la transacci\xF3n
5. bankName: nombre del banco
6. isValid: true si parece un comprobante leg\xEDtimo

Responde SOLO con JSON v\xE1lido sin markdown. Ejemplo:
{"referenceNumber":"123456","amount":25.50,"senderName":"Juan Garc\xEDa","date":"2024-04-22","bankName":"Santander","isValid":true}`;
    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      prompt,
    ]);
    const text2 = result.response
      .text()
      .replace(/```json|```/g, "")
      .trim();
    const extracted = JSON.parse(text2);
    res.json({ success: true, extracted });
  } catch (error) {
    console.error("OCR analyze error:", error);
    res.json({ success: false, error: error.message });
  }
});
router6.post("/create-session", authenticateToken, async (req, res) => {
  try {
    const { orderId, amount, provider } = req.body;
    if (!orderId || !amount || !provider) {
      return res
        .status(400)
        .json({ error: "orderId, amount y provider son requeridos" });
    }
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq18(orders2.id, orderId))
      .limit(1);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    const amountEur = amount / 100;
    switch (provider) {
      case "stripe_card":
      case "stripe_bizum": {
        const stripe2 = (await import("stripe")).default;
        const stripeClient = new stripe2(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2024-06-20",
        });
        const paymentMethods2 =
          provider === "stripe_bizum" ? ["bizum"] : ["card"];
        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: paymentMethods2,
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: { name: `Pedido ComeYa #${orderId.slice(-6)}` },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.BACKEND_URL}/api/payments/success?orderId=${orderId}&provider=${provider}`,
          cancel_url: `${process.env.BACKEND_URL}/api/payments/cancel?orderId=${orderId}`,
          metadata: { orderId, provider },
        });
        return res.json({ url: session.url, sessionId: session.id });
      }
      case "paypal": {
        const base =
          process.env.PAYPAL_MODE === "live"
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
        const tokenData = await tokenRes.json();
        const orderRes = await fetch(`${base}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenData.access_token}`,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                reference_id: orderId,
                amount: { currency_code: "EUR", value: amountEur.toFixed(2) },
              },
            ],
            application_context: {
              return_url: `${process.env.BACKEND_URL}/api/payments/success?orderId=${orderId}&provider=paypal`,
              cancel_url: `${process.env.BACKEND_URL}/api/payments/cancel?orderId=${orderId}`,
            },
          }),
        });
        const paypalOrder = await orderRes.json();
        const approveLink = paypalOrder.links?.find(
          (l) => l.rel === "approve",
        )?.href;
        return res.json({ url: approveLink, paypalOrderId: paypalOrder.id });
      }
      case "binance": {
        const crypto2 = await import("crypto");
        const nonce = crypto2.randomBytes(16).toString("hex");
        const timestamp2 = Date.now();
        const merchantId = process.env.BINANCE_MERCHANT_ID;
        const apiKey = process.env.BINANCE_API_KEY;
        const secretKey = process.env.BINANCE_SECRET_KEY;
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
        const payload = `${timestamp2}
${nonce}
${body}
`;
        const signature = crypto2
          .createHmac("sha512", secretKey)
          .update(payload)
          .digest("hex")
          .toUpperCase();
        const binanceRes = await fetch(
          "https://bpay.binanceapi.com/binancepay/openapi/v2/order",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "BinancePay-Timestamp": String(timestamp2),
              "BinancePay-Nonce": nonce,
              "BinancePay-Certificate-SN": apiKey,
              "BinancePay-Signature": signature,
            },
            body,
          },
        );
        const binanceData = await binanceRes.json();
        return res.json({
          url: binanceData.data?.checkoutUrl,
          binanceOrderId: binanceData.data?.prepayId,
        });
      }
      default:
        return res.status(400).json({ error: "Provider no soportado" });
    }
  } catch (error) {
    console.error("Create payment session error:", error);
    res.status(500).json({ error: error.message });
  }
});
router6.get("/success", async (req, res) => {
  try {
    const { orderId, provider, token } = req.query;
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    if (!orderId) {
      return res.status(400).send("<h2>Error: orderId no encontrado</h2>");
    }
    if (provider === "paypal" && token) {
      const base =
        process.env.PAYPAL_MODE === "live"
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
      const tokenData = await tokenRes.json();
      await fetch(`${base}/v2/checkout/orders/${token}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
    }
    await db2
      .update(orders2)
      .set({
        status: "accepted",
        paidAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq18(orders2.id, orderId));
    const deepLink = `comeya://order-confirmed?orderId=${orderId}`;
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
  } catch (error) {
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
router6.get("/cancel", async (req, res) => {
  const { orderId } = req.query;
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
router6.post(
  "/webhook/stripe",
  express6.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const { handleStripeWebhook: handleStripeWebhook2 } =
        await Promise.resolve().then(
          () => (init_webhookHandlers(), webhookHandlers_exports),
        );
      return handleStripeWebhook2(req, res);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);
router6.post("/webhook/binance", async (req, res) => {
  try {
    const { bizType, data } = req.body;
    if (bizType === "PAY" && data?.merchantTradeNo) {
      const orderId = data.merchantTradeNo;
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      await db2
        .update(orders2)
        .set({ status: "confirmed", updatedAt: /* @__PURE__ */ new Date() })
        .where(eq18(orders2.id, orderId));
    }
    res.json({ returnCode: "SUCCESS", returnMessage: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var payments_default = router6;

// server/routes/wallet.ts
import express7 from "express";
import { eq as eq19, desc as desc4 } from "drizzle-orm";
var router7 = express7.Router();
router7.get("/", authenticateToken, async (req, res) => {
  try {
    const { wallets: wallets2, transactions: transactions3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    let [wallet] = await db2
      .select()
      .from(wallets2)
      .where(eq19(wallets2.userId, req.user.id))
      .limit(1);
    if (!wallet) {
      const newWallet = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        createdAt: /* @__PURE__ */ new Date(),
      };
      await db2.insert(wallets2).values(newWallet);
      wallet = newWallet;
    }
    const recentTransactions = await db2
      .select()
      .from(transactions3)
      .where(eq19(transactions3.userId, req.user.id))
      .orderBy(desc4(transactions3.createdAt))
      .limit(10);
    res.json({
      success: true,
      wallet: {
        ...wallet,
        balancePesos: wallet.balance / 100,
        pendingBalancePesos: wallet.pendingBalance / 100,
        totalEarnedPesos: wallet.totalEarned / 100,
      },
      transactions: recentTransactions.map((t) => ({
        ...t,
        amountPesos: t.amount / 100,
      })),
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: error.message });
  }
});
router7.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { transactions: transactions3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const userTransactions = await db2
      .select()
      .from(transactions3)
      .where(eq19(transactions3.userId, req.user.id))
      .orderBy(desc4(transactions3.createdAt));
    res.json({
      success: true,
      transactions: userTransactions.map((t) => ({
        ...t,
        amountPesos: t.amount / 100,
      })),
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: error.message });
  }
});
router7.get("/balance", authenticateToken, async (req, res) => {
  try {
    const { wallets: wallets2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [wallet] = await db2
      .select()
      .from(wallets2)
      .where(eq19(wallets2.userId, req.user.id))
      .limit(1);
    if (!wallet) {
      return res.json({
        success: true,
        balance: 0,
        balancePesos: 0,
        pendingBalance: 0,
        pendingBalancePesos: 0,
      });
    }
    res.json({
      success: true,
      balance: wallet.balance,
      balancePesos: wallet.balance / 100,
      pendingBalance: wallet.pendingBalance,
      pendingBalancePesos: wallet.pendingBalance / 100,
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: error.message });
  }
});
router7.post("/withdraw", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Monto inv\xE1lido" });
    }
    if (!["delivery_driver", "business_owner"].includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para retiros" });
    }
    const { wallets: wallets2, transactions: transactions3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [wallet] = await db2
      .select()
      .from(wallets2)
      .where(eq19(wallets2.userId, req.user.id))
      .limit(1);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet no encontrada" });
    }
    const amountCentavos = Math.round(amount * 100);
    if (wallet.balance < amountCentavos) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }
    const withdrawalTransaction = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      type: "withdrawal",
      amount: -amountCentavos,
      description: `Retiro de $${amount}`,
      status: "pending",
      createdAt: /* @__PURE__ */ new Date(),
    };
    await db2.insert(transactions3).values(withdrawalTransaction);
    await db2
      .update(wallets2)
      .set({
        balance: wallet.balance - amountCentavos,
        pendingBalance: wallet.pendingBalance + amountCentavos,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq19(wallets2.userId, req.user.id));
    res.json({
      success: true,
      message: "Solicitud de retiro creada",
      transaction: {
        ...withdrawalTransaction,
        amountPesos: withdrawalTransaction.amount / 100,
      },
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    res.status(500).json({ error: error.message });
  }
});
router7.get("/withdrawals", authenticateToken, async (req, res) => {
  try {
    const { transactions: transactions3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const withdrawals2 = await db2
      .select()
      .from(transactions3)
      .where(eq19(transactions3.userId, req.user.id))
      .orderBy(desc4(transactions3.createdAt));
    const withdrawalTransactions = withdrawals2.filter(
      (t) => t.type === "withdrawal",
    );
    res.json({
      success: true,
      withdrawals: withdrawalTransactions.map((t) => ({
        ...t,
        amountPesos: Math.abs(t.amount) / 100,
      })),
    });
  } catch (error) {
    console.error("Get withdrawals error:", error);
    res.status(500).json({ error: error.message });
  }
});
var wallet_default = router7;

// server/routes/adminRoutes.ts
import express8 from "express";
import { sql as sql3 } from "drizzle-orm";
var router8 = express8.Router();
router8.get(
  "/dashboard/metrics",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        users: users7,
        businesses: businesses3,
        orders: orders2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const allUsers = await db2.select().from(users7);
      const allBusinesses = await db2.select().from(businesses3);
      const allOrders = await db2.select().from(orders2);
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter((o) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= today;
      });
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentOrders = allOrders.filter((o) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= sevenDaysAgo;
      });
      const ordersToShow = todayOrders.length > 0 ? todayOrders : recentOrders;
      const timeframe = todayOrders.length > 0 ? "hoy" : "\xFAltimos 7 d\xEDas";
      const cancelledToday = ordersToShow.filter(
        (o) => o.status === "cancelled",
      ).length;
      const driversOnline = allUsers.filter(
        (u) => u.role === "delivery_driver" && u.isActive,
      ).length;
      const totalDrivers = allUsers.filter(
        (u) => u.role === "delivery_driver",
      ).length;
      const pausedBusinesses = allBusinesses.filter((b) => !b.isActive).length;
      const totalBusinesses = allBusinesses.length;
      const activeOrdersCount = allOrders.filter((o) =>
        ["pending", "confirmed", "preparing", "on_the_way"].includes(o.status),
      ).length;
      const todayRevenue = ordersToShow
        .filter((o) => o.status === "delivered")
        .reduce((sum3, o) => sum3 + o.total, 0);
      res.json({
        activeOrders: activeOrdersCount,
        ordersToday: ordersToShow.length,
        onlineDrivers: driversOnline,
        todayOrders: ordersToShow.length,
        todayRevenue,
        cancelledToday,
        cancellationRate:
          ordersToShow.length > 0
            ? ((cancelledToday / ordersToShow.length) * 100).toFixed(1) + "%"
            : "0%",
        avgDeliveryTime: 35,
        driversOnline,
        totalDrivers,
        pausedBusinesses,
        totalBusinesses,
        timeframe,
        timestamp: /* @__PURE__ */ new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/dashboard/active-orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        orders: orders2,
        users: users7,
        businesses: businesses3,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, inArray: inArray4 } = await import("drizzle-orm");
      const activeOrders = await db2
        .select()
        .from(orders2)
        .where(
          inArray4(orders2.status, [
            "pending",
            "confirmed",
            "preparing",
            "on_the_way",
          ]),
        );
      const ordersWithDetails = [];
      for (const order of activeOrders) {
        const customer = await db2
          .select({ id: users7.id, name: users7.name })
          .from(users7)
          .where(eq64(users7.id, order.userId))
          .limit(1);
        const business = await db2
          .select({
            id: businesses3.id,
            name: businesses3.name,
            latitude: businesses3.latitude,
            longitude: businesses3.longitude,
          })
          .from(businesses3)
          .where(eq64(businesses3.id, order.businessId))
          .limit(1);
        let driver = null;
        if (order.deliveryPersonId) {
          const driverData = await db2
            .select({
              id: users7.id,
              name: users7.name,
              isOnline: users7.isActive,
            })
            .from(users7)
            .where(eq64(users7.id, order.deliveryPersonId))
            .limit(1);
          driver = driverData[0] || null;
        }
        ordersWithDetails.push({
          id: order.id,
          status: order.status,
          total: order.total || 0,
          createdAt: order.createdAt,
          customer: customer[0] || { id: "", name: "Cliente" },
          business: business[0] || {
            id: "",
            name: "Negocio",
            latitude: null,
            longitude: null,
          },
          deliveryAddress: {
            latitude: order.deliveryLatitude,
            longitude: order.deliveryLongitude,
            address: order.deliveryAddress || "Direcci\xF3n no disponible",
          },
          driver,
        });
      }
      res.json({ orders: ordersWithDetails });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/dashboard/online-drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const drivers3 = await db2
        .select()
        .from(users7)
        .where(eq64(users7.role, "delivery_driver"));
      const driversWithDetails = drivers3.map((driver) => ({
        id: driver.id,
        name: driver.name,
        isOnline: driver.isActive,
        lastActiveAt: driver.createdAt,
        location: {
          latitude: "20.6736",
          longitude: "-104.3647",
          updatedAt: /* @__PURE__ */ new Date().toISOString(),
        },
        activeOrder: null,
      }));
      res.json({ drivers: driversWithDetails });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/users",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const allUsers = await db2.select().from(users7);
      res.json({ success: true, users: allUsers });
    } catch (error) {
      console.error("Users endpoint error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router8.put(
  "/users/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { name, email, phone, role, isActive } = req.body;
      const userId = req.params.id;
      const updates = {};
      if (name !== void 0) updates.name = name;
      if (email !== void 0) updates.email = email;
      if (phone !== void 0) updates.phone = phone;
      if (role !== void 0) updates.role = role;
      if (isActive !== void 0) updates.isActive = isActive;
      await db2.update(users7).set(updates).where(eq64(users7.id, userId));
      res.json({ success: true, message: "Usuario actualizado correctamente" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/orders",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        orders: orders2,
        businesses: businesses3,
        users: users7,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
      const allOrders = await db2
        .select()
        .from(orders2)
        .orderBy(desc12(orders2.createdAt));
      const enrichedOrders = [];
      for (const order of allOrders) {
        const business = await db2
          .select({ name: businesses3.name })
          .from(businesses3)
          .where(eq64(businesses3.id, order.businessId))
          .limit(1);
        const customer = await db2
          .select({ name: users7.name, phone: users7.phone })
          .from(users7)
          .where(eq64(users7.id, order.userId))
          .limit(1);
        enrichedOrders.push({
          id: order.id,
          userId: order.userId,
          businessId: order.businessId,
          businessName: business[0]?.name || order.businessName || "Negocio",
          businessImage: order.businessImage,
          customerName: customer[0]?.name || "Cliente",
          customerPhone: customer[0]?.phone || "",
          status: order.status,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          total: order.total,
          paymentMethod: order.paymentMethod,
          deliveryAddress: order.deliveryAddress,
          items: order.items,
          notes: order.notes,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
          deliveryPersonId: order.deliveryPersonId,
        });
      }
      res.json({ success: true, orders: enrichedOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/businesses/:id/products",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { products: products3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const businessProducts = await db2
        .select()
        .from(products3)
        .where(eq64(products3.businessId, req.params.id));
      res.json({ success: true, products: businessProducts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/businesses",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const allBusinesses = await db2
        .select()
        .from(businesses3)
        .orderBy(businesses3.createdAt);
      res.json({ success: true, businesses: allBusinesses });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.put(
  "/businesses/:id/commission",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { customCommission } = req.body;
      const val =
        customCommission === null || customCommission === void 0
          ? null
          : parseInt(String(customCommission));
      if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Comisi\xF3n debe ser entre 0 y 100",
          });
      }
      await db2
        .update(businesses3)
        .set({ customCommission: val })
        .where(eq64(businesses3.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router8.put(
  "/businesses/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { name, address, phone, type, isActive, customCommission } =
        req.body;
      await db2
        .update(businesses3)
        .set({
          ...(name !== void 0 && { name }),
          ...(address !== void 0 && { address }),
          ...(phone !== void 0 && { phone }),
          ...(type !== void 0 && { type }),
          ...(isActive !== void 0 && { isActive }),
          // null = usa comision global, numero = comision especifica
          ...(customCommission !== void 0 && {
            customCommission:
              customCommission === null ? null : parseInt(customCommission),
          }),
        })
        .where(eq64(businesses3.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router8.get(
  "/zones",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, zones: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/delivery-zones",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryZones: deliveryZones2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const zones = await db2.select().from(deliveryZones2);
      res.json({
        success: true,
        zones,
      });
    } catch (error) {
      console.error("Delivery zones error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/drivers",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        users: users7,
        deliveryDrivers: deliveryDrivers3,
        payouts: payouts2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, and: and33 } = await import("drizzle-orm");
      const driverUsers = await db2
        .select()
        .from(users7)
        .where(eq64(users7.role, "delivery_driver"));
      const enriched = await Promise.all(
        driverUsers.map(async (u) => {
          const [dd] = await db2
            .select()
            .from(deliveryDrivers3)
            .where(eq64(deliveryDrivers3.userId, u.id))
            .limit(1);
          const pendingPays = await db2
            .select()
            .from(payouts2)
            .where(
              and33(
                eq64(payouts2.recipientId, u.id),
                eq64(payouts2.status, "pending"),
              ),
            );
          const pendingAmount = pendingPays.reduce((s, p) => s + p.amount, 0);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            isOnline: u.isOnline,
            isActive: u.isActive,
            isBlocked: dd?.isBlocked ?? false,
            blockedReason: dd?.blockedReason ?? null,
            strikes: dd?.strikes ?? 0,
            totalDeliveries: dd?.totalDeliveries ?? 0,
            rating: dd?.rating ?? null,
            vehicleType: dd?.vehicleType ?? null,
            vehiclePlate: dd?.vehiclePlate ?? null,
            currentLatitude: dd?.currentLatitude ?? null,
            currentLongitude: dd?.currentLongitude ?? null,
            createdAt: u.createdAt,
            lastActiveAt: u.lastActiveAt,
            pendingPayouts: pendingPays.length,
            pendingAmount,
          };
        }),
      );
      res.json({ success: true, drivers: enriched });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.post(
  "/drivers/:id/block",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryDrivers: deliveryDrivers3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { reason } = req.body;
      await db2
        .update(deliveryDrivers3)
        .set({
          isBlocked: true,
          blockedReason: reason ?? "Bloqueado por admin",
        })
        .where(eq64(deliveryDrivers3.userId, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.post(
  "/drivers/:id/unblock",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deliveryDrivers: deliveryDrivers3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      await db2
        .update(deliveryDrivers3)
        .set({ isBlocked: false, blockedReason: null })
        .where(eq64(deliveryDrivers3.userId, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.post(
  "/drivers/:id/strike",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason?.trim())
        return res
          .status(400)
          .json({ error: "La raz\xF3n del strike es requerida" });
      const { addStrike: addStrike2 } = await Promise.resolve().then(
        () => (init_strikeService(), strikeService_exports),
      );
      await addStrike2(req.params.id, reason.trim());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.delete(
  "/drivers/:id/strike",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { removeStrike: removeStrike2 } = await Promise.resolve().then(
        () => (init_strikeService(), strikeService_exports),
      );
      await removeStrike2(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get("/debug/wallets-noauth", async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const result = await db2.execute(sql3`
      SELECT 
        w.id, w.user_id, w.balance, w.pending_balance, w.total_earned, w.total_withdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id 
      ORDER BY w.total_earned DESC
    `);
    res.json({ success: true, wallets: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router8.get(
  "/debug/wallets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const result = await db2.execute(sql3`
      SELECT 
        w.id, w.userId, w.balance, w.pendingBalance, w.totalEarned, w.totalWithdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.userId = u.id 
      ORDER BY w.totalEarned DESC
    `);
      res.json({ success: true, wallets: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/wallets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const result = await db2.execute(sql3`
      SELECT 
        w.id, w.user_id as userId, w.balance, w.pending_balance as pendingBalance, 
        w.total_earned as totalEarned, w.total_withdrawn as totalWithdrawn,
        u.id as user_id, u.name as user_name, u.phone as user_phone, u.role as user_role
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id
    `);
      const rows = Array.isArray(result[0]) ? result[0] : result;
      const walletsWithUsers = rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        balance: row.balance || 0,
        pendingBalance: row.pendingBalance || 0,
        totalEarned: row.totalEarned || 0,
        totalWithdrawn: row.totalWithdrawn || 0,
        user: row.user_name
          ? {
              id: row.user_id,
              name: row.user_name,
              phone: row.user_phone,
              role: row.user_role,
            }
          : null,
      }));
      res.json({ success: true, wallets: walletsWithUsers });
    } catch (error) {
      console.error("Wallets error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router8.post(
  "/wallets/:walletId/release",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { wallets: wallets2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const [wallet] = await db2
        .select()
        .from(wallets2)
        .where(eq64(wallets2.id, req.params.walletId))
        .limit(1);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      if (wallet.pendingBalance <= 0) {
        return res.status(400).json({ error: "No pending balance to release" });
      }
      await db2
        .update(wallets2)
        .set({
          balance: wallet.balance + wallet.pendingBalance,
          pendingBalance: 0,
        })
        .where(eq64(wallets2.id, req.params.walletId));
      res.json({ success: true, message: "Balance released successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/finance",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { transactions: transactions3, users: users7 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
      const allTransactions = await db2
        .select()
        .from(transactions3)
        .orderBy(desc12(transactions3.createdAt));
      const enrichedTransactions = [];
      for (const transaction of allTransactions) {
        const user = await db2
          .select({
            id: users7.id,
            name: users7.name,
            email: users7.email,
            role: users7.role,
          })
          .from(users7)
          .where(eq64(users7.id, transaction.userId))
          .limit(1);
        enrichedTransactions.push({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt,
          userId: transaction.userId,
          userName: user[0]?.name || "Usuario desconocido",
          userEmail: user[0]?.email || "",
          userRole: user[0]?.role || "",
        });
      }
      res.json({
        success: true,
        transactions: enrichedTransactions,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/coupons",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, coupons: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/support/tickets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, tickets: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/support",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({ success: true, tickets: [] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/logs",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const result = await db2.execute(sql3`
      SELECT 
        id,
        user_id as userId,
        action,
        entity_type as entityType,
        entity_id as entityId,
        changes,
        ip_address as ipAddress,
        user_agent as userAgent,
        created_at as createdAt
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);
      const rows = Array.isArray(result[0]) ? result[0] : result;
      res.json({ success: true, logs: rows });
    } catch (error) {
      console.error("Admin logs error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings: systemSettings2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const settings = await db2.select().from(systemSettings2);
      res.json({ success: true, settings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.put(
  "/settings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { systemSettings: systemSettings2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { key, value } = req.body;
      if (!key || value === void 0) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      const [existing] = await db2
        .select()
        .from(systemSettings2)
        .where(eq64(systemSettings2.key, key))
        .limit(1);
      if (existing) {
        await db2
          .update(systemSettings2)
          .set({ value: String(value), updatedBy: req.user.id })
          .where(eq64(systemSettings2.key, key));
      } else {
        await db2.insert(systemSettings2).values({
          key,
          value: String(value),
          type: typeof value === "number" ? "number" : "string",
          category: "operations",
          updatedBy: req.user.id,
        });
      }
      res.json({ success: true, message: "Setting updated successfully" });
    } catch (error) {
      console.error("Settings update error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
var adminRoutes_default = router8;
router8.get(
  "/verifications/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        users: users7,
        deliveryDrivers: deliveryDrivers3,
        businesses: businesses3,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { inArray: inArray4, eq: eq64 } = await import("drizzle-orm");
      const pending = await db2
        .select()
        .from(users7)
        .where(inArray4(users7.role, ["delivery_driver", "business_owner"]));
      const enriched = await Promise.all(
        pending.map(async (user) => {
          let deliveryDriver = null;
          let business = null;
          if (user.role === "delivery_driver") {
            const [dd] = await db2
              .select()
              .from(deliveryDrivers3)
              .where(eq64(deliveryDrivers3.userId, user.id))
              .limit(1);
            deliveryDriver = dd || null;
          }
          if (user.role === "business_owner") {
            const [biz] = await db2
              .select()
              .from(businesses3)
              .where(eq64(businesses3.ownerId, user.id))
              .limit(1);
            business = biz || null;
          }
          return {
            ...user,
            deliveryDriver,
            business,
          };
        }),
      );
      res.json({ success: true, users: enriched });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.put(
  "/verifications/:userId",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { users: users7, auditLogs: auditLogs2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { action, notes } = req.body;
      const userId = req.params.userId;
      if (!action || !["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ error: "action debe ser 'approve' o 'reject'" });
      }
      const verificationStatus = action === "approve" ? "verified" : "rejected";
      const isActive = action === "approve";
      await db2
        .update(users7)
        .set({
          verificationStatus,
          verificationNotes: notes || null,
          isActive,
        })
        .where(eq64(users7.id, userId));
      await db2.insert(auditLogs2).values({
        userId: req.user.id,
        action:
          action === "approve"
            ? "verify_user_approved"
            : "verify_user_rejected",
        entityType: "user",
        entityId: userId,
        changes: JSON.stringify({ verificationStatus, notes }),
      });
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        await sendPushToUser2(userId, {
          title:
            action === "approve"
              ? "\u2705 Cuenta verificada"
              : "\u274C Verificaci\xF3n rechazada",
          body:
            action === "approve"
              ? "Tu cuenta ha sido verificada. Ya puedes usar ComeYa."
              : `Tu verificaci\xF3n fue rechazada. ${notes || "Contacta con soporte para m\xE1s informaci\xF3n."}`,
          data: { screen: "Profile" },
        });
      } catch {}
      res.json({ success: true, verificationStatus });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/bank-account",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      res.json({
        success: true,
        bankAccount: null,
        message: "No bank account configured",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router8.get(
  "/gift-cards/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { GiftCardService: GiftCardService2 } =
        await Promise.resolve().then(
          () => (init_giftCardService(), giftCardService_exports),
        );
      res.json(await GiftCardService2.getPendingGiftCards());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router8.post(
  "/gift-cards/:id/activate",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { GiftCardService: GiftCardService2 } =
        await Promise.resolve().then(
          () => (init_giftCardService(), giftCardService_exports),
        );
      res.json(
        await GiftCardService2.activateGiftCard(req.params.id, req.user.id),
      );
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router8.post(
  "/gift-cards/:id/reject",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason)
        return res
          .status(400)
          .json({ success: false, error: "Raz\xF3n requerida" });
      const { GiftCardService: GiftCardService2 } =
        await Promise.resolve().then(
          () => (init_giftCardService(), giftCardService_exports),
        );
      res.json(
        await GiftCardService2.rejectGiftCard(
          req.params.id,
          req.user.id,
          reason,
        ),
      );
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// server/routes/adminFinanceRoutes.ts
import express9 from "express";
var router9 = express9.Router();
router9.get(
  "/platform-earnings",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders: orders2, transactions: transactions3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const allOrders = await db2.select().from(orders2);
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");
      const todayEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= today)
        .reduce((sum3, o) => sum3 + (o.nemyCommission || 0), 0);
      const weekEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= weekAgo)
        .reduce((sum3, o) => sum3 + (o.nemyCommission || 0), 0);
      const monthEarnings = deliveredOrders
        .filter((o) => new Date(o.createdAt) >= monthStart)
        .reduce((sum3, o) => sum3 + (o.nemyCommission || 0), 0);
      const totalEarnings = deliveredOrders.reduce(
        (sum3, o) => sum3 + (o.nemyCommission || 0),
        0,
      );
      const allTransactions = await db2.select().from(transactions3);
      const penalties = allTransactions
        .filter((t) => t.type === "penalty")
        .reduce((sum3, t) => sum3 + t.amount, 0);
      const couponsApplied = allTransactions
        .filter((t) => t.type === "coupon_discount")
        .reduce((sum3, t) => sum3 + Math.abs(t.amount), 0);
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
          deliveryCommission: 0,
          // MOUZO no cobra comisión de delivery
          businessCommission: 0,
          // MOUZO no cobra comisión a negocios
          penalties,
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
    } catch (error) {
      console.error("Platform earnings error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router9.get(
  "/stripe-status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
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
      try {
        const stripe2 = __require("stripe")(process.env.STRIPE_SECRET_KEY);
        const balance = await stripe2.balance.retrieve();
        res.json({
          success: true,
          status: {
            isConnected: true,
            accountId: "Platform Account",
            chargesEnabled: true,
            payoutsEnabled: true,
            requirements: [],
            lastSync: /* @__PURE__ */ new Date().toISOString(),
            balance: {
              available: balance.available[0]?.amount || 0,
              pending: balance.pending[0]?.amount || 0,
            },
          },
        });
      } catch (stripeError) {
        console.error("Stripe API error:", stripeError);
        res.json({
          success: true,
          status: {
            isConnected: true,
            accountId: "Platform Account",
            chargesEnabled: true,
            payoutsEnabled: true,
            requirements: [],
            lastSync: /* @__PURE__ */ new Date().toISOString(),
            balance: {
              available: 0,
              pending: 0,
            },
            error: "No se pudo conectar con Stripe API",
          },
        });
      }
    } catch (error) {
      console.error("Stripe status error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router9.get(
  "/top-businesses",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders: orders2, businesses: businesses3 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const allOrders = await db2.select().from(orders2);
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");
      const businessEarnings = /* @__PURE__ */ new Map();
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
    } catch (error) {
      console.error("Top businesses error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router9.get(
  "/earnings-chart",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const days = parseInt(req.query.days) || 30;
      const allOrders = await db2.select().from(orders2);
      const deliveredOrders = allOrders.filter((o) => o.status === "delivered");
      const startDate = /* @__PURE__ */ new Date();
      startDate.setDate(startDate.getDate() - days);
      const dailyEarnings = /* @__PURE__ */ new Map();
      for (const order of deliveredOrders) {
        const orderDate = new Date(order.createdAt);
        if (orderDate >= startDate) {
          const dateKey = orderDate.toISOString().split("T")[0];
          const current = dailyEarnings.get(dateKey) || 0;
          dailyEarnings.set(dateKey, current + (order.nemyCommission || 0));
        }
      }
      const chartData = Array.from(dailyEarnings.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
      res.json({
        success: true,
        chartData,
      });
    } catch (error) {
      console.error("Earnings chart error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router9.post(
  "/export-csv",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const allOrders = await db2.select().from(orders2);
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
      const csvHeader = "Fecha,Pedido ID,Negocio,Comisi\xF3n (MXN),Estado\n";
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
    } catch (error) {
      console.error("Export CSV error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router9.get(
  "/payouts/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        payouts: payouts2,
        users: users7,
        businesses: businesses3,
        orders: orders2,
        paymentAccounts: paymentAccounts2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const pending = await db2
        .select()
        .from(payouts2)
        .where(eq64(payouts2.status, "pending"));
      const enriched = await Promise.all(
        pending.map(async (p) => {
          let recipientName = "";
          let recipientUserId = p.recipientId;
          if (p.recipientType === "business") {
            const [biz] = await db2
              .select({ name: businesses3.name, ownerId: businesses3.ownerId })
              .from(businesses3)
              .where(eq64(businesses3.id, p.recipientId))
              .limit(1);
            recipientName = biz?.name ?? "";
            if (biz?.ownerId) recipientUserId = biz.ownerId;
          } else {
            const [usr] = await db2
              .select({ name: users7.name })
              .from(users7)
              .where(eq64(users7.id, p.recipientId))
              .limit(1);
            recipientName = usr?.name ?? "";
          }
          const accounts = await db2
            .select()
            .from(paymentAccounts2)
            .where(eq64(paymentAccounts2.userId, recipientUserId));
          const [order] = await db2
            .select({
              paymentMethod: orders2.paymentMethod,
              assignedAt: orders2.assignedAt,
              deliveredAt: orders2.deliveredAt,
              total: orders2.total,
              businessName: orders2.businessName,
            })
            .from(orders2)
            .where(eq64(orders2.id, p.orderId))
            .limit(1);
          let deliveryMinutes = null;
          if (order?.assignedAt && order?.deliveredAt) {
            deliveryMinutes = Math.round(
              (new Date(order.deliveredAt).getTime() -
                new Date(order.assignedAt).getTime()) /
                6e4,
            );
          }
          return {
            ...p,
            recipientName,
            paymentAccounts: accounts,
            paymentMethod: order?.paymentMethod ?? null,
            deliveryMinutes,
            orderTotal: order?.total ?? null,
            businessName: order?.businessName ?? null,
          };
        }),
      );
      res.json({ success: true, payouts: enriched });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router9.post(
  "/payouts/fix-amounts",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { payouts: payouts2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const all = await db2.select().from(payouts2);
      let fixed = 0;
      for (const p of all) {
        if (p.amount > 500) {
          await db2
            .update(payouts2)
            .set({ amount: Math.round(p.amount / 100) })
            .where(eq64(payouts2.id, p.id));
          fixed++;
        }
      }
      res.json({ success: true, fixed, total: all.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router9.post(
  "/payouts/backfill",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        orders: orders2,
        payouts: payouts2,
        businesses: businesses3,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, and: and33 } = await import("drizzle-orm");
      const deliveredOrders = await db2
        .select()
        .from(orders2)
        .where(
          and33(
            eq64(orders2.status, "delivered"),
            eq64(orders2.confirmedByCustomer, true),
          ),
        );
      const existingPayouts = await db2
        .select({ orderId: payouts2.orderId })
        .from(payouts2);
      const existingOrderIds = new Set(existingPayouts.map((p) => p.orderId));
      const toProcess = deliveredOrders.filter(
        (o) => !existingOrderIds.has(o.id),
      );
      let created = 0;
      for (const order of toProcess) {
        const inserts = [];
        const [biz] = await db2
          .select({ ownerId: businesses3.ownerId })
          .from(businesses3)
          .where(eq64(businesses3.id, order.businessId))
          .limit(1);
        const businessOwnerId = biz?.ownerId || order.businessId;
        const businessAmount = order.businessEarnings || order.subtotal || 0;
        if (businessAmount > 0) {
          inserts.push({
            orderId: order.id,
            recipientId: businessOwnerId,
            recipientType: "business",
            amount: businessAmount,
            status: "pending",
          });
        }
        const driverAmount = order.deliveryEarnings || order.deliveryFee || 0;
        if (order.deliveryPersonId && driverAmount > 0) {
          inserts.push({
            orderId: order.id,
            recipientId: order.deliveryPersonId,
            recipientType: "driver",
            amount: driverAmount,
            status: "pending",
          });
        }
        if (inserts.length > 0) {
          await db2.insert(payouts2).values(inserts);
          created += inserts.length;
        }
      }
      res.json({ success: true, processed: toProcess.length, created });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router9.post(
  "/payouts/:id/mark-paid",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        payouts: payouts2,
        users: users7,
        businesses: businesses3,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { notes, proofUrl, method } = req.body;
      const [payout] = await db2
        .select()
        .from(payouts2)
        .where(eq64(payouts2.id, req.params.id))
        .limit(1);
      if (!payout)
        return res.status(404).json({ error: "Payout no encontrado" });
      await db2
        .update(payouts2)
        .set({
          status: "paid",
          paidBy: req.user.id,
          paidAt: /* @__PURE__ */ new Date(),
          ...(notes ? { notes } : {}),
          ...(method ? { method } : {}),
          ...(proofUrl
            ? { accountSnapshot: JSON.stringify({ proofUrl, notes, method }) }
            : {}),
        })
        .where(eq64(payouts2.id, req.params.id));
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        let recipientUserId = payout.recipientId;
        if (payout.recipientType === "business") {
          const [biz] = await db2
            .select({ ownerId: businesses3.ownerId })
            .from(businesses3)
            .where(eq64(businesses3.id, payout.recipientId))
            .limit(1);
          if (biz?.ownerId) recipientUserId = biz.ownerId;
        }
        const amountEur = `\u20AC${(payout.amount / 100).toFixed(2)}`;
        const methodLabel =
          method === "bizum"
            ? "Bizum"
            : method === "transferencia"
              ? "Transferencia IBAN"
              : method === "paypal"
                ? "PayPal"
                : "transferencia";
        await sendPushToUser2(recipientUserId, {
          title: "\u{1F4B0} Pago recibido",
          body: `ComeYa te ha enviado ${amountEur} v\xEDa ${methodLabel}. Pedido #${payout.orderId.slice(-6)}.`,
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
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router9.get(
  "/payouts/history",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        payouts: payouts2,
        users: users7,
        businesses: businesses3,
        orders: orders2,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
      const paid = await db2
        .select()
        .from(payouts2)
        .where(eq64(payouts2.status, "paid"))
        .orderBy(desc12(payouts2.paidAt));
      console.log(`[Finance] Found ${paid.length} paid payouts`);
      const enriched = await Promise.all(
        paid.map(async (p) => {
          let recipientName = "";
          let businessName = null;
          if (p.recipientType === "business") {
            const [biz] = await db2
              .select({ name: businesses3.name })
              .from(businesses3)
              .where(eq64(businesses3.id, p.recipientId))
              .limit(1);
            recipientName = biz?.name ?? "";
          } else {
            const [usr] = await db2
              .select({ name: users7.name })
              .from(users7)
              .where(eq64(users7.id, p.recipientId))
              .limit(1);
            recipientName = usr?.name ?? "";
            const [order] = await db2
              .select({ businessName: orders2.businessName })
              .from(orders2)
              .where(eq64(orders2.id, p.orderId))
              .limit(1);
            businessName = order?.businessName ?? null;
          }
          const snap = p.accountSnapshot
            ? (() => {
                try {
                  return JSON.parse(p.accountSnapshot);
                } catch {
                  return null;
                }
              })()
            : null;
          return {
            ...p,
            recipientName,
            businessName,
            proofUrl: snap?.proofUrl ?? null,
          };
        }),
      );
      res.json({ success: true, payouts: enriched });
    } catch (error) {
      console.error("[Finance] History error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var adminFinanceRoutes_default = router9;

// server/routes/adminExchangeRate.ts
import express10 from "express";
init_exchangeRateService();
var router10 = express10.Router();
router10.get(
  "/exchange-rate",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await exchangeRateService.getCurrentRate();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router10.post(
  "/exchange-rate",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { rate } = req.body;
      if (!rate || typeof rate !== "number") {
        return res
          .status(400)
          .json({ success: false, message: "Tasa inv\xE1lida" });
      }
      const result = await exchangeRateService.updateManualRate(
        rate,
        req.user.id,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router10.post(
  "/exchange-rate/auto-update",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ success: false, message: "Valor inv\xE1lido" });
      }
      const result = await exchangeRateService.toggleAutoUpdate(
        enabled,
        req.user.id,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router10.post(
  "/exchange-rate/force-update",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await exchangeRateService.forceUpdate();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var adminExchangeRate_default = router10;

// server/routes/walletRoutes.ts
import express11 from "express";
var router11 = express11.Router();
router11.get("/balance", authenticateToken, async (req, res) => {
  try {
    const {
      wallets: wallets2,
      businesses: businesses3,
      transactions: transactions3,
      orders: orders2,
    } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, and: and33 } = await import("drizzle-orm");
    const { cashSettlementService: cashSettlementService2 } =
      await Promise.resolve().then(
        () => (init_cashSettlementService(), cashSettlementService_exports),
      );
    const { financialService: financialService2 } =
      await Promise.resolve().then(
        () => (init_unifiedFinancialService(), unifiedFinancialService_exports),
      );
    if (req.user.role === "business_owner" || req.user.role === "business") {
      const ownerBusinesses = await db2
        .select({ id: businesses3.id })
        .from(businesses3)
        .where(eq64(businesses3.ownerId, req.user.id));
      for (const business of ownerBusinesses) {
        const [legacyWallet] = await db2
          .select()
          .from(wallets2)
          .where(eq64(wallets2.userId, business.id))
          .limit(1);
        if (!legacyWallet) {
          continue;
        }
        const hasLegacyBalance =
          legacyWallet.balance !== 0 || legacyWallet.totalEarned !== 0;
        const [ownerWallet] = await db2
          .select()
          .from(wallets2)
          .where(eq64(wallets2.userId, req.user.id))
          .limit(1);
        if (hasLegacyBalance) {
          if (ownerWallet) {
            await db2
              .update(wallets2)
              .set({
                balance: ownerWallet.balance + legacyWallet.balance,
                totalEarned: ownerWallet.totalEarned + legacyWallet.totalEarned,
              })
              .where(eq64(wallets2.userId, req.user.id));
          } else {
            await db2.insert(wallets2).values({
              userId: req.user.id,
              balance: legacyWallet.balance,
              pendingBalance: 0,
              totalEarned: legacyWallet.totalEarned,
              totalWithdrawn: 0,
              cashOwed: 0,
              cashPending: 0,
            });
          }
          await db2
            .update(wallets2)
            .set({
              balance: 0,
              totalEarned: 0,
            })
            .where(eq64(wallets2.userId, business.id));
        }
        await db2
          .update(transactions3)
          .set({ userId: req.user.id })
          .where(eq64(transactions3.userId, business.id));
        const deliveredOrders = await db2
          .select()
          .from(orders2)
          .where(
            and33(
              eq64(orders2.businessId, business.id),
              eq64(orders2.status, "delivered"),
            ),
          );
        for (const order of deliveredOrders) {
          const isCashOrder = order.paymentMethod === "cash";
          if (isCashOrder && !order.cashSettled) {
            continue;
          }
          const [existingBusinessTx] = await db2
            .select()
            .from(transactions3)
            .where(
              and33(
                eq64(transactions3.orderId, order.id),
                eq64(transactions3.userId, req.user.id),
              ),
            )
            .limit(1);
          if (existingBusinessTx) {
            continue;
          }
          const commissions = await financialService2.calculateCommissions(
            order.total,
            order.deliveryFee,
            order.productosBase || order.subtotal,
            order.nemyCommission || void 0,
          );
          await db2
            .update(orders2)
            .set({
              platformFee: order.platformFee ?? commissions.platform,
              businessEarnings: order.businessEarnings ?? commissions.business,
            })
            .where(eq64(orders2.id, order.id));
          if (!isCashOrder) {
            const [ownerWallet2] = await db2
              .select()
              .from(wallets2)
              .where(eq64(wallets2.userId, req.user.id))
              .limit(1);
            if (ownerWallet2) {
              await db2
                .update(wallets2)
                .set({
                  balance: ownerWallet2.balance + commissions.business,
                  totalEarned: ownerWallet2.totalEarned + commissions.business,
                })
                .where(eq64(wallets2.userId, req.user.id));
            } else {
              await db2.insert(wallets2).values({
                userId: req.user.id,
                balance: commissions.business,
                pendingBalance: 0,
                totalEarned: commissions.business,
                totalWithdrawn: 0,
                cashOwed: 0,
                cashPending: 0,
              });
            }
          }
          await db2.insert(transactions3).values({
            userId: req.user.id,
            type: isCashOrder ? "cash_settlement" : "order_payment",
            amount: commissions.business,
            status: "completed",
            description: `${isCashOrder ? "Efectivo liquidado" : "Pago por pedido"} #${order.id.slice(-8)}`,
            orderId: order.id,
          });
        }
      }
    }
    const [wallet] = await db2
      .select()
      .from(wallets2)
      .where(eq64(wallets2.userId, req.user.id))
      .limit(1);
    if (!wallet) {
      await db2.insert(wallets2).values({
        userId: req.user.id,
        balance: 0,
        pendingBalance: 0,
        cashOwed: 0,
        cashPending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
      const [createdWallet] = await db2
        .select()
        .from(wallets2)
        .where(eq64(wallets2.userId, req.user.id))
        .limit(1);
      if (!createdWallet) {
        return res.status(500).json({ error: "Failed to create wallet" });
      }
      return res.json({
        success: true,
        wallet: {
          id: createdWallet.id,
          balance: createdWallet.balance,
          pendingBalance: createdWallet.pendingBalance,
          cashOwed: createdWallet.cashOwed || 0,
          cashPending: createdWallet.cashPending || 0,
          availableBalance:
            createdWallet.balance - (createdWallet.cashOwed || 0),
          totalEarned: createdWallet.totalEarned,
          totalWithdrawn: createdWallet.totalWithdrawn,
          pendingCashOrders: [],
        },
      });
    }
    let pendingCashOrders = [];
    if (req.user.role === "delivery_driver" && wallet.cashOwed > 0) {
      const debtInfo = await cashSettlementService2.getDriverDebt(req.user.id);
      pendingCashOrders = debtInfo.pendingOrders;
    }
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        cashOwed: wallet.cashOwed || 0,
        cashPending: wallet.cashPending || 0,
        availableBalance: wallet.balance - (wallet.cashOwed || 0),
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        pendingCashOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router11.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const {
      transactions: transactions3,
      businesses: businesses3,
      wallets: wallets2,
    } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
    if (req.user.role === "business_owner" || req.user.role === "business") {
      const ownerBusinesses = await db2
        .select({ id: businesses3.id })
        .from(businesses3)
        .where(eq64(businesses3.ownerId, req.user.id));
      for (const business of ownerBusinesses) {
        const [legacyWallet] = await db2
          .select()
          .from(wallets2)
          .where(eq64(wallets2.userId, business.id))
          .limit(1);
        if (
          legacyWallet &&
          (legacyWallet.balance !== 0 || legacyWallet.totalEarned !== 0)
        ) {
          const [ownerWallet] = await db2
            .select()
            .from(wallets2)
            .where(eq64(wallets2.userId, req.user.id))
            .limit(1);
          if (ownerWallet) {
            await db2
              .update(wallets2)
              .set({
                balance: ownerWallet.balance + legacyWallet.balance,
                totalEarned: ownerWallet.totalEarned + legacyWallet.totalEarned,
              })
              .where(eq64(wallets2.userId, req.user.id));
          } else {
            await db2.insert(wallets2).values({
              userId: req.user.id,
              balance: legacyWallet.balance,
              pendingBalance: 0,
              totalEarned: legacyWallet.totalEarned,
              totalWithdrawn: 0,
              cashOwed: 0,
              cashPending: 0,
            });
          }
          await db2
            .update(wallets2)
            .set({
              balance: 0,
              totalEarned: 0,
            })
            .where(eq64(wallets2.userId, business.id));
        }
        await db2
          .update(transactions3)
          .set({ userId: req.user.id })
          .where(eq64(transactions3.userId, business.id));
      }
    }
    const walletTransactions2 = await db2
      .select()
      .from(transactions3)
      .where(eq64(transactions3.userId, req.user.id))
      .orderBy(desc12(transactions3.createdAt))
      .limit(50);
    res.json({ success: true, transactions: walletTransactions2 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router11.post(
  "/withdraw",
  authenticateToken,
  auditAction("request_withdrawal", "withdrawal"),
  async (req, res) => {
    try {
      const { financialService: financialService2 } =
        await Promise.resolve().then(
          () => (
            init_unifiedFinancialService(),
            unifiedFinancialService_exports
          ),
        );
      const canWithdraw = await financialService2.canUserWithdraw(
        req.user.id,
        req.user.role,
      );
      if (!canWithdraw.allowed) {
        return res.status(403).json({ error: canWithdraw.reason });
      }
      const { requestWithdrawal: requestWithdrawal2 } =
        await Promise.resolve().then(
          () => (init_withdrawalService(), withdrawalService_exports),
        );
      const result = await requestWithdrawal2({
        userId: req.user.id,
        amount: req.body.amount,
        method: req.body.method,
        bankAccount: req.body.bankAccount,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router11.get("/withdrawals", authenticateToken, async (req, res) => {
  try {
    const { getWithdrawalHistory: getWithdrawalHistory2 } =
      await Promise.resolve().then(
        () => (init_withdrawalService(), withdrawalService_exports),
      );
    const result = await getWithdrawalHistory2(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router11.post(
  "/withdrawals/:id/cancel",
  authenticateToken,
  auditAction("cancel_withdrawal", "withdrawal"),
  async (req, res) => {
    try {
      const { cancelWithdrawal: cancelWithdrawal2 } =
        await Promise.resolve().then(
          () => (init_withdrawalService(), withdrawalService_exports),
        );
      const result = await cancelWithdrawal2(req.params.id, req.user.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var walletRoutes_default = router11;

// server/routes/bankAccountRoutes.ts
import express12 from "express";
init_db();
init_schema_mysql();
import { eq as eq25 } from "drizzle-orm";
var router12 = express12.Router();
router12.get("/", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select({ bankAccount: users.bankAccount })
      .from(users)
      .where(eq25(users.id, req.user.id))
      .limit(1);
    let bankAccount = null;
    if (user?.bankAccount) {
      try {
        bankAccount = JSON.parse(user.bankAccount);
      } catch (parseError) {
        bankAccount = user.bankAccount;
      }
    }
    res.json({ success: true, bankAccount });
  } catch (error) {
    console.error("Error loading bank account:", error);
    res.status(500).json({ error: "Error al cargar la cuenta bancaria" });
  }
});
router12.post("/", authenticateToken, async (req, res) => {
  try {
    const { clabe, bankName, accountHolder } = req.body || {};
    if (!clabe || `${clabe}`.trim().length !== 18) {
      return res.status(400).json({ error: "CLABE debe tener 18 d\xEDgitos" });
    }
    if (!bankName || !accountHolder) {
      return res.status(400).json({ error: "Banco y titular son requeridos" });
    }
    const bankAccount = {
      clabe: `${clabe}`.trim(),
      bankName: `${bankName}`.trim(),
      accountHolder: `${accountHolder}`.trim(),
    };
    await db
      .update(users)
      .set({ bankAccount: JSON.stringify(bankAccount) })
      .where(eq25(users.id, req.user.id));
    res.json({ success: true, bankAccount });
  } catch (error) {
    console.error("Error saving bank account:", error);
    res.status(500).json({ error: "Error al guardar la cuenta bancaria" });
  }
});
var bankAccountRoutes_default = router12;

// server/routes/deliveryConfigRoutes.ts
import express13 from "express";

// server/services/deliveryConfigService.ts
init_db();
init_schema_mysql();
import { eq as eq26 } from "drizzle-orm";
var cachedConfig = null;
var lastFetch = 0;
var CACHE_TTL2 = 6e4;
async function getDeliveryConfig() {
  const now = Date.now();
  if (cachedConfig && now - lastFetch < CACHE_TTL2) return cachedConfig;
  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq26(systemSettings.category, "delivery"));
  const config3 = {
    tier1: 250,
    // 2.50€
    tier2: 400,
    // 4.00€
    tier3: 500,
    // 5.00€
    extraPerKm: 100,
    // 1.00€/km
    speedKmPerMin: 0.5,
    defaultPrepTime: 20,
  };
  settings.forEach((s) => {
    const v = parseFloat(s.value);
    switch (s.key) {
      case "delivery_tier1":
        config3.tier1 = Math.round(v * 100);
        break;
      case "delivery_tier2":
        config3.tier2 = Math.round(v * 100);
        break;
      case "delivery_tier3":
        config3.tier3 = Math.round(v * 100);
        break;
      case "delivery_extra_per_km":
        config3.extraPerKm = Math.round(v * 100);
        break;
      case "delivery_speed":
        config3.speedKmPerMin = v;
        break;
      case "delivery_prep_time":
        config3.defaultPrepTime = v;
        break;
    }
  });
  cachedConfig = config3;
  lastFetch = now;
  return config3;
}
function clearDeliveryConfigCache() {
  cachedConfig = null;
}

// server/routes/deliveryConfigRoutes.ts
init_db();
init_schema_mysql();
import { eq as eq27 } from "drizzle-orm";
var router13 = express13.Router();
router13.get("/config", async (req, res) => {
  try {
    const config3 = await getDeliveryConfig();
    res.json({
      success: true,
      config: {
        tier1: config3.tier1 / 100,
        tier2: config3.tier2 / 100,
        tier3: config3.tier3 / 100,
        extraPerKm: config3.extraPerKm / 100,
        speedKmPerMin: config3.speedKmPerMin,
        defaultPrepTime: config3.defaultPrepTime,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router13.put(
  "/config",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { tier1, tier2, tier3, extraPerKm } = req.body;
      const updates = [
        {
          key: "delivery_tier1",
          value: tier1?.toString(),
          category: "delivery",
          description: "Tarifa 1-2 km (EUR)",
        },
        {
          key: "delivery_tier2",
          value: tier2?.toString(),
          category: "delivery",
          description: "Tarifa 2-3 km (EUR)",
        },
        {
          key: "delivery_tier3",
          value: tier3?.toString(),
          category: "delivery",
          description: "Tarifa 3-4 km (EUR)",
        },
        {
          key: "delivery_extra_per_km",
          value: extraPerKm?.toString(),
          category: "delivery",
          description: "Extra por km >4 km (EUR)",
        },
      ];
      for (const u of updates) {
        if (u.value !== void 0) {
          const existing = await db
            .select()
            .from(systemSettings)
            .where(eq27(systemSettings.key, u.key))
            .limit(1);
          if (existing.length > 0) {
            await db
              .update(systemSettings)
              .set({ value: u.value, updatedBy: req.user.id })
              .where(eq27(systemSettings.key, u.key));
          } else {
            await db
              .insert(systemSettings)
              .values({
                key: u.key,
                value: u.value,
                type: "number",
                category: u.category,
                description: u.description,
                isPublic: false,
              });
          }
        }
      }
      clearDeliveryConfigCache();
      const newConfig = await getDeliveryConfig();
      res.json({
        success: true,
        config: {
          tier1: newConfig.tier1 / 100,
          tier2: newConfig.tier2 / 100,
          tier3: newConfig.tier3 / 100,
          extraPerKm: newConfig.extraPerKm / 100,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var deliveryConfigRoutes_default = router13;

// server/routes/businessVerificationRoutes.ts
import express14 from "express";
init_db();
init_schema_mysql();
import { eq as eq28 } from "drizzle-orm";
var router14 = express14.Router();
router14.post(
  "/send-code",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId, phone } = req.body;
      if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ""))) {
        return res
          .status(400)
          .json({ error: "N\xFAmero de tel\xE9fono inv\xE1lido" });
      }
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq28(businesses.id, businessId))
        .limit(1);
      if (!business || business.ownerId !== req.user.id) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }
      const code = Math.floor(1e5 + Math.random() * 9e5).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1e3);
      await db
        .update(businesses)
        .set({
          phone,
          verificationCode: code,
          verificationExpires: expires,
        })
        .where(eq28(businesses.id, businessId));
      if (process.env.TWILIO_ACCOUNT_SID) {
        const twilio2 = __require("twilio");
        const client = twilio2(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        );
        await client.messages.create({
          body: `Tu c\xF3digo de verificaci\xF3n MOUZO es: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        });
      } else {
        console.log(
          `[DEV] C\xF3digo de verificaci\xF3n para ${phone}: ${code}`,
        );
      }
      res.json({ success: true, message: "C\xF3digo enviado" });
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router14.post(
  "/verify-code",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId, code } = req.body;
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq28(businesses.id, businessId))
        .limit(1);
      if (!business || business.ownerId !== req.user.id) {
        return res.status(404).json({ error: "Negocio no encontrado" });
      }
      if (!business.verificationCode || !business.verificationExpires) {
        return res.status(400).json({ error: "No hay c\xF3digo pendiente" });
      }
      if (/* @__PURE__ */ new Date() > business.verificationExpires) {
        return res.status(400).json({ error: "C\xF3digo expirado" });
      }
      if (business.verificationCode !== code) {
        return res.status(400).json({ error: "C\xF3digo incorrecto" });
      }
      await db
        .update(businesses)
        .set({
          phoneVerified: true,
          verificationCode: null,
          verificationExpires: null,
        })
        .where(eq28(businesses.id, businessId));
      res.json({ success: true, message: "Tel\xE9fono verificado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var businessVerificationRoutes_default = router14;

// server/supportRoutes.ts
import express15 from "express";
var router15 = express15.Router();
async function generateAIResponse(message, history) {
  const fallbackResponse = `Gracias por tu mensaje. Un agente de soporte revisar\xE1 tu consulta pronto.

\xBFNecesitas ayuda con:
\u2022 Realizar un pedido
\u2022 Seguimiento de entregas
\u2022 Informaci\xF3n de negocios
\u2022 Problemas con pagos
\u2022 Otra consulta

Por favor, describe tu consulta con m\xE1s detalle.`;
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey =
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (openaiKey) {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Eres un asistente de soporte para MOUZO, una plataforma de delivery en San Crist\xF3bal, T\xE1chira, Venezuela.

INFORMACI\xD3N CLAVE:
- MOUZO significa "vivir" en n\xE1huatl
- Conectamos negocios locales, clientes y repartidores
- Comisiones: 15% del producto para MOUZO, 100% del producto para el negocio, 100% del delivery para el repartidor
- Pagos con tarjeta (Stripe) o efectivo
- Autenticaci\xF3n solo por tel\xE9fono con SMS
- Zona de cobertura: San Crist\xF3bal y alrededores

Responde de manera amigable, profesional y concisa en espa\xF1ol.`,
              },
              { role: "user", content: message },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || fallbackResponse;
      }
    }
    if (geminiKey) {
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { method: "GET", headers: { "Content-Type": "application/json" } },
      );
      if (listResponse.ok) {
        const models = await listResponse.json();
        console.log("Available models:", JSON.stringify(models, null, 2));
      }
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `Eres un asistente de soporte para MOUZO. Responde en espa\xF1ol de forma amigable y concisa.

Usuario: ${message}`,
            },
          ],
        },
      ];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Gemini response:", JSON.stringify(data));
        return (
          data.candidates?.[0]?.content?.parts?.[0]?.text || fallbackResponse
        );
      } else {
        console.log("Gemini error:", response.status, await response.text());
      }
    }
    return fallbackResponse;
  } catch (error) {
    console.error("AI Error:", error);
    return fallbackResponse;
  }
}
router15.get("/tickets/:userId", authenticateToken, async (req, res) => {
  try {
    const { supportChats: supportChats2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
    const tickets = await db2
      .select()
      .from(supportChats2)
      .where(eq64(supportChats2.userId, req.params.userId))
      .orderBy(desc12(supportChats2.createdAt));
    res.json({ success: true, tickets });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const response = await generateAIResponse(message, history || []);
    res.json({ success: true, response });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.post("/tickets", authenticateToken, async (req, res) => {
  try {
    const { supportChats: supportChats2, supportMessages: supportMessages2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { randomUUID: randomUUID2 } = await import("crypto");
    const { message, subject, priority } = req.body;
    const chatId = randomUUID2();
    await db2.insert(supportChats2).values({
      id: chatId,
      userId: req.user.id,
      status: "open",
    });
    await db2.insert(supportMessages2).values({
      id: randomUUID2(),
      chatId,
      userId: req.user.id,
      message: subject || message,
      isBot: false,
    });
    res.json({ success: true, chatId });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.get("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const { supportMessages: supportMessages2, supportChats: supportChats2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64, and: and33 } = await import("drizzle-orm");
    const [ticket] = await db2
      .select()
      .from(supportChats2)
      .where(eq64(supportChats2.id, req.params.id))
      .limit(1);
    if (
      !ticket ||
      (ticket.userId !== req.user.id &&
        req.user.role !== "admin" &&
        req.user.role !== "super_admin")
    ) {
      return res.status(403).json({ error: "No tienes acceso a este ticket" });
    }
    const messages = await db2
      .select()
      .from(supportMessages2)
      .where(eq64(supportMessages2.chatId, req.params.id))
      .orderBy(supportMessages2.createdAt);
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.post("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const { supportMessages: supportMessages2, supportChats: supportChats2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { randomUUID: randomUUID2 } = await import("crypto");
    const { eq: eq64 } = await import("drizzle-orm");
    const [ticket] = await db2
      .select()
      .from(supportChats2)
      .where(eq64(supportChats2.id, req.params.id))
      .limit(1);
    if (
      !ticket ||
      (ticket.userId !== req.user.id &&
        req.user.role !== "admin" &&
        req.user.role !== "super_admin")
    ) {
      return res.status(403).json({ error: "No tienes acceso a este ticket" });
    }
    const { message } = req.body;
    const isAdmin =
      req.user.role === "admin" || req.user.role === "super_admin";
    const newMessage = {
      id: randomUUID2(),
      chatId: req.params.id,
      userId: req.user.id,
      message,
      isBot: false,
      isAdmin,
    };
    await db2.insert(supportMessages2).values(newMessage);
    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.post("/create-ticket", authenticateToken, async (req, res) => {
  try {
    const { supportChats: supportChats2, supportMessages: supportMessages2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { randomUUID: randomUUID2 } = await import("crypto");
    const { message, subject, category } = req.body;
    const chatId = randomUUID2();
    await db2.insert(supportChats2).values({
      id: chatId,
      userId: req.user.id,
      subject: subject || "Consulta de soporte",
      category: category || "general",
      status: "open",
      priority: "medium",
    });
    await db2.insert(supportMessages2).values({
      id: randomUUID2(),
      chatId,
      userId: req.user.id,
      message,
      isBot: false,
      isAdmin: false,
    });
    res.json({ success: true, chatId });
  } catch (error) {
    console.error("Error creating support chat:", error);
    res.status(500).json({ error: error.message });
  }
});
router15.get(
  "/admin/tickets",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportChats: supportChats2, users: users7 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64, desc: desc12 } = await import("drizzle-orm");
      const tickets = await db2
        .select()
        .from(supportChats2)
        .orderBy(desc12(supportChats2.createdAt));
      const enrichedTickets = await Promise.all(
        tickets.map(async (ticket) => {
          const [user] = await db2
            .select({
              id: users7.id,
              name: users7.name,
              email: users7.email,
              phone: users7.phone,
            })
            .from(users7)
            .where(eq64(users7.id, ticket.userId))
            .limit(1);
          return {
            id: ticket.id,
            userId: ticket.userId,
            userName: user?.name || "Usuario",
            userEmail: user?.email || "",
            subject: ticket.subject || "Sin asunto",
            status: ticket.status || "open",
            priority: ticket.priority || "medium",
            category: ticket.category || "general",
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            lastMessageAt: ticket.updatedAt,
            messageCount: 0,
          };
        }),
      );
      res.json({ success: true, tickets: enrichedTickets });
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router15.put(
  "/tickets/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { supportChats: supportChats2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { status, priority } = req.body;
      await db2
        .update(supportChats2)
        .set({
          ...(status && { status }),
          ...(priority && { priority }),
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq64(supportChats2.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
var supportRoutes_default = router15;

// server/withdrawalRoutes.ts
init_withdrawalService();
init_db();
init_schema_mysql();
import { Router } from "express";
import { eq as eq29 } from "drizzle-orm";
var router16 = Router();
router16.post("/request", async (req, res) => {
  try {
    const { userId, amount, method, bankAccount } = req.body;
    if (!userId || !amount || !method) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }
    if (amount < 5e3) {
      return res
        .status(400)
        .json({ error: "El monto m\xEDnimo de retiro es $50 MXN" });
    }
    if (method === "bank_transfer" && !bankAccount) {
      return res
        .status(400)
        .json({ error: "Debes proporcionar datos bancarios" });
    }
    const result = await withdrawalService.requestWithdrawal({
      userId,
      amount,
      method,
      bankAccount,
    });
    res.json(result);
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    res.status(400).json({ error: error.message });
  }
});
router16.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await withdrawalService.getWithdrawalHistory(userId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ error: error.message });
  }
});
router16.get("/admin/pending", async (req, res) => {
  try {
    const pending = await db.query.withdrawalRequests.findMany({
      where: eq29(withdrawalRequests.status, "pending"),
      orderBy: (requests, { asc }) => [asc(requests.requestedAt)],
    });
    res.json(pending);
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ error: error.message });
  }
});
router16.post("/admin/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    if (!adminId) {
      return res.status(400).json({ error: "Se requiere ID de administrador" });
    }
    const result = await withdrawalService.approveWithdrawal(id, adminId);
    res.json(result);
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(400).json({ error: error.message });
  }
});
var withdrawalRoutes_default = router16;

// server/cashSettlementRoutes.ts
init_db();
init_schema_mysql();
import { Router as Router2 } from "express";
import { eq as eq30, and as and11 } from "drizzle-orm";
var router17 = Router2();
router17.get("/pending", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { businesses: businesses3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const ownerBusinesses = await db
      .select()
      .from(businesses3)
      .where(eq30(businesses3.ownerId, userId));
    if (ownerBusinesses.length === 0) {
      return res.json({ success: true, orders: [], total: 0 });
    }
    const businessIds = ownerBusinesses.map((b) => b.id);
    const { inArray: inArray4, sql: sql15 } = await import("drizzle-orm");
    const allOrders = await db.select().from(orders);
    const pendingOrders = allOrders.filter(
      (o) =>
        businessIds.includes(o.businessId) &&
        o.paymentMethod === "cash" &&
        o.status === "delivered" &&
        o.cashSettled === false,
    );
    const { financialService: financialService2 } =
      await Promise.resolve().then(
        () => (init_unifiedFinancialService(), unifiedFinancialService_exports),
      );
    let total = 0;
    for (const order of pendingOrders) {
      if (order.businessEarnings) {
        total += order.businessEarnings;
      } else {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router17.post("/settle/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq30(orders.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    const { businesses: businesses3 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const [business] = await db
      .select()
      .from(businesses3)
      .where(
        and11(
          eq30(businesses3.id, order.businessId),
          eq30(businesses3.ownerId, userId),
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
      return res.status(400).json({ error: "Ya est\xE1 liquidado" });
    }
    const recentSettlement = await db
      .select()
      .from(transactions)
      .where(
        and11(
          eq30(transactions.orderId, orderId),
          eq30(transactions.type, "cash_settlement"),
          eq30(transactions.status, "completed"),
        ),
      )
      .limit(1);
    if (recentSettlement.length > 0) {
      return res.status(400).json({ error: "Este pedido ya fue liquidado" });
    }
    const { financialService: financialService2 } =
      await Promise.resolve().then(
        () => (init_unifiedFinancialService(), unifiedFinancialService_exports),
      );
    const commissions = await financialService2.calculateCommissions(
      order.total,
      order.deliveryFee || 0,
    );
    const totalDebtForOrder = commissions.business + commissions.platform;
    await db
      .update(orders)
      .set({
        cashSettled: 1,
        cashSettledAt: /* @__PURE__ */ new Date(),
      })
      .where(eq30(orders.id, orderId));
    if (order.deliveryPersonId) {
      const [driverWallet] = await db
        .select()
        .from(wallets)
        .where(eq30(wallets.userId, order.deliveryPersonId))
        .limit(1);
      if (driverWallet) {
        await db
          .update(wallets)
          .set({
            cashOwed: Math.max(0, driverWallet.cashOwed - totalDebtForOrder),
          })
          .where(eq30(wallets.userId, order.deliveryPersonId));
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
      message: "Liquidaci\xF3n registrada",
      settled: (totalDebtForOrder / 100).toFixed(2),
      breakdown: {
        business: (commissions.business / 100).toFixed(2),
        platform: (commissions.platform / 100).toFixed(2),
        total: (totalDebtForOrder / 100).toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var cashSettlementRoutes_default = router17;

// server/weeklySettlementRoutes.ts
import { Router as Router3 } from "express";
init_weeklySettlementService();
init_db();
import { sql as sql5 } from "drizzle-orm";
var router18 = Router3();
router18.get("/driver/pending", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const settlement =
      await WeeklySettlementService.getDriverPendingSettlement(userId);
    const bankResult = await db.execute(sql5`
      SELECT * FROM platform_bank_account WHERE is_active = 1 LIMIT 1
    `);
    const bankRows = Array.isArray(bankResult)
      ? Array.isArray(bankResult[0])
        ? bankResult[0]
        : bankResult
      : bankResult?.rows || [];
    res.json({
      success: true,
      settlement,
      bankAccount: bankRows[0] || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/driver/submit-proof", authenticateToken, async (req, res) => {
  try {
    const { settlementId, proofUrl } = req.body;
    await WeeklySettlementService.submitPaymentProof(settlementId, proofUrl);
    res.json({ success: true, message: "Comprobante enviado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.get("/admin/pending", authenticateToken, async (req, res) => {
  try {
    const settlements =
      await WeeklySettlementService.getAllPendingSettlements();
    res.json({ success: true, settlements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/admin/approve/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    await WeeklySettlementService.approveSettlement(id, adminId);
    res.json({ success: true, message: "Liquidaci\xF3n aprobada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/admin/reject/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;
    await WeeklySettlementService.rejectSettlement(id, adminId, notes);
    res.json({ success: true, message: "Liquidaci\xF3n rechazada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/admin/bank-account", authenticateToken, async (req, res) => {
  try {
    const { bankName, accountHolder, clabe, accountNumber, notes } = req.body;
    await db.execute(sql5`UPDATE platform_bank_account SET is_active = 0`);
    await db.execute(sql5`
      INSERT INTO platform_bank_account 
      (bank_name, account_holder, clabe, account_number, notes, is_active)
      VALUES (${bankName}, ${accountHolder}, ${clabe}, ${accountNumber || ""}, ${notes || ""}, 1)
    `);
    res.json({ success: true, message: "Cuenta bancaria configurada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.get("/admin/bank-account", authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(sql5`
      SELECT * FROM platform_bank_account WHERE is_active = 1 LIMIT 1
    `);
    const rows = Array.isArray(result)
      ? Array.isArray(result[0])
        ? result[0]
        : result
      : result?.rows || [];
    res.json({ success: true, bankAccount: rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/cron/close-week", async (req, res) => {
  try {
    const result = await WeeklySettlementService.closeWeek();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router18.post("/cron/block-unpaid", async (req, res) => {
  try {
    const result = await WeeklySettlementService.blockUnpaidDrivers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var weeklySettlementRoutes_default = router18;

// server/financialAuditRoutes.ts
import { Router as Router4 } from "express";

// server/financialAuditService.ts
init_db();
init_schema_mysql();
init_unifiedFinancialService();
import { eq as eq31 } from "drizzle-orm";
var FinancialAuditService = class {
  // REGLA 1: Comisiones suman 100%
  async auditCommissionRates() {
    try {
      const rates = await financialService.getCommissionRates();
      const total = rates.platform + rates.business + rates.driver;
      const passed = Math.abs(total - 1) < 1e-3;
      return {
        passed,
        rule: "Commission Rates Sum to 100%",
        details: passed
          ? `\u2713 Rates valid: Platform ${(rates.platform * 100).toFixed(1)}% + Business ${(rates.business * 100).toFixed(1)}% + Driver ${(rates.driver * 100).toFixed(1)}% = 100%`
          : `\u2717 Rates invalid: Total = ${(total * 100).toFixed(2)}%`,
        severity: passed ? "info" : "critical",
        expectedValue: 1,
        actualValue: total,
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Commission Rates Sum to 100%",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 2: Total pedido = subtotal + deliveryFee + tax
  async auditOrderTotals() {
    try {
      const allOrders = await db.select().from(orders);
      const invalidOrders = [];
      for (const order of allOrders) {
        const nemyCommission = Math.round(order.subtotal * 0.15);
        const expectedTotal =
          order.subtotal + nemyCommission + order.deliveryFee;
        if (order.total !== expectedTotal) {
          invalidOrders.push(
            `${order.id.slice(-6)}: expected ${expectedTotal}, got ${order.total}`,
          );
        }
      }
      return {
        passed: invalidOrders.length === 0,
        rule: "Order Totals Match Calculation",
        details:
          invalidOrders.length === 0
            ? `\u2713 All ${allOrders.length} orders have correct totals`
            : `\u2717 ${invalidOrders.length}/${allOrders.length} orders with incorrect totals`,
        severity: invalidOrders.length === 0 ? "info" : "critical",
        affectedEntities: invalidOrders.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Order Totals Match Calculation",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 3: Comisiones distribuidas = total pedido
  async auditCommissionDistribution() {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq31(orders.status, "delivered"));
      const invalidOrders = [];
      for (const order of deliveredOrders) {
        if (
          order.platformFee &&
          order.businessEarnings &&
          order.deliveryEarnings
        ) {
          const distributed =
            order.platformFee + order.businessEarnings + order.deliveryEarnings;
          if (distributed !== order.total) {
            invalidOrders.push(
              `${order.id.slice(-6)}: total ${order.total}, distributed ${distributed}`,
            );
          }
        }
      }
      return {
        passed: invalidOrders.length === 0,
        rule: "Commission Distribution Equals Order Total",
        details:
          invalidOrders.length === 0
            ? `\u2713 All ${deliveredOrders.length} delivered orders correctly distributed`
            : `\u2717 ${invalidOrders.length}/${deliveredOrders.length} orders with distribution errors`,
        severity: invalidOrders.length === 0 ? "info" : "critical",
        affectedEntities: invalidOrders.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Commission Distribution Equals Order Total",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 4: Balance wallet = suma transacciones
  async auditWalletBalances() {
    try {
      const allWallets = await db.select().from(wallets);
      const invalidWallets = [];
      for (const wallet of allWallets) {
        const txs = await db
          .select()
          .from(transactions)
          .where(eq31(transactions.walletId, wallet.id));
        const calculatedBalance = txs.reduce((sum3, tx) => sum3 + tx.amount, 0);
        if (wallet.balance !== calculatedBalance) {
          invalidWallets.push(
            `${wallet.userId.slice(-6)}: expected ${calculatedBalance}, got ${wallet.balance}`,
          );
        }
      }
      return {
        passed: invalidWallets.length === 0,
        rule: "Wallet Balances Match Transaction History",
        details:
          invalidWallets.length === 0
            ? `\u2713 All ${allWallets.length} wallets have correct balances`
            : `\u2717 ${invalidWallets.length}/${allWallets.length} wallets with balance mismatches`,
        severity: invalidWallets.length === 0 ? "info" : "critical",
        affectedEntities: invalidWallets.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Wallet Balances Match Transaction History",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 5: Transacciones tienen balanceBefore/After consistentes
  async auditTransactionChain() {
    try {
      const allWallets = await db.select().from(wallets);
      const invalidChains = [];
      for (const wallet of allWallets) {
        const txs = await db
          .select()
          .from(transactions)
          .where(eq31(transactions.walletId, wallet.id))
          .orderBy(transactions.createdAt);
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          const expectedAfter = (tx.balanceBefore || 0) + tx.amount;
          if (tx.balanceAfter !== expectedAfter) {
            invalidChains.push(
              `Wallet ${wallet.userId.slice(-6)}, tx ${i + 1}: chain broken`,
            );
            break;
          }
        }
      }
      return {
        passed: invalidChains.length === 0,
        rule: "Transaction Chains Are Consistent",
        details:
          invalidChains.length === 0
            ? `\u2713 All wallet transaction chains are valid`
            : `\u2717 ${invalidChains.length} wallets with broken transaction chains`,
        severity: invalidChains.length === 0 ? "info" : "critical",
        affectedEntities: invalidChains.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Transaction Chains Are Consistent",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 6: Pagos Stripe coinciden con orders
  async auditStripePayments() {
    try {
      const allPayments = await db.select().from(payments);
      const invalidPayments = [];
      for (const payment of allPayments) {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq31(orders.id, payment.orderId))
          .limit(1);
        if (!order) {
          invalidPayments.push(
            `Payment ${payment.id.slice(-6)}: order not found`,
          );
          continue;
        }
        if (payment.amount !== order.total) {
          invalidPayments.push(
            `Payment ${payment.id.slice(-6)}: amount ${payment.amount} != order ${order.total}`,
          );
        }
      }
      return {
        passed: invalidPayments.length === 0,
        rule: "Stripe Payments Match Order Totals",
        details:
          invalidPayments.length === 0
            ? `\u2713 All ${allPayments.length} payments match their orders`
            : `\u2717 ${invalidPayments.length}/${allPayments.length} payments with mismatches`,
        severity: invalidPayments.length === 0 ? "info" : "warning",
        affectedEntities: invalidPayments.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Stripe Payments Match Order Totals",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 7: Transacciones coinciden con comisiones del pedido
  async auditTransactionAmounts() {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq31(orders.status, "delivered"));
      const invalidTransactions = [];
      for (const order of deliveredOrders) {
        if (!order.deliveryPersonId || !order.deliveryEarnings) continue;
        const driverTxs = await db
          .select()
          .from(transactions)
          .where(eq31(transactions.orderId, order.id));
        const driverTx = driverTxs.find(
          (tx) => tx.userId === order.deliveryPersonId,
        );
        if (driverTx && driverTx.amount !== order.deliveryEarnings) {
          invalidTransactions.push(
            `Order ${order.id.slice(-6)}: driver tx ${driverTx.amount} != expected ${order.deliveryEarnings}`,
          );
        }
      }
      return {
        passed: invalidTransactions.length === 0,
        rule: "Transaction Amounts Match Order Commissions",
        details:
          invalidTransactions.length === 0
            ? `\u2713 All transactions match their order commissions`
            : `\u2717 ${invalidTransactions.length} transactions with incorrect amounts`,
        severity: invalidTransactions.length === 0 ? "info" : "critical",
        affectedEntities: invalidTransactions.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Transaction Amounts Match Order Commissions",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // REGLA 8: Ganancias del repartidor = deliveryEarnings (no deliveryFee)
  async auditDriverEarningsCalculation() {
    try {
      const deliveredOrders = await db
        .select()
        .from(orders)
        .where(eq31(orders.status, "delivered"));
      const invalidEarnings = [];
      const rates = await financialService.getCommissionRates();
      for (const order of deliveredOrders) {
        if (!order.deliveryPersonId) continue;
        const expectedEarnings = Math.round(order.deliveryFee * rates.driver);
        if (order.deliveryEarnings !== expectedEarnings) {
          invalidEarnings.push(
            `Order ${order.id.slice(-6)}: deliveryEarnings ${order.deliveryEarnings} != expected ${expectedEarnings} (${(rates.driver * 100).toFixed(0)}% of ${order.deliveryFee})`,
          );
        }
      }
      return {
        passed: invalidEarnings.length === 0,
        rule: "Driver Earnings = 15% of Delivery Fee",
        details:
          invalidEarnings.length === 0
            ? `\u2713 All ${deliveredOrders.length} orders have correct driver earnings (15% of deliveryFee)`
            : `\u2717 ${invalidEarnings.length}/${deliveredOrders.length} orders with incorrect driver earnings`,
        severity: invalidEarnings.length === 0 ? "info" : "critical",
        affectedEntities: invalidEarnings.slice(0, 10),
      };
    } catch (error) {
      return {
        passed: false,
        rule: "Driver Earnings = 15% of Delivery Fee",
        details: `\u2717 Error: ${error.message}`,
        severity: "critical",
      };
    }
  }
  // Ejecutar auditoría completa
  async runFullAudit() {
    const results = [];
    results.push(await this.auditCommissionRates());
    results.push(await this.auditOrderTotals());
    results.push(await this.auditCommissionDistribution());
    results.push(await this.auditWalletBalances());
    results.push(await this.auditTransactionChain());
    results.push(await this.auditStripePayments());
    results.push(await this.auditTransactionAmounts());
    results.push(await this.auditDriverEarningsCalculation());
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter(
      (r) => !r.passed && r.severity === "critical",
    ).length;
    const warnings = results.filter(
      (r) => !r.passed && r.severity === "warning",
    ).length;
    let systemHealth = "healthy";
    if (failed > 0) systemHealth = "critical";
    else if (warnings > 0) systemHealth = "warning";
    return {
      timestamp: /* @__PURE__ */ new Date(),
      totalChecks: results.length,
      passed,
      failed,
      warnings,
      results,
      systemHealth,
    };
  }
};
var financialAuditService = new FinancialAuditService();

// server/financialAuditRoutes.ts
var router19 = Router4();
router19.get(
  "/full",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const report = await financialAuditService.runFullAudit();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router19.get(
  "/commission-rates",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditCommissionRates();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router19.get(
  "/order-totals",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditOrderTotals();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router19.get(
  "/wallet-balances",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await financialAuditService.auditWalletBalances();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var financialAuditRoutes_default = router19;

// server/favoritesRoutes.ts
import express16 from "express";
var router20 = express16.Router();
console.log("\u{1F527} Favorites routes loaded");
router20.get("/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("\u{1F50D} GETTING FAVORITES FOR:", userId);
    const { favorites: favorites2, businesses: businesses3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64 } = await import("drizzle-orm");
    const rows = await db2
      .select({
        id: favorites2.id,
        userId: favorites2.userId,
        businessId: favorites2.businessId,
        productId: favorites2.productId,
        businessName: businesses3.name,
        businessImage: businesses3.image,
        businessType: businesses3.type,
        businessRating: businesses3.rating,
      })
      .from(favorites2)
      .leftJoin(businesses3, eq64(favorites2.businessId, businesses3.id))
      .where(eq64(favorites2.userId, userId));
    const mapped = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      businessId: row.businessId,
      productId: row.productId,
      business: row.businessId
        ? {
            id: row.businessId,
            name: row.businessName,
            image: row.businessImage,
            type: row.businessType,
            rating: ((row.businessRating || 0) / 10).toFixed(1),
          }
        : null,
    }));
    res.json(mapped);
  } catch (error) {
    console.error("\u274C ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
router20.post("/", authenticateToken, async (req, res) => {
  try {
    const { favorites: favorites2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { v4: uuidv4 } = await import("uuid");
    const { and: and33, eq: eq64 } = await import("drizzle-orm");
    const { userId, businessId, productId } = req.body;
    const existing = await db2
      .select()
      .from(favorites2)
      .where(
        and33(
          eq64(favorites2.userId, userId),
          businessId
            ? eq64(favorites2.businessId, businessId)
            : eq64(favorites2.productId, productId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return res.json({ success: true, favorite: existing[0] });
    }
    const newFavorite = {
      id: uuidv4(),
      userId,
      businessId: businessId || null,
      productId: productId || null,
    };
    await db2.insert(favorites2).values(newFavorite);
    res.json({ success: true, favorite: newFavorite });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: error.message });
  }
});
router20.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { favorites: favorites2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { eq: eq64 } = await import("drizzle-orm");
    await db2.delete(favorites2).where(eq64(favorites2.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: error.message });
  }
});
router20.get("/check/:userId/:itemId", authenticateToken, async (req, res) => {
  try {
    const { favorites: favorites2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { and: and33, eq: eq64, or: or5 } = await import("drizzle-orm");
    const { userId, itemId } = req.params;
    const [favorite] = await db2
      .select()
      .from(favorites2)
      .where(
        and33(
          eq64(favorites2.userId, userId),
          or5(
            eq64(favorites2.businessId, itemId),
            eq64(favorites2.productId, itemId),
          ),
        ),
      )
      .limit(1);
    res.json({ isFavorite: !!favorite, favoriteId: favorite?.id });
  } catch (error) {
    console.error("Error checking favorite:", error);
    res.status(500).json({ error: error.message });
  }
});
var favoritesRoutes_default = router20;

// server/deliveryRoutes.ts
init_db();
init_schema_mysql();
import { Router as Router5 } from "express";
import {
  eq as eq35,
  and as and14,
  inArray as inArray3,
  sql as sql8,
} from "drizzle-orm";
init_errors();
init_logger();
init_distance();
var router21 = Router5();
var DELIVERY_RADIUS_KM = 0.2;
router21.post(
  "/register",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { userId, vehicleType, vehiclePlate } = req.body;
    if (!vehicleType || !vehiclePlate) {
      throw new ValidationError("Vehicle type and plate are required");
    }
    if (!["bike", "motorcycle", "car"].includes(vehicleType)) {
      throw new ValidationError("Invalid vehicle type");
    }
    const [existing] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    if (existing) {
      await db
        .update(deliveryDrivers)
        .set({
          vehicleType,
          vehiclePlate: vehiclePlate.toUpperCase(),
        })
        .where(eq35(deliveryDrivers.userId, userId));
    } else {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType,
        vehiclePlate: vehiclePlate.toUpperCase(),
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
    }
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    const [existingWallet] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(eq35(wallets.userId, userId))
      .limit(1);
    if (!existingWallet) {
      await db.insert(wallets).values({
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
    }
    logger.delivery("Driver registered", { userId, driverId: driver.id });
    res.json({ driver, message: "Driver registered" });
  }),
);
router21.post(
  "/location",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      throw new ValidationError("Latitude and longitude required");
    }
    await db
      .update(deliveryDrivers)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        lastLocationUpdate: /* @__PURE__ */ new Date(),
      })
      .where(eq35(deliveryDrivers.userId, userId));
    const { checkAndUpdateArrivingStatus: checkAndUpdateArrivingStatus2 } =
      await Promise.resolve().then(
        () => (init_arrivingStatusService(), arrivingStatusService_exports),
      );
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and14(
          eq35(orders.deliveryPersonId, userId),
          inArray3(orders.status, ["picked_up", "on_the_way", "in_transit"]),
        ),
      );
    for (const order of activeOrders) {
      await checkAndUpdateArrivingStatus2(order.id, latitude, longitude);
    }
    res.json({ success: true });
  }),
);
router21.get(
  "/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    res.json({ success: true, isOnline: driver?.isAvailable ?? false });
  }),
);
router21.get(
  "/stats",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    if (!driver) {
      return res.json({
        success: true,
        stats: {
          totalDeliveries: 0,
          rating: 0,
          totalRatings: 0,
          completionRate: 100,
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          totalEarnings: 0,
          balance: 0,
          avgDeliveryTime: 0,
          cashOwed: 0,
          availableToWithdraw: 0,
          pendingCashOrders: [],
        },
      });
    }
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq35(wallets.userId, userId))
      .limit(1);
    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and14(
          eq35(orders.deliveryPersonId, userId),
          eq35(orders.status, "delivered"),
        ),
      );
    const now = /* @__PURE__ */ new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    const todayOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= todayStart;
    });
    const weekOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= weekStart;
    });
    const monthOrders = completedOrders.filter((o) => {
      if (!o.deliveredAt) return false;
      const deliveredDate = new Date(o.deliveredAt);
      return deliveredDate >= monthStart;
    });
    const todayEarnings = todayOrders.reduce(
      (sum3, o) => sum3 + (o.deliveryFee || 0),
      0,
    );
    const weekEarnings = weekOrders.reduce(
      (sum3, o) => sum3 + (o.deliveryFee || 0),
      0,
    );
    const monthEarnings = monthOrders.reduce(
      (sum3, o) => sum3 + (o.deliveryFee || 0),
      0,
    );
    const totalEarnings = completedOrders.reduce(
      (sum3, o) => sum3 + (o.deliveryFee || 0),
      0,
    );
    const avgTimeMinutes =
      completedOrders.length > 0
        ? completedOrders.reduce((sum3, order) => {
            if (order.deliveredAt && order.createdAt) {
              const diff =
                new Date(order.deliveredAt).getTime() -
                new Date(order.createdAt).getTime();
              return sum3 + Math.floor(diff / 6e4);
            }
            return sum3;
          }, 0) / completedOrders.length
        : 0;
    const { cashSettlementService: cashSettlementService2 } =
      await Promise.resolve().then(
        () => (init_cashSettlementService(), cashSettlementService_exports),
      );
    const cashSummary = await cashSettlementService2.getDriverDebt(userId);
    const canWithdraw = Math.max(
      0,
      (wallet?.balance || 0) - (wallet?.cashOwed || 0),
    );
    res.json({
      success: true,
      stats: {
        totalDeliveries: completedOrders.length,
        rating: driver.rating,
        totalRatings: driver.totalRatings,
        completionRate: 100,
        todayEarnings,
        weekEarnings,
        monthEarnings,
        totalEarnings,
        balance: wallet?.balance || 0,
        avgDeliveryTime: Math.round(avgTimeMinutes),
        // Info de efectivo
        cashOwed: wallet?.cashOwed || 0,
        availableToWithdraw: canWithdraw,
        pendingCashOrders: cashSummary.pendingOrders || [],
      },
      // Historial de entregas para mostrar en pantalla
      deliveries: completedOrders
        .map((o) => ({
          id: o.id,
          businessName: o.businessName,
          deliveryFee: o.deliveryFee || 0,
          deliveryEarnings: o.deliveryEarnings || o.deliveryFee || 0,
          deliveredAt: o.deliveredAt,
          createdAt: o.createdAt,
          paymentMethod: o.paymentMethod,
        }))
        .sort(
          (a, b) =>
            new Date(b.deliveredAt || b.createdAt).getTime() -
            new Date(a.deliveredAt || a.createdAt).getTime(),
        ),
    });
  }),
);
router21.post(
  "/toggle-status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    let [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    if (!driver) {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType: "motorcycle",
        vehiclePlate: "PENDIENTE",
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
      [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq35(deliveryDrivers.userId, userId))
        .limit(1);
    }
    const newStatus = !driver.isAvailable;
    await db
      .update(deliveryDrivers)
      .set({
        isAvailable: newStatus,
        lastLocationUpdate: /* @__PURE__ */ new Date(),
      })
      .where(eq35(deliveryDrivers.userId, userId));
    logger.delivery(`Driver ${newStatus ? "online" : "offline"}`, { userId });
    res.json({ success: true, isOnline: newStatus });
  }),
);
router21.get(
  "/orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const myOrders = await db
      .select()
      .from(orders)
      .where(
        and14(
          eq35(orders.deliveryPersonId, userId),
          inArray3(orders.status, ["ready", "picked_up", "delivered"]),
        ),
      );
    const { isNull: isNullOp } = await import("drizzle-orm");
    const availableOrders = await db
      .select()
      .from(orders)
      .where(
        and14(eq35(orders.status, "ready"), isNullOp(orders.deliveryPersonId)),
      )
      .limit(10);
    res.json({ orders: myOrders, availableOrders });
  }),
);
router21.get(
  "/my-orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const myOrders = await db
      .select()
      .from(orders)
      .where(eq35(orders.deliveryPersonId, userId))
      .orderBy(sql8`created_at DESC`)
      .limit(50);
    res.json({ success: true, orders: myOrders });
  }),
);
router21.get(
  "/available-orders",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    let [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    if (!driver) {
      await db.insert(deliveryDrivers).values({
        userId,
        vehicleType: "motorcycle",
        vehiclePlate: "PENDIENTE",
        isAvailable: false,
        totalDeliveries: 0,
        rating: 0,
        totalRatings: 0,
        strikes: 0,
        isBlocked: false,
      });
      [driver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq35(deliveryDrivers.userId, userId))
        .limit(1);
    }
    const { isNull: isNull4 } = await import("drizzle-orm");
    const availableOrders = await db
      .select()
      .from(orders)
      .where(
        and14(eq35(orders.status, "ready"), isNull4(orders.deliveryPersonId)),
      )
      .limit(100);
    res.json({ success: true, orders: availableOrders });
  }),
);
router21.post(
  "/accept/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq35(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new NotFoundError("Order");
    }
    if (order.deliveryPersonId) {
      throw new ValidationError("Order already assigned");
    }
    if (order.status !== "ready") {
      throw new ValidationError("Order not ready for pickup");
    }
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, userId))
      .limit(1);
    if (!driver || !driver.isAvailable) {
      throw new AuthorizationError("Driver not available");
    }
    await db
      .update(orders)
      .set({
        deliveryPersonId: userId,
        status: "picked_up",
        assignedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq35(orders.id, orderId));
    logger.delivery("Order accepted", { orderId, driverId: userId });
    res.json({ success: true, order });
  }),
);
router21.post(
  "/pickup/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq35(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new NotFoundError("Order");
    }
    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }
    if (order.status !== "ready" && order.status !== "assigned") {
      throw new ValidationError("Order not ready for pickup");
    }
    await db
      .update(orders)
      .set({
        status: "picked_up",
        pickedUpAt: /* @__PURE__ */ new Date(),
      })
      .where(eq35(orders.id, orderId));
    logger.delivery("Order picked up", { orderId, driverId: userId });
    res.json({ success: true });
  }),
);
router21.put(
  "/orders/:orderId/status",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq35(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new NotFoundError("Order");
    }
    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }
    await db.update(orders).set({ status }).where(eq35(orders.id, orderId));
    logger.delivery(`Order status updated to ${status}`, {
      orderId,
      driverId: userId,
    });
    res.json({ success: true });
  }),
);
router21.post(
  "/deliver/:orderId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;
    const { latitude, longitude } = req.body;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq35(orders.id, orderId))
      .limit(1);
    if (!order) {
      throw new NotFoundError("Order");
    }
    if (order.deliveryPersonId !== userId) {
      throw new AuthorizationError("Not your order");
    }
    if (order.status === "delivered") {
      return res.status(400).json({ error: "Order already delivered" });
    }
    if (
      order.status !== "picked_up" &&
      order.status !== "on_the_way" &&
      order.status !== "in_transit"
    ) {
      throw new ValidationError("Order must be picked up or on the way first");
    }
    if (latitude === void 0 || longitude === void 0) {
      throw new ValidationError(
        "Se requiere la ubicaci\xF3n GPS para finalizar la entrega",
      );
    }
    const deliveryLat =
      order.deliveryLatitude ?? order.deliveryLat ?? order.latitude;
    const deliveryLng =
      order.deliveryLongitude ?? order.deliveryLng ?? order.longitude;
    if (!deliveryLat || !deliveryLng) {
      throw new ValidationError(
        "No hay coordenadas de entrega registradas para validar la entrega",
      );
    }
    const driverLat = Number(latitude);
    const driverLng = Number(longitude);
    const deliveryLatNum = Number(deliveryLat);
    const deliveryLngNum = Number(deliveryLng);
    if (
      [driverLat, driverLng, deliveryLatNum, deliveryLngNum].some((value) =>
        Number.isNaN(value),
      )
    ) {
      throw new ValidationError(
        "Coordenadas inv\xE1lidas para validar la entrega",
      );
    }
    const distanceKm = calculateDistance(
      driverLat,
      driverLng,
      deliveryLatNum,
      deliveryLngNum,
    );
    if (distanceKm > DELIVERY_RADIUS_KM) {
      return res.status(400).json({
        error: `Debes estar dentro de ${Math.round(DELIVERY_RADIUS_KM * 1e3)}m del punto de entrega para finalizar`,
        distanceKm,
      });
    }
    const deliveredAt = /* @__PURE__ */ new Date();
    const actualDeliveryTime = order.pickedUpAt
      ? Math.floor(
          (deliveredAt.getTime() - new Date(order.pickedUpAt).getTime()) / 6e4,
        )
      : null;
    const actualPrepTime =
      order.pickedUpAt && order.createdAt
        ? Math.floor(
            (new Date(order.pickedUpAt).getTime() -
              new Date(order.createdAt).getTime()) /
              6e4,
          )
        : null;
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt,
        deliveryLatitude: latitude?.toString(),
        deliveryLongitude: longitude?.toString(),
        actualDeliveryTime,
        actualPrepTime,
      })
      .where(eq35(orders.id, orderId));
    if (order.paymentMethod === "cash") {
      const { cashSettlementService: cashSettlementService2 } =
        await Promise.resolve().then(
          () => (init_cashSettlementService(), cashSettlementService_exports),
        );
      await cashSettlementService2.registerCashDebt(
        orderId,
        userId,
        order.businessId,
        order.total,
        order.deliveryFee,
      );
      logger.delivery("Cash order completed - debt registered", {
        orderId,
        driverId: userId,
        total: order.total,
      });
    } else {
      const {
        calculateAndDistributeCommissions: calculateAndDistributeCommissions2,
      } = await Promise.resolve().then(
        () => (init_commissionService(), commissionService_exports),
      );
      await calculateAndDistributeCommissions2(orderId);
    }
    await db
      .update(deliveryDrivers)
      .set({
        totalDeliveries: sql8`total_deliveries + 1`,
        isAvailable: true,
      })
      .where(eq35(deliveryDrivers.userId, userId));
    const {
      updateBusinessPrepTimeMetrics: updateBusinessPrepTimeMetrics2,
      updateDriverSpeedMetrics: updateDriverSpeedMetrics2,
    } = await Promise.resolve().then(
      () => (init_metricsService(), metricsService_exports),
    );
    updateBusinessPrepTimeMetrics2(order.businessId).catch(console.error);
    updateDriverSpeedMetrics2(userId).catch(console.error);
    const { sendOrderStatusNotification: sendOrderStatusNotification2 } =
      await Promise.resolve().then(
        () => (init_enhancedPushService(), enhancedPushService_exports),
      );
    await sendOrderStatusNotification2(orderId, order.userId, "delivered");
    logger.delivery("Order delivered", { orderId, driverId: userId });
    res.json({ success: true, message: "Pedido entregado exitosamente" });
  }),
);
router21.get(
  "/location/:orderId",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq35(orders.id, orderId))
      .limit(1);
    if (!order || !order.deliveryPersonId) {
      return res.json({ location: null });
    }
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);
    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return res.json({ location: null });
    }
    res.json({
      location: {
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        lastUpdate: driver.lastLocationUpdate,
      },
    });
  }),
);
router21.get(
  "/location/driver/:deliveryPersonId",
  asyncHandler(async (req, res) => {
    const { deliveryPersonId } = req.params;
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq35(deliveryDrivers.userId, deliveryPersonId))
      .limit(1);
    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return res.json({ location: null });
    }
    res.json({
      location: {
        latitude: parseFloat(driver.currentLatitude),
        longitude: parseFloat(driver.currentLongitude),
        lastUpdate: driver.lastLocationUpdate,
      },
    });
  }),
);
var deliveryRoutes_default = router21;

// server/gpsRoutes.ts
init_db();
init_schema_mysql();
import { Router as Router6 } from "express";
import { eq as eq36, and as and15, sql as sql9 } from "drizzle-orm";
var router22 = Router6();
router22.post("/geofence-event", authenticateToken, async (req, res) => {
  try {
    const { orderId, type, location, distance } = req.body;
    const userId = req.user?.userId;
    console.log(
      `\u{1F4CD} Geofence event: ${type} for order ${orderId} at ${location} (${distance}m)`,
    );
    if (type === "enter" && location === "business") {
      await db
        .update(orders)
        .set({ driverPickedUpAt: /* @__PURE__ */ new Date() })
        .where(eq36(orders.id, orderId));
    } else if (type === "enter" && location === "customer") {
      await db
        .update(orders)
        .set({ driverArrivedAt: /* @__PURE__ */ new Date() })
        .where(eq36(orders.id, orderId));
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error handling geofence event:", error);
    res.status(500).json({ error: "Failed to process geofence event" });
  }
});
router22.post("/proximity-alert", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      type,
      distance,
      destinationType,
      timestamp: timestamp2,
    } = req.body;
    const userId = req.user?.userId;
    console.log(
      `\u{1F514} Proximity alert: ${type} for order ${orderId} (${distance}m from ${destinationType})`,
    );
    await db.insert(proximityAlerts).values({
      orderId,
      driverId: userId,
      alertType: type,
      distance,
      destinationType,
      notificationSent: true,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error handling proximity alert:", error);
    res.status(500).json({ error: "Failed to process proximity alert" });
  }
});
router22.post("/proof/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      photoBase64,
      latitude,
      longitude,
      timestamp: timestamp2,
      accuracy,
      route,
    } = req.body;
    const userId = req.user?.userId;
    console.log(`\u{1F4F8} Delivery proof submitted for order ${orderId}`);
    const photoUrl = `data:image/jpeg;base64,${photoBase64.substring(0, 100)}...`;
    let routeDistance = 0;
    if (route && route.length > 1) {
      for (let i = 1; i < route.length; i++) {
        const prev = route[i - 1];
        const curr = route[i];
        routeDistance += calculateDistance3(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude,
        );
      }
    }
    await db.insert(deliveryProofs).values({
      orderId,
      driverId: userId,
      photoUrl,
      photoBase64: photoBase64.substring(0, 1e3),
      // Store truncated version
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy,
      route: JSON.stringify(route),
      routeDistance: Math.round(routeDistance),
      timestamp: new Date(timestamp2),
    });
    await db
      .update(orders)
      .set({
        deliveryProofPhoto: photoUrl,
        deliveryProofPhotoTimestamp: new Date(timestamp2),
        deliveryRoute: JSON.stringify(route),
        deliveryDistance: Math.round(routeDistance),
        deliveryGpsAccuracy: accuracy,
        deliveryGpsValidated: accuracy ? accuracy < 50 : false,
      })
      .where(eq36(orders.id, orderId));
    await db
      .update(deliveryDrivers)
      .set({
        totalDistanceTraveled: sql9`${deliveryDrivers.totalDistanceTraveled} + ${Math.round(routeDistance)}`,
      })
      .where(eq36(deliveryDrivers.userId, userId));
    res.json({ success: true, routeDistance: Math.round(routeDistance) });
  } catch (error) {
    console.error("Error submitting delivery proof:", error);
    res.status(500).json({ error: "Failed to submit delivery proof" });
  }
});
router22.get("/proof/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const proof = await db
      .select()
      .from(deliveryProofs)
      .where(eq36(deliveryProofs.orderId, orderId))
      .limit(1);
    if (proof.length === 0) {
      return res.status(404).json({ error: "Delivery proof not found" });
    }
    res.json({ success: true, proof: proof[0] });
  } catch (error) {
    console.error("Error getting delivery proof:", error);
    res.status(500).json({ error: "Failed to get delivery proof" });
  }
});
router22.get("/heatmap", authenticateToken, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "admin" && userRole !== "super_admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const completedOrders = await db
      .select({
        latitude: orders.deliveryLatitude,
        longitude: orders.deliveryLongitude,
        total: orders.total,
        deliveredAt: orders.deliveredAt,
      })
      .from(orders)
      .where(
        and15(
          eq36(orders.status, "delivered"),
          sql9`${orders.deliveryLatitude} IS NOT NULL`,
          sql9`${orders.deliveryLongitude} IS NOT NULL`,
        ),
      );
    const heatmapData = {};
    completedOrders.forEach((order) => {
      if (!order.latitude || !order.longitude) return;
      const lat = parseFloat(order.latitude);
      const lng = parseFloat(order.longitude);
      const gridLat = Math.round(lat * 1e3) / 1e3;
      const gridLng = Math.round(lng * 1e3) / 1e3;
      const gridCell = `${gridLat},${gridLng}`;
      if (!heatmapData[gridCell]) {
        heatmapData[gridCell] = {
          latitude: gridLat,
          longitude: gridLng,
          orderCount: 0,
          totalRevenue: 0,
        };
      }
      heatmapData[gridCell].orderCount++;
      heatmapData[gridCell].totalRevenue += order.total || 0;
    });
    const heatmap = Object.values(heatmapData);
    res.json({ success: true, heatmap });
  } catch (error) {
    console.error("Error getting heatmap:", error);
    res.status(500).json({ error: "Failed to get heatmap data" });
  }
});
router22.post(
  "/tracking-token/:orderId",
  authenticateToken,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;
      const order = await db
        .select()
        .from(orders)
        .where(eq36(orders.id, orderId))
        .limit(1);
      if (order.length === 0 || order[0].userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const token = generateTrackingToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      await db
        .update(orders)
        .set({
          trackingToken: token,
          trackingTokenExpires: expiresAt,
        })
        .where(eq36(orders.id, orderId));
      const trackingUrl = `${process.env.FRONTEND_URL}/track/${token}`;
      res.json({ success: true, token, trackingUrl, expiresAt });
    } catch (error) {
      console.error("Error generating tracking token:", error);
      res.status(500).json({ error: "Failed to generate tracking token" });
    }
  },
);
router22.get("/track/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const order = await db
      .select()
      .from(orders)
      .where(
        and15(
          eq36(orders.trackingToken, token),
          sql9`${orders.trackingTokenExpires} > NOW()`,
        ),
      )
      .limit(1);
    if (order.length === 0) {
      return res
        .status(404)
        .json({ error: "Invalid or expired tracking link" });
    }
    let driverLocation = null;
    if (order[0].deliveryPersonId) {
      const driver = await db
        .select({
          latitude: deliveryDrivers.currentLatitude,
          longitude: deliveryDrivers.currentLongitude,
          lastUpdate: deliveryDrivers.lastLocationUpdate,
        })
        .from(deliveryDrivers)
        .where(eq36(deliveryDrivers.userId, order[0].deliveryPersonId))
        .limit(1);
      if (driver.length > 0 && driver[0].latitude && driver[0].longitude) {
        driverLocation = {
          latitude: parseFloat(driver[0].latitude),
          longitude: parseFloat(driver[0].longitude),
          lastUpdate: driver[0].lastUpdate,
        };
      }
    }
    res.json({
      success: true,
      order: {
        id: order[0].id,
        status: order[0].status,
        businessName: order[0].businessName,
        estimatedDelivery: order[0].estimatedDelivery,
        deliveryAddress: order[0].deliveryAddress,
      },
      driverLocation,
    });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ error: "Failed to track order" });
  }
});
function calculateDistance3(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function generateTrackingToken() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
var gpsRoutes_default = router22;

// server/routes/digitalPayments.ts
import { Router as Router7 } from "express";

// server/digitalPaymentService.ts
init_db();
init_schema_mysql();
init_unifiedFinancialService();
init_autoVerificationService();
init_logger();
init_enhancedPushService();
init_cloudinaryService();
import {
  eq as eq37,
  and as and16,
  count as count2,
  sum as sum2,
  gte as gte2,
} from "drizzle-orm";
var DigitalPaymentService = class _DigitalPaymentService {
  static instance;
  constructor() {}
  static getInstance() {
    if (!_DigitalPaymentService.instance) {
      _DigitalPaymentService.instance = new _DigitalPaymentService();
    }
    return _DigitalPaymentService.instance;
  }
  // Get active payment methods
  async getActivePaymentMethods() {
    try {
      const methods = await db
        .select()
        .from(paymentMethods)
        .where(eq37(paymentMethods.isActive, true));
      return methods;
    } catch (error) {
      logger.error("Error getting active payment methods:", error);
      return [];
    }
  }
  // Submit payment proof (Pago Móvil, Binance Pay, Zinli, Zelle)
  async submitPaymentProof(data) {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq37(orders.id, data.orderId))
        .limit(1);
      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }
      if (order.status !== "pending") {
        return { success: false, message: "El pedido ya fue procesado" };
      }
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(
          and16(
            eq37(paymentMethods.provider, data.paymentProvider),
            eq37(paymentMethods.isActive, true),
          ),
        )
        .limit(1);
      if (!method) {
        return { success: false, message: "M\xE9todo de pago no disponible" };
      }
      if (!method.requiresManualVerification) {
        return {
          success: false,
          message: "Este m\xE9todo no requiere comprobante",
        };
      }
      let imageUrl = data.proofImageUrl;
      if (imageUrl && imageUrl.startsWith("data:image/")) {
        imageUrl = await CloudinaryService.uploadImage(
          imageUrl,
          "comprobantes",
          `proof-${data.orderId}`,
        );
      }
      const proofId = crypto.randomUUID();
      await db.insert(paymentProofs).values({
        id: proofId,
        orderId: data.orderId,
        userId: data.userId,
        paymentProvider: data.paymentProvider,
        referenceNumber: data.referenceNumber,
        proofImageUrl: imageUrl,
        amount: data.amount,
        status: "pending",
        submittedAt: /* @__PURE__ */ new Date(),
      });
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq37(paymentProofs.id, proofId))
        .limit(1);
      logger.info(
        `\u{1F4B3} Payment proof submitted: Order ${data.orderId} - ${data.paymentProvider}`,
        {
          orderId: data.orderId,
          provider: data.paymentProvider,
          reference: data.referenceNumber,
        },
      );
      const SKIP_AUTO_VERIFICATION = process.env.NODE_ENV === "development";
      if (!SKIP_AUTO_VERIFICATION) {
        const autoVerification =
          await autoVerificationService.shouldAutoApprove(proof.id);
        if (autoVerification.autoApprove) {
          logger.info(`\u{1F916} Auto-approving payment proof ${proof.id}`, {
            proofId: proof.id,
            confidence: autoVerification.confidence,
            riskScore: autoVerification.riskScore,
          });
          const verificationResult = await this.verifyPaymentProof(
            proof.id,
            "SYSTEM_AUTO",
            true,
            `Auto-aprobado (Confianza: ${(autoVerification.confidence * 100).toFixed(0)}%, Riesgo: ${(autoVerification.riskScore * 100).toFixed(0)}%)`,
          );
          if (verificationResult.success) {
            return {
              success: true,
              proofId: proof.id,
              message:
                "\xA1Pago verificado autom\xE1ticamente! Tu pedido est\xE1 confirmado.",
            };
          }
        } else {
          logger.warn(
            `\u26A0\uFE0F Payment proof ${proof.id} requires manual verification`,
            {
              proofId: proof.id,
              reason: autoVerification.reason,
              confidence: autoVerification.confidence,
              riskScore: autoVerification.riskScore,
            },
          );
          if (autoVerification.riskScore > 0.7) {
            await autoVerificationService.logFraudAttempt(
              data.userId,
              proof.id,
              autoVerification.reason,
            );
          }
        }
      } else {
        logger.info(
          `\u23ED\uFE0F Skipping auto-verification in development mode`,
        );
      }
      await db
        .update(orders)
        .set({
          paymentMethod: data.paymentProvider,
          paymentProvider: data.paymentProvider,
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq37(orders.id, data.orderId));
      return {
        success: true,
        proofId: proof.id,
        message: "Comprobante enviado. Ser\xE1 verificado en breve.",
      };
    } catch (error) {
      logger.error("Error submitting payment proof:", error);
      return { success: false, message: error.message };
    }
  }
  // Verify payment proof (Admin only)
  async verifyPaymentProof(proofId, adminId, approved, notes) {
    try {
      const [proof] = await db
        .select()
        .from(paymentProofs)
        .where(eq37(paymentProofs.id, proofId))
        .limit(1);
      if (!proof) {
        return { success: false, message: "Comprobante no encontrado" };
      }
      if (proof.status !== "pending") {
        return { success: false, message: "Este comprobante ya fue procesado" };
      }
      const [order] = await db
        .select()
        .from(orders)
        .where(eq37(orders.id, proof.orderId))
        .limit(1);
      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }
      if (approved) {
        await db.transaction(async (tx) => {
          await tx
            .update(paymentProofs)
            .set({
              status: "approved",
              verifiedBy: adminId,
              verifiedAt: /* @__PURE__ */ new Date(),
              verificationNotes: notes,
            })
            .where(eq37(paymentProofs.id, proofId));
          await tx
            .update(orders)
            .set({
              status: "accepted",
              paidAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq37(orders.id, proof.orderId));
        });
        logger.info(`\u2705 Payment verified: Order ${order.id}`, {
          orderId: order.id,
          provider: proof.paymentProvider,
        });
        await notifyPagoMovilStatus(proof.userId, "verified", order.id);
        const [biz] = await db
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq37(businesses.id, order.businessId))
          .limit(1);
        if (biz?.ownerId) {
          await sendPushToUser(biz.ownerId, {
            title: "\u{1F4B3} Pago confirmado \u2014 \xA1A preparar!",
            body: `Pedido #${order.id.slice(-6)} pagado. Empieza la preparaci\xF3n.`,
            data: { orderId: order.id, screen: "BusinessOrders" },
          });
        }
        return {
          success: true,
          message: "Pago verificado y pedido activado",
          orderId: order.id,
        };
      } else {
        await db.transaction(async (tx) => {
          await tx
            .update(paymentProofs)
            .set({
              status: "rejected",
              verifiedBy: adminId,
              verifiedAt: /* @__PURE__ */ new Date(),
              verificationNotes: notes || "Comprobante rechazado",
            })
            .where(eq37(paymentProofs.id, proofId));
          await tx
            .update(orders)
            .set({
              status: "payment_failed",
              updatedAt: /* @__PURE__ */ new Date(),
            })
            .where(eq37(orders.id, proof.orderId));
        });
        logger.warn(`\u274C Payment proof rejected: Order ${order.id}`, {
          orderId: order.id,
          provider: proof.paymentProvider,
          reason: notes,
        });
        await notifyPagoMovilStatus(proof.userId, "rejected", order.id, notes);
        return {
          success: true,
          message: "Comprobante rechazado",
          orderId: order.id,
        };
      }
    } catch (error) {
      logger.error("Error verifying payment proof:", error);
      return { success: false, message: error.message };
    }
  }
  // Process PayPal payment (automatic)
  async processPayPalPayment(orderId, paypalTransactionId) {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq37(orders.id, orderId))
        .limit(1);
      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }
      const settings = await db
        .select()
        .from(systemSettings)
        .where(eq37(systemSettings.category, "payment_providers"));
      const paypalClientId = settings.find(
        (s) => s.key === "paypal_client_id",
      )?.value;
      const paypalSecret = settings.find(
        (s) => s.key === "paypal_secret",
      )?.value;
      if (!paypalClientId || !paypalSecret) {
        return { success: false, message: "PayPal no configurado" };
      }
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            status: "confirmed",
            paymentMethod: "paypal",
            paymentProvider: "paypal",
            paidAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date(),
          })
          .where(eq37(orders.id, orderId));
        const commissions = await financialService.calculateCommissions(
          order.totalAmount,
          order.deliveryFee || 0,
        );
        const [paypalMethod] = await tx
          .select()
          .from(paymentMethods)
          .where(eq37(paymentMethods.provider, "paypal"))
          .limit(1);
        const paypalFee = paypalMethod
          ? Math.round(
              order.totalAmount * (paypalMethod.commissionPercentage / 100),
            )
          : 0;
        const [business] = await tx
          .select({ ownerId: businesses.ownerId })
          .from(businesses)
          .where(eq37(businesses.id, order.businessId))
          .limit(1);
        if (!business?.ownerId) {
          throw new Error(
            `Business owner not found for business ${order.businessId}`,
          );
        }
        await financialService.updateWalletBalance(
          business.ownerId,
          commissions.business - paypalFee,
          "order_payment",
          order.id,
          `Pago de pedido #${order.id.slice(-6)} - PayPal (${paypalMethod?.commissionPercentage}% fee)`,
        );
        if (order.driverId) {
          await financialService.updateWalletBalance(
            order.driverId,
            commissions.driver,
            "delivery_payment",
            order.id,
            `Entrega de pedido #${order.id.slice(-6)}`,
          );
        }
        const [adminUser] = await tx
          .select()
          .from(
            await Promise.resolve()
              .then(() => (init_schema_mysql(), schema_mysql_exports))
              .then((m) => m.users),
          )
          .where(
            eq37(
              (
                await Promise.resolve()
                  .then(() => (init_schema_mysql(), schema_mysql_exports))
                  .then((m) => m.users)
              ).role,
              "admin",
            ),
          )
          .limit(1);
        if (adminUser) {
          await financialService.updateWalletBalance(
            adminUser.id,
            commissions.platform + paypalFee,
            "platform_commission",
            order.id,
            `Comisi\xF3n ComeYa + PayPal fee - Pedido #${order.id.slice(-6)}`,
          );
        }
        logger.info(`\u2705 PayPal payment processed: Order ${order.id}`, {
          orderId: order.id,
          transactionId: paypalTransactionId,
          commissions,
          paypalFee,
        });
      });
      return {
        success: true,
        message: "Pago con PayPal procesado exitosamente",
        orderId: order.id,
      };
    } catch (error) {
      logger.error("Error processing PayPal payment:", error);
      return { success: false, message: error.message };
    }
  }
  // Get pending payment proofs (Admin)
  async getPendingPaymentProofs() {
    const proofs = await db
      .select()
      .from(paymentProofs)
      .where(eq37(paymentProofs.status, "pending"))
      .orderBy(paymentProofs.submittedAt);
    const backendUrl =
      process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5e3}`;
    return proofs.map((proof) => ({
      ...proof,
      proofImageUrl: proof.proofImageUrl?.startsWith("http")
        ? proof.proofImageUrl
        : `${backendUrl}${proof.proofImageUrl}`,
    }));
  }
  // Métricas genéricas de pagos (todos los métodos)
  async getPaymentMetrics() {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const [all, pending, approved, rejected, todayApproved, todayRejected] =
      await Promise.all([
        db.select({ count: count2() }).from(paymentProofs),
        db
          .select({ count: count2() })
          .from(paymentProofs)
          .where(eq37(paymentProofs.status, "pending")),
        db
          .select({ count: count2(), total: sum2(paymentProofs.amount) })
          .from(paymentProofs)
          .where(eq37(paymentProofs.status, "approved")),
        db
          .select({ count: count2() })
          .from(paymentProofs)
          .where(eq37(paymentProofs.status, "rejected")),
        db
          .select({ count: count2(), total: sum2(paymentProofs.amount) })
          .from(paymentProofs)
          .where(
            and16(
              eq37(paymentProofs.status, "approved"),
              gte2(paymentProofs.verifiedAt, today),
            ),
          ),
        db
          .select({ count: count2() })
          .from(paymentProofs)
          .where(
            and16(
              eq37(paymentProofs.status, "rejected"),
              gte2(paymentProofs.verifiedAt, today),
            ),
          ),
      ]);
    const byProvider = await db
      .select({
        provider: paymentProofs.paymentProvider,
        count: count2(),
        total: sum2(paymentProofs.amount),
      })
      .from(paymentProofs)
      .where(eq37(paymentProofs.status, "approved"))
      .groupBy(paymentProofs.paymentProvider);
    const totalByMethod = {};
    byProvider.forEach((item) => {
      totalByMethod[item.provider] = {
        count: item.count,
        amount: item.total || 0,
      };
    });
    return {
      totalByMethod,
      pendingProofs: pending[0].count,
      approvedToday: todayApproved[0].count,
      rejectedToday: todayRejected[0].count,
      totalRevenue: approved[0].total || 0,
    };
  }
  // Get payment proof by order ID
  async getPaymentProofByOrderId(orderId) {
    const [proof] = await db
      .select()
      .from(paymentProofs)
      .where(eq37(paymentProofs.orderId, orderId))
      .limit(1);
    return proof;
  }
};
var digitalPaymentService = DigitalPaymentService.getInstance();

// server/routes/digitalPayments.ts
var router23 = Router7();
router23.get("/methods", authenticateToken, async (req, res) => {
  try {
    const methods = await digitalPaymentService.getActivePaymentMethods();
    res.json({ success: true, methods });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router23.get(
  "/metrics",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const metrics = await digitalPaymentService.getPaymentMetrics();
      res.json({ success: true, ...metrics });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var digitalPayments_default = router23;

// server/routes/paymentAccounts.ts
import { Router as Router8 } from "express";
init_db();
var router24 = Router8();
router24.get("/receiving-accounts", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT provider, account_data FROM payment_receiving_accounts WHERE is_active = TRUE",
    );
    const accounts = {};
    rows.forEach((row) => {
      accounts[row.provider] = row.account_data;
    });
    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Error getting payment accounts:", error);
    res
      .status(500)
      .json({ success: false, error: "Error al obtener cuentas de pago" });
  }
});
router24.get(
  "/admin/receiving-accounts",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        "SELECT id, provider, account_data, is_active, created_at, updated_at FROM payment_receiving_accounts ORDER BY provider",
      );
      const accounts = rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        accountData: row.account_data,
        // Ya viene como objeto
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      res.json({ success: true, accounts });
    } catch (error) {
      console.error("Error getting admin payment accounts:", error);
      res
        .status(500)
        .json({ success: false, error: "Error al obtener cuentas" });
    }
  },
);
router24.put(
  "/admin/receiving-accounts/:provider",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { accountData, isActive } = req.body;
      await db.execute(
        "UPDATE payment_receiving_accounts SET account_data = ?, is_active = ?, updated_at = NOW() WHERE provider = ?",
        [JSON.stringify(accountData), isActive ?? true, provider],
      );
      res.json({ success: true, message: "Cuenta actualizada correctamente" });
    } catch (error) {
      console.error("Error updating payment account:", error);
      res
        .status(500)
        .json({ success: false, error: "Error al actualizar cuenta" });
    }
  },
);
var paymentAccounts_default = router24;

// server/routes/fundRelease.ts
import { Router as Router9 } from "express";

// server/fundReleaseService.ts
init_db();
init_schema_mysql();
init_logger();
import { eq as eq39, and as and18, lt } from "drizzle-orm";
var FundReleaseService = class _FundReleaseService {
  static instance;
  constructor() {}
  static getInstance() {
    if (!_FundReleaseService.instance) {
      _FundReleaseService.instance = new _FundReleaseService();
    }
    return _FundReleaseService.instance;
  }
  // Release funds - creates payouts for business and driver
  async releaseFunds(order) {
    const { createPayoutsForOrder: createPayoutsForOrder2 } =
      await Promise.resolve().then(
        () => (init_payoutService(), payoutService_exports),
      );
    await createPayoutsForOrder2(order.id);
    await db
      .update(orders)
      .set({
        fundsReleased: true,
        fundsReleasedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq39(orders.id, order.id));
  }
  // Release funds when customer confirms delivery
  async releaseOnCustomerConfirmation(orderId, customerId) {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq39(orders.id, orderId))
        .limit(1);
      if (!order) return { success: false, message: "Pedido no encontrado" };
      if (order.userId !== customerId)
        return { success: false, message: "No autorizado" };
      if (order.status !== "delivered")
        return {
          success: false,
          message: "El pedido a\xFAn no ha sido entregado",
        };
      if (order.fundsReleased)
        return { success: false, message: "Los fondos ya fueron liberados" };
      await db
        .update(orders)
        .set({
          confirmedByCustomer: true,
          confirmedByCustomerAt: /* @__PURE__ */ new Date(),
          fundsReleased: true,
          fundsReleasedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq39(orders.id, orderId));
      try {
        const { createPayoutsForOrder: createPayoutsForOrder2 } =
          await Promise.resolve().then(
            () => (init_payoutService(), payoutService_exports),
          );
        await createPayoutsForOrder2(orderId);
      } catch (e) {
        logger.error(`Error creating payouts for order ${orderId}:`, e);
      }
      logger.info(`\u2705 Customer confirmed delivery: Order ${orderId}`, {
        orderId,
        customerId,
      });
      return {
        success: true,
        message:
          "Entrega confirmada. Los pagos ser\xE1n procesados por el administrador.",
        orderId: order.id,
        amountReleased: order.total,
      };
    } catch (error) {
      logger.error("Error releasing funds on customer confirmation:", error);
      return { success: false, message: error.message };
    }
  }
  // Release funds for a specific order (used by business QR scan or pickup)
  async releaseOrderFunds(orderId) {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq39(orders.id, orderId))
        .limit(1);
      if (!order) return { success: false, message: "Pedido no encontrado" };
      if (order.fundsReleased)
        return { success: false, message: "Los fondos ya fueron liberados" };
      await this.releaseFunds(order);
      logger.info(`\u2705 Funds released: Order ${orderId}`, { orderId });
      return {
        success: true,
        message: "Fondos liberados exitosamente",
        orderId: order.id,
        amountReleased: order.total,
      };
    } catch (error) {
      logger.error("Error releasing order funds:", error);
      return { success: false, message: error.message };
    }
  }
  // Auto-release funds after timeout (24h default)
  async autoReleaseFunds() {
    try {
      const now = /* @__PURE__ */ new Date();
      const deliveredAt24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      const ordersToRelease = await db
        .select()
        .from(orders)
        .where(
          and18(
            eq39(orders.status, "delivered"),
            eq39(orders.fundsReleased, false),
            lt(orders.deliveredAt, deliveredAt24hAgo),
          ),
        );
      let released = 0;
      let failed = 0;
      for (const order of ordersToRelease) {
        try {
          await this.releaseFunds(order);
          released++;
          logger.info(`\u23F0 Auto-released funds: Order ${order.id}`, {
            orderId: order.id,
            deliveredAt: order.deliveredAt,
            hoursElapsed: Math.floor(
              (now.getTime() - new Date(order.deliveredAt).getTime()) /
                (1e3 * 60 * 60),
            ),
          });
        } catch (error) {
          failed++;
          logger.error(
            `Failed to auto-release funds for order ${order.id}:`,
            error,
          );
        }
      }
      logger.info(
        `\u{1F504} Auto-release batch completed: ${released} released, ${failed} failed`,
      );
      return { released, failed };
    } catch (error) {
      logger.error("Error in auto-release funds:", error);
      return { released: 0, failed: 0 };
    }
  }
  // Get orders pending fund release
  async getPendingReleaseOrders() {
    const now = /* @__PURE__ */ new Date();
    const deliveredAt24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    return await db
      .select()
      .from(orders)
      .where(
        and18(
          eq39(orders.status, "delivered"),
          eq39(orders.fundsReleased, false),
          lt(orders.deliveredAt, deliveredAt24hAgo),
        ),
      );
  }
  // Dispute order - prevent fund release
  async disputeOrder(orderId, customerId, reason) {
    try {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq39(orders.id, orderId))
        .limit(1);
      if (!order) {
        return { success: false, message: "Pedido no encontrado" };
      }
      if (order.userId !== customerId) {
        return { success: false, message: "No autorizado" };
      }
      if (order.fundsReleased) {
        return {
          success: false,
          message: "Los fondos ya fueron liberados. Contacta soporte.",
        };
      }
      await db
        .update(orders)
        .set({
          status: "disputed",
          cancellationReason: reason,
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq39(orders.id, orderId));
      logger.warn(`\u26A0\uFE0F Order disputed by customer: ${orderId}`, {
        orderId,
        customerId,
        reason,
      });
      return {
        success: true,
        message: "Disputa registrada. Un administrador revisar\xE1 tu caso.",
        orderId: order.id,
      };
    } catch (error) {
      logger.error("Error disputing order:", error);
      return { success: false, message: error.message };
    }
  }
};
var fundReleaseService = FundReleaseService.getInstance();

// server/routes/fundRelease.ts
init_payoutService();
init_loyaltyService();
var router25 = Router9();
router25.post("/confirm-delivery", authenticateToken, async (req, res) => {
  try {
    if (
      req.user.role !== "customer" &&
      req.user.role !== "admin" &&
      req.user.role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Solo el cliente puede confirmar la entrega",
        });
    }
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId es requerido",
      });
    }
    const result = await fundReleaseService.releaseOnCustomerConfirmation(
      orderId,
      req.user.id,
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    await createPayoutsForOrder(orderId);
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (order?.userId) {
        await LoyaltyService.awardPointsForOrder(
          order.userId,
          orderId,
          order.total,
        );
        console.log(
          `\u2705 Puntos de lealtad awarded para orden ${orderId.slice(-6)}`,
        );
      }
    } catch (loyaltyError) {
      console.error(
        "\u26A0\uFE0F Error agregando puntos de lealtad:",
        loyaltyError,
      );
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router25.post("/dispute", authenticateToken, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        error: "orderId y reason son requeridos",
      });
    }
    const result = await fundReleaseService.disputeOrder(
      orderId,
      req.user.id,
      reason,
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    try {
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq64(orders2.id, orderId))
        .limit(1);
      if (order?.deliveryPersonId) {
        const { addStrike: addStrike2 } = await Promise.resolve().then(
          () => (init_strikeService(), strikeService_exports),
        );
        await addStrike2(
          order.deliveryPersonId,
          `Disputa del cliente: ${reason}`,
          orderId,
        );
      }
    } catch (strikeErr) {
      console.error("Error adding strike on dispute:", strikeErr);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router25.get(
  "/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const orders2 = await fundReleaseService.getPendingReleaseOrders();
      res.json({ success: true, orders: orders2 });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router25.post(
  "/auto-release",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await fundReleaseService.autoReleaseFunds();
      res.json({
        success: true,
        message: `Auto-release completado: ${result.released} liberados, ${result.failed} fallidos`,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var fundRelease_default = router25;

// server/payoutRoutes.ts
import { Router as Router10 } from "express";
init_payoutService();
var router26 = Router10();
router26.get("/accounts", authenticateToken, async (req, res) => {
  try {
    const accounts = await getUserPaymentAccounts(req.user.id);
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router26.post("/accounts", authenticateToken, async (req, res) => {
  try {
    await savePaymentAccount(req.user.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router26.delete("/accounts/:id", authenticateToken, async (req, res) => {
  try {
    await deletePaymentAccount(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router26.get("/history", authenticateToken, async (req, res) => {
  try {
    const history = await getPayoutHistory(req.user.id);
    res.json({ success: true, payouts: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router26.get(
  "/pending",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const pending = await getPendingPayouts();
      res.json({ success: true, payouts: pending });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
router26.post(
  "/:id/paid",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      await markPayoutPaid(req.params.id, req.user.id, req.body.notes);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);
var payoutRoutes_default = router26;

// server/routes/search.ts
init_db();
init_schema_mysql();
import express17 from "express";
import { like, and as and19, eq as eq40, or as or3 } from "drizzle-orm";
var router27 = express17.Router();
router27.get("/products", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    if (!query || query.length < 2) {
      return res.json({ success: true, results: [] });
    }
    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 1);
    const results = await db
      .select({
        product: products,
        business: {
          id: businesses.id,
          name: businesses.name,
          image: businesses.image,
          isOpen: businesses.isOpen,
          deliveryFee: businesses.deliveryFee,
        },
      })
      .from(products)
      .leftJoin(businesses, eq40(products.businessId, businesses.id))
      .where(
        and19(
          eq40(products.isAvailable, true),
          eq40(businesses.isActive, true),
          or3(
            ...searchTerms.map((term) => like(products.name, `%${term}%`)),
            ...searchTerms.map((term) =>
              like(products.description, `%${term}%`),
            ),
          ),
        ),
      )
      .limit(50);
    res.json({
      success: true,
      results: results.map((r) => ({
        ...r.product,
        business: r.business,
      })),
    });
  } catch (error) {
    console.error("Product search error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
var search_default = router27;

// server/routes/coupons.ts
import express18 from "express";

// server/advancedCouponService.ts
init_db();
init_schema_mysql();
import {
  eq as eq41,
  and as and20,
  gte as gte3,
  or as or4,
  isNull as isNull2,
} from "drizzle-orm";
var AdvancedCouponService = class {
  /**
   * Valida un cupón y calcula el descuento aplicable
   */
  static async validateCoupon(code, context) {
    try {
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(
          and20(
            eq41(coupons.code, code.toUpperCase()),
            eq41(coupons.isActive, true),
          ),
        )
        .limit(1);
      if (!coupon) {
        return { valid: false, discount: 0, message: "Cup\xF3n no v\xE1lido" };
      }
      if (
        coupon.expiresAt &&
        new Date(coupon.expiresAt) < /* @__PURE__ */ new Date()
      ) {
        return { valid: false, discount: 0, message: "Cup\xF3n expirado" };
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, discount: 0, message: "Cup\xF3n agotado" };
      }
      if (coupon.maxUsesPerUser) {
        const userUsageCount = await this.getUserCouponUsageCount(
          context.userId,
          coupon.id,
        );
        if (userUsageCount >= coupon.maxUsesPerUser) {
          return {
            valid: false,
            discount: 0,
            message: `Ya usaste este cup\xF3n ${coupon.maxUsesPerUser} ${coupon.maxUsesPerUser === 1 ? "vez" : "veces"}`,
          };
        }
      }
      if (coupon.minOrderAmount && context.orderTotal < coupon.minOrderAmount) {
        return {
          valid: false,
          discount: 0,
          message: `Pedido m\xEDnimo de Bs. ${(coupon.minOrderAmount / 100).toFixed(2)}`,
        };
      }
      const newUsersOnly = coupon.newUsersOnly;
      if (newUsersOnly) {
        const isNewUser = await this.isNewUser(context.userId);
        if (!isNewUser) {
          return {
            valid: false,
            discount: 0,
            message: "Cup\xF3n solo para nuevos usuarios",
          };
        }
      }
      const firstOrderOnly = coupon.firstOrderOnly;
      if (firstOrderOnly && !context.isFirstOrder) {
        return {
          valid: false,
          discount: 0,
          message: "Cup\xF3n solo para primera compra",
        };
      }
      const validForBusinesses = coupon.validForBusinesses;
      if (validForBusinesses && context.businessId) {
        try {
          const businessIds = JSON.parse(validForBusinesses);
          if (
            Array.isArray(businessIds) &&
            !businessIds.includes(context.businessId)
          ) {
            return {
              valid: false,
              discount: 0,
              message: "Cup\xF3n no v\xE1lido para este negocio",
            };
          }
        } catch (e) {
          console.error("Error parsing validForBusinesses:", e);
        }
      }
      const validForCategories = coupon.validForCategories;
      if (validForCategories && context.categories) {
        try {
          const allowedCategories = JSON.parse(validForCategories);
          if (Array.isArray(allowedCategories)) {
            const hasValidCategory = context.categories.some((cat) =>
              allowedCategories.includes(cat),
            );
            if (!hasValidCategory) {
              return {
                valid: false,
                discount: 0,
                message: "Cup\xF3n no v\xE1lido para estas categor\xEDas",
              };
            }
          }
        } catch (e) {
          console.error("Error parsing validForCategories:", e);
        }
      }
      const validForProducts = coupon.validForProducts;
      if (validForProducts && context.productIds) {
        try {
          const allowedProducts = JSON.parse(validForProducts);
          if (Array.isArray(allowedProducts)) {
            const hasValidProduct = context.productIds.some((pid) =>
              allowedProducts.includes(pid),
            );
            if (!hasValidProduct) {
              return {
                valid: false,
                discount: 0,
                message: "Cup\xF3n no v\xE1lido para estos productos",
              };
            }
          }
        } catch (e) {
          console.error("Error parsing validForProducts:", e);
        }
      }
      const dayOfWeek = coupon.dayOfWeek;
      if (dayOfWeek) {
        try {
          const allowedDays = JSON.parse(dayOfWeek);
          const currentDay = (
            context.currentTime || /* @__PURE__ */ new Date()
          ).getDay();
          if (Array.isArray(allowedDays) && !allowedDays.includes(currentDay)) {
            const dayNames = [
              "Domingo",
              "Lunes",
              "Martes",
              "Mi\xE9rcoles",
              "Jueves",
              "Viernes",
              "S\xE1bado",
            ];
            const validDays = allowedDays.map((d) => dayNames[d]).join(", ");
            return {
              valid: false,
              discount: 0,
              message: `Cup\xF3n v\xE1lido solo: ${validDays}`,
            };
          }
        } catch (e) {
          console.error("Error parsing dayOfWeek:", e);
        }
      }
      const timeRange = coupon.timeRange;
      if (timeRange) {
        try {
          const range = JSON.parse(timeRange);
          const currentTime = context.currentTime || /* @__PURE__ */ new Date();
          const currentHour = currentTime.getHours();
          const currentMinute = currentTime.getMinutes();
          const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
          if (range.start && range.end) {
            if (currentTimeStr < range.start || currentTimeStr > range.end) {
              return {
                valid: false,
                discount: 0,
                message: `Cup\xF3n v\xE1lido de ${range.start} a ${range.end}`,
              };
            }
          }
        } catch (e) {
          console.error("Error parsing timeRange:", e);
        }
      }
      const discount = this.calculateDiscount(coupon, context.orderTotal);
      return {
        valid: true,
        discount,
        coupon,
        message: `Descuento de Bs. ${(discount / 100).toFixed(2)} aplicado`,
      };
    } catch (error) {
      console.error("Error validating coupon:", error);
      return {
        valid: false,
        discount: 0,
        message: "Error al validar cup\xF3n",
      };
    }
  }
  /**
   * Calcula el descuento basado en el tipo de cupón
   */
  static calculateDiscount(coupon, orderTotal) {
    const type = coupon.type || coupon.discountType;
    switch (type) {
      case "percentage":
        let discount = Math.round((orderTotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
        return discount;
      case "fixed":
        return Math.min(coupon.discountValue, orderTotal);
      case "free_delivery":
        return coupon.discountValue || 2500;
      case "bogo":
        return Math.round(orderTotal * 0.5);
      case "first_order":
        return Math.round((orderTotal * coupon.discountValue) / 100);
      default:
        return 0;
    }
  }
  /**
   * Obtiene el número de veces que un usuario ha usado un cupón
   */
  static async getUserCouponUsageCount(userId, couponId) {
    try {
      const result = await db.execute(
        `SELECT COUNT(*) as count FROM coupon_usage WHERE user_id = ? AND coupon_id = ?`,
        [userId, couponId],
      );
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting coupon usage count:", error);
      return 0;
    }
  }
  /**
   * Verifica si un usuario es nuevo (sin pedidos completados)
   */
  static async isNewUser(userId) {
    try {
      const result = await db.execute(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'delivered'`,
        [userId],
      );
      return (result[0]?.count || 0) === 0;
    } catch (error) {
      console.error("Error checking if new user:", error);
      return false;
    }
  }
  /**
   * Registra el uso de un cupón
   */
  static async recordCouponUsage(couponId, userId, orderId, discountApplied) {
    try {
      await db.execute(
        `INSERT INTO coupon_usage (id, coupon_id, user_id, order_id, discount_applied) 
         VALUES (UUID(), ?, ?, ?, ?)`,
        [couponId, userId, orderId, discountApplied],
      );
      await db.execute(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`,
        [couponId],
      );
    } catch (error) {
      console.error("Error recording coupon usage:", error);
      throw error;
    }
  }
  /**
   * Obtiene cupones disponibles para un usuario
   */
  static async getAvailableCoupons(userId) {
    try {
      const now = /* @__PURE__ */ new Date();
      const availableCoupons = await db
        .select()
        .from(coupons)
        .where(
          and20(
            eq41(coupons.isActive, true),
            or4(isNull2(coupons.expiresAt), gte3(coupons.expiresAt, now)),
          ),
        );
      const filtered = [];
      for (const coupon of availableCoupons) {
        if (coupon.maxUsesPerUser) {
          const usageCount = await this.getUserCouponUsageCount(
            userId,
            coupon.id,
          );
          if (usageCount >= coupon.maxUsesPerUser) {
            continue;
          }
        }
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          continue;
        }
        filtered.push(coupon);
      }
      return filtered;
    } catch (error) {
      console.error("Error getting available coupons:", error);
      return [];
    }
  }
};

// server/routes/coupons.ts
init_db();
init_schema_mysql();
import { eq as eq42 } from "drizzle-orm";
var router28 = express18.Router();
router28.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const availableCoupons =
      await AdvancedCouponService.getAvailableCoupons(userId);
    res.json({
      success: true,
      coupons: availableCoupons,
    });
  } catch (error) {
    console.error("Error getting coupons:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router28.post("/validate", authenticateToken, async (req, res) => {
  try {
    const { code, orderTotal, businessId, productIds, categories } = req.body;
    const userId = req.user.id;
    if (!code || !orderTotal) {
      return res.status(400).json({
        success: false,
        error: "C\xF3digo de cup\xF3n y total del pedido son requeridos",
      });
    }
    const ordersResult = await db.execute(
      `SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'delivered'`,
      [userId],
    );
    const isFirstOrder = (ordersResult[0]?.count || 0) === 0;
    const result = await AdvancedCouponService.validateCoupon(code, {
      userId,
      orderTotal,
      businessId,
      productIds,
      categories,
      isFirstOrder,
    });
    res.json({
      success: result.valid,
      ...result,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router28.post("/apply", authenticateToken, async (req, res) => {
  try {
    const { couponId, orderId, discountApplied } = req.body;
    const userId = req.user.id;
    if (!couponId || !orderId || discountApplied === void 0) {
      return res.status(400).json({
        success: false,
        error: "Datos incompletos",
      });
    }
    await AdvancedCouponService.recordCouponUsage(
      couponId,
      userId,
      orderId,
      discountApplied,
    );
    res.json({
      success: true,
      message: "Cup\xF3n aplicado exitosamente",
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router28.get("/my-usage", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const usage = await db.execute(
      `SELECT cu.*, c.code, c.description, o.created_at as used_at
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       JOIN orders o ON cu.order_id = o.id
       WHERE cu.user_id = ?
       ORDER BY cu.created_at DESC
       LIMIT 50`,
      [userId],
    );
    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error("Error getting coupon usage:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router28.get(
  "/admin/all",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const allCoupons = await db.select().from(coupons);
      res.json({
        success: true,
        coupons: allCoupons,
      });
    } catch (error) {
      console.error("Error getting all coupons:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router28.post(
  "/admin/create",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        code,
        type,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        maxUses,
        maxUsesPerUser,
        description,
        validForBusinesses,
        validForCategories,
        validForProducts,
        newUsersOnly,
        firstOrderOnly,
        dayOfWeek,
        timeRange,
        expiresAt,
      } = req.body;
      if (!code || !discountValue) {
        return res.status(400).json({
          success: false,
          error: "C\xF3digo y valor de descuento son requeridos",
        });
      }
      const [existing] = await db
        .select()
        .from(coupons)
        .where(eq42(coupons.code, code.toUpperCase()))
        .limit(1);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Ya existe un cup\xF3n con ese c\xF3digo",
        });
      }
      await db.insert(coupons).values({
        code: code.toUpperCase(),
        discountType: discountType || "percentage",
        discountValue,
        minOrderAmount: minOrderAmount || 0,
        maxDiscount: maxDiscount || null,
        maxUses: maxUses || null,
        maxUsesPerUser: maxUsesPerUser || 1,
        description: description || "",
        type: type || "percentage",
        validForBusinesses: validForBusinesses
          ? JSON.stringify(validForBusinesses)
          : null,
        validForCategories: validForCategories
          ? JSON.stringify(validForCategories)
          : null,
        validForProducts: validForProducts
          ? JSON.stringify(validForProducts)
          : null,
        newUsersOnly: newUsersOnly || false,
        firstOrderOnly: firstOrderOnly || false,
        dayOfWeek: dayOfWeek ? JSON.stringify(dayOfWeek) : null,
        timeRange: timeRange ? JSON.stringify(timeRange) : null,
        expiresAt: expiresAt || null,
        isActive: true,
      });
      res.json({
        success: true,
        message: "Cup\xF3n creado exitosamente",
      });
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router28.put(
  "/admin/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        code,
        discountType,
        discountValue,
        minOrderAmount,
        maxUses,
        maxUsesPerUser,
        expiresAt,
        isActive,
      } = req.body;
      const updates = {};
      if (code !== void 0) updates.code = String(code).toUpperCase();
      if (discountType !== void 0) updates.discountType = discountType;
      if (discountValue !== void 0)
        updates.discountValue = Number(discountValue);
      if (minOrderAmount !== void 0)
        updates.minOrderAmount =
          minOrderAmount === null ? null : Number(minOrderAmount);
      if (maxUses !== void 0)
        updates.maxUses = maxUses === null ? null : Number(maxUses);
      if (maxUsesPerUser !== void 0)
        updates.maxUsesPerUser = Number(maxUsesPerUser);
      if (expiresAt !== void 0)
        updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (isActive !== void 0) updates.isActive = Boolean(isActive);
      if (Object.keys(updates).length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            error: "No hay campos v\xE1lidos para actualizar",
          });
      }
      await db.update(coupons).set(updates).where(eq42(coupons.id, id));
      const [updated] = await db
        .select()
        .from(coupons)
        .where(eq42(coupons.id, id))
        .limit(1);
      res.json({ success: true, coupon: updated });
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router28.delete(
  "/admin/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(`DELETE FROM coupons WHERE id = ?`, [id]);
      res.json({ success: true, message: "Cup\xF3n eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router28.get(
  "/admin/stats",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const stats = await db.execute(`
      SELECT 
        COUNT(*) as total_coupons,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_coupons,
        SUM(used_count) as total_uses,
        SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired_coupons
      FROM coupons
    `);
      const topCoupons = await db.execute(`
      SELECT c.code, c.description, c.used_count, 
             COUNT(cu.id) as actual_uses,
             SUM(cu.discount_applied) as total_discount_given
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      GROUP BY c.id
      ORDER BY actual_uses DESC
      LIMIT 10
    `);
      res.json({
        success: true,
        stats: stats[0],
        topCoupons,
      });
    } catch (error) {
      console.error("Error getting coupon stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var coupons_default = router28;

// server/routes/loyalty.ts
import express19 from "express";
init_loyaltyService();
init_db();
init_schema_mysql();
import { eq as eq43 } from "drizzle-orm";
var router29 = express19.Router();
router29.get("/points", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const points = await LoyaltyService.getOrCreateLoyaltyPoints(userId);
    res.json({
      success: true,
      points,
    });
  } catch (error) {
    console.error("Error getting loyalty points:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router29.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const history = await LoyaltyService.getTransactionHistory(userId, limit);
    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Error getting transaction history:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router29.get("/rewards", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rewards = await LoyaltyService.getAvailableRewards(userId);
    res.json({
      success: true,
      rewards,
    });
  } catch (error) {
    console.error("Error getting available rewards:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router29.post("/redeem", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rewardId } = req.body;
    if (!rewardId) {
      return res.status(400).json({
        success: false,
        error: "rewardId requerido",
      });
    }
    const result = await LoyaltyService.redeemReward(userId, rewardId);
    res.json({
      success: true,
      redemptionId: result.redemptionId,
      reward: result.reward,
      message: "Recompensa canjeada exitosamente",
    });
  } catch (error) {
    console.error("Error redeeming reward:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});
router29.get("/challenges", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const challenges = await LoyaltyService.getUserChallenges(userId);
    res.json({
      success: true,
      challenges,
    });
  } catch (error) {
    console.error("Error getting challenges:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router29.post("/challenges/:id/claim", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const challengeId = req.params.id;
    const pointsAwarded = await LoyaltyService.claimChallengeReward(
      userId,
      challengeId,
    );
    res.json({
      success: true,
      pointsAwarded,
      message: `Has ganado ${pointsAwarded} puntos`,
    });
  } catch (error) {
    console.error("Error claiming challenge reward:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});
router29.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [points, rewards, challenges, history] = await Promise.all([
      LoyaltyService.getOrCreateLoyaltyPoints(userId),
      LoyaltyService.getAvailableRewards(userId),
      LoyaltyService.getUserChallenges(userId),
      LoyaltyService.getTransactionHistory(userId, 10),
    ]);
    res.json({
      success: true,
      dashboard: {
        points,
        rewards,
        challenges,
        recentActivity: history,
      },
    });
  } catch (error) {
    console.error("Error getting loyalty dashboard:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router29.get(
  "/admin/rewards",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const allRewards = await db.select().from(loyaltyRewards);
      res.json({
        success: true,
        rewards: allRewards,
      });
    } catch (error) {
      console.error("Error getting all rewards:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.post(
  "/admin/rewards",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        pointsCost,
        type,
        value,
        minTier,
        maxRedemptions,
        expiresAt,
        imageUrl,
        terms,
      } = req.body;
      if (!title || !pointsCost || !type || !value) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: title, pointsCost, type, value",
        });
      }
      const rewardId = crypto.randomUUID();
      await db.insert(loyaltyRewards).values({
        id: rewardId,
        title,
        description,
        pointsCost,
        type,
        value,
        minTier,
        maxRedemptions,
        expiresAt,
        imageUrl,
        terms,
        isAvailable: true,
        currentRedemptions: 0,
      });
      res.json({
        success: true,
        rewardId,
        message: "Recompensa creada exitosamente",
      });
    } catch (error) {
      console.error("Error creating reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.put(
  "/admin/rewards/:id",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      await db
        .update(loyaltyRewards)
        .set(updates)
        .where(eq43(loyaltyRewards.id, id));
      res.json({
        success: true,
        message: "Recompensa actualizada exitosamente",
      });
    } catch (error) {
      console.error("Error updating reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.delete(
  "/admin/rewards/:id",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      await db
        .update(loyaltyRewards)
        .set({ isAvailable: false })
        .where(eq43(loyaltyRewards.id, id));
      res.json({
        success: true,
        message: "Recompensa desactivada exitosamente",
      });
    } catch (error) {
      console.error("Error deleting reward:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.get(
  "/admin/challenges",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const allChallenges = await db.select().from(loyaltyChallenges);
      res.json({
        success: true,
        challenges: allChallenges,
      });
    } catch (error) {
      console.error("Error getting all challenges:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.post(
  "/admin/challenges",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const {
        title,
        description,
        type,
        target,
        rewardPoints,
        startsAt,
        expiresAt,
      } = req.body;
      if (!title || !type || !target || !rewardPoints) {
        return res.status(400).json({
          success: false,
          error: "Campos requeridos: title, type, target, rewardPoints",
        });
      }
      const challengeId = crypto.randomUUID();
      await db.insert(loyaltyChallenges).values({
        id: challengeId,
        title,
        description,
        type,
        target,
        rewardPoints,
        startsAt,
        expiresAt,
        isActive: true,
      });
      res.json({
        success: true,
        challengeId,
        message: "Challenge creado exitosamente",
      });
    } catch (error) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router29.get(
  "/admin/stats",
  authenticateToken,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const stats = await db.execute(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(current_points) as total_points_in_circulation,
        SUM(total_earned) as total_points_earned,
        SUM(total_redeemed) as total_points_redeemed,
        SUM(CASE WHEN tier = 'bronze' THEN 1 ELSE 0 END) as bronze_users,
        SUM(CASE WHEN tier = 'silver' THEN 1 ELSE 0 END) as silver_users,
        SUM(CASE WHEN tier = 'gold' THEN 1 ELSE 0 END) as gold_users,
        SUM(CASE WHEN tier = 'platinum' THEN 1 ELSE 0 END) as platinum_users,
        SUM(CASE WHEN tier = 'diamond' THEN 1 ELSE 0 END) as diamond_users
      FROM loyalty_points
    `);
      const rewardStats = await db.execute(`
      SELECT 
        COUNT(*) as total_rewards,
        SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as active_rewards,
        SUM(current_redemptions) as total_redemptions
      FROM loyalty_rewards
    `);
      res.json({
        success: true,
        stats: {
          users: stats[0],
          rewards: rewardStats[0],
        },
      });
    } catch (error) {
      console.error("Error getting loyalty stats:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var loyalty_default = router29;

// server/routes/favorites.ts
import express20 from "express";

// server/favoritesService.ts
init_db();
init_schema_mysql();
import { eq as eq44, and as and21 } from "drizzle-orm";
var FavoritesService = class {
  // Agregar favorito
  static async addFavorite(userId, itemType, itemId) {
    try {
      await db.insert(userFavorites).values({
        userId,
        itemType,
        itemId,
      });
      return { success: true };
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return { success: false, error: "Ya est\xE1 en favoritos" };
      }
      throw error;
    }
  }
  // Eliminar favorito
  static async removeFavorite(userId, itemType, itemId) {
    await db
      .delete(userFavorites)
      .where(
        and21(
          eq44(userFavorites.userId, userId),
          eq44(userFavorites.itemType, itemType),
          eq44(userFavorites.itemId, itemId),
        ),
      );
    return { success: true };
  }
  // Obtener favoritos del usuario
  static async getUserFavorites(userId) {
    const favorites2 = await db
      .select()
      .from(userFavorites)
      .where(eq44(userFavorites.userId, userId));
    const businessIds = favorites2
      .filter((f) => f.itemType === "business")
      .map((f) => f.itemId);
    const productIds = favorites2
      .filter((f) => f.itemType === "product")
      .map((f) => f.itemId);
    const favoriteBusinesses =
      businessIds.length > 0
        ? await db
            .select()
            .from(businesses)
            .where(eq44(businesses.id, businessIds[0]))
        : [];
    const favoriteProducts =
      productIds.length > 0
        ? await db
            .select()
            .from(products)
            .where(eq44(products.id, productIds[0]))
        : [];
    return {
      businesses: favoriteBusinesses,
      products: favoriteProducts,
      total: favorites2.length,
    };
  }
  // Verificar si es favorito
  static async isFavorite(userId, itemType, itemId) {
    const [favorite] = await db
      .select()
      .from(userFavorites)
      .where(
        and21(
          eq44(userFavorites.userId, userId),
          eq44(userFavorites.itemType, itemType),
          eq44(userFavorites.itemId, itemId),
        ),
      )
      .limit(1);
    return !!favorite;
  }
};

// server/routes/favorites.ts
var router30 = express20.Router();
router30.post("/", authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.body;
    const result = await FavoritesService.addFavorite(
      req.user.id,
      itemType,
      itemId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.delete("/:itemType/:itemId", authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;
    const result = await FavoritesService.removeFavorite(
      req.user.id,
      itemType,
      itemId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.get("/", authenticateToken, async (req, res) => {
  try {
    const favorites2 = await FavoritesService.getUserFavorites(req.user.id);
    res.json({ success: true, favorites: favorites2 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router30.get(
  "/check/:itemType/:itemId",
  authenticateToken,
  async (req, res) => {
    try {
      const { itemType, itemId } = req.params;
      const isFavorite = await FavoritesService.isFavorite(
        req.user.id,
        itemType,
        itemId,
      );
      res.json({ success: true, isFavorite });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var favorites_default = router30;

// server/routes/scheduledOrders.ts
import express21 from "express";

// server/scheduledOrdersService.ts
init_db();
init_schema_mysql();
import { eq as eq45, and as and22, lte as lte2 } from "drizzle-orm";
var ScheduledOrdersService = class {
  // Crear pedido programado
  static async createScheduledOrder(data) {
    const [scheduled] = await db.insert(scheduledOrders).values({
      userId: data.userId,
      businessId: data.businessId,
      items: JSON.stringify(data.items),
      scheduledFor: data.scheduledFor,
      recurringPattern: data.recurringPattern,
      recurringDays: data.recurringDays
        ? JSON.stringify(data.recurringDays)
        : null,
      recurringEndDate: data.recurringEndDate,
      deliveryAddressId: data.deliveryAddressId,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      status: "pending",
    });
    return { success: true, scheduledOrderId: scheduled.insertId };
  }
  // Obtener pedidos programados del usuario
  static async getUserScheduledOrders(userId) {
    const scheduled = await db
      .select()
      .from(scheduledOrders)
      .where(
        and22(
          eq45(scheduledOrders.userId, userId),
          eq45(scheduledOrders.status, "pending"),
        ),
      );
    return scheduled;
  }
  // Cancelar pedido programado
  static async cancelScheduledOrder(scheduledOrderId, userId) {
    await db
      .update(scheduledOrders)
      .set({ status: "cancelled" })
      .where(
        and22(
          eq45(scheduledOrders.id, scheduledOrderId),
          eq45(scheduledOrders.userId, userId),
        ),
      );
    return { success: true };
  }
  // Ejecutar pedidos programados (cron job)
  static async executeScheduledOrders() {
    const now = /* @__PURE__ */ new Date();
    const pending = await db
      .select()
      .from(scheduledOrders)
      .where(
        and22(
          eq45(scheduledOrders.status, "pending"),
          lte2(scheduledOrders.scheduledFor, now),
        ),
      );
    const results = [];
    for (const scheduled of pending) {
      try {
        const [order] = await db.insert(orders).values({
          userId: scheduled.userId,
          businessId: scheduled.businessId,
          items: scheduled.items,
          deliveryAddressId: scheduled.deliveryAddressId,
          paymentMethod: scheduled.paymentMethod,
          notes: scheduled.notes,
          status: "pending",
        });
        await db
          .update(scheduledOrders)
          .set({
            status: "executed",
            executedOrderId: order.insertId,
          })
          .where(eq45(scheduledOrders.id, scheduled.id));
        if (scheduled.recurringPattern) {
          const nextDate = this.calculateNextOccurrence(
            scheduled.scheduledFor,
            scheduled.recurringPattern,
            scheduled.recurringDays
              ? JSON.parse(scheduled.recurringDays)
              : null,
          );
          if (
            nextDate &&
            (!scheduled.recurringEndDate ||
              nextDate <= scheduled.recurringEndDate)
          ) {
            await db.insert(scheduledOrders).values({
              userId: scheduled.userId,
              businessId: scheduled.businessId,
              items: scheduled.items,
              scheduledFor: nextDate,
              recurringPattern: scheduled.recurringPattern,
              recurringDays: scheduled.recurringDays,
              recurringEndDate: scheduled.recurringEndDate,
              deliveryAddressId: scheduled.deliveryAddressId,
              paymentMethod: scheduled.paymentMethod,
              notes: scheduled.notes,
              status: "pending",
            });
          }
        }
        results.push({
          scheduledOrderId: scheduled.id,
          orderId: order.insertId,
          success: true,
        });
      } catch (error) {
        await db
          .update(scheduledOrders)
          .set({ status: "failed" })
          .where(eq45(scheduledOrders.id, scheduled.id));
        results.push({ scheduledOrderId: scheduled.id, success: false, error });
      }
    }
    return results;
  }
  // Calcular próxima ocurrencia
  static calculateNextOccurrence(currentDate, pattern, days) {
    const next = new Date(currentDate);
    switch (pattern) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }
};

// server/routes/scheduledOrders.ts
var router31 = express21.Router();
router31.post("/", authenticateToken, async (req, res) => {
  try {
    const result = await ScheduledOrdersService.createScheduledOrder({
      userId: req.user.id,
      ...req.body,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router31.get("/", authenticateToken, async (req, res) => {
  try {
    const scheduled = await ScheduledOrdersService.getUserScheduledOrders(
      req.user.id,
    );
    res.json({ success: true, scheduledOrders: scheduled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router31.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await ScheduledOrdersService.cancelScheduledOrder(
      req.params.id,
      req.user.id,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router31.post("/execute", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "No autorizado" });
    }
    const results = await ScheduledOrdersService.executeScheduledOrders();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var scheduledOrders_default = router31;

// server/routes/aiRecommendations.ts
import express22 from "express";

// server/aiRecommendationsService.ts
init_db();
init_schema_mysql();
import {
  eq as eq46,
  desc as desc6,
  and as and23,
  sql as sql10,
  gte as gte5,
} from "drizzle-orm";
var AIRecommendationsService = class {
  // Generar recomendaciones personalizadas
  static async generatePersonalizedRecommendations(userId) {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq46(orders.userId, userId))
      .orderBy(desc6(orders.createdAt))
      .limit(50);
    if (userOrders.length === 0) {
      return this.getDefaultRecommendations(userId);
    }
    const businessFrequency = this.analyzeBusinessFrequency(userOrders);
    const productFrequency = this.analyzeProductFrequency(userOrders);
    const timePatterns = this.analyzeTimePatterns(userOrders);
    const recommendations = [];
    for (const [businessId, count3] of Object.entries(businessFrequency).slice(
      0,
      3,
    )) {
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq46(businesses.id, businessId))
        .limit(1);
      if (business) {
        recommendations.push({
          userId,
          recommendationType: "personalized",
          itemType: "business",
          itemId: businessId,
          confidenceScore: Math.min(95, 60 + count3 * 5),
          reason: `Has pedido aqu\xED ${count3} veces`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
        });
      }
    }
    for (const [productId, count3] of Object.entries(productFrequency).slice(
      0,
      3,
    )) {
      recommendations.push({
        userId,
        recommendationType: "reorder",
        itemType: "product",
        itemId: productId,
        confidenceScore: Math.min(90, 50 + count3 * 10),
        reason: `Lo has pedido ${count3} veces`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
      });
    }
    await db
      .delete(aiRecommendations)
      .where(eq46(aiRecommendations.userId, userId));
    if (recommendations.length > 0) {
      await db.insert(aiRecommendations).values(recommendations);
    }
    return recommendations;
  }
  // Obtener recomendaciones trending
  static async getTrendingRecommendations() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1e3);
    const trending = await db
      .select({
        productId: sql10`JSON_EXTRACT(items, '$[*].product.id')`,
        count: sql10`COUNT(*)`,
      })
      .from(orders)
      .where(gte5(orders.createdAt, last24h))
      .groupBy(sql10`JSON_EXTRACT(items, '$[*].product.id')`)
      .orderBy(desc6(sql10`COUNT(*)`))
      .limit(10);
    return trending;
  }
  // Obtener recomendaciones del usuario
  static async getUserRecommendations(userId) {
    const now = /* @__PURE__ */ new Date();
    const recommendations = await db
      .select()
      .from(aiRecommendations)
      .where(
        and23(
          eq46(aiRecommendations.userId, userId),
          gte5(aiRecommendations.expiresAt, now),
        ),
      )
      .orderBy(desc6(aiRecommendations.confidenceScore));
    const enriched = [];
    for (const rec of recommendations) {
      let itemData = null;
      if (rec.itemType === "business") {
        const [business] = await db
          .select()
          .from(businesses)
          .where(eq46(businesses.id, rec.itemId))
          .limit(1);
        itemData = business;
      } else if (rec.itemType === "product") {
        const [product] = await db
          .select()
          .from(products)
          .where(eq46(products.id, rec.itemId))
          .limit(1);
        itemData = product;
      }
      if (itemData) {
        enriched.push({
          ...rec,
          itemData,
        });
      }
    }
    return enriched;
  }
  // Actualizar preferencias del usuario
  static async updateUserPreferences(userId, preferences) {
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq46(userPreferences.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(userPreferences)
        .set({
          cuisineTypes: preferences.cuisineTypes
            ? JSON.stringify(preferences.cuisineTypes)
            : null,
          priceRange: preferences.priceRange,
          dietaryRestrictions: preferences.dietaryRestrictions
            ? JSON.stringify(preferences.dietaryRestrictions)
            : null,
          preferredOrderTimes: preferences.preferredOrderTimes
            ? JSON.stringify(preferences.preferredOrderTimes)
            : null,
          favoriteCategories: preferences.favoriteCategories
            ? JSON.stringify(preferences.favoriteCategories)
            : null,
          spiceLevel: preferences.spiceLevel,
          healthScore: preferences.healthScore,
        })
        .where(eq46(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        cuisineTypes: preferences.cuisineTypes
          ? JSON.stringify(preferences.cuisineTypes)
          : null,
        priceRange: preferences.priceRange,
        dietaryRestrictions: preferences.dietaryRestrictions
          ? JSON.stringify(preferences.dietaryRestrictions)
          : null,
        preferredOrderTimes: preferences.preferredOrderTimes
          ? JSON.stringify(preferences.preferredOrderTimes)
          : null,
        favoriteCategories: preferences.favoriteCategories
          ? JSON.stringify(preferences.favoriteCategories)
          : null,
        spiceLevel: preferences.spiceLevel,
        healthScore: preferences.healthScore,
      });
    }
    await this.generatePersonalizedRecommendations(userId);
    return { success: true };
  }
  // Analizar frecuencia de negocios
  static analyzeBusinessFrequency(orders2) {
    const frequency = {};
    for (const order of orders2) {
      frequency[order.businessId] = (frequency[order.businessId] || 0) + 1;
    }
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }
  // Analizar frecuencia de productos
  static analyzeProductFrequency(orders2) {
    const frequency = {};
    for (const order of orders2) {
      try {
        const items = JSON.parse(order.items);
        for (const item of items) {
          const productId = item.product?.id || item.productId;
          if (productId) {
            frequency[productId] = (frequency[productId] || 0) + 1;
          }
        }
      } catch (e) {}
    }
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }
  // Analizar patrones de tiempo
  static analyzeTimePatterns(orders2) {
    const hourFrequency = {};
    const dayFrequency = {};
    for (const order of orders2) {
      const date = new Date(order.createdAt);
      const hour = date.getHours();
      const day = date.getDay();
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    }
    return { hourFrequency, dayFrequency };
  }
  // Recomendaciones por defecto para nuevos usuarios
  static async getDefaultRecommendations(userId) {
    const topBusinesses = await db
      .select()
      .from(businesses)
      .where(eq46(businesses.isActive, true))
      .orderBy(desc6(businesses.rating))
      .limit(5);
    const recommendations = topBusinesses.map((business, index) => ({
      userId,
      recommendationType: "trending",
      itemType: "business",
      itemId: business.id,
      confidenceScore: 80 - index * 5,
      reason: "Popular en tu \xE1rea",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
    }));
    if (recommendations.length > 0) {
      await db.insert(aiRecommendations).values(recommendations);
    }
    return recommendations;
  }
};

// server/routes/aiRecommendations.ts
var router32 = express22.Router();
router32.get("/personalized", authenticateToken, async (req, res) => {
  try {
    const recommendations =
      await AIRecommendationsService.getUserRecommendations(req.user.id);
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router32.get("/trending", authenticateToken, async (req, res) => {
  try {
    const trending =
      await AIRecommendationsService.getTrendingRecommendations();
    res.json({ success: true, trending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router32.post("/generate", authenticateToken, async (req, res) => {
  try {
    const recommendations =
      await AIRecommendationsService.generatePersonalizedRecommendations(
        req.user.id,
      );
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router32.put("/preferences", authenticateToken, async (req, res) => {
  try {
    const result = await AIRecommendationsService.updateUserPreferences(
      req.user.id,
      req.body,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var aiRecommendations_default = router32;

// server/routes/support.ts
import express23 from "express";

// server/supportService.ts
init_db();
init_schema_mysql();
init_enhancedPushService();
import { eq as eq47, and as and24, desc as desc7 } from "drizzle-orm";
var SupportService = class {
  static async createTicket(data) {
    const [result] = await db.insert(supportTickets).values({
      userId: data.userId,
      orderId: data.orderId,
      subject: data.subject,
      category: data.category,
      priority: data.priority || "medium",
      status: "open",
    });
    const ticketId = result.insertId;
    await db.insert(ticketMessages).values({
      ticketId,
      senderId: data.userId,
      senderType: "user",
      message: data.initialMessage,
    });
    return { success: true, ticketId };
  }
  static async getUserTickets(userId) {
    return db
      .select()
      .from(supportTickets)
      .where(eq47(supportTickets.userId, userId))
      .orderBy(desc7(supportTickets.createdAt));
  }
  static async getTicket(ticketId, userId) {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(
        and24(
          eq47(supportTickets.id, ticketId),
          eq47(supportTickets.userId, userId),
        ),
      )
      .limit(1);
    if (!ticket) throw new Error("Ticket no encontrado");
    const messages = await db
      .select()
      .from(ticketMessages)
      .where(eq47(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);
    return { ticket, messages };
  }
  static async addMessage(data) {
    await db.insert(ticketMessages).values({
      ticketId: data.ticketId,
      senderId: data.senderId,
      senderType: data.senderType,
      message: data.message,
    });
    await db
      .update(supportTickets)
      .set({ updatedAt: /* @__PURE__ */ new Date() })
      .where(eq47(supportTickets.id, data.ticketId));
    if (data.senderType === "admin") {
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq47(supportTickets.id, data.ticketId))
        .limit(1);
      if (ticket) {
        await sendPushToUser(ticket.userId, {
          title: "Respuesta de Soporte",
          body: data.message.substring(0, 100),
          data: { ticketId: data.ticketId, screen: "SupportChat" },
        });
      }
    }
    return { success: true };
  }
  static async updateTicketStatus(ticketId, status, adminId) {
    const updateData = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (status === "resolved" || status === "closed")
      updateData.resolvedAt = /* @__PURE__ */ new Date();
    if (adminId) updateData.assignedTo = adminId;
    await db
      .update(supportTickets)
      .set(updateData)
      .where(eq47(supportTickets.id, ticketId));
    return { success: true };
  }
  static async getPendingTickets() {
    return db
      .select()
      .from(supportTickets)
      .where(eq47(supportTickets.status, "open"))
      .orderBy(desc7(supportTickets.createdAt));
  }
  static async assignTicket(ticketId, adminId) {
    await db
      .update(supportTickets)
      .set({
        assignedTo: adminId,
        status: "in_progress",
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq47(supportTickets.id, ticketId));
    return { success: true };
  }
};

// server/routes/support.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
var router33 = express23.Router();
var SYSTEM_PROMPT = `Eres el asistente virtual de ComeYa, una plataforma de delivery en Soria, Espa\xF1a.
Respondes en espa\xF1ol, de forma amable, concisa y \xFAtil.
Solo respondes preguntas relacionadas con ComeYa: pedidos, pagos, entregas, negocios, repartidores, cuenta, etc.
Si la pregunta no tiene relaci\xF3n con ComeYa, redirige amablemente al tema.
M\xE9todos de pago aceptados: Bizum, transferencia IBAN, tarjeta, efectivo.
Pol\xEDtica de cancelaci\xF3n: gratis en los primeros 60 segundos, luego pueden aplicar cargos.
Tiempos de entrega estimados: 30-45 minutos seg\xFAn distancia y disponibilidad.
Si el usuario tiene un problema urgente con un pedido activo, sug\xEDere crear un ticket de soporte.`;
router33.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Mensaje requerido" });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "IA no configurada" });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chatHistory = (history || []).slice(-8).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        {
          role: "model",
          parts: [
            {
              text: "Entendido. Soy el asistente de ComeYa, listo para ayudar.",
            },
          ],
        },
        ...chatHistory,
      ],
    });
    const result = await chat.sendMessage(message);
    const response = result.response.text();
    res.json({ success: true, response });
  } catch (error) {
    console.error("Support chat error:", error);
    res.json({
      success: true,
      response:
        "Lo siento, el asistente no est\xE1 disponible en este momento. Por favor crea un ticket de soporte y te responderemos pronto.",
    });
  }
});
router33.post("/tickets", authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.createTicket({
      userId: req.user.id,
      ...req.body,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router33.get("/tickets", authenticateToken, async (req, res) => {
  try {
    const tickets = await SupportService.getUserTickets(req.user.id);
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router33.get("/tickets/:id", authenticateToken, async (req, res) => {
  try {
    const data = await SupportService.getTicket(req.params.id, req.user.id);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
router33.post("/tickets/:id/messages", authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.addMessage({
      ticketId: req.params.id,
      senderId: req.user.id,
      senderType:
        req.user.role === "admin" || req.user.role === "super_admin"
          ? "admin"
          : "user",
      ...req.body,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router33.patch(
  "/tickets/:id/status",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await SupportService.updateTicketStatus(
        req.params.id,
        req.body.status,
        req.user.id,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router33.get(
  "/admin/pending",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const tickets = await SupportService.getPendingTickets();
      res.json({ success: true, tickets });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router33.post(
  "/tickets/:id/assign",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await SupportService.assignTicket(
        req.params.id,
        req.user.id,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var support_default = router33;

// server/routes/enhancedTracking.ts
import express24 from "express";

// server/enhancedTrackingService.ts
init_db();
init_schema_mysql();
init_enhancedPushService();
import { eq as eq48, and as and25 } from "drizzle-orm";
var EnhancedTrackingService = class {
  // Calcular distancia entre dos puntos (Haversine)
  static calculateDistance(loc1, loc2) {
    const R = 6371;
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const lat1 = this.toRad(loc1.latitude);
    const lat2 = this.toRad(loc2.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  static toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
  // Actualizar ubicación del repartidor y verificar proximidad
  static async updateDriverLocation(
    driverId,
    latitude,
    longitude,
    heading,
    speed,
  ) {
    await db
      .update(deliveryDrivers)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        lastLocationUpdate: /* @__PURE__ */ new Date(),
      })
      .where(eq48(deliveryDrivers.userId, driverId));
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and25(
          eq48(orders.deliveryPersonId, driverId),
          eq48(orders.status, "on_the_way"),
        ),
      );
    for (const order of activeOrders) {
      if (!order.deliveryLatitude || !order.deliveryLongitude) continue;
      const customerLocation = {
        latitude: parseFloat(order.deliveryLatitude),
        longitude: parseFloat(order.deliveryLongitude),
      };
      const driverLocation = { latitude, longitude };
      const distance = this.calculateDistance(driverLocation, customerLocation);
      const distanceMeters = distance * 1e3;
      await this.checkProximityAlerts(
        order.id,
        order.userId,
        driverId,
        distanceMeters,
      );
    }
    return {
      success: true,
      location: { latitude, longitude, heading, speed },
    };
  }
  // Verificar y enviar alertas de proximidad
  static async checkProximityAlerts(
    orderId,
    customerId,
    driverId,
    distanceMeters,
  ) {
    const alerts = [
      {
        type: "nearby",
        distance: 500,
        message: "Tu repartidor est\xE1 a 500m",
      },
      {
        type: "approaching",
        distance: 200,
        message: "Tu repartidor est\xE1 llegando (200m)",
      },
      {
        type: "arrived",
        distance: 50,
        message: "\xA1Tu repartidor ha llegado!",
      },
    ];
    for (const alert of alerts) {
      if (distanceMeters <= alert.distance) {
        const [existing] = await db
          .select()
          .from(proximityAlerts)
          .where(
            and25(
              eq48(proximityAlerts.orderId, orderId),
              eq48(proximityAlerts.alertType, alert.type),
            ),
          )
          .limit(1);
        if (!existing) {
          await db.insert(proximityAlerts).values({
            orderId,
            driverId,
            alertType: alert.type,
            distance: Math.round(distanceMeters),
            destinationType: "customer",
            notificationSent: true,
          });
          await sendPushToUser(customerId, {
            title: alert.message,
            body: `Pedido #${orderId.slice(-6)}`,
            data: { orderId, screen: "OrderTracking", type: alert.type },
          });
        }
      }
    }
  }
  // Verificar y enviar alertas de tiempo (5 min, 2 min)
  static async checkTimeAlerts(orderId, etaMinutes) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq48(orders.id, orderId))
      .limit(1);
    if (!order || !order.deliveryPersonId) return;
    const timeAlerts = [
      {
        type: "eta_5min",
        threshold: 5,
        message: "\xA1Tu pedido llega en 5 minutos!",
      },
      {
        type: "eta_2min",
        threshold: 2,
        message: "\xA1Tu pedido llega en 2 minutos!",
      },
    ];
    for (const alert of timeAlerts) {
      if (etaMinutes <= alert.threshold) {
        const [existing] = await db
          .select()
          .from(proximityAlerts)
          .where(
            and25(
              eq48(proximityAlerts.orderId, orderId),
              eq48(proximityAlerts.alertType, alert.type),
            ),
          )
          .limit(1);
        if (!existing) {
          await db.insert(proximityAlerts).values({
            orderId,
            driverId: order.deliveryPersonId,
            alertType: alert.type,
            distance: 0,
            destinationType: "customer",
            notificationSent: true,
          });
          await sendPushToUser(order.userId, {
            title: alert.message,
            body: `Pedido #${orderId.slice(-6)}`,
            data: { orderId, screen: "OrderTracking", type: alert.type },
          });
        }
      }
    }
  }
  // Obtener ubicación actual del repartidor
  static async getDriverLocation(orderId) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq48(orders.id, orderId))
      .limit(1);
    if (!order || !order.deliveryPersonId) {
      return { success: false, error: "Pedido sin repartidor asignado" };
    }
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq48(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);
    if (!driver || !driver.currentLatitude || !driver.currentLongitude) {
      return {
        success: false,
        error: "Ubicaci\xF3n del repartidor no disponible",
      };
    }
    return {
      success: true,
      location: {
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        lastUpdate: driver.lastLocationUpdate,
      },
    };
  }
  // Calcular ETA dinámico
  static async calculateDynamicETA(orderId) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq48(orders.id, orderId))
      .limit(1);
    if (!order || !order.deliveryPersonId) {
      return { success: false, eta: null };
    }
    const [driver] = await db
      .select()
      .from(deliveryDrivers)
      .where(eq48(deliveryDrivers.userId, order.deliveryPersonId))
      .limit(1);
    if (
      !driver ||
      !driver.currentLatitude ||
      !driver.currentLongitude ||
      !order.deliveryLatitude ||
      !order.deliveryLongitude
    ) {
      return { success: false, eta: null };
    }
    const driverLocation = {
      latitude: parseFloat(driver.currentLatitude),
      longitude: parseFloat(driver.currentLongitude),
    };
    const customerLocation = {
      latitude: parseFloat(order.deliveryLatitude),
      longitude: parseFloat(order.deliveryLongitude),
    };
    const distance = this.calculateDistance(driverLocation, customerLocation);
    const avgSpeed = 30;
    const etaMinutes = Math.ceil((distance / avgSpeed) * 60);
    let totalETA = etaMinutes;
    if (order.status === "preparing") {
      totalETA += 15;
    } else if (order.status === "accepted") {
      totalETA += 20;
    }
    const etaDate = new Date(Date.now() + totalETA * 60 * 1e3);
    await this.checkTimeAlerts(orderId, totalETA);
    return {
      success: true,
      eta: {
        minutes: totalETA,
        timestamp: etaDate,
        distance: Math.round(distance * 1e3),
        // en metros
        confidence: distance < 5 ? 95 : distance < 10 ? 85 : 75,
      },
    };
  }
  // Obtener hitos del pedido
  static async getOrderMilestones(orderId) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq48(orders.id, orderId))
      .limit(1);
    if (!order) {
      return { success: false, milestones: null };
    }
    return {
      success: true,
      milestones: {
        orderPlaced: order.createdAt,
        restaurantConfirmed: order.businessResponseAt,
        preparationStarted: order.businessResponseAt,
        driverAssigned: order.assignedAt,
        pickedUp: order.driverPickedUpAt,
        onTheWay: order.driverPickedUpAt,
        delivered: order.deliveredAt,
      },
    };
  }
};

// server/routes/enhancedTracking.ts
var router34 = express24.Router();
router34.post(
  "/location/update",
  authenticateToken,
  requireRole("delivery_driver"),
  async (req, res) => {
    try {
      const { latitude, longitude, heading, speed } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitud y longitud requeridas" });
      }
      const result = await EnhancedTrackingService.updateDriverLocation(
        req.user.id,
        latitude,
        longitude,
        heading,
        speed,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router34.get("/location/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.getDriverLocation(
      req.params.orderId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router34.get("/eta/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.calculateDynamicETA(
      req.params.orderId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router34.get("/milestones/:orderId", authenticateToken, async (req, res) => {
  try {
    const result = await EnhancedTrackingService.getOrderMilestones(
      req.params.orderId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var enhancedTracking_default = router34;

// server/routes/subscriptions.ts
import express25 from "express";
init_subscriptionService();
import { eq as eq49 } from "drizzle-orm";
var router35 = express25.Router();
router35.get("/my-subscription", authenticateToken, async (req, res) => {
  try {
    const subscription = await SubscriptionService.getUserSubscription(
      req.user.id,
    );
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.get("/plans", async (req, res) => {
  try {
    const plans = await SubscriptionService.getPlansFromDB();
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.get("/benefits-preview", authenticateToken, async (req, res) => {
  try {
    const { subtotal = 0, deliveryFee = 0 } = req.query;
    const benefits = await SubscriptionService.applySubscriptionBenefits(
      req.user.id,
      parseInt(subtotal),
      parseInt(deliveryFee),
    );
    const sub = await SubscriptionService.getUserSubscription(req.user.id);
    res.json({
      success: true,
      plan: sub.plan,
      isActive: sub.status === "active" && sub.plan !== "free",
      discount: benefits.discount,
      deliveryFee: benefits.deliveryFee,
      appliedBenefits: benefits.appliedBenefits,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.post("/subscribe", authenticateToken, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    if (!["premium", "business"].includes(plan)) {
      return res.status(400).json({ error: "Plan inv\xE1lido" });
    }
    const result = await SubscriptionService.initSubscription(
      req.user.id,
      plan,
      billingCycle || "monthly",
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.post("/submit-proof", authenticateToken, async (req, res) => {
  try {
    const {
      subscriptionId,
      imageUrl,
      referenceNumber,
      senderName,
      amount,
      paymentMethod,
    } = req.body;
    const userId = req.user.id;
    if (!subscriptionId || !imageUrl || !referenceNumber) {
      return res
        .status(400)
        .json({
          error: "subscriptionId, imageUrl y referenceNumber son requeridos",
        });
    }
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { subscriptions: subscriptions2, paymentProofs: paymentProofs2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { sql: drizzleSql } = await import("drizzle-orm");
    const { v4: uuidv4 } = await import("uuid");
    const [sub] = await db2
      .select()
      .from(subscriptions2)
      .where(eq49(subscriptions2.id, subscriptionId))
      .limit(1);
    if (!sub || sub.userId !== userId) {
      return res.status(404).json({ error: "Suscripci\xF3n no encontrada" });
    }
    const [existing] = await db2
      .select()
      .from(paymentProofs2)
      .where(drizzleSql`reference_number = ${referenceNumber.trim()}`)
      .limit(1);
    if (existing) {
      return res
        .status(409)
        .json({ error: "Este comprobante ya fue enviado anteriormente" });
    }
    const proofId = uuidv4();
    await db2.insert(paymentProofs2).values({
      id: proofId,
      orderId: `sub_${subscriptionId}`,
      userId,
      paymentProvider: paymentMethod || "bizum",
      proofImageUrl: imageUrl,
      referenceNumber: referenceNumber.trim(),
      amount: amount || sub.price,
      status: "pending",
      submittedAt: /* @__PURE__ */ new Date(),
    });
    if (senderName) {
      await db2.execute(
        drizzleSql`UPDATE payment_proofs SET verification_notes = ${`Remitente: ${senderName} | Suscripci\xF3n: ${sub.plan}`} WHERE id = ${proofId}`,
      );
    }
    try {
      const { notifyAdminNewProof: notifyAdminNewProof2 } =
        await Promise.resolve().then(
          () => (init_websocket(), websocket_exports),
        );
      const { users: users7 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [u] = await db2
        .select({ name: users7.name })
        .from(users7)
        .where(eq49(users7.id, userId))
        .limit(1);
      notifyAdminNewProof2({
        proofId,
        orderId: `sub_${subscriptionId}`,
        userName: u?.name ?? "Cliente",
        amount: amount || sub.price,
        method: paymentMethod || "bizum",
      });
    } catch {}
    res.json({
      success: true,
      proofId,
      message:
        "Comprobante recibido. Tu suscripci\xF3n se activar\xE1 tras la verificaci\xF3n.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.post(
  "/proofs/:proofId/approve",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { proofId } = req.params;
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { paymentProofs: paymentProofs2, subscriptions: subscriptions2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { sql: drizzleSql } = await import("drizzle-orm");
      const [proof] = await db2
        .select()
        .from(paymentProofs2)
        .where(drizzleSql`id = ${proofId}`)
        .limit(1);
      if (!proof)
        return res.status(404).json({ error: "Comprobante no encontrado" });
      const subscriptionId = proof.orderId?.replace("sub_", "");
      if (!subscriptionId)
        return res
          .status(400)
          .json({ error: "No es un comprobante de suscripci\xF3n" });
      await db2.execute(
        drizzleSql`UPDATE payment_proofs SET status = 'approved', verified_by = ${req.user.id}, verified_at = NOW() WHERE id = ${proofId}`,
      );
      const now = /* @__PURE__ */ new Date();
      const [sub] = await db2
        .select()
        .from(subscriptions2)
        .where(eq49(subscriptions2.id, subscriptionId))
        .limit(1);
      if (sub) {
        const periodEnd = new Date(now);
        sub.billingCycle === "yearly"
          ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
          : periodEnd.setMonth(periodEnd.getMonth() + 1);
        await db2
          .update(subscriptions2)
          .set({
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          })
          .where(eq49(subscriptions2.id, subscriptionId));
      }
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        await sendPushToUser2(proof.userId, {
          title: "\u2705 Suscripci\xF3n activada",
          body: `Tu plan ${sub?.plan || "Premium"} ya est\xE1 activo. \xA1Disfruta los beneficios!`,
          data: { screen: "Subscriptions" },
        });
      } catch {}
      res.json({ success: true, message: "Suscripci\xF3n activada" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router35.post(
  "/proofs/:proofId/reject",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { proofId } = req.params;
      const { reason } = req.body;
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { paymentProofs: paymentProofs2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { sql: drizzleSql } = await import("drizzle-orm");
      const [proof] = await db2
        .select()
        .from(paymentProofs2)
        .where(drizzleSql`id = ${proofId}`)
        .limit(1);
      if (!proof)
        return res.status(404).json({ error: "Comprobante no encontrado" });
      await db2.execute(
        drizzleSql`UPDATE payment_proofs SET status = 'rejected', verified_by = ${req.user.id}, verified_at = NOW(), verification_notes = ${reason || "Rechazado por admin"} WHERE id = ${proofId}`,
      );
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        await sendPushToUser2(proof.userId, {
          title: "\u274C Comprobante rechazado",
          body:
            reason ||
            "Tu comprobante de suscripci\xF3n no pudo ser verificado. Contacta soporte.",
          data: { screen: "Subscriptions" },
        });
      } catch {}
      res.json({ success: true, message: "Comprobante rechazado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router35.post("/cancel-pending", authenticateToken, async (req, res) => {
  try {
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { subscriptions: subscriptions2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { eq: eq64, and: and33 } = await import("drizzle-orm");
    const { sql: drizzleSql } = await import("drizzle-orm");
    await db2
      .update(subscriptions2)
      .set({ status: "cancelled", cancelledAt: /* @__PURE__ */ new Date() })
      .where(
        drizzleSql`user_id = ${req.user.id} AND status = 'pending_payment'`,
      );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router35.post("/cancel", authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.cancelSubscription(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var subscriptions_default = router35;

// server/routes/smartNotifications.ts
import express26 from "express";

// server/smartNotificationService.ts
init_db();
init_schema_mysql();
init_enhancedPushService();
import {
  eq as eq50,
  and as and26,
  gte as gte6,
  desc as desc8,
  sql as sql11,
} from "drizzle-orm";
var SmartNotificationService = class {
  // Segmentar usuarios
  static async segmentUsers(target) {
    const now = /* @__PURE__ */ new Date();
    const userIds = [];
    if (target.userSegment === "new") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      const newUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and26(
            gte6(users.createdAt, sevenDaysAgo),
            eq50(users.role, "customer"),
          ),
        );
      for (const user of newUsers) {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq50(orders.userId, user.id))
          .limit(1);
        if (!order) {
          userIds.push(user.id);
        }
      }
    } else if (target.userSegment === "inactive") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq50(users.role, "customer"));
      for (const user of allUsers) {
        const [lastOrder] = await db
          .select()
          .from(orders)
          .where(eq50(orders.userId, user.id))
          .orderBy(desc8(orders.createdAt))
          .limit(1);
        if (lastOrder && lastOrder.createdAt < thirtyDaysAgo) {
          userIds.push(user.id);
        }
      }
    } else if (target.userSegment === "active") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      const recentOrders = await db
        .select({ userId: orders.userId })
        .from(orders)
        .where(gte6(orders.createdAt, sevenDaysAgo))
        .groupBy(orders.userId);
      userIds.push(...recentOrders.map((o) => o.userId));
    } else if (target.userSegment === "vip") {
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq50(users.role, "customer"));
      for (const user of allUsers) {
        const orderCount = await db
          .select({ count: sql11`COUNT(*)` })
          .from(orders)
          .where(eq50(orders.userId, user.id));
        if (orderCount[0].count >= 10) {
          userIds.push(user.id);
        }
      }
    }
    return [...new Set(userIds)];
  }
  // Enviar notificación de reactivación
  static async sendReactivationNotification() {
    const inactiveUsers = await this.segmentUsers({ userSegment: "inactive" });
    let sent = 0;
    for (const userId of inactiveUsers) {
      try {
        await sendPushToUser(userId, {
          title: "\xA1Te extra\xF1amos! \u{1F60A}",
          body: "Vuelve y disfruta de un 15% de descuento en tu pr\xF3ximo pedido",
          data: { screen: "Home", coupon: "COMEBACK15" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }
    return { success: true, sent, total: inactiveUsers.length };
  }
  // Enviar notificación de promoción
  static async sendPromotionNotification(title, body, target, deepLink) {
    const targetUsers = await this.segmentUsers(target);
    let sent = 0;
    for (const userId of targetUsers) {
      try {
        await sendPushToUser(userId, {
          title,
          body,
          data: { screen: deepLink || "Home", type: "promotion" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }
    return { success: true, sent, total: targetUsers.length };
  }
  // Enviar recordatorio inteligente (hora del almuerzo/cena)
  static async sendMealTimeReminder() {
    const hour = /* @__PURE__ */ new Date().getHours();
    let message = "";
    let targetSegment = "active";
    if (hour >= 12 && hour <= 14) {
      message =
        "\xBFHambre? \u{1F37D}\uFE0F Es hora del almuerzo. Pide ahora y recibe en 30 min";
    } else if (hour >= 19 && hour <= 21) {
      message =
        "\u{1F319} Hora de la cena. Tu restaurante favorito est\xE1 abierto";
      targetSegment = "vip";
    } else {
      return { success: false, message: "No es hora de comida" };
    }
    const targetUsers = await this.segmentUsers({ userSegment: targetSegment });
    let sent = 0;
    for (const userId of targetUsers) {
      try {
        await sendPushToUser(userId, {
          title: message,
          body: "Explora negocios cerca de ti",
          data: { screen: "Home", type: "reminder" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }
    return { success: true, sent, total: targetUsers.length };
  }
  // Enviar notificación de nuevo negocio
  static async sendNewBusinessNotification(businessId, businessName) {
    const activeUsers = await this.segmentUsers({ userSegment: "active" });
    let sent = 0;
    for (const userId of activeUsers) {
      try {
        await sendPushToUser(userId, {
          title: `\u{1F389} Nuevo: ${businessName}`,
          body: "Descubre el nuevo restaurante en tu zona",
          data: { screen: "BusinessDetail", businessId, type: "new_business" },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${userId}:`, error);
      }
    }
    return { success: true, sent, total: activeUsers.length };
  }
  // Enviar notificación personalizada basada en favoritos
  static async sendFavoriteBusinessPromotion(businessId, promotion) {
    const { userFavorites: userFavorites2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const favorites2 = await db
      .select()
      .from(userFavorites2)
      .where(
        and26(
          eq50(userFavorites2.itemType, "business"),
          eq50(userFavorites2.itemId, businessId),
        ),
      );
    let sent = 0;
    for (const fav of favorites2) {
      try {
        await sendPushToUser(fav.userId, {
          title: "\u{1F49D} Oferta en tu favorito",
          body: promotion,
          data: {
            screen: "BusinessDetail",
            businessId,
            type: "favorite_promo",
          },
        });
        sent++;
      } catch (error) {
        console.error(`Error sending to ${fav.userId}:`, error);
      }
    }
    return { success: true, sent, total: favorites2.length };
  }
};

// server/routes/smartNotifications.ts
var router36 = express26.Router();
router36.post(
  "/reactivation",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result =
        await SmartNotificationService.sendReactivationNotification();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router36.post(
  "/promotion",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { title, body, target, deepLink } = req.body;
      if (!title || !body || !target) {
        return res
          .status(400)
          .json({ error: "Faltan par\xE1metros requeridos" });
      }
      const result = await SmartNotificationService.sendPromotionNotification(
        title,
        body,
        target,
        deepLink,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router36.post(
  "/meal-reminder",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const result = await SmartNotificationService.sendMealTimeReminder();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router36.post(
  "/new-business",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId, businessName } = req.body;
      if (!businessId || !businessName) {
        return res
          .status(400)
          .json({ error: "businessId y businessName requeridos" });
      }
      const result = await SmartNotificationService.sendNewBusinessNotification(
        businessId,
        businessName,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router36.post(
  "/favorite-promo",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessId, promotion } = req.body;
      if (!businessId || !promotion) {
        return res
          .status(400)
          .json({ error: "businessId y promotion requeridos" });
      }
      const result =
        await SmartNotificationService.sendFavoriteBusinessPromotion(
          businessId,
          promotion,
        );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var smartNotifications_default = router36;

// server/routes/enhancedReviews.ts
import express27 from "express";

// server/enhancedReviewService.ts
init_db();
init_schema_mysql();
init_cloudinaryService();
import { eq as eq52, and as and28, desc as desc10 } from "drizzle-orm";
var EnhancedReviewService = class {
  // Crear review mejorada
  static async createReview(data) {
    const {
      userId,
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
    } = data;
    let photoUrls = [];
    if (photos && photos.length > 0) {
      photoUrls = await Promise.all(
        photos.map(async (photo, index) => {
          if (photo.startsWith("data:image/")) {
            return await CloudinaryService.uploadImage(
              photo,
              "reviews",
              `review-${orderId}-${index}`,
            );
          }
          return photo;
        }),
      );
    }
    const ratings = [foodRating, deliveryRating, packagingRating].filter(
      (r) => r && r > 0,
    );
    const averageRating =
      ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
        : 5;
    const reviewId = crypto.randomUUID();
    await db.insert(reviews).values({
      id: reviewId,
      userId,
      orderId,
      businessId,
      deliveryPersonId: deliveryPersonId || null,
      rating: averageRating,
      foodRating: foodRating || null,
      deliveryRating: deliveryRating || null,
      packagingRating: packagingRating || null,
      deliveryPersonRating: driverRating || null,
      comment: comment || null,
      photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
      approved: true,
      flagged: false,
    });
    await this.updateBusinessRating(businessId);
    if (deliveryPersonId && driverRating) {
      await this.updateDriverRating(deliveryPersonId);
    }
    try {
      const { GamificationService: GamificationService2 } =
        await Promise.resolve().then(
          () => (init_gamificationService(), gamificationService_exports),
        );
      const { count: countFn } = await import("drizzle-orm");
      const { achievements: achTable } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [{ value: reviewCount }] = await db
        .select({ value: countFn() })
        .from(reviews)
        .where(eq52(reviews.userId, userId));
      const reviewAchievements = await db
        .select()
        .from(achTable)
        .where(eq52(achTable.requirementType, "review_count"));
      for (const ach of reviewAchievements) {
        if (Number(reviewCount) >= ach.requirementValue) {
          await GamificationService2.unlockAchievement(userId, ach.id);
        }
      }
    } catch {}
    return { success: true, reviewId };
  }
  // Actualizar rating promedio del negocio
  static async updateBusinessRating(businessId) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and28(
          eq52(reviews.businessId, businessId),
          eq52(reviews.approved, true),
        ),
      );
    if (businessReviews.length === 0) return;
    const totalRating = businessReviews.reduce((sum3, r) => sum3 + r.rating, 0);
    const avgRating = Math.round((totalRating / businessReviews.length) * 10);
    await db
      .update(businesses)
      .set({
        rating: avgRating,
        totalRatings: businessReviews.length,
      })
      .where(eq52(businesses.id, businessId));
  }
  // Actualizar rating promedio del repartidor
  static async updateDriverRating(driverId) {
    const driverReviews = await db
      .select()
      .from(reviews)
      .where(
        and28(
          eq52(reviews.deliveryPersonId, driverId),
          eq52(reviews.approved, true),
        ),
      );
    if (driverReviews.length === 0) return;
    const ratingsWithDriver = driverReviews.filter(
      (r) => r.deliveryPersonRating,
    );
    if (ratingsWithDriver.length === 0) return;
    const totalRating = ratingsWithDriver.reduce(
      (sum3, r) => sum3 + (r.deliveryPersonRating || 0),
      0,
    );
    const avgRating = Math.round((totalRating / ratingsWithDriver.length) * 10);
    await db
      .update(deliveryDrivers)
      .set({
        rating: avgRating,
        totalRatings: ratingsWithDriver.length,
      })
      .where(eq52(deliveryDrivers.userId, driverId));
  }
  // Obtener tags disponibles
  static async getTags() {
    const tags = await db
      .select()
      .from(reviewTags)
      .where(eq52(reviewTags.isActive, true))
      .orderBy(reviewTags.displayOrder);
    return { success: true, tags };
  }
  // Obtener reviews de un negocio
  static async getBusinessReviews(businessId, limit = 20) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and28(
          eq52(reviews.businessId, businessId),
          eq52(reviews.approved, true),
        ),
      )
      .orderBy(desc10(reviews.createdAt))
      .limit(limit);
    const reviewsWithResponses = await Promise.all(
      businessReviews.map(async (review) => {
        const [response] = await db
          .select()
          .from(reviewResponses)
          .where(eq52(reviewResponses.reviewId, review.id))
          .limit(1);
        return {
          ...review,
          photos: review.photos ? JSON.parse(review.photos) : [],
          tags: review.tags ? JSON.parse(review.tags) : [],
          response: response || null,
        };
      }),
    );
    return { success: true, reviews: reviewsWithResponses };
  }
  // Responder a una review (solo dueño del negocio)
  static async respondToReview(
    reviewId,
    businessId,
    respondedBy,
    responseText,
  ) {
    const [review] = await db
      .select()
      .from(reviews)
      .where(
        and28(eq52(reviews.id, reviewId), eq52(reviews.businessId, businessId)),
      )
      .limit(1);
    if (!review) {
      return { success: false, error: "Review no encontrada" };
    }
    const [existing] = await db
      .select()
      .from(reviewResponses)
      .where(eq52(reviewResponses.reviewId, reviewId))
      .limit(1);
    if (existing) {
      await db
        .update(reviewResponses)
        .set({ responseText, updatedAt: /* @__PURE__ */ new Date() })
        .where(eq52(reviewResponses.id, existing.id));
    } else {
      await db.insert(reviewResponses).values({
        id: crypto.randomUUID(),
        reviewId,
        businessId,
        responseText,
        respondedBy,
      });
    }
    return { success: true };
  }
};

// server/routes/enhancedReviews.ts
var router37 = express27.Router();
router37.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
    } = req.body;
    const result = await EnhancedReviewService.createReview({
      userId: req.user.id,
      orderId,
      businessId,
      deliveryPersonId,
      foodRating,
      deliveryRating,
      packagingRating,
      driverRating,
      comment,
      tags,
      photos,
    });
    res.json(result);
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router37.get("/tags", async (req, res) => {
  try {
    const result = await EnhancedReviewService.getTags();
    res.json(result);
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router37.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const result = await EnhancedReviewService.getBusinessReviews(
      businessId,
      limit,
    );
    res.json(result);
  } catch (error) {
    console.error("Get business reviews error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router37.post(
  "/:reviewId/respond",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { businessId, responseText } = req.body;
      if (!responseText || responseText.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Respuesta requerida" });
      }
      const result = await EnhancedReviewService.respondToReview(
        reviewId,
        businessId,
        req.user.id,
        responseText,
      );
      res.json(result);
    } catch (error) {
      console.error("Respond to review error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var enhancedReviews_default = router37;

// server/routes/businessAnalytics.ts
import express28 from "express";

// server/businessAnalyticsService.ts
init_db();
init_schema_mysql();
import {
  eq as eq53,
  and as and29,
  gte as gte8,
  lte as lte4,
} from "drizzle-orm";
var BusinessAnalyticsService = class {
  // Dashboard principal con métricas en tiempo real
  static async getDashboard(businessId, period = "week") {
    const now = /* @__PURE__ */ new Date();
    let startDate;
    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    const periodOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          gte8(orders.createdAt, startDate),
        ),
      );
    const periodLength = now.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          gte8(orders.createdAt, previousStartDate),
          lte4(orders.createdAt, startDate),
        ),
      );
    const totalOrders = periodOrders.length;
    const previousTotalOrders = previousOrders.length;
    const ordersChange =
      previousTotalOrders > 0
        ? ((totalOrders - previousTotalOrders) / previousTotalOrders) * 100
        : 0;
    const completedOrders = periodOrders.filter(
      (o) => o.status === "delivered",
    );
    const totalRevenue = completedOrders.reduce(
      (sum3, o) => sum3 + (o.businessEarnings || 0),
      0,
    );
    const previousRevenue = previousOrders
      .filter((o) => o.status === "delivered")
      .reduce((sum3, o) => sum3 + (o.businessEarnings || 0), 0);
    const revenueChange =
      previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;
    const avgOrderValue =
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq53(businesses.id, businessId))
      .limit(1);
    const rating = business?.rating ? business.rating / 10 : 0;
    return {
      success: true,
      dashboard: {
        period,
        totalOrders,
        ordersChange: Math.round(ordersChange * 10) / 10,
        totalRevenue: totalRevenue / 100,
        // convertir a bolívares
        revenueChange: Math.round(revenueChange * 10) / 10,
        avgOrderValue: avgOrderValue / 100,
        rating,
        totalReviews: business?.totalRatings || 0,
      },
    };
  }
  // Productos más vendidos
  static async getTopProducts(businessId, limit = 10) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          eq53(orders.status, "delivered"),
          gte8(orders.createdAt, thirtyDaysAgo),
        ),
      );
    const productCounts = {};
    for (const order of recentOrders) {
      const items =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;
      for (const item of items) {
        const productId = item.product?.id || item.id;
        const productName = item.product?.name || item.name || "Producto";
        const quantity = item.quantity || 1;
        const price = item.product?.price || item.price || 0;
        if (!productCounts[productId]) {
          productCounts[productId] = {
            name: productName,
            count: 0,
            revenue: 0,
          };
        }
        productCounts[productId].count += quantity;
        productCounts[productId].revenue += price * quantity;
      }
    }
    const topProducts = Object.entries(productCounts)
      .map(([id, data]) => ({
        productId: id,
        name: data.name,
        unitsSold: data.count,
        revenue: data.revenue / 100,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, limit);
    return { success: true, topProducts };
  }
  // Horas pico
  static async getPeakHours(businessId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          gte8(orders.createdAt, thirtyDaysAgo),
        ),
      );
    const hourCounts = {};
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }
    for (const order of recentOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourCounts[hour]++;
    }
    const peakHours = Object.entries(hourCounts)
      .map(([hour, count3]) => ({
        hour: parseInt(hour),
        orderCount: count3,
        label: `${hour}:00 - ${parseInt(hour) + 1}:00`,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
    return { success: true, peakHours };
  }
  // Ventas por día (últimos 30 días)
  static async getSalesChart(businessId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          eq53(orders.status, "delivered"),
          gte8(orders.createdAt, startDate),
        ),
      );
    const dailySales = {};
    for (const order of recentOrders) {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      if (!dailySales[date]) {
        dailySales[date] = { orders: 0, revenue: 0 };
      }
      dailySales[date].orders++;
      dailySales[date].revenue += order.businessEarnings || 0;
    }
    const chartData = Object.entries(dailySales)
      .map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, chartData };
  }
  // Estadísticas de reviews
  static async getReviewStats(businessId) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and29(
          eq53(reviews.businessId, businessId),
          eq53(reviews.approved, true),
        ),
      );
    const totalReviews = businessReviews.length;
    if (totalReviews === 0) {
      return {
        success: true,
        reviewStats: {
          totalReviews: 0,
          avgRating: 0,
          avgFoodRating: 0,
          avgPackagingRating: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
      };
    }
    const avgRating =
      businessReviews.reduce((sum3, r) => sum3 + r.rating, 0) / totalReviews;
    const foodRatings = businessReviews.filter((r) => r.foodRating);
    const avgFoodRating =
      foodRatings.length > 0
        ? foodRatings.reduce((sum3, r) => sum3 + (r.foodRating || 0), 0) /
          foodRatings.length
        : 0;
    const packagingRatings = businessReviews.filter((r) => r.packagingRating);
    const avgPackagingRating =
      packagingRatings.length > 0
        ? packagingRatings.reduce(
            (sum3, r) => sum3 + (r.packagingRating || 0),
            0,
          ) / packagingRatings.length
        : 0;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of businessReviews) {
      ratingDistribution[review.rating]++;
    }
    return {
      success: true,
      reviewStats: {
        totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
        avgFoodRating: Math.round(avgFoodRating * 10) / 10,
        avgPackagingRating: Math.round(avgPackagingRating * 10) / 10,
        ratingDistribution,
      },
    };
  }
  // Comparativa semanal
  static async getWeeklyComparison(businessId) {
    const now = /* @__PURE__ */ new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1e3);
    const thisWeekOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          eq53(orders.status, "delivered"),
          gte8(orders.createdAt, thisWeekStart),
        ),
      );
    const lastWeekOrders = await db
      .select()
      .from(orders)
      .where(
        and29(
          eq53(orders.businessId, businessId),
          eq53(orders.status, "delivered"),
          gte8(orders.createdAt, lastWeekStart),
          lte4(orders.createdAt, thisWeekStart),
        ),
      );
    const thisWeekRevenue = thisWeekOrders.reduce(
      (sum3, o) => sum3 + (o.businessEarnings || 0),
      0,
    );
    const lastWeekRevenue = lastWeekOrders.reduce(
      (sum3, o) => sum3 + (o.businessEarnings || 0),
      0,
    );
    return {
      success: true,
      comparison: {
        thisWeek: {
          orders: thisWeekOrders.length,
          revenue: thisWeekRevenue / 100,
        },
        lastWeek: {
          orders: lastWeekOrders.length,
          revenue: lastWeekRevenue / 100,
        },
        ordersChange:
          lastWeekOrders.length > 0
            ? ((thisWeekOrders.length - lastWeekOrders.length) /
                lastWeekOrders.length) *
              100
            : 0,
        revenueChange:
          lastWeekRevenue > 0
            ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
            : 0,
      },
    };
  }
};

// server/routes/businessAnalytics.ts
var router38 = express28.Router();
router38.get(
  "/dashboard/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const period = req.query.period || "week";
      const result = await BusinessAnalyticsService.getDashboard(
        businessId,
        period,
      );
      res.json(result);
    } catch (error) {
      console.error("Get dashboard error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router38.get(
  "/top-products/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const result = await BusinessAnalyticsService.getTopProducts(
        businessId,
        limit,
      );
      res.json(result);
    } catch (error) {
      console.error("Get top products error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router38.get(
  "/peak-hours/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const result = await BusinessAnalyticsService.getPeakHours(businessId);
      res.json(result);
    } catch (error) {
      console.error("Get peak hours error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router38.get(
  "/sales-chart/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const days = parseInt(req.query.days) || 30;
      const result = await BusinessAnalyticsService.getSalesChart(
        businessId,
        days,
      );
      res.json(result);
    } catch (error) {
      console.error("Get sales chart error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router38.get(
  "/reviews/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const result = await BusinessAnalyticsService.getReviewStats(businessId);
      res.json(result);
    } catch (error) {
      console.error("Get review stats error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router38.get(
  "/weekly-comparison/:businessId",
  authenticateToken,
  requireRole("business_owner"),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const result =
        await BusinessAnalyticsService.getWeeklyComparison(businessId);
      res.json(result);
    } catch (error) {
      console.error("Get weekly comparison error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var businessAnalytics_default = router38;

// server/routes/groupOrders.ts
import express29 from "express";

// server/groupOrderService.ts
init_db();
init_schema_mysql();
import { eq as eq54, and as and30 } from "drizzle-orm";
var GroupOrderService = class {
  // Crear pedido grupal
  static async createGroupOrder(data) {
    const {
      creatorId,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes = 60,
    } = data;
    const groupOrderId = crypto.randomUUID();
    const shareToken = crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1e3);
    await db.insert(groupOrders).values({
      id: groupOrderId,
      creatorId,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude: deliveryLatitude || null,
      deliveryLongitude: deliveryLongitude || null,
      shareToken,
      expiresAt,
      status: "open",
    });
    return {
      success: true,
      groupOrderId,
      shareToken,
      shareLink: `comeya://group-order/${shareToken}`,
    };
  }
  // Unirse a pedido grupal
  static async joinGroupOrder(data) {
    const { shareToken, userId, userName, items, subtotal } = data;
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq54(groupOrders.shareToken, shareToken))
      .limit(1);
    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }
    if (group.status !== "open") {
      return { success: false, error: "El grupo ya est\xE1 cerrado" };
    }
    if (/* @__PURE__ */ new Date() > new Date(group.expiresAt)) {
      return { success: false, error: "El grupo ha expirado" };
    }
    const [existing] = await db
      .select()
      .from(groupOrderParticipants)
      .where(
        and30(
          eq54(groupOrderParticipants.groupOrderId, group.id),
          eq54(groupOrderParticipants.userId, userId),
        ),
      )
      .limit(1);
    if (existing) {
      return { success: false, error: "Ya est\xE1s en este grupo" };
    }
    await db.insert(groupOrderParticipants).values({
      id: crypto.randomUUID(),
      groupOrderId: group.id,
      userId,
      userName,
      items: JSON.stringify(items),
      subtotal,
      paymentStatus: "pending",
    });
    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq54(groupOrderParticipants.groupOrderId, group.id));
    const totalAmount = participants.reduce((sum3, p) => sum3 + p.subtotal, 0);
    await db
      .update(groupOrders)
      .set({ totalAmount })
      .where(eq54(groupOrders.id, group.id));
    return { success: true, groupOrderId: group.id };
  }
  // Obtener detalles del grupo
  static async getGroupOrder(groupOrderId) {
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq54(groupOrders.id, groupOrderId))
      .limit(1);
    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }
    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq54(groupOrderParticipants.groupOrderId, groupOrderId));
    return {
      success: true,
      groupOrder: {
        ...group,
        participants: participants.map((p) => ({
          ...p,
          items: JSON.parse(p.items),
        })),
      },
    };
  }
  // Cerrar grupo y crear pedido
  static async lockAndOrder(groupOrderId, creatorId) {
    const [group] = await db
      .select()
      .from(groupOrders)
      .where(eq54(groupOrders.id, groupOrderId))
      .limit(1);
    if (!group) {
      return { success: false, error: "Grupo no encontrado" };
    }
    if (group.creatorId !== creatorId) {
      return { success: false, error: "Solo el creador puede cerrar el grupo" };
    }
    if (group.status !== "open") {
      return { success: false, error: "El grupo ya est\xE1 cerrado" };
    }
    const participants = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq54(groupOrderParticipants.groupOrderId, groupOrderId));
    if (participants.length === 0) {
      return { success: false, error: "No hay participantes en el grupo" };
    }
    const allItems = [];
    for (const participant of participants) {
      const items = JSON.parse(participant.items);
      allItems.push(...items);
    }
    const orderId = crypto.randomUUID();
    const totalAmount = participants.reduce((sum3, p) => sum3 + p.subtotal, 0);
    const deliveryFee = 2500;
    await db.insert(orders).values({
      id: orderId,
      userId: group.creatorId,
      businessId: group.businessId,
      businessName: group.businessName,
      items: JSON.stringify(allItems),
      status: "pending",
      subtotal: totalAmount,
      deliveryFee,
      total: totalAmount + deliveryFee,
      paymentMethod: "group_split",
      deliveryAddress: group.deliveryAddress,
      deliveryLatitude: group.deliveryLatitude || null,
      deliveryLongitude: group.deliveryLongitude || null,
    });
    await db
      .update(groupOrders)
      .set({
        status: "locked",
        orderId,
        lockedAt: /* @__PURE__ */ new Date(),
        orderedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq54(groupOrders.id, groupOrderId));
    return { success: true, orderId };
  }
  // Marcar pago de participante
  static async markParticipantPaid(participantId, paymentProofUrl) {
    await db
      .update(groupOrderParticipants)
      .set({
        paymentStatus: "paid",
        paymentProofUrl: paymentProofUrl || null,
        paidAt: /* @__PURE__ */ new Date(),
      })
      .where(eq54(groupOrderParticipants.id, participantId));
    return { success: true };
  }
  // Obtener grupos del usuario
  static async getUserGroupOrders(userId) {
    const createdGroups = await db
      .select()
      .from(groupOrders)
      .where(eq54(groupOrders.creatorId, userId));
    const participations = await db
      .select()
      .from(groupOrderParticipants)
      .where(eq54(groupOrderParticipants.userId, userId));
    const participantGroupIds = participations.map((p) => p.groupOrderId);
    const participantGroups =
      participantGroupIds.length > 0
        ? await db
            .select()
            .from(groupOrders)
            .where(eq54(groupOrders.id, participantGroupIds[0]))
        : [];
    return {
      success: true,
      createdGroups,
      participantGroups,
    };
  }
};

// server/routes/groupOrders.ts
var router39 = express29.Router();
router39.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes,
    } = req.body;
    const result = await GroupOrderService.createGroupOrder({
      creatorId: req.user.id,
      businessId,
      businessName,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      expiresInMinutes,
    });
    res.json(result);
  } catch (error) {
    console.error("Create group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router39.post("/join", authenticateToken, async (req, res) => {
  try {
    const { shareToken, items, subtotal } = req.body;
    const result = await GroupOrderService.joinGroupOrder({
      shareToken,
      userId: req.user.id,
      userName: req.user.name,
      items,
      subtotal,
    });
    res.json(result);
  } catch (error) {
    console.error("Join group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router39.get("/:groupOrderId", authenticateToken, async (req, res) => {
  try {
    const { groupOrderId } = req.params;
    const result = await GroupOrderService.getGroupOrder(groupOrderId);
    res.json(result);
  } catch (error) {
    console.error("Get group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router39.post("/:groupOrderId/lock", authenticateToken, async (req, res) => {
  try {
    const { groupOrderId } = req.params;
    const result = await GroupOrderService.lockAndOrder(
      groupOrderId,
      req.user.id,
    );
    res.json(result);
  } catch (error) {
    console.error("Lock group order error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router39.post(
  "/participants/:participantId/pay",
  authenticateToken,
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const { paymentProofUrl } = req.body;
      const result = await GroupOrderService.markParticipantPaid(
        participantId,
        paymentProofUrl,
      );
      res.json(result);
    } catch (error) {
      console.error("Mark participant paid error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router39.get("/user/my-groups", authenticateToken, async (req, res) => {
  try {
    const result = await GroupOrderService.getUserGroupOrders(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Get user group orders error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
var groupOrders_default = router39;

// server/routes/gamification.ts
import express30 from "express";
init_gamificationService();
var router40 = express30.Router();
router40.get("/points", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getUserPoints(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Get points error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router40.get("/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await GamificationService.getLeaderboard(limit);
    res.json(result);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router40.get("/achievements", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getUserAchievements(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Get achievements error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router40.get("/rewards", authenticateToken, async (req, res) => {
  try {
    const result = await GamificationService.getAvailableRewards(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Get rewards error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router40.post("/redeem/:rewardId", authenticateToken, async (req, res) => {
  try {
    const { rewardId } = req.params;
    const result = await GamificationService.redeemReward(
      req.user.id,
      rewardId,
    );
    res.json(result);
  } catch (error) {
    console.error("Redeem reward error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
var gamification_default = router40;

// server/routes/giftCards.ts
import express31 from "express";
init_giftCardService();
var router41 = express31.Router();
router41.post("/purchase", authenticateToken, async (req, res) => {
  try {
    const {
      amount,
      recipientEmail,
      recipientPhone,
      message,
      design,
      paymentMethod,
    } = req.body;
    const result = await GiftCardService.purchaseGiftCard({
      purchasedBy: req.user.id,
      amount: Math.round(amount * 100),
      recipientEmail,
      recipientPhone,
      message,
      design,
      activateImmediately: false,
      // siempre false aquí; Stripe activa via webhook
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router41.post(
  "/:giftCardId/stripe-success",
  authenticateToken,
  async (req, res) => {
    try {
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { giftCards: giftCards2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { getStripe: getStripe3 } = await Promise.resolve().then(
        () => (init_stripeClient(), stripeClient_exports),
      );
      const [gc] = await db2
        .select()
        .from(giftCards2)
        .where(eq64(giftCards2.id, req.params.giftCardId))
        .limit(1);
      if (!gc)
        return res
          .status(404)
          .json({ success: false, error: "Gift card no encontrada" });
      if (gc.purchasedBy !== req.user.id)
        return res.status(403).json({ success: false, error: "No autorizado" });
      if (gc.status === "active")
        return res.json({ success: true, message: "Ya estaba activa" });
      if (gc.status !== "pending_payment")
        return res
          .status(400)
          .json({ success: false, error: "Estado inv\xE1lido" });
      const { paymentIntentId } = req.body;
      if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
        const stripe2 = getStripe3();
        const pi = await stripe2.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== "succeeded") {
          return res
            .status(400)
            .json({ success: false, error: "El pago no se ha completado" });
        }
      }
      const result = await GiftCardService.activateGiftCard(
        req.params.giftCardId,
        req.user.id,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router41.post(
  "/:giftCardId/payment-proof",
  authenticateToken,
  async (req, res) => {
    try {
      const { giftCardId } = req.params;
      const { paymentProvider, proofImageUrl, referenceNumber, amount } =
        req.body;
      if (!paymentProvider || !proofImageUrl || !amount) {
        return res
          .status(400)
          .json({ success: false, error: "Datos incompletos" });
      }
      const result = await GiftCardService.submitPaymentProof({
        giftCardId,
        userId: req.user.id,
        paymentProvider,
        proofImageUrl,
        referenceNumber,
        amount: Math.round(amount * 100),
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router41.post("/validate", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res
        .status(400)
        .json({ success: false, error: "C\xF3digo requerido" });
    res.json(await GiftCardService.validateGiftCard(code));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router41.post("/redeem", authenticateToken, async (req, res) => {
  try {
    const { code, orderId, amountToUse } = req.body;
    if (!code || !orderId || !amountToUse)
      return res
        .status(400)
        .json({ success: false, error: "Datos incompletos" });
    res.json(
      await GiftCardService.redeemGiftCard({
        code,
        orderId,
        userId: req.user.id,
        amountToUse: Math.round(amountToUse * 100),
      }),
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router41.get("/my-cards", authenticateToken, async (req, res) => {
  try {
    res.json(await GiftCardService.getUserGiftCards(req.user.id));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router41.get("/designs", async (req, res) => {
  try {
    res.json(await GiftCardService.getDesigns());
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router41.get("/:giftCardId/history", authenticateToken, async (req, res) => {
  try {
    res.json(
      await GiftCardService.getTransactionHistory(req.params.giftCardId),
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
var giftCards_default = router41;

// server/routes/orderChat.ts
import express32 from "express";
import { eq as eq55 } from "drizzle-orm";
var router42 = express32.Router();
router42.get("/:orderId/chat", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orders: orders2, users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq55(orders2.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    const isCustomer = order.userId === req.user.id;
    const isDriver = order.deliveryPersonId === req.user.id;
    const isAdmin =
      req.user.role === "admin" || req.user.role === "super_admin";
    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: "No autorizado" });
    }
    const chatMessages = order.chatMessages
      ? JSON.parse(order.chatMessages)
      : [];
    res.json({
      success: true,
      messages: chatMessages,
      orderId,
      order: {
        id: order.id,
        status: order.status,
        userId: order.userId,
        deliveryPersonId: order.deliveryPersonId,
        businessId: order.businessId,
      },
    });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({ error: error.message });
  }
});
router42.post("/:orderId/chat", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message, receiverId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensaje vac\xEDo" });
    }
    const { orders: orders2, users: users7 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq55(orders2.id, orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    const isCustomer = order.userId === req.user.id;
    const isDriver = order.deliveryPersonId === req.user.id;
    const isAdmin =
      req.user.role === "admin" || req.user.role === "super_admin";
    if (!isCustomer && !isDriver && !isAdmin) {
      return res.status(403).json({ error: "No autorizado" });
    }
    const [sender] = await db2
      .select()
      .from(users7)
      .where(eq55(users7.id, req.user.id))
      .limit(1);
    const newMessage = {
      id: `msg-${Date.now()}`,
      orderId,
      senderId: req.user.id,
      senderName: sender?.name || "Usuario",
      receiverId:
        receiverId || (isCustomer ? order.deliveryPersonId : order.userId),
      message: message.trim(),
      createdAt: /* @__PURE__ */ new Date().toISOString(),
      isRead: false,
    };
    const chatMessages = order.chatMessages
      ? JSON.parse(order.chatMessages)
      : [];
    chatMessages.push(newMessage);
    await db2
      .update(orders2)
      .set({
        chatMessages: JSON.stringify(chatMessages),
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq55(orders2.id, orderId));
    try {
      const { sendPushToUser: sendPushToUser2 } = await Promise.resolve().then(
        () => (init_enhancedPushService(), enhancedPushService_exports),
      );
      const receiverName = sender?.name || "Cliente";
      const roleText = isDriver ? "Repartidor" : "Cliente";
      await sendPushToUser2(newMessage.receiverId, {
        title: `\u{1F4AC} Nuevo mensaje de ${roleText}`,
        body: message.substring(0, 50),
        data: { orderId, screen: "OrderChat" },
      });
    } catch (e) {
      console.error("Error sending push notification:", e);
    }
    res.json({
      success: true,
      message: newMessage,
      messages: chatMessages,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});
router42.patch(
  "/:orderId/chat/:messageId/read",
  authenticateToken,
  async (req, res) => {
    try {
      const { orderId, messageId } = req.params;
      const { orders: orders2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const [order] = await db2
        .select()
        .from(orders2)
        .where(eq55(orders2.id, orderId))
        .limit(1);
      if (!order) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }
      const chatMessages = order.chatMessages
        ? JSON.parse(order.chatMessages)
        : [];
      const messageIndex = chatMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        return res.status(404).json({ error: "Mensaje no encontrado" });
      }
      chatMessages[messageIndex].isRead = true;
      await db2
        .update(orders2)
        .set({
          chatMessages: JSON.stringify(chatMessages),
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq55(orders2.id, orderId));
      res.json({ success: true, message: "Mensaje marcado como le\xEDdo" });
    } catch (error) {
      console.error("Mark read error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
var orderChat_default = router42;

// server/routes/stripePaymentRoutes.ts
import express33 from "express";
init_db();
init_schema_mysql();
init_stripeClient();
import { eq as eq56 } from "drizzle-orm";
var router43 = express33.Router();
router43.get("/publishable-key", async (_req, res) => {
  try {
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.post("/create-payment-sheet", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const { amount, businessId, orderId, subtotal, deliveryFee } = req.body;
    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Datos de pago incompletos" });
    }
    const stripe2 = getStripe2();
    const { businesses: businesses3, orders: orders2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { sql: sql15 } = await import("drizzle-orm");
    const [userRows] = await db.execute(
      sql15`SELECT id, name, stripe_customer_id FROM users WHERE id = ${req.user.id} LIMIT 1`,
    );
    const user = userRows[0];
    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe2.customers.create({
        metadata: { userId: req.user.id },
        ...(user?.name && { name: user.name }),
      });
      customerId = customer.id;
      await db.execute(
        sql15`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${req.user.id}`,
      );
    }
    const ephemeralKey = await stripe2.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-06-20" },
    );
    const subtotalCents = Math.round(subtotal || 0);
    const nemyCommission = Math.round(subtotalCents * 0.15);
    const amountCents = Math.round(amount);
    const paymentIntent = await stripe2.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.user.id,
        businessId: businessId || "",
        orderId,
        subtotal: subtotalCents.toString(),
        deliveryFee: (deliveryFee || 0).toString(),
        nemyCommission: nemyCommission.toString(),
      },
    });
    await db
      .update(orders2)
      .set({
        paymentIntentId: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        productosBase: subtotalCents,
        nemyCommission,
        platformFee: nemyCommission,
        businessEarnings: subtotalCents,
        deliveryEarnings: deliveryFee || 0,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq56(orders2.id, orderId));
    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error("Create payment sheet error:", error);
    res.status(500).json({ error: error.message });
  }
});
router43.post("/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
      console.error("Stripe config missing", {
        hasSecret: !!process.env.STRIPE_SECRET_KEY,
        hasPublishable: !!process.env.STRIPE_PUBLISHABLE_KEY,
      });
      return res.status(503).json({ message: "Stripe no est\xE1 configurado" });
    }
    const {
      amount,
      businessId,
      orderId,
      subtotal,
      deliveryFee,
      isGiftCard,
      isSubscription,
    } = req.body;
    if (!amount || amount <= 0 || !orderId) {
      console.error("Invalid payment intent data", {
        amount,
        businessId,
        orderId,
        userId: req.user?.id,
      });
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }
    if (!isGiftCard && !isSubscription && !businessId) {
      return res.status(400).json({ message: "Datos de pago incompletos" });
    }
    let business = null;
    if (businessId && !isGiftCard && !isSubscription) {
      const { businesses: businesses3 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [b] = await db
        .select()
        .from(businesses3)
        .where(eq56(businesses3.id, businessId))
        .limit(1);
      if (!b) return res.status(404).json({ message: "Negocio no encontrado" });
      business = b;
    }
    const stripe2 = getStripe2();
    const amountInCents = Math.round(amount);
    const subtotalInCents = Math.round(subtotal || 0);
    const nemyCommission = Math.round(subtotalInCents * 0.15);
    const paymentIntent = await stripe2.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      metadata: {
        userId: req.user.id,
        businessId,
        orderId,
        subtotal: subtotalInCents.toString(),
        deliveryFee: (deliveryFee || 0).toString(),
        nemyCommission: nemyCommission.toString(),
      },
    });
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    await db
      .update(orders2)
      .set({
        paymentIntentId: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        productosBase: subtotalInCents,
        nemyCommission,
        platformFee: nemyCommission,
        businessEarnings: subtotalInCents,
        // Business gets 100% of products
        deliveryEarnings: deliveryFee || 0,
        // Delivery gets 100% of delivery fee
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(eq56(orders2.id, orderId));
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Create payment intent error", {
      userId: req.user?.id,
      amount: req.body?.amount,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });
    res
      .status(500)
      .json({ message: "No se pudo crear el pago", error: error?.message });
  }
});
router43.get("/payment-method/:userId", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq56(users.id, req.params.userId))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.post("/create-setup-intent", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }
    const stripe2 = (await import("stripe")).default;
    const stripeClient = new stripe2(process.env.STRIPE_SECRET_KEY);
    const { userId } = req.body;
    const [user] = await db
      .select()
      .from(users)
      .where(eq56(users.id, userId))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        metadata: { userId },
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq56(users.id, userId));
    }
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.post("/save-payment-method", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured" });
    }
    const stripe2 = (await import("stripe")).default;
    const stripeClient = new stripe2(process.env.STRIPE_SECRET_KEY);
    const { userId, paymentMethodId } = req.body;
    const paymentMethod =
      await stripeClient.paymentMethods.retrieve(paymentMethodId);
    await db
      .update(users)
      .set({
        stripePaymentMethodId: paymentMethodId,
        cardLast4: paymentMethod.card?.last4 || null,
        cardBrand: paymentMethod.card?.brand || null,
      })
      .where(eq56(users.id, userId));
    res.json({
      success: true,
      card: {
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.delete(
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
        .where(eq56(users.id, req.params.userId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router43.post(
  "/confirm-delivery/:orderId",
  authenticateToken,
  async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: "Stripe not configured" });
      }
      const stripe2 = (await import("stripe")).default;
      const stripeClient = new stripe2(process.env.STRIPE_SECRET_KEY);
      const {
        orders: orders2,
        businesses: businesses3,
        users: usersTable,
      } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [order] = await db
        .select()
        .from(orders2)
        .where(eq56(orders2.id, req.params.orderId))
        .limit(1);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.userId !== req.user.id)
        return res.status(403).json({ error: "Not authorized" });
      if (order.status !== "delivered")
        return res.status(400).json({ error: "Order not delivered yet" });
      if (order.confirmedByCustomer)
        return res.status(400).json({ error: "Already confirmed" });
      if (!order.paymentIntentId)
        return res.status(400).json({ error: "No payment found" });
      const [business] = await db
        .select()
        .from(businesses3)
        .where(eq56(businesses3.id, order.businessId))
        .limit(1);
      if (!business)
        return res.status(404).json({ error: "Business not found" });
      const hasStripeConnect = !!business.stripeAccountId;
      let driverAccount = null;
      if (order.deliveryPersonId) {
        const [driver] = await db
          .select()
          .from(usersTable)
          .where(eq56(usersTable.id, order.deliveryPersonId))
          .limit(1);
        driverAccount = driver?.stripeAccountId;
      }
      const businessAmount =
        order.businessEarnings || order.productosBase || order.subtotal || 0;
      const deliveryAmount = order.deliveryEarnings || order.deliveryFee || 0;
      let businessTransferId = null;
      let driverTransferId = null;
      if (hasStripeConnect && order.paymentIntentId) {
        const paymentIntent = await stripeClient.paymentIntents.retrieve(
          order.paymentIntentId,
        );
        const chargeId = paymentIntent.latest_charge;
        if (chargeId) {
          const businessTransfer = await stripeClient.transfers.create({
            amount: businessAmount,
            currency: "eur",
            destination: business.stripeAccountId,
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
        const { createPayoutsForOrder: createPayoutsForOrder2 } =
          await Promise.resolve().then(
            () => (init_payoutService(), payoutService_exports),
          );
        await createPayoutsForOrder2(order.id);
      }
      await db
        .update(orders2)
        .set({
          confirmedByCustomer: true,
          confirmedByCustomerAt: /* @__PURE__ */ new Date(),
          fundsReleased: true,
          fundsReleasedAt: /* @__PURE__ */ new Date(),
          businessTransferId,
          driverTransferId,
          driverPaymentStatus: driverTransferId ? "completed" : "pending",
          driverPaidAt: driverTransferId ? /* @__PURE__ */ new Date() : null,
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq56(orders2.id, order.id));
      try {
        const { LoyaltyService: LoyaltyService2 } =
          await Promise.resolve().then(
            () => (init_loyaltyService(), loyaltyService_exports),
          );
        await LoyaltyService2.awardPointsForOrder(
          order.userId,
          order.id,
          order.total,
        );
        console.log(
          `\u2705 Puntos de lealtad awarded para orden ${order.id.slice(-6)}`,
        );
      } catch (loyaltyError) {
        console.error(
          "\u26A0\uFE0F Error agregando puntos de lealtad:",
          loyaltyError,
        );
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
    } catch (error) {
      console.error("Confirm delivery error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router43.post(
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
      const { subscriptions: subscriptions2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const [sub] = await db
        .select()
        .from(subscriptions2)
        .where(eq56(subscriptions2.id, subscriptionId))
        .limit(1);
      if (!sub || sub.userId !== req.user.id) {
        return res.status(404).json({ error: "Suscripci\xF3n no encontrada" });
      }
      const stripe2 = getStripe2();
      const paymentIntent = await stripe2.paymentIntents.create({
        amount: Math.round(amount),
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        metadata: { userId: req.user.id, subscriptionId, plan: sub.plan },
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router43.post(
  "/confirm-subscription/:subscriptionId",
  authenticateToken,
  async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { subscriptions: subscriptions2 } = await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
      const { sql: sql15 } = await import("drizzle-orm");
      let [sub] = await db
        .select()
        .from(subscriptions2)
        .where(eq56(subscriptions2.id, subscriptionId))
        .limit(1);
      if (!sub || sub.userId !== req.user.id) {
        const [byUser] = await db
          .select()
          .from(subscriptions2)
          .where(eq56(subscriptions2.userId, req.user.id))
          .limit(1);
        if (!byUser)
          return res
            .status(404)
            .json({ error: "Suscripci\xF3n no encontrada" });
        sub = byUser;
      }
      const now = /* @__PURE__ */ new Date();
      const periodEnd = new Date(now);
      sub.billingCycle === "yearly"
        ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        : periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db
        .update(subscriptions2)
        .set({
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .where(eq56(subscriptions2.userId, req.user.id));
      try {
        const { sendPushToUser: sendPushToUser2 } =
          await Promise.resolve().then(
            () => (init_enhancedPushService(), enhancedPushService_exports),
          );
        await sendPushToUser2(sub.userId, {
          title: "\u2705 Suscripci\xF3n activada",
          body: `Tu plan ${sub.plan} ya est\xE1 activo. \xA1Disfruta los beneficios!`,
          data: { screen: "Subscriptions" },
        });
      } catch {}
      res.json({ success: true, plan: sub.plan });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router43.get("/cards", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq56(users.id, req.user.id))
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.get("/history", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { desc: desc12 } = await import("drizzle-orm");
    const userOrders = await db
      .select()
      .from(orders2)
      .where(eq56(orders2.userId, req.user.id))
      .orderBy(desc12(orders2.createdAt))
      .limit(20);
    const payments2 = userOrders
      .filter((o) => o.stripePaymentIntentId || o.paymentMethod)
      .map((o) => ({
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
    res.json({ payments: payments2 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router43.put("/cards/:cardId/default", authenticateToken, async (req, res) => {
  res.json({ success: true });
});
router43.delete("/cards/:cardId", authenticateToken, async (req, res) => {
  try {
    await db
      .update(users)
      .set({
        stripePaymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
      })
      .where(eq56(users.id, req.user.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var stripePaymentRoutes_default = router43;

// server/routes/stripeConnect.ts
import { Router as Router11 } from "express";
init_db();
init_stripeClient();
import { sql as sql14 } from "drizzle-orm";
var router44 = Router11();
async function getStripeAccountId(userId) {
  const [rows] = await db.execute(
    sql14`SELECT stripe_account_id FROM users WHERE id = ${userId} LIMIT 1`,
  );
  return rows[0]?.stripe_account_id || null;
}
async function saveStripeAccountId(userId, accountId) {
  await db.execute(
    sql14`UPDATE users SET stripe_account_id = ${accountId} WHERE id = ${userId}`,
  );
  await db.execute(
    sql14`UPDATE businesses SET stripe_account_id = ${accountId} WHERE owner_id = ${userId}`,
  );
}
router44.get("/status", authenticateToken, async (req, res) => {
  try {
    const stripe2 = getStripe2();
    const accountId = await getStripeAccountId(req.user.id);
    if (!accountId) {
      return res.json({
        hasAccount: false,
        onboardingComplete: false,
        canReceivePayments: false,
      });
    }
    const account = await stripe2.accounts.retrieve(accountId);
    res.json({
      hasAccount: true,
      accountId,
      onboardingComplete: account.details_submitted,
      canReceivePayments: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router44.post("/onboard", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const stripe2 = getStripe2();
    let accountId = await getStripeAccountId(req.user.id);
    if (!accountId) {
      const [userRows] = await db.execute(
        sql14`SELECT name, email FROM users WHERE id = ${req.user.id} LIMIT 1`,
      );
      const user = userRows[0];
      const account = await stripe2.accounts.create({
        type: "express",
        country: "ES",
        capabilities: { transfers: { requested: true } },
        business_type:
          req.user.role === "delivery_driver" ? "individual" : "company",
        ...(user?.email && { email: user.email }),
        metadata: { userId: req.user.id, role: req.user.role },
      });
      accountId = account.id;
      await saveStripeAccountId(req.user.id, accountId);
    }
    const returnUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/return?userId=${req.user.id}`;
    const refreshUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/refresh?accountId=${accountId}`;
    const accountLink = await stripe2.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    res.json({ success: true, onboardingUrl: accountLink.url, accountId });
  } catch (error) {
    console.error("Stripe Connect onboard error:", error);
    res.status(500).json({ error: error.message });
  }
});
router44.post("/refresh-onboarding", authenticateToken, async (req, res) => {
  try {
    const stripe2 = getStripe2();
    const { accountId } = req.body;
    if (!accountId)
      return res.status(400).json({ error: "accountId requerido" });
    const returnUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/return?userId=${req.user.id}`;
    const refreshUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL}/api/connect/refresh?accountId=${accountId}`;
    const accountLink = await stripe2.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    res.json({ success: true, onboardingUrl: accountLink.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router44.get("/return", async (req, res) => {
  const deepLink = `comeya://stripe-connect-complete`;
  res.send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Stripe configurado - ComeYa</title>
    <script>window.location.href='${deepLink}';</script>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">\u2705</div>
      <h1 style="color:#1A1A1A">\xA1Cuenta configurada!</h1>
      <p style="color:#555">Tu cuenta Stripe est\xE1 lista. Vuelve a la app para continuar.</p>
      <a href="${deepLink}" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>
  `);
});
router44.get("/refresh", async (req, res) => {
  res.send(`
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Enlace expirado - ComeYa</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F7F7F7;text-align:center;padding:24px;}</style>
    </head><body>
    <div style="background:white;border-radius:20px;padding:40px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="font-size:64px">\u26A0\uFE0F</div>
      <h1 style="color:#1A1A1A">Enlace expirado</h1>
      <p style="color:#555">El enlace de configuraci\xF3n ha expirado. Vuelve a la app y genera uno nuevo.</p>
      <a href="comeya://" style="display:inline-block;background:#FF6B35;color:white;padding:14px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">Volver a ComeYa</a>
    </div></body></html>
  `);
});
router44.get("/business/status", authenticateToken, async (req, res) => {
  try {
    const stripe2 = getStripe2();
    const accountId = await getStripeAccountId(req.user.id);
    if (!accountId) {
      return res.json({ success: true, connected: false });
    }
    const account = await stripe2.accounts.retrieve(accountId);
    res.json({
      success: true,
      connected: true,
      accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router44.post("/business/connect", authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe no configurado" });
    }
    const stripe2 = getStripe2();
    let accountId = await getStripeAccountId(req.user.id);
    if (!accountId) {
      const [userRows] = await db.execute(
        sql14`SELECT name, email FROM users WHERE id = ${req.user.id} LIMIT 1`,
      );
      const user = userRows[0];
      const account = await stripe2.accounts.create({
        type: "express",
        country: "ES",
        capabilities: { transfers: { requested: true } },
        business_type: "company",
        ...(user?.email && { email: user.email }),
        metadata: { userId: req.user.id, role: "business_owner" },
      });
      accountId = account.id;
      await saveStripeAccountId(req.user.id, accountId);
    }
    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;
    const accountLink = await stripe2.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/refresh?accountId=${accountId}`,
      return_url: `${baseUrl}/api/connect/return?userId=${req.user.id}`,
      type: "account_onboarding",
    });
    res.json({ success: true, onboardingUrl: accountLink.url, accountId });
  } catch (error) {
    console.error("Business Stripe connect error:", error);
    res.status(500).json({ error: error.message });
  }
});
router44.get(
  "/business/dashboard-link",
  authenticateToken,
  async (req, res) => {
    try {
      const stripe2 = getStripe2();
      const accountId = await getStripeAccountId(req.user.id);
      if (!accountId)
        return res.status(404).json({ error: "Sin cuenta Stripe" });
      const loginLink = await stripe2.accounts.createLoginLink(accountId);
      res.json({ success: true, url: loginLink.url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router44.delete("/business/disconnect", authenticateToken, async (req, res) => {
  try {
    await db.execute(
      sql14`UPDATE users SET stripe_account_id = NULL WHERE id = ${req.user.id}`,
    );
    await db.execute(
      sql14`UPDATE businesses SET stripe_account_id = NULL WHERE owner_id = ${req.user.id}`,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var stripeConnect_default = router44;

// server/routes/pickup.ts
import express34 from "express";
init_pickupService();
import { eq as eq59 } from "drizzle-orm";
var router45 = express34.Router();
router45.get("/:orderId/info", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2 } = await Promise.resolve().then(
      () => (init_schema_mysql(), schema_mysql_exports),
    );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [order] = await db2
      .select()
      .from(orders2)
      .where(eq59(orders2.id, req.params.orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    if (order.orderType !== "pickup") {
      return res
        .status(400)
        .json({ error: "Este pedido no es de tipo pickup" });
    }
    const timeRemaining = pickupService.getTimeRemaining(order);
    const progress = pickupService.getProgress(order);
    const pendingBefore = await pickupService.getPendingOrdersCount(
      order.businessId,
      order.id,
    );
    res.json({
      success: true,
      pickup: {
        code: order.pickupCode,
        qrCode: order.pickupQrCode,
        estimatedMinutes: order.estimatedPickupTime,
        timeRemaining,
        progress,
        isReady: order.status === "ready",
        readyAt: order.pickupReadyAt,
        pendingBefore,
      },
    });
  } catch (error) {
    console.error("Get pickup info error:", error);
    res.status(500).json({ error: error.message });
  }
});
router45.post("/:orderId/arrived", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2, businesses: businesses3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const [order] = await db2
      .select({ order: orders2, business: businesses3 })
      .from(orders2)
      .leftJoin(businesses3, eq59(orders2.businessId, businesses3.id))
      .where(eq59(orders2.id, req.params.orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    if (order.order.userId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (order.order.orderType !== "pickup") {
      return res
        .status(400)
        .json({ error: "Este pedido no es de tipo pickup" });
    }
    await pickupService.customerArrived(
      req.params.orderId,
      order.business?.ownerId,
    );
    res.json({ success: true, message: "Negocio notificado de tu llegada" });
  } catch (error) {
    console.error("Customer arrived error:", error);
    res.status(500).json({ error: error.message });
  }
});
router45.post("/:orderId/update-time", authenticateToken, async (req, res) => {
  try {
    const { orders: orders2, businesses: businesses3 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { estimatedMinutes } = req.body;
    if (!estimatedMinutes || estimatedMinutes < 5 || estimatedMinutes > 120) {
      return res
        .status(400)
        .json({ error: "Tiempo estimado inv\xE1lido (5-120 min)" });
    }
    const [order] = await db2
      .select({ order: orders2, business: businesses3 })
      .from(orders2)
      .leftJoin(businesses3, eq59(orders2.businessId, businesses3.id))
      .where(eq59(orders2.id, req.params.orderId))
      .limit(1);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    if (order.business?.ownerId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }
    await db2
      .update(orders2)
      .set({
        estimatedPickupTime: estimatedMinutes,
      })
      .where(eq59(orders2.id, req.params.orderId));
    const { sendPushToUser: sendPushToUser2 } = await Promise.resolve().then(
      () => (init_enhancedPushService(), enhancedPushService_exports),
    );
    await sendPushToUser2(order.order.userId, {
      title: "\u23F1\uFE0F Tiempo actualizado",
      body: `Tu pedido estar\xE1 listo en aprox. ${estimatedMinutes} min`,
      data: { orderId: order.order.id, screen: "OrderTracking" },
    });
    res.json({ success: true, message: "Tiempo actualizado" });
  } catch (error) {
    console.error("Update time error:", error);
    res.status(500).json({ error: error.message });
  }
});
router45.post(
  "/:orderId/validate-code",
  authenticateToken,
  async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || code.length !== 6) {
        return res.status(400).json({ error: "C\xF3digo inv\xE1lido" });
      }
      const isValid = await pickupService.validatePickupCode(
        req.params.orderId,
        code,
      );
      res.json({ success: true, valid: isValid });
    } catch (error) {
      console.error("Validate code error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);
router45.get("/business/:businessId/average-time", async (req, res) => {
  try {
    const avgTime = await pickupService.getBusinessAverageTime(
      req.params.businessId,
    );
    res.json({ success: true, averageMinutes: avgTime });
  } catch (error) {
    console.error("Get average time error:", error);
    res.status(500).json({ error: error.message });
  }
});
var pickup_default = router45;

// server/routes/registration.ts
init_cloudinaryService();
init_db();
init_schema_mysql();
import express35 from "express";
import { eq as eq60 } from "drizzle-orm";
var router46 = express35.Router();
router46.post("/upload-documents", async (req, res) => {
  try {
    const {
      userId,
      idDocument,
      autonomoDocument,
      profilePhoto,
      vehiclePhoto,
      vehicleDocument,
      insuranceDocument,
      vehicleType,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
    } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId requerido" });
    }
    const uploadedUrls = {};
    if (idDocument) {
      uploadedUrls.idDocument = await CloudinaryService.uploadImage(
        idDocument,
        "profiles",
        `id-${userId}`,
      );
    }
    if (autonomoDocument) {
      uploadedUrls.autonomoDocument = await CloudinaryService.uploadImage(
        autonomoDocument,
        "profiles",
        `autonomo-${userId}`,
      );
    }
    if (profilePhoto) {
      uploadedUrls.profilePhoto = await CloudinaryService.uploadImage(
        profilePhoto,
        "profiles",
        `profile-${userId}`,
      );
      await db
        .update(users)
        .set({ profileImage: uploadedUrls.profilePhoto })
        .where(eq60(users.id, userId));
    }
    if (vehiclePhoto) {
      uploadedUrls.vehiclePhoto = await CloudinaryService.uploadImage(
        vehiclePhoto,
        "profiles",
        `vehicle-${userId}`,
      );
    }
    if (vehicleDocument) {
      uploadedUrls.vehicleDocument = await CloudinaryService.uploadImage(
        vehicleDocument,
        "profiles",
        `vehicle-doc-${userId}`,
      );
    }
    if (insuranceDocument) {
      uploadedUrls.insuranceDocument = await CloudinaryService.uploadImage(
        insuranceDocument,
        "profiles",
        `insurance-${userId}`,
      );
    }
    if (vehicleType) {
      const [existingDriver] = await db
        .select()
        .from(deliveryDrivers)
        .where(eq60(deliveryDrivers.userId, userId))
        .limit(1);
      const driverData = {
        vehicleType,
        vehiclePlate: vehiclePlate || null,
        vehicleBrand: vehicleBrand || null,
        vehicleModel: vehicleModel || null,
        vehicleColor: vehicleColor || null,
        vehiclePhoto: uploadedUrls.vehiclePhoto || null,
        status: "pending_verification",
      };
      if (existingDriver) {
        await db
          .update(deliveryDrivers)
          .set(driverData)
          .where(eq60(deliveryDrivers.userId, userId));
      } else {
        await db.insert(deliveryDrivers).values({
          id: crypto.randomUUID(),
          userId,
          ...driverData,
          isAvailable: false,
          currentLat: null,
          currentLng: null,
        });
      }
    }
    res.json({
      success: true,
      uploadedUrls,
      message: "Documentos subidos correctamente",
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al subir documentos" });
  }
});
var registration_default = router46;

// server/routes/adminSubscriptionPlans.ts
import express36 from "express";
init_db();
init_schema_mysql();
import { eq as eq61 } from "drizzle-orm";
import { randomUUID } from "crypto";
var router47 = express36.Router();
router47.get(
  "/subscription-plans",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const plans = await db
        .select()
        .from(subscriptionPlans)
        .orderBy(subscriptionPlans.displayOrder);
      const benefits = await db.select().from(subscriptionBenefits);
      const result = plans.map((plan) => ({
        ...plan,
        benefits: benefits.filter((b) => b.plan === plan.planKey),
      }));
      res.json({ success: true, plans: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router47.put(
  "/subscription-plans/:planKey",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { planKey } = req.params;
      const { name, description, price, isActive, color } = req.body;
      await db
        .update(subscriptionPlans)
        .set({
          name,
          description,
          price,
          isActive,
          color,
          updatedAt: /* @__PURE__ */ new Date(),
        })
        .where(eq61(subscriptionPlans.planKey, planKey));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router47.post(
  "/subscription-benefits",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { plan, benefitType, benefitValue, description } = req.body;
      if (!plan || !benefitType)
        return res
          .status(400)
          .json({ error: "plan y benefitType son requeridos" });
      const id = randomUUID();
      await db.insert(subscriptionBenefits).values({
        id,
        plan,
        benefitType,
        benefitValue: parseInt(benefitValue) || 0,
        description,
      });
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router47.put(
  "/subscription-benefits/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { benefitType, benefitValue, description } = req.body;
      await db
        .update(subscriptionBenefits)
        .set({
          benefitType,
          benefitValue: parseInt(benefitValue) || 0,
          description,
        })
        .where(eq61(subscriptionBenefits.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
router47.delete(
  "/subscription-benefits/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      await db
        .delete(subscriptionBenefits)
        .where(eq61(subscriptionBenefits.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);
var adminSubscriptionPlans_default = router47;

// server/routes/businessCategories.ts
import express37 from "express";
var router48 = express37.Router();
var DEFAULT_CATEGORIES = [
  {
    name: "Restaurantes",
    slug: "restaurant",
    icon: "coffee",
    color: "#F97316",
    description: "Comida preparada, men\xFAs y platos del d\xEDa",
    displayOrder: 1,
  },
  {
    name: "Mercados",
    slug: "market",
    icon: "shopping-bag",
    color: "#10B981",
    description: "Supermercados, fruter\xEDas y alimentaci\xF3n",
    displayOrder: 2,
  },
  {
    name: "Farmacias",
    slug: "pharmacy",
    icon: "plus-circle",
    color: "#3B82F6",
    description: "Medicamentos, parafarmacia y productos de salud",
    displayOrder: 3,
  },
  {
    name: "Tiendas",
    slug: "store",
    icon: "package",
    color: "#8B5CF6",
    description: "Comercios locales y tiendas especializadas",
    displayOrder: 4,
  },
  {
    name: "Ferreter\xEDas",
    slug: "hardware",
    icon: "tool",
    color: "#F59E0B",
    description: "Herramientas, materiales y bricolaje",
    displayOrder: 5,
  },
  {
    name: "Papeler\xEDas",
    slug: "stationery",
    icon: "book",
    color: "#EC4899",
    description: "Material de oficina, libros y papeler\xEDa",
    displayOrder: 6,
  },
  {
    name: "Otros",
    slug: "other",
    icon: "grid",
    color: "#6B7280",
    description: "Negocios que no encajan en otras categor\xEDas",
    displayOrder: 99,
  },
];
router48.get(
  "/",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessCategories: businessCategories2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { asc } = await import("drizzle-orm");
      let cats = await db2
        .select()
        .from(businessCategories2)
        .orderBy(asc(businessCategories2.displayOrder));
      if (cats.length === 0) {
        await db2.insert(businessCategories2).values(DEFAULT_CATEGORIES);
        cats = await db2
          .select()
          .from(businessCategories2)
          .orderBy(asc(businessCategories2.displayOrder));
      }
      res.json({ success: true, categories: cats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router48.get("/public", async (_req, res) => {
  try {
    const { businessCategories: businessCategories2 } =
      await Promise.resolve().then(
        () => (init_schema_mysql(), schema_mysql_exports),
      );
    const { db: db2 } = await Promise.resolve().then(
      () => (init_db(), db_exports),
    );
    const { asc, eq: eq64 } = await import("drizzle-orm");
    const cats = await db2
      .select()
      .from(businessCategories2)
      .where(eq64(businessCategories2.isActive, true))
      .orderBy(asc(businessCategories2.displayOrder));
    res.json({ success: true, categories: cats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router48.post(
  "/",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessCategories: businessCategories2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { name, slug, icon, color, description, isActive, displayOrder } =
        req.body;
      if (!name?.trim() || !slug?.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "name y slug son requeridos" });
      }
      const cleanSlug = slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      await db2.insert(businessCategories2).values({
        name: name.trim(),
        slug: cleanSlug,
        icon: icon ?? "grid",
        color: color ?? "#6B7280",
        description: description ?? null,
        isActive: isActive ?? true,
        displayOrder: displayOrder ?? 0,
      });
      const [created] = await db2
        .select()
        .from(businessCategories2)
        .where(
          (await import("drizzle-orm")).eq(businessCategories2.slug, cleanSlug),
        )
        .limit(1);
      res.json({ success: true, category: created });
    } catch (error) {
      if (error.message?.includes("Duplicate")) {
        return res
          .status(409)
          .json({
            success: false,
            error: "Ya existe una categor\xEDa con ese slug",
          });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router48.put(
  "/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessCategories: businessCategories2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      const { name, slug, icon, color, description, isActive, displayOrder } =
        req.body;
      const updates = {};
      if (name !== void 0) updates.name = name.trim();
      if (slug !== void 0)
        updates.slug = slug
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
      if (icon !== void 0) updates.icon = icon;
      if (color !== void 0) updates.color = color;
      if (description !== void 0) updates.description = description;
      if (isActive !== void 0) updates.isActive = isActive;
      if (displayOrder !== void 0) updates.displayOrder = displayOrder;
      await db2
        .update(businessCategories2)
        .set(updates)
        .where(eq64(businessCategories2.id, req.params.id));
      const [updated] = await db2
        .select()
        .from(businessCategories2)
        .where(eq64(businessCategories2.id, req.params.id))
        .limit(1);
      res.json({ success: true, category: updated });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
router48.delete(
  "/:id",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { businessCategories: businessCategories2 } =
        await Promise.resolve().then(
          () => (init_schema_mysql(), schema_mysql_exports),
        );
      const { db: db2 } = await Promise.resolve().then(
        () => (init_db(), db_exports),
      );
      const { eq: eq64 } = await import("drizzle-orm");
      await db2
        .delete(businessCategories2)
        .where(eq64(businessCategories2.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);
var businessCategories_default = router48;

// server/routes.ts
var router49 = express38.Router();
router49.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: /* @__PURE__ */ new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});
router49.get("/settings/public", async (req, res) => {
  try {
    const { getPublicSettings: getPublicSettings2 } =
      await Promise.resolve().then(
        () => (init_systemSettingsService(), systemSettingsService_exports),
      );
    const result = await getPublicSettings2();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router49.get("/system/exchange-rate", async (req, res) => {
  try {
    const { exchangeRateService: exchangeRateService2 } =
      await Promise.resolve().then(
        () => (init_exchangeRateService(), exchangeRateService_exports),
      );
    const result = await exchangeRateService2.getCurrentRate();
    res.json({
      success: true,
      rate: result.rate,
      source: result.source,
      lastUpdated: result.lastUpdated,
    });
  } catch (error) {
    res.json({ success: true, rate: 36.5, source: "fallback" });
  }
});
router49.post("/coupons/validate", authenticateToken, async (req, res) => {
  try {
    const { validateCoupon } = await import("./couponService");
    const { code, userId, orderTotal } = req.body;
    const result = await validateCoupon(
      code,
      userId || req.user.id,
      orderTotal,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});
router49.get("/delivery-zones", async (_req, res) => {
  res.json({
    success: true,
    zones: [
      {
        id: "zone-centro",
        name: "Centro",
        deliveryFee: 300,
        maxDeliveryTime: 20,
        isActive: true,
        centerLatitude: "41.7636",
        centerLongitude: "-2.4677",
        radiusKm: 2,
      },
      {
        id: "zone-norte",
        name: "Norte",
        deliveryFee: 350,
        maxDeliveryTime: 25,
        isActive: true,
        centerLatitude: "41.7750",
        centerLongitude: "-2.4677",
        radiusKm: 3,
      },
      {
        id: "zone-sur",
        name: "Sur",
        deliveryFee: 350,
        maxDeliveryTime: 25,
        isActive: true,
        centerLatitude: "41.7500",
        centerLongitude: "-2.4677",
        radiusKm: 3,
      },
      {
        id: "zone-este",
        name: "Este",
        deliveryFee: 400,
        maxDeliveryTime: 30,
        isActive: true,
        centerLatitude: "41.7636",
        centerLongitude: "-2.4400",
        radiusKm: 3,
      },
    ],
  });
});
router49.get("/favorites/check/:userId/:businessId", (_req, res) =>
  res.json({ success: true, isFavorite: false }),
);
router49.get("/favorites/:userId", (_req, res) =>
  res.json({ success: true, favorites: [] }),
);
router49.post("/favorites", (_req, res) => res.json({ success: true }));
router49.delete("/favorites/:userId/:businessId", (_req, res) =>
  res.json({ success: true }),
);
router49.get("/levels/my-level", (_req, res) =>
  res.json({ success: true, level: null }),
);
router49.use("/auth", auth_default);
router49.use("/businesses", business_default);
router49.use("/business", business_default);
router49.use("/orders", orderRoutes_default);
router49.use("/users", users_default);
router49.use("/user", users_default);
router49.use("/delivery", deliveryConfigRoutes_default);
router49.use("/delivery", delivery_default);
router49.use("/delivery", deliveryRoutes_default);
router49.use("/payments", payments_default);
router49.use("/digital-payments", digitalPayments_default);
router49.use("/payment-accounts", paymentAccounts_default);
router49.use("/fund-release", fundRelease_default);
router49.use("/payouts", payoutRoutes_default);
router49.use("/wallet", wallet_default);
router49.use("/wallet", walletRoutes_default);
router49.use("/bank-account", bankAccountRoutes_default);
router49.use("/admin", adminRoutes_default);
router49.use("/admin/finance", adminFinanceRoutes_default);
router49.use("/admin", adminExchangeRate_default);
router49.use("/support", supportRoutes_default);
router49.use("/withdrawals", withdrawalRoutes_default);
router49.use("/cash-settlement", cashSettlementRoutes_default);
router49.use("/weekly-settlement", weeklySettlementRoutes_default);
router49.use("/audit", financialAuditRoutes_default);
router49.use("/favorites", favoritesRoutes_default);
router49.use("/business-verification", businessVerificationRoutes_default);
router49.use("/gps", gpsRoutes_default);
router49.use("/search", search_default);
router49.use("/coupons", coupons_default);
router49.use("/loyalty", loyalty_default);
router49.use("/favorites", favorites_default);
router49.use("/scheduled-orders", scheduledOrders_default);
router49.use("/ai", aiRecommendations_default);
router49.use("/support", support_default);
router49.use("/tracking", enhancedTracking_default);
router49.use("/subscriptions", subscriptions_default);
router49.use("/smart-notifications", smartNotifications_default);
router49.use("/reviews", enhancedReviews_default);
router49.use("/analytics", businessAnalytics_default);
router49.use("/group-orders", groupOrders_default);
router49.use("/gamification", gamification_default);
router49.use("/gift-cards", giftCards_default);
router49.use("/orders", orderChat_default);
router49.use("/stripe", stripePaymentRoutes_default);
router49.use("/connect", stripeConnect_default);
router49.use("/business/stripe", stripeConnect_default);
router49.use("/pickup", pickup_default);
router49.use("/registration", registration_default);
router49.use("/admin/business-categories", businessCategories_default);
router49.use("/admin", adminSubscriptionPlans_default);
router49.use("/business-categories", businessCategories_default);
var routes_default = router49;

// server/server.ts
config2({ path: ".env.local", override: true });
config2({ path: ".env", override: false });
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
validateEnv();
var app = express39();
var httpServer = createServer(app);
var PORT = process.env.PORT || 5e3;
var isProduction2 = process.env.NODE_ENV === "production";
app.set("trust proxy", 1);
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: isProduction2 ? 100 : 1e4,
    message: "Too many requests from this IP",
  }),
);
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});
app.use(express39.json({ limit: "10mb" }));
app.use(express39.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  };
  next();
});
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express39.static(path2.join(__dirname, "uploads")),
);
app.use(
  "/assets",
  express39.static(path2.join(process.cwd(), "client/assets")),
);
app.use("/api", routes_default);
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: /* @__PURE__ */ new Date().toISOString(),
  });
});
if (isProduction2) {
  app.use(express39.static(path2.join(process.cwd(), "dist")));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path2.join(process.cwd(), "dist", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      message: "MOUZO API Server",
      frontend: process.env.FRONTEND_URL || "http://localhost:8081",
    });
  });
}
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});
app.use((req, res) => {
  res
    .status(404)
    .json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});
var server = httpServer.listen(PORT, () => {
  console.log(`\u{1F680} Server running on port ${PORT}`);
  console.log(
    `\u{1F527} Environment: ${process.env.NODE_ENV || "development"}`,
  );
  initializeWebSocket(httpServer);
  console.log("\u{1F50C} WebSocket initialized");
  if (!process.env.TWILIO_ACCOUNT_SID)
    console.warn("\u26A0\uFE0F  Twilio not configured");
  if (!process.env.MOUZO_PAGO_MOVIL_PHONE)
    console.warn(
      "\u26A0\uFE0F  Pago M\xF3vil no configurado - agrega MOUZO_PAGO_MOVIL_PHONE en .env",
    );
  Promise.resolve()
    .then(() => (init_businessHoursCron(), businessHoursCron_exports))
    .then(({ startBusinessHoursCron: startBusinessHoursCron2 }) =>
      startBusinessHoursCron2(),
    )
    .catch(console.error);
  Promise.resolve()
    .then(() => (init_weeklySettlementCron(), weeklySettlementCron_exports))
    .then(({ WeeklySettlementCron: WeeklySettlementCron2 }) =>
      WeeklySettlementCron2.start(),
    )
    .catch(console.error);
  Promise.resolve()
    .then(
      () => (init_autoConfirmDeliveryCron(), autoConfirmDeliveryCron_exports),
    )
    .then(({ startAutoConfirmCron: startAutoConfirmCron2 }) =>
      startAutoConfirmCron2(),
    )
    .catch(console.error);
  Promise.resolve()
    .then(() => (init_pickupNotificationCron(), pickupNotificationCron_exports))
    .then(({ startPickupNotificationCron: startPickupNotificationCron2 }) =>
      startPickupNotificationCron2(),
    )
    .catch(console.error);
});
