import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

import OrdersScreen from "@/screens/OrdersScreen";
import OrderTrackingScreen from "@/screens/OrderTrackingScreen";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type OrdersStackParamList = {
  Orders: undefined;
  OrderTracking: { orderId: string };
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          headerTitle: "Mis Pedidos",
          headerRight: () => <ThemeToggleButton />,
        }}
      />
      <Stack.Screen
        name="OrderTracking"
        component={OrderTrackingScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
