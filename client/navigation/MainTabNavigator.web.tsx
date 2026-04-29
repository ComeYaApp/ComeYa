import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeStackNavigator    from "@/navigation/HomeStackNavigator";
import OrdersStackNavigator  from "@/navigation/OrdersStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import BusinessMapScreen     from "@/screens/BusinessMapScreen";
import AdminDashboardScreen   from "@/screens/AdminDashboardScreen.web";
import AdminMapScreen         from "@/screens/AdminMapScreen.web";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import DriverDashboardScreen  from "@/screens/DriverDashboardScreen.web";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing } from "@/constants/theme";

// Navigators móviles nativos (para móvil web)
import BusinessTabNavigator from "@/navigation/BusinessTabNavigator";
import DriverTabNavigator   from "@/navigation/DriverTabNavigator";
import MainTabNavigatorMobile from "@/navigation/MainTabNavigator";

const MOBILE_BREAKPOINT = 768;

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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isAdmin    = user?.role === "admin" || user?.role === "super_admin";
  const isBusiness = user?.role === "business_owner";
  const isDelivery = user?.role === "delivery_driver";

  // En móvil web (< 768px) usar los navigators nativos con bottom tabs
  // que ya están optimizados para pantallas pequeñas
  if (width < MOBILE_BREAKPOINT) {
    if (isAdmin)    return <MainTabNavigatorMobile />;
    if (isBusiness) return <BusinessTabNavigator />;
    if (isDelivery) return <DriverTabNavigator />;
    return <MainTabNavigatorMobile />;
  }

  const isCustomer = !isAdmin && !isBusiness && !isDelivery;

  const tabBarHeight = 64 + Math.max(insets.bottom, 8);

  const tabBarStyle = {
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: tabBarHeight,
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: Spacing.xs,
  };

  return (
    <Tab.Navigator
      initialRouteName={isAdmin ? "DashboardTab" : isDelivery ? "DeliveryTab" : isBusiness ? "BusinessTab" : "HomeTab"}
      screenOptions={{
        tabBarActiveTintColor: ComeYaColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
      {/* ── ADMIN ── Dashboard con sidebar completo + Mapa GPS + Perfil */}
      {isAdmin && (
        <>
          <Tab.Screen
            name="DashboardTab"
            component={AdminDashboardScreen}
            options={{
              title: "Panel Admin",
              tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={AdminMapScreen}
            options={{
              title: "Mapa GPS",
              tabBarIcon: ({ color, size }) => <Feather name="map" size={size} color={color} />,
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileStackNavigator}
            options={{
              title: "Perfil",
              tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
            }}
          />
        </>
      )}

      {/* ── CLIENTE ── */}
      {isCustomer && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStackNavigator}
            options={{
              title: "Inicio",
              tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
            }}
          />
          <Tab.Screen
            name="OrdersTab"
            component={OrdersStackNavigator}
            options={{
              title: "Pedidos",
              tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={MapStackNavigator}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => <Feather name="map-pin" size={size} color={color} />,
            }}
          />
        </>
      )}

      {/* ── REPARTIDOR ── Dashboard con sidebar completo */}
      {isDelivery && (
        <Tab.Screen
          name="DeliveryTab"
          component={DriverDashboardScreen}
          options={{
            title: "Panel Repartidor",
            tabBarIcon: ({ color, size }) => <Feather name="truck" size={size} color={color} />,
          }}
        />
      )}

      {/* ── NEGOCIO ── */}
      {isBusiness && (
        <Tab.Screen
          name="BusinessTab"
          component={BusinessDashboardScreen}
          options={{
            title: "Mi Negocio",
            tabBarIcon: ({ color, size }) => <Feather name="briefcase" size={size} color={color} />,
          }}
        />
      )}

      {/* ── PERFIL (clientes y negocios) ── */}
      {!isAdmin && !isDelivery && (
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          }}
        />
      )}
    </Tab.Navigator>
  );
}
