import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import OrdersStackNavigator from "@/navigation/OrdersStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import BusinessMapScreen from "@/screens/BusinessMapScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen.web";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors } from "@/constants/theme";

const MapStack = createNativeStackNavigator();
function MapStackNavigator() {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="BusinessMapMain" component={BusinessMapScreen} />
    </MapStack.Navigator>
  );
}

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  DashboardTab: undefined;
  FinanceTab: undefined;
  MapTab: undefined;
  AdminTab: undefined;
  ProfileTab: undefined;
  BusinessTab: undefined;
  DeliveryTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isAdmin    = user?.role === "admin" || user?.role === "super_admin";
  const isBusiness = user?.role === "business_owner";
  const isDelivery = user?.role === "delivery_driver";
  const isCustomer = !isAdmin && !isBusiness && !isDelivery;

  // ── Admin en web: pantalla completa con sidebar, sin bottom tabs ──
  if (isAdmin) {
    return <AdminDashboardScreen />;
  }

  return (
    <Tab.Navigator
      initialRouteName={isDelivery ? "DeliveryTab" : isBusiness ? "BusinessTab" : "HomeTab"}
      screenOptions={{
        tabBarActiveTintColor: ComeYaColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
      {isCustomer && (
        <>
          <Tab.Screen name="HomeTab" component={HomeStackNavigator}
            options={{ title: "Inicio", tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }} />
          <Tab.Screen name="OrdersTab" component={OrdersStackNavigator}
            options={{ title: "Pedidos", tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} /> }} />
          <Tab.Screen name="MapTab" component={MapStackNavigator}
            options={{ title: "Mapa", tabBarIcon: ({ color, size }) => <Feather name="map-pin" size={size} color={color} /> }} />
        </>
      )}
      {isBusiness && (
        <Tab.Screen name="BusinessTab" component={BusinessDashboardScreen}
          options={{ title: "Mi Negocio", tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} /> }} />
      )}
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator}
        options={{ title: "Perfil", tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}
