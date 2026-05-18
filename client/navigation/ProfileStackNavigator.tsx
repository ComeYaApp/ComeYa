import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CustomerProfileScreen from "@/screens/CustomerProfileScreen";
import BusinessProfileScreen from "@/screens/BusinessProfileScreen";
import DeliveryProfileScreen from "@/screens/DeliveryProfileScreen";
import AdminProfileScreen from "@/screens/AdminProfileScreen";
import { useAuth } from "@/contexts/AuthContext";

import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import AddAddressScreen from "@/screens/AddAddressScreen";
import LocationPickerScreen from "@/screens/LocationPickerScreen";
import PaymentMethodsScreen from "@/screens/PaymentMethodsScreen";
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

// Wrapper component that renders the correct profile screen based on user role
function RoleBasedProfile() {
  const { user } = useAuth();
  
  switch (user?.role) {
    case "business_owner":
      return <BusinessProfileScreen />;
    case "delivery_driver":
      return <DeliveryProfileScreen />;
    case "admin":
    case "super_admin":
      return <AdminProfileScreen />;
    case "customer":
    default:
      return <CustomerProfileScreen />;
  }
}

export type ProfileStackParamList = {
  Profile: undefined;
  SavedAddresses: undefined;
  AddAddress: { address?: any; fromCheckout?: boolean } | undefined;
  LocationPicker: {
    onLocationSelected: (coords: { latitude: number; longitude: number }, address: string) => void;
  };
  PaymentMethods: undefined;
  Terms: undefined;
  Privacy: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
<Stack.Screen
        name="Profile"
        component={RoleBasedProfile}
        options={{
          headerTitle: "Mi Perfil",
        }}
      />
      <Stack.Screen
        name="SavedAddresses"
        component={SavedAddressesScreen}
        options={{ headerTitle: "Direcciones Guardadas" }}
      />
      <Stack.Screen
        name="AddAddress"
        component={AddAddressScreen}
        options={{ headerTitle: "Agregar Dirección" }}
      />
      <Stack.Screen
        name="LocationPicker"
        component={LocationPickerScreen}
        options={{ headerTitle: "Seleccionar Ubicación" }}
      />
      <Stack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{ headerTitle: "Métodos de Pago", headerShown: false }}
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
    </Stack.Navigator>
  );
}
