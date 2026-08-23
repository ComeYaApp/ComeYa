import React, { useEffect, useState } from "react";
import { StyleSheet, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

// Deep links: el enlace de seguimiento compartido (/track/:token) abre la
// pantalla pública tanto en web como en la app móvil
const linking = {
  prefixes: [
    process.env.EXPO_PUBLIC_FRONTEND_URL,
    "https://app.comeya.es",
    process.env.EXPO_PUBLIC_BACKEND_URL,
    "comeya://",
  ].filter(Boolean) as string[],
  config: {
    screens: {
      PublicTracking: "track/:token",
    },
  },
};

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { navigationRef } from "@/navigation/navigationRef";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { CartProvider } from "@/contexts/CartContext";
import { AppProvider } from "@/contexts/AppContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { WebDialogProvider } from "@/hooks/useWebDialog";
import { StripeProvider } from "@/providers/StripeProvider";
import {
  OnboardingOverlay,
  checkOnboardingCompleted,
} from "@/components/OnboardingOverlay";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { useTheme } from "@/hooks/useTheme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [authCallbackHandled, setAuthCallbackHandled] = useState(false);

  // Detectar /auth-callback ANTES de que AuthContext cargue
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAuthCallbackHandled(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const role = params.get("role");
    if (token && role) {
      const refresh = params.get("refresh") || "";
      const name = params.get("name") || "";
      const userData = {
        token,
        refreshToken: refresh,
        role,
        name,
        phoneVerified: true,
        isActive: true,
      };
      Promise.all([
        AsyncStorage.setItem("@ComeYa_user", JSON.stringify(userData)),
        AsyncStorage.setItem("token", token),
        refresh
          ? AsyncStorage.setItem("refreshToken", refresh)
          : Promise.resolve(),
      ]).then(() => {
        window.location.replace("/");
      });
      // No hacer setAuthCallbackHandled(true) — dejamos que el replace recargue
    } else {
      setAuthCallbackHandled(true);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Android 8+: sin canal de notificaciones no se muestra nada
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Notificaciones",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#DC2626",
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await checkOnboardingCompleted();
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, []);

  // Al tocar una notificación (o abrir la app desde una), navegar a la
  // pantalla indicada en data.screen o, si hay orderId, al seguimiento.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | { screen?: string; orderId?: string; orderType?: string }
        | undefined;
      if (!data) return;
      // navigationRef es un ref global: se navega con tipos relajados
      if (data.orderId) {
        (navigationRef as any).navigate("OrderTracking", {
          orderId: data.orderId,
        });
        return;
      }
      const allowed = [
        "Orders",
        "Subscriptions",
        "DriverEarnings",
        "DriverMyDeliveries",
        "BusinessOrders",
        "Main",
      ];
      if (data.screen && allowed.includes(data.screen)) {
        (navigationRef as any).navigate(data.screen);
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(
      handleResponse,
    );
    // App abierta desde una notificación (arranque en frío)
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!authCallbackHandled) {
    return null; // Guardando token y recargando
  }

  if (!onboardingChecked) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <StripeProvider>
                <AppProvider>
                  <ToastProvider>
                    <WebDialogProvider>
                      <AuthProvider>
                        <BusinessProvider>
                          <CartProvider>
                            <AppThemedShell>
                              <RootStackNavigator />
                            </AppThemedShell>
                            {showOnboarding && (
                              <OnboardingOverlay
                                onComplete={() => setShowOnboarding(false)}
                              />
                            )}
                            <NotificationPermissionGate
                              active={!showOnboarding && onboardingChecked}
                            />
                          </CartProvider>
                        </BusinessProvider>
                      </AuthProvider>
                    </WebDialogProvider>
                  </ToastProvider>
                </AppProvider>
              </StripeProvider>
              <StatusBar style="auto" />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function NotificationPermissionGate({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const { registerPushToken } = useAuth();

  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    const check = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") setVisible(true);
    };
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <NotificationPermissionModal
      visible={visible}
      onAccept={async () => {
        setVisible(false);
        // registerPushToken pide el permiso, obtiene el token Expo y lo sube
        await registerPushToken();
      }}
      onDecline={() => setVisible(false)}
    />
  );
}

function AppThemedShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={isDark ? DarkTheme : DefaultTheme}
        linking={linking}
      >
        {children}
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
