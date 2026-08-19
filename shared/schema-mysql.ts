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
import { z } from "zod";

export const users = mysqlTable("users", {
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
  dni: varchar("dni", { length: 20 }), // DNI/NIE
  address: text("address"), // Dirección completa
  // Verificación de identidad
  idDocumentUrl: text("id_document_url"), // Foto DNI/NIE anverso
  idDocumentBackUrl: text("id_document_back_url"), // Foto DNI/NIE reverso
  autonomoDocumentUrl: text("autonomo_document_url"), // Cert. autónomo/empresa
  verificationStatus: varchar("verification_status", { length: 20 }).default(
    "pending",
  ), // pending, verified, rejected
  verificationNotes: text("verification_notes"),
  // Legacy Venezuela (mantener para no romper)
  // Legacy — mantener columnas para no romper BD existente
  pagoMovilPhone: text("pago_movil_phone"),
  pagoMovilBank: text("pago_movil_bank"),
  pagoMovilCedula: text("pago_movil_cedula"),
  bankAccount: text("bank_account"),
  // Preferencias de notificaciones (JSON: {promotions, news}; los avisos de
  // pedidos siempre se envían por ser operativos)
  notificationPreferences: text("notification_preferences"),
  // Referidos: código propio del usuario y quién lo invitó
  referralCode: varchar("referral_code", { length: 20 }),
  referredBy: varchar("referred_by", { length: 255 }),
  referralRewardedAt: timestamp("referral_rewarded_at"),
  isActive: boolean("is_active").notNull().default(true),
  isOnline: boolean("is_online").notNull().default(false),
  lastActiveAt: timestamp("last_active_at"),
  profileImage: text("profile_image"),
  pushToken: text("push_token"),
  // Stripe Connect (cuenta vinculada del usuario)
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
});

export const addresses = mysqlTable("addresses", {
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

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: text("business_id").notNull(),
  businessName: text("business_name").notNull(),
  businessImage: text("business_image"),
  items: text("items").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, preparing, on_the_way, delivered, cancelled
  subtotal: int("subtotal").notNull(),
  productosBase: int("productos_base").default(0), // Precio base sin markup MOUZO
  nemyCommission: int("nemy_commission").default(0), // 15% markup MOUZO
  deliveryFee: int("delivery_fee").notNull(),
  total: int("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentProvider: varchar("payment_provider", { length: 50 }).default(
    "stripe_bizum",
  ),
  orderType: text("order_type"), // delivery | pickup
  estimatedPickupTime: int("estimated_pickup_time"), // minutos estimados para pickup
  pickupReadyAt: timestamp("pickup_ready_at"), // cuando el pedido estuvo listo para recoger
  customerArrivedAt: timestamp("customer_arrived_at"), // cuando el cliente avisó que llegó
  pickupCode: varchar("pickup_code", { length: 6 }), // código de 6 dígitos para recoger
  pickupQrCode: text("pickup_qr_code"), // QR code único para escanear
  // Referencia de pago (Stripe/PayPal)
  paymentReference: text("pago_movil_reference"),
  paymentProofUrl: text("pago_movil_proof_url"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryPersonId: text("delivery_person_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  estimatedDelivery: timestamp("estimated_delivery"),
  // Aviso anticipado a repartidores (5-10 min / 10-20 min)
  estimatedPrepMinutes: int("estimated_prep_minutes"),
  estimatedPrepRange: varchar("estimated_prep_range", { length: 20 }),
  // Ventana de entrega agrupada para pedidos de mercado (escaparate)
  deliveryWindow: varchar("delivery_window", { length: 20 }),
  // Campos para cancelación y comisiones
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 255 }),
  cancellationReason: text("cancellation_reason"),
  refundAmount: int("refund_amount"),
  penaltyAmount: int("penalty_amount"), // penalización por cancelación
  refundStatus: text("refund_status"), // pending, processed, failed
  businessResponseAt: timestamp("business_response_at"), // cuando el negocio respondió
  platformFee: int("platform_fee"), // comisión MOUZO
  businessEarnings: int("business_earnings"), // ganancia negocio
  deliveryEarnings: int("delivery_earnings"), // ganancia repartidor
  distanceKm: int("distance_km"), // distancia en metros x100
  deliveredAt: timestamp("delivered_at"), // cuando se entregó
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  // Preferencias de sustitución (Stock Out)
  substitutionPreference: text("substitution_preference").default("refund"), // refund, call, substitute
  itemSubstitutionPreferences: text("item_substitution_preferences"), // JSON: {productId: "refund"|"call"|"substitute"}
  // Pago en efectivo
  cashPaymentAmount: int("cash_payment_amount"), // Con cuánto paga el cliente (centavos)
  cashChangeAmount: int("cash_change_amount"), // Cambio a entregar (centavos)
  // Cronómetro de arrepentimiento
  regretPeriodEndsAt: timestamp("regret_period_ends_at"), // Cuando termina el periodo de 60s
  regretPeriodConfirmed: boolean("regret_period_confirmed").default(false), // Cliente confirmó después de 60s (no va a cancelar)
  regretPeriodConfirmedAt: timestamp("regret_period_confirmed_at"), // Cuándo confirmó el período
  confirmedToBusinessAt: timestamp("confirmed_to_business_at"), // Cuando se notificó al negocio
  // Llamada automática al negocio
  callAttempted: boolean("call_attempted").default(false), // Si ya se intentó llamar al negocio
  callAttemptedAt: timestamp("call_attempted_at"), // Cuando se intentó la llamada
  // Campos adicionales de pago
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  driverPaidAt: timestamp("driver_paid_at"),
  driverPaymentStatus: text("driver_payment_status").default("pending"),
  // Confirmación de recepción por cliente (para liberar fondos)
  confirmedByCustomer: boolean("confirmed_by_customer").default(false), // Si el cliente confirmó que RECIBIÓ el pedido
  confirmedByCustomerAt: timestamp("confirmed_by_customer_at"), // Cuándo confirmó la recepción
  fundsReleased: boolean("funds_released").default(false), // Si ya se liberaron los fondos
  fundsReleasedAt: timestamp("funds_released_at"), // Cuándo se liberaron
  stripePaymentIntentId: text("stripe_payment_intent_id"), // PaymentIntent de Stripe
  businessTransferId: text("business_transfer_id"), // ID de transfer a negocio
  driverTransferId: text("driver_transfer_id"), // ID de transfer a repartidor
  // Asignación de repartidor
  assignedAt: timestamp("assigned_at"), // Cuando se asignó el repartidor
  driverPickedUpAt: timestamp("driver_picked_up_at"), // Cuando repartidor recogió el pedido
  driverArrivedAt: timestamp("driver_arrived_at"), // Cuando repartidor llegó con el cliente
  // Liquidación de efectivo (para pedidos cash)
  cashCollected: boolean("cash_collected").default(false), // Si el repartidor ya cobró el efectivo
  cashSettled: boolean("cash_settled").default(false), // Si ya liquidó con negocio/plataforma
  cashSettledAt: timestamp("cash_settled_at"), // Cuando liquidó
  // Prueba de entrega
  deliveryProofPhoto: text("delivery_proof_photo"), // URL de foto de entrega
  deliveryProofPhotoTimestamp: timestamp("delivery_proof_photo_timestamp"),
  deliveryRoute: text("delivery_route"), // JSON con ruta completa del repartidor
  deliveryDistance: int("delivery_distance"), // Distancia real recorrida en metros
  // Validación GPS
  deliveryGpsAccuracy: int("delivery_gps_accuracy"), // Precisión del GPS en metros
  deliveryGpsValidated: boolean("delivery_gps_validated").default(false), // Si se validó la ubicación
  // Compartir tracking
  trackingToken: varchar("tracking_token", { length: 255 }), // Token para compartir tracking
  trackingTokenExpires: timestamp("tracking_token_expires"),
  // Chat messages — JSON array de mensajes entre cliente y repartidor
  chatMessages: text("chat_messages"),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export const businesses = mysqlTable("businesses", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  ownerId: varchar("owner_id", { length: 255 }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("restaurant"), // restaurant, market
  image: text("image"),
  coverImage: text("cover_image"),
  address: text("address"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  email: text("email"),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  deliveryTime: text("delivery_time").default("30-45 min"),
  deliveryFee: int("delivery_fee").default(300), // en centavos de euro (3€)
  minOrder: int("min_order").default(1000), // en centavos de euro (10€ mínimo)
  isActive: boolean("is_active").notNull().default(true),
  isOpen: boolean("is_open").notNull().default(true),
  openingHours: text("opening_hours"), // JSON string
  categories: text("categories"), // comma-separated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  // Campos para ubicación y zonas de entrega
  latitude: text("latitude"),
  longitude: text("longitude"),
  maxDeliveryRadiusKm: int("max_delivery_radius_km").default(10), // Radio máximo de entrega
  baseFeePerKm: int("base_fee_per_km").default(500), // Costo por km en centavos
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  verificationDocuments: text("verification_documents"), // JSON con URLs de documentos
  // Control operativo de negocios
  maxSimultaneousOrders: int("max_simultaneous_orders").default(10), // Límite de pedidos activos
  isPaused: boolean("is_paused").notNull().default(false), // Pausado por sistema o manual
  pauseReason: text("pause_reason"), // Razón de pausa: manual, too_many_orders, delayed_orders
  pausedAt: timestamp("paused_at"),
  pausedUntil: timestamp("paused_until"), // Pausa temporal
  autoResumeEnabled: boolean("auto_resume_enabled").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false), // Destacado en pantalla de login
  featuredOrder: int("featured_order").default(0), // Orden de aparición en carrusel
  // Modo Slammed (Saturado)
  isSlammed: boolean("is_slammed").notNull().default(false), // Negocio saturado
  slammedExtraMinutes: int("slammed_extra_minutes").default(20), // Minutos extra cuando está saturado
  slammedAt: timestamp("slammed_at"), // Cuando se activó el modo saturado
  pagoMovilPhone: text("pago_movil_phone"),
  pagoMovilBank: text("pago_movil_bank"),
  pagoMovilCedula: text("pago_movil_cedula"),
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  // Stripe Connect
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeAccountStatus: varchar("stripe_account_status", { length: 50 }).default(
    "not_connected",
  ), // not_connected, pending, active
  // Niveles de partner
  partnerLevel: varchar("partner_level", { length: 20 }).default("bronze"), // bronze, silver, gold, platinum
  partnerLevelUpdatedAt: timestamp("partner_level_updated_at"),
  customCommission: int("custom_commission"), // null = usa global, numero = % especifico para este negocio
  totalOrdersCompleted: int("total_orders_completed").default(0),
  totalRevenueGenerated: int("total_revenue_generated").default(0), // en centavos
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Wallets - billetera para cada usuario
export const wallets = mysqlTable("wallets", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  balance: int("balance").notNull().default(0), // en centavos - saldo disponible
  pendingBalance: int("pending_balance").notNull().default(0), // dinero en tránsito
  cashOwed: int("cash_owed").notNull().default(0), // efectivo que debe liquidar (para repartidores)
  totalEarned: int("total_earned").notNull().default(0),
  totalWithdrawn: int("total_withdrawn").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Transactions - registro contable de todas las transacciones
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  walletId: varchar("wallet_id", { length: 255 }),
  orderId: varchar("order_id", { length: 255 }),
  businessId: varchar("business_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  type: text("type").notNull(), // income, commission, withdrawal, refund, penalty, tip, payment, transfer, delivery_payment
  amount: int("amount").notNull(), // en centavos (positivo = ingreso, negativo = egreso)
  balanceBefore: int("balance_before"),
  balanceAfter: int("balance_after"),
  description: text("description"),
  status: text("status").notNull().default("completed"), // pending, completed, failed, cancelled
  metadata: text("metadata"), // JSON con info adicional
  pagoMovilReference: text("pago_movil_reference"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Payments - registro de pagos de Stripe
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  customerId: varchar("customer_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  driverId: varchar("driver_id", { length: 255 }),
  amount: int("amount").notNull(), // en centavos
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("stripe_bizum"),
  orderType: text("order_type").notNull().default("delivery"), // delivery | pickup
  pagoMovilReference: text("pago_movil_reference"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Alias para compatibilidad con paymentService.ts
export const walletTransactions = transactions;

// Base insert schema - phone and name are required, email/password are optional
export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    name: true,
    phone: true,
    role: true,
  })
  .extend({
    phone: z.string().min(10, "Phone number is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().nullable(),
    password: z.string().optional().nullable(),
  });

export const insertOrderSchema = createInsertSchema(orders).pick({
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
  deliveryAddress: true,
  notes: true,
  substitutionPreference: true,
  itemSubstitutionPreferences: true,
  cashPaymentAmount: true,
  cashChangeAmount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

// System Settings - Configuración global del sistema
export const systemSettings = mysqlTable("system_settings", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, number, boolean, json
  category: text("category").notNull(), // payments, commissions, operations, security
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false), // Si es visible para clientes
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Products - Productos de negocios
export const products = mysqlTable("products", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: int("price").notNull(), // en centavos
  image: text("image"),
  category: text("category"),
  isAvailable: boolean("is_available").notNull().default(true),
  is86: boolean("is_86").notNull().default(false), // Menú 86 (agotado temporalmente)
  soldByWeight: boolean("sold_by_weight").notNull().default(false),
  weightUnit: text("weight_unit").default("kg"), // kg, lb, g
  stock: int("stock"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Pago Móvil Verifications
export const pagoMovilVerifications = mysqlTable("pago_movil_verifications", {
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

// Payment Accounts - Cuentas de pago configuradas por cada usuario/negocio
// Negocio/Driver: donde RECIBEN sus pagos del admin
// Cliente: cuenta ORIGEN para pre-llenar checkout
export const paymentAccounts = mysqlTable("payment_accounts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(), // pago_movil, binance, zinli, zelle, cash
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
  label: varchar("label", { length: 100 }), // ej: "Mi Banesco principal"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Payouts - Lo que el admin debe pagar a negocio/driver por cada pedido entregado
// Reemplaza withdrawals + withdrawalRequests con algo simple y sin bugs
export const payouts = mysqlTable("payouts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  recipientId: varchar("recipient_id", { length: 255 }).notNull(), // negocio o driver
  recipientType: varchar("recipient_type", { length: 20 }).notNull(), // business, driver
  amount: int("amount").notNull(), // en centavos
  method: varchar("method", { length: 50 }), // pago_movil, binance, zinli, zelle, cash
  // Snapshot de la cuenta destino al momento del pago
  accountSnapshot: text("account_snapshot"), // JSON con datos de la cuenta usada
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, paid, stripe_auto
  paidBy: varchar("paid_by", { length: 255 }), // admin que marcó como pagado
  paidAt: timestamp("paid_at"),
  stripeTransferId: varchar("stripe_transfer_id", { length: 255 }), // ID del transfer de Stripe
  proofUrl: text("proof_url"), // comprobante de transferencia subido por el admin
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Mantener withdrawals/withdrawalRequests como alias vacíos para no romper imports existentes
export const withdrawals = payouts;
export const withdrawalRequests = payouts;

// Delivery Drivers - Repartidores
export const deliveryDrivers = mysqlTable("delivery_drivers", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  vehicleType: text("vehicle_type").notNull(), // bike, motorcycle, car
  vehiclePlate: text("vehicle_plate"),
  vehiclePhoto: text("vehicle_photo"),
  vehicleBrand: varchar("vehicle_brand", { length: 100 }),
  vehicleModel: varchar("vehicle_model", { length: 100 }),
  vehicleColor: varchar("vehicle_color", { length: 50 }),
  // Documentos del vehículo (verificación del repartidor)
  vehiclePlatePhoto: text("vehicle_plate_photo"),
  vehicleItvPhoto: text("vehicle_itv_photo"),
  vehicleInsurancePhoto: text("vehicle_insurance_photo"),
  vehicleLicensePhoto: text("vehicle_license_photo"),
  updatedAt: timestamp("updated_at"),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLatitude: text("current_latitude"),
  currentLongitude: text("current_longitude"),
  lastLocationUpdate: timestamp("last_location_update"),
  totalDeliveries: int("total_deliveries").notNull().default(0),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  strikes: int("strikes").notNull().default(0), // Sistema de strikes
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
  blockedUntil: timestamp("blocked_until"),
  // GPS tracking y ruta
  routeHistory: text("route_history"), // JSON con historial de rutas
  totalDistanceTraveled: int("total_distance_traveled").default(0), // metros totales
  averageSpeed: int("average_speed").default(0), // km/h promedio
  gpsAccuracyAverage: int("gps_accuracy_average").default(0), // precisión promedio en metros
  // Stripe Connect
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeAccountStatus: varchar("stripe_account_status", { length: 50 }).default(
    "not_connected",
  ),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Audit Logs - Logs de auditoría para acciones críticas
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: text("action").notNull(), // create_order, cancel_order, update_settings, etc
  entityType: text("entity_type").notNull(), // order, user, business, settings
  entityId: varchar("entity_id", { length: 255 }),
  changes: text("changes"), // JSON con cambios realizados
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type Product = typeof products.$inferSelect;
export type PagoMovilVerification = typeof pagoMovilVerifications.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type DeliveryDriver = typeof deliveryDrivers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// Alias para compatibilidad
export const drivers = deliveryDrivers;

// Refresh Tokens - Tokens de refresco para autenticación
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Scheduled Orders - Pedidos programados
export const scheduledOrders = mysqlTable("scheduled_orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  items: text("items").notNull(), // JSON
  scheduledFor: timestamp("scheduled_for").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, processed, failed, cancelled
  orderId: varchar("order_id", { length: 255 }), // ID del pedido creado
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Support Chats - Chats de soporte con IA
export const supportChats = mysqlTable("support_chats", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  status: text("status").notNull().default("active"), // active, closed, escalated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Support Messages - Mensajes de chat de soporte
export const supportMessages = mysqlTable("support_messages", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  chatId: varchar("chat_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }), // null si es del bot
  message: text("message").notNull(),
  isBot: boolean("is_bot").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Reviews - Reseñas de pedidos
export const reviews = mysqlTable("reviews", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  rating: int("rating").notNull(), // 1-5 (rating general, legacy)
  foodRating: int("food_rating"), // 1-5
  deliveryRating: int("delivery_rating"), // 1-5
  packagingRating: int("packaging_rating"), // 1-5
  deliveryPersonId: varchar("delivery_person_id", { length: 255 }),
  deliveryPersonRating: int("delivery_person_rating"), // 1-5
  comment: text("comment"),
  photos: text("photos"), // JSON array de URLs
  tags: text("tags"), // JSON array de tag IDs
  tipAmount: int("tip_amount"), // propina al repartidor en centavos
  approved: boolean("approved").notNull().default(true),
  flagged: boolean("flagged").notNull().default(false),
  moderationReason: text("moderation_reason"),
  businessResponse: text("business_response"),
  businessResponseAt: timestamp("business_response_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Review Responses - Respuestas de negocios a reviews
export const reviewResponses = mysqlTable("review_responses", {
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

// Review Tags - Tags predefinidos para reviews
export const reviewTags = mysqlTable("review_tags", {
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

// Call logs for automatic business calls
export const callLogs = mysqlTable("call_logs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  callSid: varchar("call_sid", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  purpose: varchar("purpose", { length: 50 }).default("order_notification"), // order_notification, reminder
  status: varchar("status", { length: 50 }).default("initiated"), // initiated, ringing, answered, completed, failed, no-answer
  duration: int("duration"), // in seconds
  outcome: varchar("outcome", { length: 50 }), // accepted, rejected, no-answer
  response: varchar("response", { length: 10 }), // digits pressed by business
  responseAction: varchar("response_action", { length: 50 }), // accept, reject
  retryCount: int("retry_count").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at"),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ScheduledOrder = typeof scheduledOrders.$inferSelect;
export type SupportChat = typeof supportChats.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewResponse = typeof reviewResponses.$inferSelect;
export type ReviewTag = typeof reviewTags.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;

// Delivery Zones - Zonas de entrega
export const deliveryZones = mysqlTable("delivery_zones", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  name: text("name").notNull(),
  description: text("description"),
  deliveryFee: int("deliveryFee").notNull(), // en centavos
  maxDeliveryTime: int("maxDeliveryTime").default(45), // minutos
  isActive: boolean("isActive").notNull().default(true),
  coordinates: text("coordinates"), // JSON con polígono de coordenadas
  centerLatitude: text("centerLatitude"),
  centerLongitude: text("centerLongitude"),
  radiusKm: int("radiusKm").default(5),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type DeliveryZone = typeof deliveryZones.$inferSelect;

// Coupons - Cupones de descuento
export const coupons = mysqlTable("coupons", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // percentage, fixed
  discountValue: int("discount_value").notNull(), // en centavos o porcentaje
  minOrderAmount: int("min_order_amount").default(0), // mínimo de pedido en centavos
  maxUses: int("max_uses"), // null = ilimitado
  maxUsesPerUser: int("max_uses_per_user").default(1),
  usedCount: int("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type Coupon = typeof coupons.$inferSelect;

// Favorites - Favoritos de usuarios (negocios y productos)
export const favorites = mysqlTable("favorites", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }),
  productId: varchar("product_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Favorite = typeof favorites.$inferSelect;

// Delivery Heatmap - Mapa de calor de entregas
export const deliveryHeatmap = mysqlTable("delivery_heatmap", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  orderCount: int("order_count").notNull().default(1),
  totalRevenue: int("total_revenue").notNull().default(0), // en centavos
  averageDeliveryTime: int("average_delivery_time").default(0), // en segundos
  lastOrderAt: timestamp("last_order_at"),
  gridCell: varchar("grid_cell", { length: 50 }), // Para agrupar por celda de grid
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type DeliveryHeatmap = typeof deliveryHeatmap.$inferSelect;

// Proximity Alerts - Alertas de proximidad
export const proximityAlerts = mysqlTable("proximity_alerts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  driverId: varchar("driver_id", { length: 255 }).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(), // approaching, nearby, arrived
  distance: int("distance").notNull(), // metros
  destinationType: varchar("destination_type", { length: 50 }).notNull(), // business, customer
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type ProximityAlert = typeof proximityAlerts.$inferSelect;

// Delivery Proofs - Pruebas de entrega con foto
export const deliveryProofs = mysqlTable("delivery_proofs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull().unique(),
  driverId: varchar("driver_id", { length: 255 }).notNull(),
  photoUrl: text("photo_url").notNull(),
  photoBase64: text("photo_base64"), // Backup en base64
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accuracy: int("accuracy"), // Precisión GPS en metros
  route: text("route"), // JSON con breadcrumbs de la ruta
  routeDistance: int("route_distance"), // Distancia total en metros
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type DeliveryProof = typeof deliveryProofs.$inferSelect;

// Payment Methods - Métodos de pago disponibles
export const paymentMethods = mysqlTable("payment_methods", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  name: varchar("name", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  requiresManualVerification: boolean("requires_manual_verification").default(
    false,
  ),
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

// Payment Proofs - Comprobantes de pago
export const paymentProofs = mysqlTable("payment_proofs", {
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

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type PaymentProof = typeof paymentProofs.$inferSelect;
export type PaymentAccount = typeof paymentAccounts.$inferSelect;
export type Payout = typeof payouts.$inferSelect;

// Coupon Usage - Uso de cupones por usuario
export const couponUsage = mysqlTable("coupon_usage", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  couponId: varchar("coupon_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  discountApplied: int("discount_applied").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Loyalty Points - Puntos de lealtad por usuario
export const loyaltyPoints = mysqlTable("loyalty_points", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  currentPoints: int("current_points").default(0),
  totalEarned: int("total_earned").default(0),
  totalRedeemed: int("total_redeemed").default(0),
  tier: varchar("tier", { length: 20 }).default("bronze"),
  tierUpdatedAt: timestamp("tier_updated_at"),
  pointsToNextTier: int("points_to_next_tier").default(1000),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Loyalty Transactions - Historial de puntos
export const loyaltyTransactions = mysqlTable("loyalty_transactions", {
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

// Loyalty Rewards - Recompensas disponibles
export const loyaltyRewards = mysqlTable("loyalty_rewards", {
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

// Loyalty Redemptions - Canjes de recompensas
export const loyaltyRedemptions = mysqlTable("loyalty_redemptions", {
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

// Loyalty Challenges - Desafíos para ganar puntos
export const loyaltyChallenges = mysqlTable("loyalty_challenges", {
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

// Loyalty Challenge Progress - Progreso de usuarios en challenges
export const loyaltyChallengeProgress = mysqlTable(
  "loyalty_challenge_progress",
  {
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
  },
);

// Achievements - Logros
export const achievements = mysqlTable("achievements", {
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

// User Achievements - Logros desbloqueados por usuarios
export const userAchievements = mysqlTable("user_achievements", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  achievementId: varchar("achievement_id", { length: 255 }).notNull(),
  unlockedAt: timestamp("unlocked_at").default(sql`CURRENT_TIMESTAMP`),
});

export type CouponUsage = typeof couponUsage.$inferSelect;
export type LoyaltyPoints = typeof loyaltyPoints.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRedemption = typeof loyaltyRedemptions.$inferSelect;
export type LoyaltyChallenge = typeof loyaltyChallenges.$inferSelect;
export type LoyaltyChallengeProgress =
  typeof loyaltyChallengeProgress.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;

// User Favorites - Favoritos de usuarios
export const userFavorites = mysqlTable("user_favorites", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  itemId: varchar("item_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// User Preferences - Preferencias de usuario para IA
export const userPreferences = mysqlTable("user_preferences", {
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

// AI Recommendations - Recomendaciones generadas por IA
export const aiRecommendations = mysqlTable("ai_recommendations", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  recommendationType: varchar("recommendation_type", { length: 50 }).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  itemId: varchar("item_id", { length: 255 }).notNull(),
  confidenceScore: int("confidence_score").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  expiresAt: timestamp("expires_at"),
  clicked: boolean("clicked").default(false),
  ordered: boolean("ordered").default(false),
});

// Support Tickets - Tickets de soporte
export const supportTickets = mysqlTable("support_tickets", {
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

export type UserFavorite = typeof userFavorites.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
export type AIRecommendation = typeof aiRecommendations.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;

// Group Orders - Pedidos grupales (esquema real de la BD)
export const groupOrders = mysqlTable("group_orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  hostUserId: varchar("host_user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  deliveryAddressId: varchar("delivery_address_id", { length: 255 }),
  splitMethod: varchar("split_method", { length: 20 }).default("equal"),
  status: varchar("status", { length: 50 }).notNull().default("open"),
  expiresAt: timestamp("expires_at").notNull(),
  finalOrderId: varchar("final_order_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const groupOrderParticipants = mysqlTable("group_order_participants", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  groupOrderId: varchar("group_order_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  items: text("items").notNull(),
  subtotal: int("subtotal").notNull(),
  paid: boolean("paid").default(false),
  paymentMethod: varchar("payment_method", { length: 50 }),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const groupOrderInvitations = mysqlTable("group_order_invitations", {
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

export type GroupOrder = typeof groupOrders.$inferSelect;
export type GroupOrderParticipant = typeof groupOrderParticipants.$inferSelect;
export type GroupOrderInvitation = typeof groupOrderInvitations.$inferSelect;

// Subscriptions - Suscripciones premium
export const subscriptions = mysqlTable("subscriptions", {
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

export const subscriptionBenefits = mysqlTable("subscription_benefits", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  plan: varchar("plan", { length: 50 }).notNull(),
  benefitType: varchar("benefit_type", { length: 50 }).notNull(),
  benefitValue: int("benefit_value"),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const subscriptionPlans = mysqlTable("subscription_plans", {
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

export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionBenefit = typeof subscriptionBenefits.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Gift Cards - Tarjetas regalo
export const giftCards = mysqlTable("gift_cards", {
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

export const giftCardTransactions = mysqlTable("gift_card_transactions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  giftCardId: varchar("gift_card_id", { length: 255 }).notNull(),
  orderId: varchar("order_id", { length: 255 }),
  amount: int("amount").notNull(),
  balanceAfter: int("balance_after").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const giftCardDesigns = mysqlTable("gift_card_designs", {
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

export type GiftCard = typeof giftCards.$inferSelect;
export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect;
export type GiftCardDesign = typeof giftCardDesigns.$inferSelect;

// Delivery Requests - Plan Logística Local (B2B): solicitar repartidor
export const deliveryRequests = mysqlTable("delivery_requests", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupLatitude: text("pickup_latitude"),
  pickupLongitude: text("pickup_longitude"),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLatitude: text("dropoff_latitude"),
  dropoffLongitude: text("dropoff_longitude"),
  contactPhone: varchar("contact_phone", { length: 30 }),
  fee: int("fee").notNull().default(350), // tarifa plana 3,50 €
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, picked_up, delivered, cancelled
  driverId: varchar("driver_id", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  acceptedAt: timestamp("accepted_at"),
  deliveredAt: timestamp("delivered_at"),
});

export type DeliveryRequest = typeof deliveryRequests.$inferSelect;

// Ticket Messages - Mensajes de conversación en tickets de soporte
export const ticketMessages = mysqlTable("ticket_messages", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  ticketId: varchar("ticket_id", { length: 255 }).notNull(),
  senderId: varchar("sender_id", { length: 255 }).notNull(),
  senderType: varchar("sender_type", { length: 20 }).notNull(), // user, admin
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type TicketMessage = typeof ticketMessages.$inferSelect;

// Business Categories - Categorías de negocios (farmacia, restaurante, ferretería, etc.)
export const businessCategories = mysqlTable("business_categories", {
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

export type BusinessCategory = typeof businessCategories.$inferSelect;
