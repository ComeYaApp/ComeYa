import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { ComeYaColors } from "@/constants/theme";

const PRIMARY = "#DC2626";

export default function StripePaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { isDark } = useTheme();
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e5e7eb";

  const params = route.params as any;
  const { orderId, amount, subtotal, deliveryFee, businessId, isSubscription, subscriptionId } = params || {};

  // Open Stripe payment in in-app browser
  const openPayment = useCallback(async () => {
    if (!orderId || !amount || !businessId) {
      Alert.alert("Error", "Datos de pago incompletos");
      return;
    }

    setProcessing(true);
    try {
      // Get Stripe payment URL from backend
      const res = await apiRequest("POST", "/api/stripe/create-payment-session", {
        orderId,
        amount: Math.round(amount),
        businessId,
        subtotal: Math.round(subtotal || 0),
        deliveryFee: Math.round(deliveryFee || 0),
        returnUrl: "comeya://payment-return",
      });
      const data = await res.json();

      if (data.url) {
        // Open in-app browser
        const result = await WebBrowser.openAuthSessionAsync(data.url, "comeya://payment-return");
        
        if (result.type === "success" && result.url) {
          // Check if payment was successful
          await clearCart();
          navigation.reset({
            index: 0,
            routes: [{ name: "Main" }, { name: "OrderTracking", params: { orderId } }],
          });
        } else {
          Alert.alert("Pago cancelado", "Puedes intentar novamente");
        }
      } else {
        Alert.alert("Error", data.message || "No se pudo iniciar el pago");
      }
    } catch (e: any) {
      Alert.alert("Error", "No se pudo conectar con el servidor de pagos");
    } finally {
      setProcessing(false);
    }
  }, [orderId, amount, businessId, subtotal, deliveryFee, clearCart, navigation]);

  useEffect(() => {
    if (orderId && amount && businessId) {
      setLoading(false);
    } else {
      Alert.alert("Error", "Datos de pago incompletos");
    }
  }, [orderId, amount, businessId]);

  // Redirect back to web payment screen for better payment form
  const handleUseWebVersion = useCallback(() => {
    // This would ideally use deep linking to open the web version
    Alert.alert(
      "Pago con Stripe",
      "Serás redirigido a la pasarela de pago segura de Stripe.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Continuar", onPress: openPayment },
      ]
    );
  }, [openPayment]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center" }]}>
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
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h4" style={{ color: text }}>Pago seguro</ThemedText>
        </View>
        <View style={styles.securityBadge}>
          <Feather name="lock" size={12} color="#10b981" />
          <ThemedText type="caption" style={{ color: "#10b981", marginLeft: 4 }}>SSL</ThemedText>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Card with all payment info */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <View style={[styles.iconCircle, { backgroundColor: PRIMARY + "15" }]}>
            <Feather name="credit-card" size={32} color={PRIMARY} />
          </View>
          
          <ThemedText type="h3" style={{ color: text, marginTop: 16, textAlign: "center" }}>
            Total a pagar
          </ThemedText>
          
          <ThemedText type="h1" style={{ color: PRIMARY, fontWeight: "900", marginTop: 8 }}>
            €{(amount / 100).toFixed(2)}
          </ThemedText>

          {/* Order summary */}
          <View style={[styles.summary, { borderTopColor: border, marginTop: 24 }]}>
            <View style={styles.summaryRow}>
              <ThemedText type="body" style={{ color: sub }}>Importe</ThemedText>
              <ThemedText type="body" style={{ color: text }}>€{((subtotal || 0) / 100).toFixed(2)}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText type="body" style={{ color: sub }}>Envío</ThemedText>
              <ThemedText type="body" style={{ color: text }}>€{((deliveryFee || 0) / 100).toFixed(2)}</ThemedText>
            </View>
          </View>

          {/* Stripe badge */}
          <View style={[styles.stripeBadge, { borderTopColor: border, marginTop: 16 }]}>
            <Feather name="shield" size={14} color={sub} />
            <ThemedText type="caption" style={{ color: sub, marginLeft: 6, flex: 1 }}>
              Procesado por Stripe{`\n`}Tus datos nunca se almacenan en nuestros servidores
            </ThemedText>
          </View>
        </View>

        {/* Pay button */}
        <Pressable
          onPress={handleUseWebVersion}
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
                Pagar €{(amount / 100).toFixed(2)}
              </ThemedText>
            </>
          )}
        </Pressable>

        {/* Cancel button */}
        <Pressable onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <ThemedText type="body" style={{ color: sub }}>Cancelar y volver</ThemedText>
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
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  securityBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#10b98120" },
  content: { flex: 1, padding: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  summary: { width: "100%", borderTopWidth: 1, paddingTop: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  stripeBadge: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 16, width: "100%" },
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
