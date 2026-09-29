# Paridad web ↔ app · ComeYa

Generado por `node scripts/audit-web-parity.js`.

## 0. Estado de esta tanda (1.0.16 build 21)

Arreglado y verificado:

- **Inicio de la web** ya tiene los mismos botones que la app: *Explorar negocios* y *Ver mapa*, más las cuatro promos (VIP, tarjeta regalo, puntos, invita y gana). Comprobado en un navegador real: *Ver mapa* navega a `/BusinessMap`.
- **Enlaces muertos corregidos**: *Favoritos* (menú lateral) e *Historial de pagos* (perfil de negocio) navegaban a rutas que solo existían en los navegadores del móvil, así que no hacían nada. Ahora están registradas en el navegador web.
- **Reservas y finanzas con versión web propia**: `MyReservationsScreen`, `BusinessReservationsScreen` y `BusinessFinancesScreen` comparten el MISMO componente de pantalla en app y web (`*Content.tsx`), así que el flujo no puede divergir; en escritorio se envuelven con la barra y el menú lateral.
- **Menú lateral web** con acceso a *Reservas* (cliente y negocio) e *Historial de pagos*.
- **El mapa de la web funciona**: comprobado en producción (app.comeya.es), carga Google Maps con los 11 negocios. La clave web (`/api/config/maps-key`) está configurada.

Pendiente / siguiente prioridad:

- Las 10 pantallas de la sección 1 siguen usando módulos que solo existen en el móvil (cámara, ficheros, notificaciones, Stripe nativo). En web hay que darles un camino alternativo (o marcar el botón como no disponible en web, como ya se hace en Métodos de pago).
- Las pantallas de la sección 3 se ven en web con el diseño del móvil (funcionan, pero sin adaptar el ancho de escritorio).

## 1. Pantallas sin versión web que SÍ usan algo exclusivo del móvil

Son las que pueden romper o quedarse a medias en la web.

| Pantalla | Módulos nativos que usa |
|---|---|
| `AdminProfileScreen` | expo-image-picker |
| `BaseProfileScreen` | expo-notifications |
| `BillPaymentScreen` | @stripe/stripe-react-native |
| `BusinessFeesScreen` | expo-image-picker, @stripe/stripe-react-native |
| `BusinessProfileScreen` | expo-image-picker |
| `CarnivalScreen` | expo-notifications |
| `ComeYaPassScreen` | @stripe/stripe-react-native |
| `DeliveryProfileScreen` | expo-image-picker |
| `DriverMyDeliveriesScreen` | expo-image-picker |
| `PickupScannerScreen` | expo-camera |

## 2. Pantallas con versión web propia

66 de 114:

`AddAddressScreen`, `AddressesScreen`, `AdminDashboardScreen`, `AdminFinanceScreen`, `AdminMapScreen`, `AdminPaymentAccountsScreen`, `AdminScreenNew`, `BecomeDriverScreen`, `BusinessCategoriesScreen`, `BusinessDashboardScreen`, `BusinessDeliveryMapScreen`, `BusinessDetailScreen`, `BusinessFinancesScreen`, `BusinessHoursScreen`, `BusinessListScreen`, `BusinessManageScreen`, `BusinessMapScreen`, `BusinessOrdersScreen`, `BusinessProductsScreen`, `BusinessReservationsScreen`, `BusinessStatsScreen`, `BusinessStripeSetupScreen`, `CartScreen`, `CheckoutScreen`, `DeliveryConfigScreen`, `DeliveryConfirmationScreen`, `DeliveryEarningsScreen`, `DigitalPaymentMethodScreen`, `DriverMapScreen`, `DriverNavigationScreen`, `EditProfileScreen`, `GamificationScreen`, `GiftCardsScreen`, `HomeScreen`, `LegalScreen`, `LocationPickerScreen`, `LoginScreen`, `MarketsScreen`, `MyBusinessesScreen`, `MyReservationsScreen`, `OrderConfirmationScreen`, `OrderTrackingScreen`, `OrdersScreen`, `PaymentMethodsScreen`, `PaymentProofScreen`, `PaymentWalletSetupScreen`, `PaymentWebViewScreen`, `PrivacyScreen`, `ProductDetailScreen`, `ProfileScreen`, `PublicTrackingScreen`, `QRScannerScreen`, `ReportIssueScreen`, `ReviewScreenEnhanced`, `RouteOptimizationScreen`, `SavedAddressesScreen`, `ScheduleOrderScreen`, `ScheduledOrdersScreen`, `SignupScreen`, `StripePaymentScreen`, `SubscriptionScreen`, `SupportChatScreen`, `SupportScreen`, `TermsScreen`, `VerifyPhoneScreen`, `WalletScreen`

## 3. Pantallas que usan la versión nativa también en web

38 de 114 (funcionan en web tal cual, sin adaptar el diseño):

`AIRecommendationsScreen`, `AdminBankAccountScreen`, `AdminExchangeRateScreen`, `AdminSettlementsScreen`, `AdminStripeSetupScreen`, `AdvancedMarketplaceScreen`, `AuthCallbackScreen`, `BusinessAnalyticsScreen`, `BusinessIntelligenceScreen`, `BusinessReservationsSettingsScreen`, `CashSettlementScreen`, `ChangePasswordScreen`, `ChangePhoneEmailScreen`, `ComeYaPlanScreen`, `CustomerProfileScreen`, `DeleteAccountScreen`, `DriverAvailableOrdersScreen`, `DriverEarningsScreen`, `DynamicPricingScreen`, `EnhancedWalletScreen`, `FavoritesScreen`, `FinTechScreen`, `GuestProfileScreen`, `JoinReservationScreen`, `LogisticsRequestScreen`, `LoyaltyProgramScreen`, `LoyaltyScreen`, `NotificationPreferencesScreen`, `OfflineSettingsScreen`, `ReferralScreen`, `ReviewScreen`, `SocialFeaturesScreen`, `StripeSetupScreen`, `SubscriptionConditionsScreen`, `SuperAppScreen`, `TicketDetailScreen`, `VerifyEmailScreen`, `WeeklySettlementScreen`

## 4. Rutas navegables que NO están registradas en los navegadores web

Si algún botón navega a una de estas desde la web, la acción se descarta en silencio.

_Todas registradas._
