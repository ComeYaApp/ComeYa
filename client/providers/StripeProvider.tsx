import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiRequestRaw } from "@/lib/query-client";

interface StripeProviderProps {
  children: React.ReactNode;
}

const isExpoGo = Constants.appOwnership === "expo";
const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";

export function StripeProvider({ children }: StripeProviderProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [StripeNativeProvider, setStripeNativeProvider] =
    useState<React.ComponentType<any> | null>(null);
  const [stripeAvailable, setStripeAvailable] = useState(false);

  useEffect(() => {
    if (!isWeb && !isExpoGo && !isIOS) {
      loadStripe();
    }
  }, []);

  const loadStripe = async () => {
    try {
      const { StripeProvider: NativeStripeProvider } = await import(
        "@stripe/stripe-react-native"
      );
      setStripeNativeProvider(() => NativeStripeProvider);
      setStripeAvailable(true);

      const response = await apiRequestRaw(
        "GET",
        "/api/stripe/publishable-key",
      );
      const responseText = await response.text();
      let parsedBody: any = {};
      if (responseText) {
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          parsedBody = { error: responseText };
        }
      }

      if (!response.ok) {
        console.error("Publishable key fetch failed", {
          status: response.status,
          body: parsedBody,
        });
        setStripeAvailable(false);
        return;
      }

      setPublishableKey(parsedBody.publishableKey);
    } catch (error) {
      console.log("Stripe native not available in this environment", error);
      setStripeAvailable(false);
    }
  };

  // En web o Expo Go, solo renderizar children sin Stripe
    if (
      isWeb ||
      isExpoGo ||
      isIOS ||
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
