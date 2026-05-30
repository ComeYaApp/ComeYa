import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreenWeb from "@/screens/ProfileScreen.web";
import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import AddAddressScreen from "@/screens/AddAddressScreen";
import LocationPickerScreen from "@/screens/LocationPickerScreen";
import PaymentWalletSetupScreen from "@/screens/PaymentWalletSetupScreen";
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
// Pantallas de negocio para acceso desde perfil
import BusinessHoursScreenWeb from "@/screens/BusinessHoursScreen.web";
import BusinessDashboardScreenWeb from "@/screens/BusinessDashboardScreen.web";
import BusinessOrdersScreenWeb from "@/screens/BusinessOrdersScreen.web";
import BusinessProductsScreenWeb from "@/screens/BusinessProductsScreen.web";
import BusinessStatsScreenWeb from "@/screens/BusinessStatsScreen.web";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigatorWeb() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreenWeb} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
      <Stack.Screen
        name="PaymentWalletSetup"
        component={PaymentWalletSetupScreen}
      />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      {/* Pantallas de negocio accesibles desde perfil */}
      <Stack.Screen name="BusinessHours" component={BusinessHoursScreenWeb} />
      <Stack.Screen name="BusinessOrders" component={BusinessOrdersScreenWeb} />
      <Stack.Screen
        name="BusinessProducts"
        component={BusinessProductsScreenWeb}
      />
      <Stack.Screen name="BusinessStats" component={BusinessStatsScreenWeb} />
      <Stack.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreenWeb}
      />
      <Stack.Screen
        name="MyBusinesses"
        component={BusinessDashboardScreenWeb}
      />
      <Stack.Screen
        name="BusinessManage"
        component={BusinessDashboardScreenWeb}
      />
    </Stack.Navigator>
  );
}
