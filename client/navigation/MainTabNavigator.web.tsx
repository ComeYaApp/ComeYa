import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import OrdersStackNavigator from "@/navigation/OrdersStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import ProfileStackNavigatorWeb from "@/navigation/ProfileStackNavigator.web";
import GuestProfileScreen from "@/screens/GuestProfileScreen";
import BusinessMapScreen from "@/screens/BusinessMapScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen.web";
import AdminMapScreen from "@/screens/AdminOpsCenterScreen.web";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import DriverDashboardScreen from "@/screens/DriverDashboardScreen.web";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing } from "@/constants/theme";

// Navigators móviles nativos (sin circular dependency — NO importar MainTabNavigator aquí)
import BusinessTabNavigator from "@/navigation/BusinessTabNavigator";
import DriverTabNavigator from "@/navigation/DriverTabNavigator";

// Pantallas móviles admin
import AdminDashboardScreenMobile from "@/screens/AdminDashboardScreen";
import AdminFinanceScreen from "@/screens/AdminFinanceScreen";
import AdminMapScreenMobile from "@/screens/AdminMapScreen";

// Pantallas web del business
import BusinessDashboardScreenWeb from "@/screens/BusinessDashboardScreen.web";
import BusinessOrdersScreenWeb from "@/screens/BusinessOrdersScreen.web";
import BusinessReservationsScreenWeb from "@/screens/BusinessReservationsScreen.web";
import BusinessProductsScreenWeb from "@/screens/BusinessProductsScreen.web";
import BusinessHoursScreenWeb from "@/screens/BusinessHoursScreen.web";
import BusinessStatsScreenWeb from "@/screens/BusinessStatsScreen.web";
import BusinessDeliveryMapScreen from "@/screens/BusinessDeliveryMapScreen.web";

import ProfileScreenWeb from "@/screens/ProfileScreen.web";

// Stack GPS del negocio
const BusinessMapStack = createNativeStackNavigator();
function BusinessMapStackNavigator() {
  return (
    <BusinessMapStack.Navigator screenOptions={{ headerShown: false }}>
      <BusinessMapStack.Screen
        name="BusinessDeliveryMapMain"
        component={BusinessDeliveryMapScreen}
      />
    </BusinessMapStack.Navigator>
  );
}

const MOBILE_BREAKPOINT = 768;

const MapStack = createNativeStackNavigator();
function MapStackNavigator() {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="BusinessMapMain" component={BusinessMapScreen} />
    </MapStack.Navigator>
  );
}

const BusinessStack = createNativeStackNavigator();
function BusinessStackNavigator() {
  return (
    <BusinessStack.Navigator screenOptions={{ headerShown: false }}>
      <BusinessStack.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessOrders"
        component={BusinessOrdersScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessReservations"
        component={BusinessReservationsScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessProducts"
        component={BusinessProductsScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessHours"
        component={BusinessHoursScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessStats"
        component={BusinessStatsScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessProfile"
        component={ProfileScreenWeb}
      />
      <BusinessStack.Screen
        name="MyBusinesses"
        component={BusinessDashboardScreenWeb}
      />
      <BusinessStack.Screen
        name="BusinessManage"
        component={BusinessDashboardScreenWeb}
      />
    </BusinessStack.Navigator>
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

// ── Navigator móvil para admin y cliente (sin sidebar) ────────────────────────
function MobileTabNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isCustomer = !isAdmin && isAuthenticated;
  const isGuest = !isAuthenticated;

  const tabBarStyle = {
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    height: 56 + Math.max(insets.bottom, 8),
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: 4,
  };

  return (
    <Tab.Navigator
      initialRouteName={isAdmin ? "DashboardTab" : "HomeTab"}
      screenOptions={{
        tabBarActiveTintColor: ComeYaColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
      {/* Guest mode - browse without login */}
      {isGuest && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStackNavigator}
            options={{
              title: "Inicio",
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={MapStackNavigator}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map-pin" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={GuestProfileScreen}
            options={{
              title: "Cuenta",
              tabBarIcon: ({ color, size }) => (
                <Feather name="log-in" size={size} color={color} />
              ),
            }}
          />
        </>
      )}

      {isAdmin && (
        <>
          <Tab.Screen
            name="DashboardTab"
            component={AdminDashboardScreenMobile}
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color, size }) => (
                <Feather name="bar-chart-2" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="FinanceTab"
            component={AdminFinanceScreen}
            options={{
              title: "Finanzas",
              tabBarIcon: ({ color, size }) => (
                <Feather name="dollar-sign" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={AdminMapScreenMobile}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileStackNavigator}
            options={{
              title: "Perfil",
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" size={size} color={color} />
              ),
            }}
          />
        </>
      )}
      {isCustomer && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStackNavigator}
            options={{
              title: "Inicio",
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="OrdersTab"
            component={OrdersStackNavigator}
            options={{
              title: "Pedidos",
              tabBarIcon: ({ color, size }) => (
                <Feather name="shopping-bag" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={MapStackNavigator}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map-pin" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileStackNavigator}
            options={{
              title: "Perfil",
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" size={size} color={color} />
              ),
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
}

// ── Navigator principal ───────────────────────────────────────────────────────
export default function MainTabNavigator() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isBusiness = user?.role === "business_owner";
  const isDelivery = user?.role === "delivery_driver";
  const isCustomer = !isAdmin && !isBusiness && !isDelivery && isAuthenticated;
  const isGuest = !isAuthenticated;

  // ── Móvil web (< 768px): usar navigators nativos con bottom tabs ──
  if (width < MOBILE_BREAKPOINT) {
    if (isBusiness) return <BusinessTabNavigator />;
    if (isDelivery) return <DriverTabNavigator />;
    return <MobileTabNavigator />; // admin y cliente
  }

  // ── Desktop web (>= 768px): sidebars completos ──
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
      initialRouteName={
        isAdmin
          ? "DashboardTab"
          : isDelivery
            ? "DeliveryTab"
            : isBusiness
              ? "BusinessTab"
              : "HomeTab"
      }
      screenOptions={{
        tabBarActiveTintColor: ComeYaColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
      {/* Guest mode - browse without login */}
      {isGuest && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStackNavigator}
            options={{
              title: "Inicio",
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={MapStackNavigator}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map-pin" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={GuestProfileScreen}
            options={{
              title: "Cuenta",
              tabBarIcon: ({ color, size }) => (
                <Feather name="log-in" size={size} color={color} />
              ),
            }}
          />
        </>
      )}

      {isAdmin && (
        <>
          <Tab.Screen
            name="DashboardTab"
            component={AdminDashboardScreen}
            options={{
              title: "Panel Admin",
              tabBarIcon: ({ color, size }) => (
                <Feather name="bar-chart-2" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={AdminMapScreen}
            options={{
              title: "Mapa GPS",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileStackNavigator}
            options={{
              title: "Perfil",
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" size={size} color={color} />
              ),
            }}
          />
        </>
      )}

      {isCustomer && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStackNavigator}
            options={{
              title: "Inicio",
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="OrdersTab"
            component={OrdersStackNavigator}
            options={{
              title: "Pedidos",
              tabBarIcon: ({ color, size }) => (
                <Feather name="shopping-bag" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={MapStackNavigator}
            options={{
              title: "Mapa",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map-pin" size={size} color={color} />
              ),
            }}
          />
        </>
      )}

      {isDelivery && (
        <Tab.Screen
          name="DeliveryTab"
          component={DriverDashboardScreen}
          options={{
            title: "Panel Repartidor",
            tabBarIcon: ({ color, size }) => (
              <Feather name="truck" size={size} color={color} />
            ),
          }}
        />
      )}

      {isBusiness && (
        <>
          <Tab.Screen
            name="BusinessTab"
            component={BusinessStackNavigator}
            options={{
              title: "Mi Negocio",
              tabBarIcon: ({ color, size }) => (
                <Feather name="briefcase" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="MapTab"
            component={BusinessMapStackNavigator}
            options={{
              title: "Mapa GPS",
              tabBarIcon: ({ color, size }) => (
                <Feather name="map" size={size} color={color} />
              ),
            }}
          />
        </>
      )}

      {!isAdmin && !isDelivery && !isGuest && (
        <Tab.Screen
          name="ProfileTab"
          component={
            isBusiness ? ProfileStackNavigatorWeb : ProfileStackNavigator
          }
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}
