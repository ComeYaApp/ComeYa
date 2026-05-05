import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreenWeb from "@/screens/ProfileScreen.web";
import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import AddAddressScreen from "@/screens/AddAddressScreen";
import LocationPickerScreen from "@/screens/LocationPickerScreen";
import PaymentWalletSetupScreen from "@/screens/PaymentWalletSetupScreen";
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigatorWeb() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain"     component={ProfileScreenWeb} />
      <Stack.Screen name="SavedAddresses"  component={SavedAddressesScreen} />
      <Stack.Screen name="AddAddress"      component={AddAddressScreen} />
      <Stack.Screen name="LocationPicker"  component={LocationPickerScreen} />
      <Stack.Screen name="PaymentWalletSetup" component={PaymentWalletSetupScreen} />
      <Stack.Screen name="Terms"           component={TermsScreen} />
      <Stack.Screen name="Privacy"         component={PrivacyScreen} />
    </Stack.Navigator>
  );
}
