import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import * as WebBrowser from "expo-web-browser";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { ComeYaColors } from "@/constants/theme";
import { useQueryClient } from "@tanstack/react-query";

const PRIMARY = "#DC2626";

export default function StripePaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDark } = useTheme();
  const { clearCart } = useCart();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e5e7eb";

  const params = route.params as any;
  const {
    orderId,
    amount,
    subtotal,
    deliveryFee,
    businessId,
    isSubscription,
    subscriptionId,
  } = params || {};

  // Las suscripciones pasan el importe en centavos (1500 = €15), los pedidos normales en euros
  const displayAmount = isSubscription ? amount / 100 : amount;

  // Open Stripe payment in in-app browser
const openPayment = useCallback(async () => {
  if (!orderId || !amount) {
    Alert.alert("Error", "Datos de pago incompletos");
    return;
  }

  // Para suscripciones, businessId no es requerido
  if (!isSubscription && !businessId) {
    Alert.alert("Error", "Datos de pago incompletos");
    return;
  }

  setProcessing(true);
  try {
    // Determinar endpoint según tipo de pago
    const endpoint = isSubscription
      ? "/api/stripe/create-subscription-payment-intent"
      : "/api/stripe/create-payment-intent";

    const res = await apiRequest(
      "POST",
      endpoint,
      {
        orderId,
        amount: Math.round(amount),
        businessId: isSubscription ? "" : businessId,
        subtotal: Math.round(subtotal || 0),
        deliveryFee: Math.round(deliveryFee || 0),
        isSubscription,
        subscriptionId,
      },
    );
    const data = await res.json();

    if (data.clientSecret) {
      // Usar PaymentSheet interno para pagos con Stripe
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: "ComeYa",
        returnURL: "comeya://payment-return",
      });
      
      if (error) {
        Alert.alert("Error", "No se pudo inicializar el pago interno: " + error.message);
        return;
      }
      
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        Alert.alert("Error", "Error en el pago: " + presentError.message);
      } else {
        // Pago exitoso
        if (isSubscription && subscriptionId) {
          try {
            // Confirmar suscripción después del pago exitoso
            await apiRequest(
              "POST",
              `/api/stripe/confirm-subscription/${subscriptionId}`,
            );
          } catch (e) {
            // Silenciar error, la suscripción ya debería estar activa
          }
          // Invalidar el caché de la suscripción para que la pantalla se actualice inmediatamente
          queryClient.invalidateQueries({ queryKey: ["subscription"] });
          Alert.alert(
            "✅ ¡Suscripción activada!",
            "Tu plan ya está activo. Disfruta todos los beneficios.",
            [{ text: "Ver mi suscripción", onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Main" }, { name: "Subscriptions" }],
              });
            }}],
          );
        } else {
          // Para pedidos normales, limpiar carrito y navegar al tracking
          await clearCart();
          navigation.reset({
            index: 0,
            routes: [
              { name: "Main" },
              { name: "OrderTracking", params: { orderId } },
            ],
          });
        }
      }
      return;
    }

    // Si no hay clientSecret (pagos regulares), usar endpoint create-session
    const sessionEndpoint = "/api/payments/create-session";
    const sessionRes = await apiRequest(
      "POST",
      sessionEndpoint,
      {
        orderId,
        amount: Math.round(amount),
        businessId: isSubscription ? "" : businessId,
        provider: "stripe_card", // Por defecto tarjeta
        isSubscription,
        subscriptionId,
      },
    );
    const sessionData = await sessionRes.json();

    if (sessionData.url) {
      // Open in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        sessionData.url,
        "comeya://payment-return",
      );

      if (result.type === "success" && result.url) {
        // Check if payment was successful
        await clearCart();
        navigation.reset({
          index: 0,
          routes: [
            { name: "Main" },
            { name: "OrderTracking", params: { orderId } },
          ],
        });
      } else {
        Alert.alert("Pago cancelado", "Puedes intentar novamente");
      }
    } else {
      Alert.alert("Error", sessionData.message || "No se pudo iniciar el pago");
    }
  } catch (e: any) {
    Alert.alert("Error", "No se pudo conectar con el servidor de pagos");
  } finally {
    setProcessing(false);
  }
}, [
  orderId,
  amount,
  businessId,
  subtotal,
  deliveryFee,
  clearCart,
  navigation,
  initPaymentSheet,
  presentPaymentSheet,
  queryClient,
]);

  useEffect(() => {
    if (!orderId || !amount) {
      Alert.alert("Error", "Datos de pago incompletos");
      return;
    }
    // Para suscripciones, businessId no es requerido
    if (!isSubscription && !businessId) {
      Alert.alert("Error", "Datos de pago incompletos");
      return;
    }
    setLoading(false);
  }, [orderId, amount, businessId, isSubscription]);

  const handlePayment = useCallback(async () => {
    await openPayment();
  }, [openPayment]);

  if (loading) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: bg,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
        <ThemedText type="body" style={{ color: sub, marginTop: 12 }}>
          Cargando pasarela de pago...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: card, borderBottomColor: border },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h4" style={{ color: text }}>
            Pago seguro
          </ThemedText>
        </View>
        <View style={styles.securityBadge}>
          <Feather name="lock" size={12} color="#10b981" />
          <ThemedText
            type="caption"
            style={{ color: "#10b981", marginLeft: 4 }}
          >
            SSL
          </ThemedText>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Card with all payment info */}
        <View
          style={[styles.card, { backgroundColor: card, borderColor: border }]}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: PRIMARY + "15" }]}
          >
            <Feather name="credit-card" size={32} color={PRIMARY} />
          </View>

          <ThemedText
            type="h3"
            style={{ color: text, marginTop: 16, textAlign: "center" }}
          >
            Total a pagar
          </ThemedText>

          <ThemedText
            type="h1"
            style={{ color: PRIMARY, fontWeight: "900", marginTop: 8 }}
          >
            €{(displayAmount).toFixed(2)}
          </ThemedText>

          {/* Order summary */}
          <View
            style={[styles.summary, { borderTopColor: border, marginTop: 24 }]}
          >
            {isSubscription ? (
              <View style={styles.summaryRow}>
                <ThemedText type="body" style={{ color: sub }}>
                  Suscripción mensual
                </ThemedText>
                <ThemedText type="body" style={{ color: text }}>
                  €{(displayAmount).toFixed(2)}/mes
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: sub }}>
                    Importe
                  </ThemedText>
                  <ThemedText type="body" style={{ color: text }}>
                    €{(subtotal || 0).toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.summaryRow}>
                  <ThemedText type="body" style={{ color: sub }}>
                    Envío
                  </ThemedText>
                  <ThemedText type="body" style={{ color: text }}>
                    €{(deliveryFee || 0).toFixed(2)}
                  </ThemedText>
                </View>
              </>
            )}
          </View>

          {/* Stripe badge */}
          <View
            style={[
              styles.stripeBadge,
              { borderTopColor: border, marginTop: 16 },
            ]}
          >
            <Feather name="shield" size={14} color={sub} />
            <ThemedText
              type="caption"
              style={{ color: sub, marginLeft: 6, flex: 1 }}
            >
              Procesado por Stripe{`\n`}Tus datos nunca se almacenan en nuestros
              servidores
            </ThemedText>
          </View>
        </View>

        {/* Pay button */}
        <Pressable
          onPress={handlePayment}
          disabled={processing}
          style={({ pressed }) => [
            styles.payBtn,
            { backgroundColor: pressed ? "#b91c1c" : PRIMARY },
            processing && { opacity: 0.7 },
          ]}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="lock" size={18} color="#fff" />
              <ThemedText type="h4" style={{ color: "#fff", marginLeft: 8 }}>
                Pagar €{(displayAmount).toFixed(2)}
              </ThemedText>
            </>
          )}
        </Pressable>

        {/* Cancel button */}
        <Pressable onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <ThemedText type="body" style={{ color: sub }}>
            Cancelar y volver
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#10b98120",
  },
  content: { flex: 1, padding: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  summary: { width: "100%", borderTopWidth: 1, paddingTop: 16 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  stripeBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 16,
    width: "100%",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 12,
    marginTop: 24,
  },
  cancelBtn: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
});
