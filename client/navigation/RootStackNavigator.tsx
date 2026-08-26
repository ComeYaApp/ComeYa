import React, { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform, Linking } from "react-native";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import MainTabNavigatorWeb from "@/navigation/MainTabNavigator.web";
import BusinessTabNavigator from "@/navigation/BusinessTabNavigator";
import DriverTabNavigator from "@/navigation/DriverTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import VerifyPhoneScreen from "@/screens/VerifyPhoneScreen";
import BusinessDetailScreen from "@/screens/BusinessDetailScreen";
import DeleteAccountScreen from "@/screens/DeleteAccountScreen";
import ProductDetailScreen from "@/screens/ProductDetailScreen";
import CartScreen from "@/screens/CartScreen";
import CheckoutScreen from "@/screens/CheckoutScreen";
import OrderTrackingScreen from "@/screens/OrderTrackingScreen";
import CarnivalScreen from "@/screens/CarnivalScreen";
import MarketsScreen from "@/screens/MarketsScreen";
import BusinessListScreen from "@/screens/BusinessListScreen";
import PaymentMethodsScreen from "@/screens/PaymentMethodsScreen";
import PaymentWalletSetupScreen from "@/screens/PaymentWalletSetupScreen";
import SupportScreen from "@/screens/SupportScreen";
import ReviewScreen from "@/screens/ReviewScreenEnhanced";
import LegalScreen from "@/screens/LegalScreen";
import ScheduleOrderScreen from "@/screens/ScheduleOrderScreen";
import DeliveryEarningsScreen from "@/screens/DeliveryEarningsScreen";
import LogisticsRequestScreen from "@/screens/LogisticsRequestScreen";
import BusinessManageScreen from "@/screens/BusinessManageScreen";
import BusinessStatsScreen from "@/screens/BusinessStatsScreen";
import BusinessOrdersScreen from "@/screens/BusinessOrdersScreen";
import BusinessProductsScreen from "@/screens/BusinessProductsScreen";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import BusinessHoursScreen from "@/screens/BusinessHoursScreen";
import BusinessCategoriesScreen from "@/screens/BusinessCategoriesScreen";
import MyBusinessesScreen from "@/screens/MyBusinessesScreen";
import BusinessStripeSetupScreen from "@/screens/BusinessStripeSetupScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

import GamificationScreen from "@/screens/GamificationScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import GiftCardsScreen from "@/screens/GiftCardsScreen";
import ScheduledOrdersScreen from "@/screens/ScheduledOrdersScreen";
import NotificationPreferencesScreen from "@/screens/NotificationPreferencesScreen";
import ReferralScreen from "@/screens/ReferralScreen";
import AddressesScreen from "@/screens/AddressesScreen";
import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import AddAddressScreen from "@/screens/AddAddressScreen";
import SupportChatScreen from "@/screens/SupportChatScreen";
import TicketDetailScreen from "@/screens/TicketDetailScreen";
import WalletScreen from "@/screens/WalletScreen";
import ReportIssueScreen from "@/screens/ReportIssueScreen";
import OrderConfirmationScreen from "@/screens/OrderConfirmationScreen";
import BusinessMapScreen from "@/screens/BusinessMapScreen";
import BusinessDeliveryMapScreen from "@/screens/BusinessDeliveryMapScreen";
import BecomeDriverScreen from "@/screens/BecomeDriverScreen";
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import DigitalPaymentMethodScreen from "@/screens/DigitalPaymentMethodScreen";
import PaymentWebViewScreen from "@/screens/PaymentWebViewScreen";
import AdminPaymentAccountsScreen from "@/screens/AdminPaymentAccountsScreen";
import AdminStripeSetupScreen from "@/screens/AdminStripeSetupScreen";
import PaymentProofScreen from "@/screens/PaymentProofScreen";
import DeliveryConfirmationScreen from "@/screens/DeliveryConfirmationScreen";
import QRScannerScreen from "@/screens/QRScannerScreen";
import PickupScannerScreen from "@/screens/PickupScannerScreen";
import StripePaymentScreen from "@/screens/StripePaymentScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import LocationPickerScreen from "@/screens/LocationPickerScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import ChangePhoneEmailScreen from "@/screens/ChangePhoneEmailScreen";
import DriverNavigationScreen from "@/screens/DriverNavigationScreen";
import RouteOptimizationScreen from "@/screens/RouteOptimizationScreen";
import PublicTrackingScreen from "@/screens/PublicTrackingScreen";
import DriverMyDeliveriesScreen from "@/screens/DriverMyDeliveriesScreen";
import StripeSetupScreen from "@/screens/StripeSetupScreen";

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Signup: { phone?: string } | undefined;
  VerifyPhone: { phone: string };
  BusinessDetail: { businessId: string };
  ProductDetail: {
    productId: string;
    businessId: string;
    businessName: string;
    product?: import("@/types").Product;
  };
  Cart: undefined;
  Checkout:
    | {
        orderId?: string;
        subtotalWithMarkup?: number;
        calculatedDeliveryFee?: number;
        addressRefreshToken?: number;
        selectedAddressId?: string;
        selectedPaymentMethod?: any;
        orderType?: "delivery" | "pickup";
      }
    | undefined;
  OrderTracking: { orderId: string };
  Carnival: undefined;
  Markets: undefined;
  BusinessList: undefined;
  PaymentMethods: undefined;
  PaymentWalletSetup: undefined;
  BusinessStripeSetup: undefined;
  Support: undefined;
  Review: {
    orderId: string;
    businessId: string;
    businessName: string;
    deliveryPersonId?: string;
    // La propina solo se ofrece al confirmar la entrega (el repartidor
    // acaba de entregar); valorar más tarde no incluye propina.
    allowTip?: boolean;
  };
  Legal: { type: "terms" | "privacy" | "refund" };
  ScheduleOrder: {
    businessId: string;
    businessName: string;
    items: any[];
    subtotal: number;
  };
  DeliveryEarnings: undefined;
  BusinessManage: undefined;
  BusinessStats: undefined;
  BusinessOrders: undefined;
  BusinessProducts: undefined;
  BusinessDashboard: undefined;
  EditProfile: undefined;
  Profile: undefined;
  ChangePassword: undefined;
  ChangePhoneEmail: undefined;
  Gamification: undefined;
  Subscriptions: undefined;
  GiftCards: undefined;
  ScheduledOrders: undefined;
  NotificationPreferences: undefined;
  Referral: undefined;
  Addresses: undefined;
  SavedAddresses: undefined;
  AddAddress: { address?: any; fromCheckout?: boolean } | undefined;
  AddBankAccount: undefined;
  LocationPicker: {
    onLocationSelected?: (coords: any, address: string) => void;
  };
  SupportChat: undefined;
  Wallet: undefined;
  ReportIssue: { orderId: string; orderNumber?: string };
  TicketDetail: { ticketId: string };
  OrderConfirmation: { orderId: string; regretPeriodEndsAt: string };
  DigitalPaymentMethod: { orderTotal: number };
  PaymentProof: {
    orderId: string;
    amount: number;
    paymentMethod: string;
    subscriptionId?: string;
  };
  StripePayment: {
    orderId: string;
    amount: number;
    subtotal: number;
    deliveryFee: number;
    businessId: string;
    isSubscription?: boolean;
    subscriptionId?: string;
  };
  AdminPaymentAccounts: undefined;
  AdminStripeSetup: undefined;
  PaymentWebView: { orderId: string; paymentUrl: string; provider: string };
  DeliveryConfirmation: { orderId: string; orderDetails: any };
  BusinessDeliveryMap: undefined;
  BusinessMap: undefined;
  BecomeDriver: undefined;
  BusinessHours: undefined;
  BusinessCategories: undefined;
  MyBusinesses:
    | {
        openAddModal?: boolean;
        draft?: {
          name?: string;
          type?: string;
          address?: string;
          phone?: string;
        };
      }
    | undefined;
  Terms: undefined;
  Privacy: undefined;
  QRScanner: undefined;
  PickupScanner: undefined;
  DriverNavigation: {
    destLat: number;
    destLng: number;
    destAddress: string;
    travelMode?: "driving" | "walking";
  };
  RouteOptimization: undefined;
  PublicTracking: { token: string };
  DriverDeliveries: undefined;
  StripeSetup: undefined;
  LogisticsRequest: undefined;
  DeleteAccount: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigationRef = useRef<any>(null);

  // Ref siempre actualizada para el handler de deep links (evita closures
  // obsoletos de isAuthenticated)
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  // Cuando isAuthenticated cambia a true (login exitoso), resetear a Main
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        const { resetToMain } = require("@/navigation/navigationRef");
        resetToMain();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  // Deep link handler
  useEffect(() => {
    const handleURL = (event?: { url?: string }) => {
      const incomingUrl = event?.url || (
        typeof window !== "undefined" && window.location?.href ? window.location.href : ""
      );
      if (!incomingUrl) return;
      try {
        const url = new URL(incomingUrl);
        const path = url.pathname.replace(/^\/+/, "");

        // Stripe Connect: al completar el onboarding, volver a Métodos de pago
        if (path.startsWith("stripe-connect")) {
          const { navigationRef: navRef } = require("@/navigation/navigationRef");
          if (isAuthRef.current && navRef?.isReady()) {
            navRef.navigate("PaymentWalletSetup" as never);
          }
          return;
        }

        // Enlace de referido: app.comeya.es?ref=CODIGO (web) o comeya://ref/CODIGO
        const ref =
          url.searchParams.get("ref") ||
          (url.pathname.match(/\/ref\/([^/?]+)/) || [])[1] ||
          "";
        if (ref) {
          const { setPendingReferral } = require("@/lib/referral");
          setPendingReferral(ref.toUpperCase());
        }
      } catch {
        /* URL no válida: ignorar */
      }
    };

    // Solo en web: verificar URL inicial
    if (typeof window !== "undefined" && window.location?.href) {
      handleURL();
    }

    const subscription = Linking.addEventListener("url", handleURL);
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleURL({ url: initialUrl });
    });

    return () => subscription.remove();
  }, []);

  if (isLoading) return null;

  const isBusinessOwner = user?.role === "business_owner";
  const isDeliveryDriver = user?.role === "delivery_driver";

  const getMainNavigator = () => {
    if (Platform.OS === "web") return MainTabNavigatorWeb;
    if (isBusinessOwner) return BusinessTabNavigator;
    if (isDeliveryDriver) return DriverTabNavigator;
    return MainTabNavigator;
  };

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="Main">
      <Stack.Screen name="Main" component={getMainNavigator()} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="Carnival" component={CarnivalScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Markets" component={MarketsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessList" component={BusinessListScreen} options={{ headerShown: false }} />

      {isAuthenticated && (
        <>
          <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ headerTitle: "Métodos de pago" }} />
          <Stack.Screen name="PaymentWalletSetup" component={PaymentWalletSetupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessStripeSetup" component={BusinessStripeSetupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ScheduleOrder" component={ScheduleOrderScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AddBankAccount" component={PaymentWalletSetupScreen} options={{ headerTitle: "Métodos de pago" }} />
          <Stack.Screen name="DeliveryEarnings" component={DeliveryEarningsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessManage" component={BusinessManageScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessStats" component={BusinessStatsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessOrders" component={BusinessOrdersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessProducts" component={BusinessProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessDashboard" component={BusinessDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Gamification" component={GamificationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Subscriptions" component={SubscriptionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GiftCards" component={GiftCardsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ScheduledOrders" component={ScheduledOrdersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ headerTitle: "Notificaciones" }} />
          <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerTitle: "Editar perfil" }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerTitle: "Cambiar contraseña" }} />
          <Stack.Screen name="ChangePhoneEmail" component={ChangePhoneEmailScreen} options={{ headerTitle: "Cambiar teléfono/correo" }} />
          <Stack.Screen name="Profile" component={ProfileStackNavigator} options={{ headerTitle: "Mi perfil" }} />
          <Stack.Screen name="Addresses" component={AddressesScreen} options={{ headerTitle: "Mis direcciones" }} />
          <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} options={{ headerTitle: "Direcciones guardadas" }} />
          <Stack.Screen name="AddAddress" component={AddAddressScreen} options={{ headerTitle: "Agregar dirección" }} />
          <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ headerTitle: "Seleccionar ubicación" }} />
          <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ headerTitle: "Soporte" }} />
          <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ headerTitle: "Mi incidencia" }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReportIssue" component={ReportIssueScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessDeliveryMap" component={BusinessDeliveryMapScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessMap" component={BusinessMapScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BecomeDriver" component={BecomeDriverScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BusinessHours" component={BusinessHoursScreen} options={{ headerTitle: "Horarios" }} />
          <Stack.Screen name="BusinessCategories" component={BusinessCategoriesScreen} options={{ headerTitle: "Categorías" }} />
          <Stack.Screen name="MyBusinesses" component={MyBusinessesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DigitalPaymentMethod" component={DigitalPaymentMethodScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentProof" component={PaymentProofScreen} options={{ headerShown: false }} />
          <Stack.Screen name="StripePayment" component={StripePaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminPaymentAccounts" component={AdminPaymentAccountsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminStripeSetup" component={AdminStripeSetupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DeliveryConfirmation" component={DeliveryConfirmationScreen} options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="PickupScanner" component={PickupScannerScreen} options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="DriverNavigation" component={DriverNavigationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RouteOptimization" component={RouteOptimizationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PublicTracking" component={PublicTrackingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DriverDeliveries" component={DriverMyDeliveriesScreen} options={{ headerTitle: "Mis entregas" }} />
          <Stack.Screen name="StripeSetup" component={StripeSetupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="LogisticsRequest" component={LogisticsRequestScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}