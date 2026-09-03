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

// ── Sentry: captura de errores JS Y crashes nativos (iOS/Android) ──────────
// Sin DSN configurado queda inerte (no rompe la app). Para activarlo:
//  1. Crea un proyecto React Native gratis en https://sentry.io
//  2. Copia el DSN a EXPO_PUBLIC_SENTRY_DSN (.env y EAS secrets)
//  3. Recompila: los crashes nativos aparecerán simbolizados en el panel
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/react-native");
    Sentry.init({
      dsn: SENTRY_DSN,
      // Rastrea el rendimiento de forma moderada (10% de transacciones)
      tracesSampleRate: 0.1,
      // Adjunta el contexto del dispositivo y las últimas acciones
      enableAutoSessionTracking: true,
      attachStacktrace: true,
      environment: __DEV__ ? "development" : "production",
    });
  } catch (e) {
    console.warn("Sentry no disponible:", e);
  }
}

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
        lightColor: "#E60000",
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

  // Al tocar una notificación (o abrir la app desde una), navegar al destino
  // indicado en data.screen. La pantalla explícita tiene PRIORIDAD sobre el
  // orderId: si no, un push de "incidencia reportada" con orderId abría el
  // seguimiento del pedido en vez del panel del admin (bug original).
  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | {
            screen?: string;
            orderId?: string;
            orderType?: string;
            section?: string;
            type?: string;
            ticketId?: string;
          }
        | undefined;
      if (!data) return;
      // navigationRef es un ref global: se navega con tipos relajados
      const nav = navigationRef as any;

      // Destinos del panel admin. En web navega por sección del sidebar;
      // en nativo abre el tab correspondiente de la app admin (AdminScreenNew)
      if (data.screen === "AdminDashboard" && data.section) {
        if (Platform.OS === "web") {
          nav.navigate("DashboardTab", { section: data.section });
        } else {
          const sectionToTab: Record<string, string> = {
            support_issues: "issues",
            finance_refunds: "refunds",
            support_tickets: "support",
            support_verifications: "verifications",
            orders_active: "orders",
            finance_earnings: "finance",
            finance_payouts: "finance",
          };
          const tab = sectionToTab[data.section];
          nav.navigate("AdminTab", tab ? { initialTab: tab } : undefined);
        }
        return;
      }

      const allowed = [
        "Orders",
        "Subscriptions",
        "DriverEarnings",
        "DriverMyDeliveries",
        "BusinessOrders",
        "Main",
        "TicketDetail",
        "OrderTracking",
        "Support",
        "SupportChat",
      ];
      if (data.screen && allowed.includes(data.screen)) {
        const params: any = {};
        if (data.orderId) params.orderId = data.orderId;
        if (data.ticketId) params.ticketId = data.ticketId;
        nav.navigate(data.screen, Object.keys(params).length ? params : undefined);
        return;
      }

      // Fallback: si solo hay orderId, al seguimiento del pedido
      if (data.orderId) {
        nav.navigate("OrderTracking", { orderId: data.orderId });
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

  // Web: abrir el panel admin en la sección correcta tras hacer clic en una
  // notificación del service worker (llega como query param).
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const params = new URLSearchParams(window.location.search);
    const section = params.get("admin_section");
    if (!section) return;

    // Esperar a que la navegación y la sesión estén listas
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (navigationRef.isReady?.()) {
        try {
          const raw = await AsyncStorage.getItem("@ComeYa_user");
          const user = raw ? JSON.parse(raw) : null;
          const isAdmin = user?.role === "admin" || user?.role === "super_admin";
          if (isAdmin) {
            (navigationRef as any).navigate("DashboardTab", { section });
            clearInterval(timer);
            // Limpiar el query param sin recargar
            window.history.replaceState({}, "", "/");
          }
        } catch {}
      }
      if (attempts > 20) clearInterval(timer); // ~10s y se rinde
    }, 500);

    return () => clearInterval(timer);
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
