import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import BusinessTabNavigator from "@/navigation/BusinessTabNavigator";
import DriverTabNavigator from "@/navigation/DriverTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import VerifyPhoneScreen from "@/screens/VerifyPhoneScreen";
import BusinessDetailScreen from "@/screens/BusinessDetailScreen";
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
import OrderChatScreen from "@/screens/OrderChatScreen";
import DeliveryEarningsScreen from "@/screens/DeliveryEarningsScreen";
import BusinessManageScreen from "@/screens/BusinessManageScreen";
import BusinessStatsScreen from "@/screens/BusinessStatsScreen";
import BusinessHoursScreen from "@/screens/BusinessHoursScreen";
import BusinessCategoriesScreen from "@/screens/BusinessCategoriesScreen";
import MyBusinessesScreen from "@/screens/MyBusinessesScreen";
import BusinessStripeSetupScreen from "@/screens/BusinessStripeSetupScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import AddressesScreen from "@/screens/AddressesScreen";
import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import AddAddressScreen from "@/screens/AddAddressScreen";
import AddBankAccountScreen from "@/screens/AddBankAccountScreen";
import SupportChatScreen from "@/screens/SupportChatScreen";
import WalletScreen from "@/screens/WalletScreen";
import ReportIssueScreen from "@/screens/ReportIssueScreen";
import OrderConfirmationScreen from "@/screens/OrderConfirmationScreen";
import BusinessMapScreen from "@/screens/BusinessMapScreen";
import BecomeDriverScreen from "@/screens/BecomeDriverScreen";
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import DigitalPaymentMethodScreen from "@/screens/DigitalPaymentMethodScreen";
import PaymentWebViewScreen from "@/screens/PaymentWebViewScreen";
import AdminPaymentAccountsScreen from "@/screens/AdminPaymentAccountsScreen";
import PaymentProofScreen from "@/screens/PaymentProofScreen";
import DeliveryConfirmationScreen from "@/screens/DeliveryConfirmationScreen";
import QRScannerScreen from "@/screens/QRScannerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

import LocationPickerScreen from "@/screens/LocationPickerScreen";

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
  };
  Cart: undefined;
  Checkout: {
    orderId?: string;
    subtotalWithMarkup?: number;
    calculatedDeliveryFee?: number;
    addressRefreshToken?: number;
    selectedAddressId?: string;
    selectedPaymentMethod?: any;
    orderType?: 'delivery' | 'pickup';
  } | undefined;
  OrderTracking: { orderId: string };
  Carnival: undefined;
  Markets: undefined;
  BusinessList: undefined;
  PaymentMethods: undefined;
  PaymentWalletSetup: undefined;
  Support: undefined;
  Review: {
    orderId: string;
    businessId: string;
    businessName: string;
    deliveryPersonId?: string;
  };
  Legal: { type: "terms" | "privacy" | "refund" };
  ScheduleOrder: {
    businessId: string;
    businessName: string;
    items: any[];
    subtotal: number;
  };
  OrderChat: { orderId: string; receiverId: string; receiverName: string };
  DeliveryEarnings: undefined;
  BusinessManage: undefined;
  BusinessStats: undefined;
  EditProfile: undefined;
  Addresses: undefined;
  SavedAddresses: undefined;
  AddAddress: { address?: any; fromCheckout?: boolean } | undefined;
  AddBankAccount: undefined;
  LocationPicker: { onLocationSelected?: (coords: any, address: string) => void };
  SupportChat: undefined;
  Wallet: undefined;
  ReportIssue: { orderId: string; orderNumber?: string };
  OrderConfirmation: { orderId: string; regretPeriodEndsAt: string };
  DigitalPaymentMethod: { orderTotal: number };
  PaymentProof: { orderId: string; amount: number; paymentMethod: string };
  AdminPaymentAccounts: undefined;
  PaymentWebView: { orderId: string; paymentUrl: string; provider: string };
  DeliveryConfirmation: { orderId: string; orderDetails: any };
  BusinessMap: undefined;
  BecomeDriver: undefined;
  BusinessHours: undefined;
  BusinessCategories: undefined;
  MyBusinesses: { openAddModal?: boolean; draft?: { name?: string; type?: string; address?: string; phone?: string } } | undefined;
  Terms: undefined;
  Privacy: undefined;
  QRScanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, pendingVerificationPhone, user } = useAuth();

  if (isLoading) {
    return null;
  }

  const isBusinessOwner = user?.role === "business_owner";
  const isDeliveryDriver = user?.role === "delivery_driver";

  const getMainNavigator = () => {
    if (isBusinessOwner) return BusinessTabNavigator;
    if (isDeliveryDriver) return DriverTabNavigator;
    return MainTabNavigator;
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={getMainNavigator()}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessDetail"
            component={BusinessDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OrderTracking"
            component={OrderTrackingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Carnival"
            component={CarnivalScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Markets"
            component={MarketsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessList"
            component={BusinessListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PaymentMethods"
            component={PaymentMethodsScreen}
            options={{ headerTitle: "Métodos de pago" }}
          />
          <Stack.Screen
            name="PaymentWalletSetup"
            component={PaymentWalletSetupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Support"
            component={SupportScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Review"
            component={ReviewScreen}
            options={{
              presentation: "modal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Legal"
            component={LegalScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ScheduleOrder"
            component={ScheduleOrderScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OrderChat"
            component={OrderChatScreen}
            options={{ headerTitle: "Chat" }}
          />
          <Stack.Screen
            name="AddBankAccount"
            component={AddBankAccountScreen}
            options={{ headerTitle: "Agregar Cuenta Bancaria" }}
          />
          <Stack.Screen
            name="DeliveryEarnings"
            component={DeliveryEarningsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessManage"
            component={BusinessManageScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessStats"
            component={BusinessStatsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerTitle: "Editar perfil" }}
          />
          <Stack.Screen
            name="Addresses"
            component={AddressesScreen}
            options={{ headerTitle: "Mis direcciones" }}
          />
          <Stack.Screen
            name="SavedAddresses"
            component={SavedAddressesScreen}
            options={{ headerTitle: "Direcciones guardadas" }}
          />
          <Stack.Screen
            name="AddAddress"
            component={AddAddressScreen}
            options={{ headerTitle: "Agregar dirección" }}
          />
          <Stack.Screen
            name="LocationPicker"
            component={LocationPickerScreen}
            options={{ headerTitle: "Seleccionar ubicación" }}
          />
          <Stack.Screen
            name="SupportChat"
            component={SupportChatScreen}
            options={{ headerTitle: "Soporte" }}
          />
          <Stack.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ReportIssue"
            component={ReportIssueScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OrderConfirmation"
            component={OrderConfirmationScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessMap"
            component={BusinessMapScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BecomeDriver"
            component={BecomeDriverScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BusinessHours"
            component={BusinessHoursScreen}
            options={{ headerTitle: "Horarios" }}
          />
          <Stack.Screen
            name="BusinessCategories"
            component={BusinessCategoriesScreen}
            options={{ headerTitle: "Categorías" }}
          />
          <Stack.Screen
            name="MyBusinesses"
            component={MyBusinessesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Terms"
            component={TermsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Privacy"
            component={PrivacyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="DigitalPaymentMethod"
            component={DigitalPaymentMethodScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PaymentProof"
            component={PaymentProofScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AdminPaymentAccounts"
            component={AdminPaymentAccountsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PaymentWebView"
            component={PaymentWebViewScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="DeliveryConfirmation"
            component={DeliveryConfirmationScreen}
            options={{ 
              presentation: "modal",
              headerShown: false 
            }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{ 
              presentation: "modal",
              headerShown: false 
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VerifyPhone"
            component={VerifyPhoneScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Carnival"
            component={CarnivalScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
