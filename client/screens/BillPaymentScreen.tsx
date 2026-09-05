// 💳 Pagar la cuenta desde ComeYa: el cliente escanea el QR de la cuenta del
// restaurante y paga (todo o su parte) con tarjeta vía Stripe PaymentSheet.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const fmt = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const TIP_OPTIONS = [0, 5, 10];

export default function BillPaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const billId = route.params?.billId || "";

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [tip, setTip] = useState(0);
  const [customAmount, setCustomAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", `/api/reservations/bill/${billId}`);
      const data = await res.json();
      if (data.success) setBill({ ...data.bill, remainingCents: data.remainingCents });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useEffect(() => {
    load();
  }, [load]);

  const pay = async () => {
    const base = customAmount
      ? Math.round(Number(customAmount.replace(",", ".")) * 100)
      : bill.remainingCents;
    const tipCents = customAmount ? 0 : Math.round((bill.remainingCents * tip) / 100);
    const amount = Math.min(bill.remainingCents + tipCents, base + tipCents);
    if (amount < 50) {
      showToast("Importe mínimo 0,50 €", "error");
      return;
    }
    setPaying(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/reservations/bill/${billId}/pay-intent`,
        { amountCents: amount },
      );
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || "No se pudo iniciar el pago", "error");
        return;
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
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
      const confirmRes = await apiRequest(
        "POST",
        `/api/reservations/bill/${billId}/confirm`,
        { paymentIntentId: data.paymentIntentId },
      );
      const confirmData = await confirmRes.json();
      if (confirmData.success) {
        showToast(
          confirmData.status === "paid"
            ? "¡Cuenta pagada! Gracias 💳"
            : `Pagado ${fmt(confirmData.paidCents)}. Quedan ${fmt(confirmData.remainingCents)}`,
          "success",
        );
        load();
        setCustomAmount("");
      } else {
        showToast(confirmData.error || "No se pudo confirmar el pago", "error");
      }
    } catch {
      showToast("No se pudo procesar el pago", "error");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing["3xl"] }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing["3xl"] }]}>
        <Feather name="credit-card" size={48} color={theme.textSecondary} />
        <ThemedText type="h4" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Cuenta no encontrada
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>

      <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
        <ThemedText type="h3">Cuenta · {bill.businessName}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
          {bill.reservationCode ? `Reserva ${bill.reservationCode} · ` : ""}
          {bill.businessAddress || ""}
        </ThemedText>

        <View style={[styles.totalRow, { borderColor: theme.border }]}>
          <ThemedText type="h1" style={{ color: ComeYaColors.primary }}>
            {fmt(bill.totalCents)}
          </ThemedText>
          <View style={{ alignItems: "flex-end" }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pagado {fmt(bill.paidCents)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {bill.status === "paid" ? "✅ Cuenta saldada" : `Pendiente ${fmt(bill.remainingCents)}`}
            </ThemedText>
          </View>
        </View>

        {bill.items?.length > 0 ? (
          <View style={{ marginTop: Spacing.sm, gap: 4 }}>
            {bill.items.map((it: any, i: number) => (
              <View key={i} style={styles.itemRow}>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {it.name} ×{it.quantity}
                </ThemedText>
                <ThemedText type="small">{fmt(it.priceCents * it.quantity)}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {bill.status !== "paid" ? (
        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText style={{ fontWeight: "700" }}>Pagar mi parte</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2, marginBottom: Spacing.sm }}>
            Introduce un importe para pagar solo tu parte, o déjalo vacío para pagar todo.
          </ThemedText>
          <TextInput
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder={`Todo: ${fmt(bill.remainingCents)}`}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {!customAmount ? (
            <View style={styles.tipRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Propina:</ThemedText>
              {TIP_OPTIONS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTip(t)}
                  style={[styles.tipChip, { backgroundColor: tip === t ? ComeYaColors.primary : theme.backgroundSecondary }]}
                >
                  <ThemedText type="small" style={{ color: tip === t ? "#FFF" : theme.text, fontWeight: "700" }}>
                    {t === 0 ? "No" : `${t}%`}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={pay}
            disabled={paying}
            style={[styles.payBtn, { opacity: paying ? 0.6 : 1 }]}
          >
            {paying ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="credit-card" size={16} color="#FFF" />
            )}
            <ThemedText style={{ color: "#FFF", fontWeight: "800", marginLeft: Spacing.sm }}>
              {paying ? "Procesando..." : "Pagar con tarjeta"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  content: { padding: Spacing.lg, paddingBottom: Spacing["4xl"], maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", marginBottom: Spacing.md },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, paddingBottom: Spacing.md, marginTop: Spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, marginBottom: Spacing.sm },
  tipRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  tipChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: ComeYaColors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
});
