import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type StripeStatus = {
  hasAccount?: boolean;
  accountId?: string;
  onboardingComplete?: boolean;
  canReceivePayments?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirements?: string[];
};

export default function StripeSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/connect/status");
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* estado no disponible */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  const handleOnboard = async () => {
    if (!user) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/connect/onboard", {});
      const data = await res.json();
      if (!res.ok || !data.success) {
        const isServerConfigError =
          res.status === 503 ||
          /configurado|STRIPE_SECRET_KEY/i.test(data.error || "");
        Alert.alert(
          "Error",
          isServerConfigError
            ? "Stripe no está configurado en el servidor. Avisa al administrador."
            : data.error || "No se pudo iniciar la configuración de Stripe",
        );
        return;
      }
      await Linking.openURL(data.onboardingUrl);
      showToast(
        "Completa la configuración en el navegador y vuelve a la app",
        "info",
      );
    } catch (e: any) {
      const message =
        e?.message || "No se pudo conectar con el servidor. Inténtalo de nuevo.";
      if (/signed up for Connect|stripe\.com\/connect/i.test(message)) {
        Alert.alert(
          "Stripe Connect no está activado",
          "Para vincular cuentas bancarias, primero debes completar el alta de Stripe Connect en tu panel de Stripe.",
          [
            {
              text: "Abrir panel de Stripe",
              onPress: () =>
                Linking.openURL("https://dashboard.stripe.com/connect"),
            },
            { text: "Cerrar", style: "cancel" },
          ],
        );
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDashboard = async () => {
    setBusy(true);
    try {
      const res = await apiRequest("GET", "/api/connect/dashboard-link");
      const data = await res.json();
      if (res.ok && data.url) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert("Error", data.error || "No se pudo abrir el panel");
      }
    } catch {
      Alert.alert("Error", "No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Desvincular Stripe",
      "Dejarás de cobrar automáticamente. Podrás volver a vincular tu cuenta cuando quieras.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await apiRequest("POST", "/api/connect/disconnect", {});
              const data = await res.json();
              if (res.ok && data.success) {
                setStatus(null);
                showToast("Cuenta Stripe desvinculada", "success");
              } else {
                Alert.alert("Error", data.error || "No se pudo desvincular");
              }
            } catch {
              Alert.alert("Error", "No se pudo conectar con el servidor");
            } finally {
              setBusy(false);
              loadStatus();
            }
          },
        },
      ],
    );
  };

  const ready = !!status?.canReceivePayments;
  const pending = status?.hasAccount && !ready;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2" style={{ marginLeft: Spacing.sm }}>
          Pagos automáticos con Stripe
        </ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={ComeYaColors.primary}
          style={{ marginTop: 48 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Tarjeta de estado */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIcon,
                  {
                    backgroundColor: ready
                      ? "#10B98120"
                      : pending
                        ? "#F59E0B20"
                        : "#6B728020",
                  },
                ]}
              >
                <Feather
                  name={ready ? "check-circle" : pending ? "clock" : "zap"}
                  size={22}
                  color={ready ? "#10B981" : pending ? "#F59E0B" : "#635BFF"}
                />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="body" style={{ fontWeight: "700" }}>
                  {ready
                    ? "Cuenta conectada"
                    : pending
                      ? "Cuenta en verificación"
                      : "Cuenta no conectada"}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {ready
                    ? "Cobrarás automáticamente en tu banco con cada entrega."
                    : pending
                      ? "Stripe está revisando tu cuenta. Completa los datos pendientes para activarla."
                      : "Conecta tu cuenta bancaria para cobrar automáticamente."}
                </ThemedText>
              </View>
            </View>

            {/* Checklist */}
            <View style={styles.checklist}>
              <View style={styles.checkRow}>
                <Feather
                  name={status?.hasAccount ? "check" : "x"}
                  size={14}
                  color={status?.hasAccount ? "#10B981" : "#EF4444"}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.text, marginLeft: 6 }}
                >
                  Cuenta Stripe vinculada
                </ThemedText>
              </View>
              <View style={styles.checkRow}>
                <Feather
                  name={status?.chargesEnabled ? "check" : "x"}
                  size={14}
                  color={status?.chargesEnabled ? "#10B981" : "#EF4444"}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.text, marginLeft: 6 }}
                >
                  Recibir pagos
                </ThemedText>
              </View>
              <View style={styles.checkRow}>
                <Feather
                  name={status?.payoutsEnabled ? "check" : "x"}
                  size={14}
                  color={status?.payoutsEnabled ? "#10B981" : "#EF4444"}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.text, marginLeft: 6 }}
                >
                  Transferencias bancarias
                </ThemedText>
              </View>
            </View>

            {/* Requisitos pendientes */}
            {pending &&
              status?.requirements &&
              status.requirements.length > 0 && (
                <View
                  style={[
                    styles.requirementsBox,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: "#F59E0B", fontWeight: "700" }}
                  >
                    Faltan estos datos en Stripe:
                  </ThemedText>
                  {status.requirements.map((req) => (
                    <ThemedText
                      key={req}
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      • {req}
                    </ThemedText>
                  ))}
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginTop: 6 }}
                  >
                    En modo prueba usa datos de prueba (cualquier valor
                    válido): la verificación es inmediata.
                  </ThemedText>
                </View>
              )}
          </View>

          {/* Botones */}
          <View style={{ gap: Spacing.sm }}>
            {!ready && (
              <Pressable
                onPress={handleOnboard}
                disabled={busy}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: "#635BFF", opacity: busy ? 0.7 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="zap" size={18} color="#fff" />
                    <ThemedText
                      type="body"
                      style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}
                    >
                      {status?.hasAccount
                        ? "Completar configuración"
                        : "Conectar cuenta Stripe"}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            )}
            {status?.hasAccount && (
              <Pressable
                onPress={handleDashboard}
                disabled={busy}
                style={[
                  styles.secondaryBtn,
                  { borderColor: theme.border },
                ]}
              >
                <Feather name="external-link" size={16} color={theme.text} />
                <ThemedText
                  type="body"
                  style={{ color: theme.text, marginLeft: 8 }}
                >
                  Ver dashboard de Stripe
                </ThemedText>
              </Pressable>
            )}
            {status?.hasAccount && (
              <Pressable
                onPress={handleDisconnect}
                disabled={busy}
                style={styles.disconnectBtn}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: theme.textSecondary,
                    textDecorationLine: "underline",
                  }}
                >
                  Desvincular cuenta Stripe
                </ThemedText>
              </Pressable>
            )}
          </View>

          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.md,
            }}
          >
            Si usas Bizum, IBAN o PayPal en lugar de Stripe, el administrador
            te transferirá manualmente al aprobar cada pago.
          </ThemedText>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  checklist: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
    paddingTop: Spacing.md,
    gap: 8,
  },
  checkRow: { flexDirection: "row", alignItems: "center" },
  requirementsBox: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  disconnectBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
