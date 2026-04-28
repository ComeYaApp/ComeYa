import React, { useEffect, useState } from "react";
import { StyleSheet, Platform, View, Dimensions } from "react-native";
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

const MAX_WIDTH = 480;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const isDesktop = screenWidth > 520;

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
                            // Layout desktop: app centrada con fondo gris
                            <View style={styles.desktopShell}>
                              <View style={styles.desktopContainer}>
                                <AppThemedShell>
                                  <RootStackNavigator />
                                </AppThemedShell>
                              </View>
                            </View>
                          ) : (
                            // Layout móvil: igual que la app nativa
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
  root: {
    flex: 1,
  },
  desktopShell: {
    flex: 1,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  desktopContainer: {
    width: MAX_WIDTH,
    flex: 1,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    overflow: "hidden",
  } as any,
});
