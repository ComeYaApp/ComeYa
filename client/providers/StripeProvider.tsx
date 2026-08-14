import React, { useState, useEffect } from "react";
import { Platform, Alert } from "react-native";
import Constants from "expo-constants";
import { apiRequestRaw } from "@/lib/query-client";

interface StripeProviderProps {
  children: React.ReactNode;
}

const isExpoGo = Constants.appOwnership === "expo";
const isWeb = Platform.OS === "web";

const loadStripeKey = async (attempt = 0): Promise<string | null> => {
  try {
    const response = await apiRequestRaw("GET", "/api/stripe/publishable-key");
    const responseText = await response.text();
    let parsedBody: any = {};
    if (responseText) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = { error: responseText };
      }
    }

    console.log("[StripeProvider] publishable-key status", response.status);

    if (!response.ok || !parsedBody.publishableKey) {
      console.error("[StripeProvider] publishable-key fetch failed", {
        status: response.status,
        body: parsedBody,
        attempt,
      });
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        return loadStripeKey(attempt + 1);
      }
      return null;
    }

    return parsedBody.publishableKey as string;
  } catch (error) {
    console.error("[StripeProvider] publishable-key fetch error", error);
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      return loadStripeKey(attempt + 1);
    }
    return null;
  }
};

export function StripeProvider({ children }: StripeProviderProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [StripeNativeProvider, setStripeNativeProvider] =
    useState<React.ComponentType<any> | null>(null);
  const [stripeAvailable, setStripeAvailable] = useState(false);

  useEffect(() => {
    if (isWeb || isExpoGo) {
      console.log("[StripeProvider] skipping init", {
        isWeb,
        isExpoGo,
        appOwnership: Constants.appOwnership,
      });
      return;
    }

    (async () => {
      try {
        const { StripeProvider: NativeStripeProvider } = await import(
          "@stripe/stripe-react-native"
        );
        setStripeNativeProvider(() => NativeStripeProvider);

        const key = await loadStripeKey();
        if (!key) {
          console.error("[StripeProvider] no publishable key after retries");
          setStripeAvailable(false);
          Alert.alert(
            "Pago no disponible",
            "No se pudo obtener la clave de Stripe. Revisa tu conexión y la configuración del backend.",
          );
          return;
        }

        console.log("[StripeProvider] key loaded OK");
        setPublishableKey(key);
        setStripeAvailable(true);
      } catch (error) {
        console.error("[StripeProvider] init error", error);
        setStripeAvailable(false);
      }
    })();
  }, []);

  if (
    isWeb ||
    isExpoGo ||
    !stripeAvailable ||
    !publishableKey ||
    !StripeNativeProvider
  ) {
    return <>{children}</>;
  }

  return (
    <StripeNativeProvider publishableKey={publishableKey}>
      {children}
    </StripeNativeProvider>
  );
}