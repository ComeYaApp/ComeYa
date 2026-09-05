// ComeYa Pass (4,99 €/mes): suscripción para clientes con puntos x2 en
// reservas y pedidos + ofertas exclusivas. Reutiliza la pasarela de suscripciones.
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const BENEFITS = [
  { icon: "zap", text: "Puntos x2 en todas tus reservas y pedidos" },
  { icon: "gift", text: "Ofertas y promociones exclusivas para miembros" },
  { icon: "star", text: "Prioridad en promociones de restaurantes destacados" },
];

export default function ComeYaPassScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);

  const subscribe = async () => {
    setBusy(true);
    try {
      // 1) Crear la suscripción pendiente de pago
      const subRes = await apiRequest("POST", "/api/subscriptions/subscribe", {
        plan: "comeya_pass",
      });
      const subData = await subRes.json();
      const subscriptionId = subData.subscription?.id || subData.id;
      if (!subscriptionId) {
        showToast(subData.error || "No se pudo crear la suscripción", "error");
        return;
      }
      // 2) Intención de pago con Stripe
      const payRes = await apiRequest(
        "POST",
        "/api/stripe/create-subscription-payment-intent",
        { subscriptionId, plan: "comeya_pass" },
      );
      const payData = await payRes.json();
      if (!payData.clientSecret) {
        showToast(payData.error || "No se pudo iniciar el pago", "error");
        return;
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: payData.clientSecret,
        merchantDisplayName: "ComeYa",
        returnURL: "comeya://payment-return",
      });
      if (initError) {
        showToast("No se pudo iniciar el pago: " + initError.message, "error");
        return;
      }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") showToast("El pago no se completó", "error");
        return;
      }
      // 3) Confirmar la suscripción
      const confRes = await apiRequest(
        "POST",
        `/api/stripe/confirm-subscription/${subscriptionId}`,
        {},
      );
      const confData = await confRes.json();
      if (confData.success || confData.subscription) {
        showToast("🎉 ¡Bienvenido a ComeYa Pass! Puntos x2 activados.", "success");
        navigation.goBack();
      } else {
        showToast(confData.error || "No se pudo activar", "error");
      }
    } catch {
      showToast("No se pudo completar la suscripción", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>

      <View style={[styles.hero, { backgroundColor: ComeYaColors.primary }, Shadows.md]}>
        <ThemedText style={{ color: "#FFF", fontSize: 22, fontWeight: "800" }}>
          COMEYA PASS
        </ThemedText>
        <ThemedText style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }}>
          Descubre. Reserva. Come. Repite.
        </ThemedText>
        <ThemedText style={{ color: "#FFF", fontSize: 34, fontWeight: "800", marginTop: Spacing.md }}>
          4,99 €<ThemedText style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}> /mes</ThemedText>
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <Feather name={b.icon as any} size={16} color={ComeYaColors.primary} />
            <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>{b.text}</ThemedText>
          </View>
        ))}
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Sin permanencia: cancela cuando quieras desde tu perfil.
        </ThemedText>
        <Pressable onPress={subscribe} disabled={busy} style={[styles.cta, { opacity: busy ? 0.6 : 1 }]}>
          {busy ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Feather name="credit-card" size={16} color="#FFF" />
          )}
          <ThemedText style={{ color: "#FFF", fontWeight: "800", marginLeft: Spacing.sm }}>
            {busy ? "Procesando..." : "Suscribirme ahora"}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing["4xl"], maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", marginBottom: Spacing.md },
  hero: { borderRadius: BorderRadius.lg, padding: Spacing.xxl, marginBottom: Spacing.md },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  benefitRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: ComeYaColors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, marginTop: Spacing.md },
});
