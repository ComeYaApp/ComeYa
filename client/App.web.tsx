import React, { useEffect, useState } from "react";
import { StyleSheet, Platform, View } from "react-native";
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
import { useTheme } from "@/hooks/useTheme";

SplashScreen.preventAutoHideAsync();

// Inyectar estilos CSS globales para el layout web responsive
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    html, body, #root { height: 100%; margin: 0; padding: 0; background: #f0f0f0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    /* Contenedor centrado estilo app móvil en escritorio */
    .web-app-shell {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
    }

    /* La app se muestra como un móvil centrado en pantallas grandes */
    .web-app-container {
      width: 100%;
      max-width: 480px;
      min-height: 100vh;
      background: white;
      position: relative;
      box-shadow: 0 0 40px rgba(0,0,0,0.15);
      overflow: hidden;
    }

    /* En móvil ocupa todo el ancho */
    @media (max-width: 520px) {
      .web-app-shell { background: white; }
      .web-app-container { max-width: 100%; box-shadow: none; }
    }

    /* En tablet un poco más ancho */
    @media (min-width: 521px) and (max-width: 900px) {
      .web-app-container { max-width: 420px; }
    }

    /* Scrollbar bonita */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #E8B4A8; border-radius: 4px; }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await checkOnboardingCompleted();
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    };
    checkOnboarding();
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
                          {/* Shell web responsive */}
                          <div className="web-app-shell">
                            <div className="web-app-container">
                              <AppThemedShell>
                                <RootStackNavigator />
                              </AppThemedShell>
                            </div>
                          </div>
                          {showOnboarding && (
                            <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
                          )}
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
  root: { flex: 1 },
});
