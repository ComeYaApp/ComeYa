import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import BusinessOrdersScreen from "@/screens/BusinessOrdersScreen";
import BusinessProductsScreen from "@/screens/BusinessProductsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import MyBusinessesScreen from "@/screens/MyBusinessesScreen";
import BusinessManageScreen from "@/screens/BusinessManageScreen";
import BusinessHoursScreen from "@/screens/BusinessHoursScreen";
import BusinessAnalyticsScreen from "@/screens/BusinessAnalyticsScreen";
import BusinessStatsScreen from "@/screens/BusinessStatsScreen";
import BusinessFinancesScreen from "@/screens/BusinessFinancesScreen";
import BusinessDeliveryMapScreen from "@/screens/BusinessDeliveryMapScreen";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "@/constants/theme";

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

// Stack interno para "Más" — mantiene el tab bar visible en todas las sub-pantallas
function BusinessMoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="BusinessMoreHome" component={MyBusinessesScreen} />
      <MoreStack.Screen name="BusinessManage" component={BusinessManageScreen} />
      <MoreStack.Screen name="BusinessHours" component={BusinessHoursScreen} />
      <MoreStack.Screen name="BusinessAnalytics" component={BusinessAnalyticsScreen} />
      <MoreStack.Screen name="BusinessStats" component={BusinessStatsScreen} />
      <MoreStack.Screen name="BusinessFinances" component={BusinessFinancesScreen} />
    </MoreStack.Navigator>
  );
}

export default function BusinessTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ComeYaColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreen}
        options={{
          title: "Mi Negocio",
          tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="BusinessOrders"
        component={BusinessOrdersScreen}
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
        }}
      />
<Tab.Screen
        name="BusinessProducts"
        component={BusinessProductsScreen}
        options={{
          title: "Productos",
          tabBarIcon: ({ color, size }) => <Feather name="package" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="BusinessGPS"
        component={BusinessDeliveryMapScreen}
        options={{
          title: "GPS",
          tabBarIcon: ({ color, size }) => <Feather name="map" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="BusinessMore"
        component={BusinessMoreStackNavigator}
        options={{
          title: "Gestión",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="BusinessProfile"
        component={ProfileScreen}
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
