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
import FavoritesScreen from "@/screens/FavoritesScreen";
import BusinessFinancesScreen from "@/screens/BusinessFinancesScreen";
import MyReservationsScreen from "@/screens/MyReservationsScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigatorWeb() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreenWeb} />
      {/* Favoritos e Historial de pagos se navegaban desde la web, pero sus
          rutas solo existían en los navegadores NATIVOS (FavoritesStack y el
          stack del negocio), así que en web el botón no hacía nada. Estas dos
          pantallas no pintan su propia cabecera, así que aquí se activa. */}
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ headerShown: true, headerTitle: "Favoritos" }}
      />
      <Stack.Screen
        name="BusinessFinances"
        component={BusinessFinancesScreen}
      />
      {/* Mis reservas pinta su propia cabecera con flecha de volver */}
      <Stack.Screen name="MyReservations" component={MyReservationsScreen} />
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
