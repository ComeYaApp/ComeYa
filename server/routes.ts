import express from "express";
import { authenticateToken } from "./authMiddleware";

// ─── Route modules ────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth";
import businessRoutes from "./routes/business";
import orderRoutes from "./routes/orderRoutes";
import userRoutes from "./routes/users";
import deliveryRoutes from "./routes/delivery";
import paymentRoutes from "./routes/payments";
import walletRoutes from "./routes/wallet";
import adminRoutes from "./routes/adminRoutes";
import adminFinanceRoutes from "./routes/adminFinanceRoutes";
import adminExchangeRateRoutes from "./routes/adminExchangeRate";
import walletRoutesV2 from "./routes/walletRoutes";
import bankAccountRoutes from "./routes/bankAccountRoutes";
import deliveryConfigRoutes from "./routes/deliveryConfigRoutes";
import businessVerificationRoutes from "./routes/businessVerificationRoutes";
import supportRoutes from "./supportRoutes";
import withdrawalRoutes from "./withdrawalRoutes";
import cashSettlementRoutes from "./cashSettlementRoutes";
import weeklySettlementRoutes from "./weeklySettlementRoutes";
import financialAuditRoutes from "./financialAuditRoutes";
import favoritesRoutes from "./favoritesRoutes";
import deliveryRoutesLegacy from "./deliveryRoutes";
import gpsRoutes from "./gpsRoutes";
import digitalPaymentRoutes from "./routes/digitalPayments";
import paymentAccountsRoutes from "./routes/paymentAccounts";
import fundReleaseRoutes from "./routes/fundRelease";
import payoutRoutes from "./payoutRoutes";
import searchRoutes from "./routes/search";
import couponRoutes from "./routes/coupons";
import loyaltyRoutes from "./routes/loyalty";
import favoritesRoutesV2 from "./routes/favorites";
import scheduledOrdersRoutes from "./routes/scheduledOrders";
import aiRecommendationsRoutes from "./routes/aiRecommendations";
import supportRoutesV2 from "./routes/support";
import enhancedTrackingRoutes from "./routes/enhancedTracking";
import subscriptionRoutes from "./routes/subscriptions";
import smartNotificationRoutes from "./routes/smartNotifications";
import enhancedReviewsRoutes from "./routes/enhancedReviews";
import businessAnalyticsRoutes from "./routes/businessAnalytics";
import groupOrdersRoutes from "./routes/groupOrders";
import gamificationRoutes from "./routes/gamification";
import giftCardsRoutes from "./routes/giftCards";
import orderChatRoutes from "./routes/orderChat";
import stripePaymentRoutes from "./routes/stripePaymentRoutes";
import stripeConnectRoutes from "./routes/stripeConnect";
import pickupRoutes from "./routes/pickup";
import registrationRoutes from "./routes/registration";
import businessCategoriesRoutes from "./routes/businessCategories";

const router = express.Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV });
});

// ─── Public settings ──────────────────────────────────────────────────────────
router.get("/settings/public", async (req, res) => {
  try {
    const { getPublicSettings } = await import("./systemSettingsService");
    const result = await getPublicSettings();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Exchange rate ────────────────────────────────────────────────────────────
router.get("/system/exchange-rate", async (req, res) => {
  try {
    const { exchangeRateService } = await import("./exchangeRateService");
    const result = await exchangeRateService.getCurrentRate();
    res.json({ success: true, rate: result.rate, source: result.source, lastUpdated: result.lastUpdated });
  } catch (error: any) {
    res.json({ success: true, rate: 36.50, source: 'fallback' }); // Fallback
  }
});

// ─── Coupon validation ────────────────────────────────────────────────────────
router.post("/coupons/validate", authenticateToken, async (req, res) => {
  try {
    const { validateCoupon } = await import("./couponService");
    const { code, userId, orderTotal } = req.body;
    const result = await validateCoupon(code, userId || req.user!.id, orderTotal);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// ─── Delivery zones (public) ──────────────────────────────────────────────────
router.get("/delivery-zones", async (_req, res) => {
  res.json({
    success: true,
    zones: [
      { id: "zone-centro", name: "Centro",        deliveryFee: 300, maxDeliveryTime: 20, isActive: true, centerLatitude: "41.7636",  centerLongitude: "-2.4677", radiusKm: 2 },
      { id: "zone-norte",  name: "Norte",          deliveryFee: 350, maxDeliveryTime: 25, isActive: true, centerLatitude: "41.7750",  centerLongitude: "-2.4677", radiusKm: 3 },
      { id: "zone-sur",    name: "Sur",            deliveryFee: 350, maxDeliveryTime: 25, isActive: true, centerLatitude: "41.7500",  centerLongitude: "-2.4677", radiusKm: 3 },
      { id: "zone-este",   name: "Este",           deliveryFee: 400, maxDeliveryTime: 30, isActive: true, centerLatitude: "41.7636",  centerLongitude: "-2.4400", radiusKm: 3 },
    ],
  });
});

// ─── Favorites stubs ──────────────────────────────────────────────────────────
router.get("/favorites/check/:userId/:businessId", (_req, res) => res.json({ success: true, isFavorite: false }));
router.get("/favorites/:userId", (_req, res) => res.json({ success: true, favorites: [] }));
router.post("/favorites", (_req, res) => res.json({ success: true }));
router.delete("/favorites/:userId/:businessId", (_req, res) => res.json({ success: true }));

// ─── Levels stub ──────────────────────────────────────────────────────────────
router.get("/levels/my-level", (_req, res) => res.json({ success: true, level: null }));

// ─── Core route modules ───────────────────────────────────────────────────────
router.use("/auth",                  authRoutes);
router.use("/businesses",            businessRoutes);
router.use("/business",              businessRoutes);
router.use("/orders",                orderRoutes);
router.use("/users",                 userRoutes);
router.use("/user",                  userRoutes);
router.use("/delivery",              deliveryConfigRoutes);
router.use("/delivery",              deliveryRoutes);
router.use("/delivery",              deliveryRoutesLegacy);
router.use("/payments",              paymentRoutes);
router.use("/digital-payments",      digitalPaymentRoutes);
router.use("/payment-accounts",      paymentAccountsRoutes);
router.use("/fund-release",          fundReleaseRoutes);
router.use("/payouts",               payoutRoutes);
router.use("/wallet",                walletRoutes);
router.use("/wallet",                walletRoutesV2);
router.use("/bank-account",          bankAccountRoutes);
router.use("/admin",                 adminRoutes);
router.use("/admin/finance",         adminFinanceRoutes);
router.use("/admin",                 adminExchangeRateRoutes);
router.use("/support",               supportRoutes);
router.use("/withdrawals",           withdrawalRoutes);
router.use("/cash-settlement",       cashSettlementRoutes);
router.use("/weekly-settlement",     weeklySettlementRoutes);
router.use("/audit",                 financialAuditRoutes);
router.use("/favorites",             favoritesRoutes);
router.use("/business-verification", businessVerificationRoutes);
router.use("/gps",                   gpsRoutes);
router.use("/search",                searchRoutes);
router.use("/coupons",               couponRoutes);
router.use("/loyalty",               loyaltyRoutes);
router.use("/favorites",             favoritesRoutesV2);
router.use("/scheduled-orders",      scheduledOrdersRoutes);
router.use("/ai",                    aiRecommendationsRoutes);
router.use("/support",               supportRoutesV2);
router.use("/tracking",              enhancedTrackingRoutes);
router.use("/subscriptions",        subscriptionRoutes);
router.use("/smart-notifications",  smartNotificationRoutes);
router.use("/reviews",              enhancedReviewsRoutes);
router.use("/analytics",            businessAnalyticsRoutes);
router.use("/group-orders",         groupOrdersRoutes);
router.use("/gamification",         gamificationRoutes);
router.use("/gift-cards",           giftCardsRoutes);
router.use("/orders",               orderChatRoutes);
router.use("/stripe",               stripePaymentRoutes);
router.use("/connect",              stripeConnectRoutes);
router.use("/business/stripe",      stripeConnectRoutes);
router.use("/pickup",               pickupRoutes);
router.use("/registration",        registrationRoutes);
router.use("/admin/business-categories", businessCategoriesRoutes);
router.use("/business-categories",       businessCategoriesRoutes);

export default router;
