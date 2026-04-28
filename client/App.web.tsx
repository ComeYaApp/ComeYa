import React, { useEffect, useState } from "react";
import { StyleSheet, View, Dimensions, Text, Pressable } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { Feather } from "@expo/vector-icons";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { CartProvider } from "@/contexts/CartContext";
import { AppProvider } from "@/contexts/AppContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { StripeProvider } from "@/providers/StripeProvider";
import { OnboardingOverlay, checkOnboardingCompleted } from "@/components/OnboardingOverlay";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { useTheme } from "@/hooks/useTheme";

SplashScreen.preventAutoHideAsync();

const PRIMARY = "#FF6B35";
const PRIMARY_DARK = "#E55A25";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get("window").width);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setWindowWidth(window.width));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const check = async () => {
      const completed = await checkOnboardingCompleted();
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    };
    check();
  }, []);

  if (!fontsLoaded && !fontError) return null;
  if (!onboardingChecked) return null;

  const isDesktop = windowWidth >= 900;
  const isTablet = windowWidth >= 520 && windowWidth < 900;

  const appWidth = isDesktop ? 420 : isTablet ? 400 : windowWidth;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <StripeProvider>
                <AppProvider>
                  <ToastProvider>
                    <AuthProvider>
                      <BusinessProvider>
                        <CartProvider>
                          {isDesktop ? (
                            <View style={styles.desktopLayout}>
                              {/* Sidebar izquierdo */}
                              <View style={styles.sidebar}>
                                <SidebarContent />
                              </View>

                              {/* App centrada */}
                              <View style={[styles.appFrame, { width: appWidth }]}>
                                <AppThemedShell>
                                  <RootStackNavigator />
                                </AppThemedShell>
                              </View>

                              {/* Panel derecho */}
                              <View style={styles.rightPanel}>
                                <RightPanelContent />
                              </View>
                            </View>
                          ) : isTablet ? (
                            <View style={styles.tabletLayout}>
                              <View style={[styles.appFrame, { width: appWidth }]}>
                                <AppThemedShell>
                                  <RootStackNavigator />
                                </AppThemedShell>
                              </View>
                            </View>
                          ) : (
                            <AppThemedShell>
                              <RootStackNavigator />
                            </AppThemedShell>
                          )}
                          {showOnboarding && (
                            <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
                          )}
                          <NotificationPermissionModal
                            visible={showNotificationModal}
                            onAccept={() => setShowNotificationModal(false)}
                            onDecline={() => setShowNotificationModal(false)}
                          />
                        </CartProvider>
                      </BusinessProvider>
                    </AuthProvider>
                  </ToastProvider>
                </AppProvider>
              </StripeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function SidebarContent() {
  return (
    <View style={sidebar.container}>
      {/* Logo */}
      <View style={sidebar.logoRow}>
        <View style={sidebar.logoCircle}>
          <Text style={sidebar.logoEmoji}>🐰</Text>
        </View>
        <View>
          <Text style={sidebar.logoTitle}>ComeYa</Text>
          <Text style={sidebar.logoSub}>Delivery en Soria</Text>
        </View>
      </View>

      {/* Descripción */}
      <Text style={sidebar.headline}>
        Tu comida favorita,{"\n"}en tu puerta
      </Text>
      <Text style={sidebar.desc}>
        Conectamos los mejores restaurantes y negocios locales de Soria contigo. Pide en segundos, sigue tu pedido en tiempo real.
      </Text>

      {/* Features */}
      {[
        { icon: "map-pin", text: "Tracking GPS en tiempo real" },
        { icon: "clock", text: "Entrega en 30-45 minutos" },
        { icon: "star", text: "Reseñas verificadas" },
        { icon: "shield", text: "Pagos seguros con Bizum y Stripe" },
        { icon: "gift", text: "Puntos y recompensas" },
      ].map((f, i) => (
        <View key={i} style={sidebar.featureRow}>
          <View style={sidebar.featureIcon}>
            <Feather name={f.icon as any} size={16} color={PRIMARY} />
          </View>
          <Text style={sidebar.featureText}>{f.text}</Text>
        </View>
      ))}

      {/* Botones descarga */}
      <View style={sidebar.storeRow}>
        <View style={sidebar.storeBadge}>
          <Feather name="smartphone" size={14} color="#fff" />
          <Text style={sidebar.storeBadgeText}>App Store</Text>
        </View>
        <View style={sidebar.storeBadge}>
          <Feather name="smartphone" size={14} color="#fff" />
          <Text style={sidebar.storeBadgeText}>Google Play</Text>
        </View>
      </View>

      <Text style={sidebar.footer}>📍 Soria, Castilla y León, España</Text>
    </View>
  );
}

function RightPanelContent() {
  return (
    <View style={right.container}>
      <Text style={right.title}>¿Por qué ComeYa?</Text>

      {[
        { emoji: "🏪", title: "Negocios locales", desc: "Apoyamos el comercio de proximidad soriano" },
        { emoji: "🚀", title: "Rápido y fácil", desc: "Pide en menos de 2 minutos" },
        { emoji: "💰", title: "Precios justos", desc: "Sin comisiones ocultas para el cliente" },
        { emoji: "🔒", title: "100% seguro", desc: "Pagos verificados y anti-fraude con IA" },
        { emoji: "🎮", title: "Gamificación", desc: "Gana puntos y canjea recompensas" },
        { emoji: "📊", title: "Para negocios", desc: "Panel de analytics en tiempo real" },
      ].map((item, i) => (
        <View key={i} style={right.card}>
          <Text style={right.cardEmoji}>{item.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={right.cardTitle}>{item.title}</Text>
            <Text style={right.cardDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      <View style={right.statsRow}>
        {[
          { n: "50+", l: "Negocios" },
          { n: "4.8★", l: "Valoración" },
          { n: "30min", l: "Promedio" },
        ].map((s, i) => (
          <View key={i} style={right.stat}>
            <Text style={right.statN}>{s.n}</Text>
            <Text style={right.statL}>{s.l}</Text>
          </View>
        ))}
      </View>

      <Text style={right.footer}>© 2025 ComeYa · Hecho con ❤️ en Soria</Text>
    </View>
  );
}

function AppThemedShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <>
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
        {children}
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desktopLayout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f7f7f7",
  },
  tabletLayout: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  sidebar: {
    flex: 1,
    backgroundColor: PRIMARY,
    minWidth: 260,
    maxWidth: 320,
  },
  appFrame: {
    flex: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    overflow: "hidden",
    alignSelf: "stretch",
  } as any,
  rightPanel: {
    flex: 1,
    backgroundColor: "#fff",
    minWidth: 220,
    maxWidth: 300,
    borderLeftWidth: 1,
    borderLeftColor: "#e0e0e0",
  },
});

const sidebar = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 28, gap: 12 },
  logoCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  logoEmoji: { fontSize: 24 },
  logoTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  logoSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  headline: { fontSize: 26, fontWeight: "900", color: "#fff", lineHeight: 32, marginBottom: 12 },
  desc: { fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 20, marginBottom: 24 },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  featureText: { fontSize: 13, color: "#fff", flex: 1 },
  storeRow: { flexDirection: "row", gap: 8, marginTop: 24, marginBottom: 16 },
  storeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  storeBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  footer: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 8 },
});

const right = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: "#1a1a1a", marginBottom: 20 },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginBottom: 16, padding: 12,
    backgroundColor: "#f9f9f9", borderRadius: 12,
  },
  cardEmoji: { fontSize: 22, width: 32, textAlign: "center" },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 2 },
  cardDesc: { fontSize: 12, color: "#666", lineHeight: 16 },
  statsRow: {
    flexDirection: "row", justifyContent: "space-around",
    marginTop: 20, marginBottom: 16,
    padding: 16, backgroundColor: PRIMARY + "10",
    borderRadius: 12,
  },
  stat: { alignItems: "center" },
  statN: { fontSize: 18, fontWeight: "800", color: PRIMARY },
  statL: { fontSize: 11, color: "#666", marginTop: 2 },
  footer: { fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 8 },
});
