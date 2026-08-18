import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/dashboard";

type PlatformStripeStatus = {
  isConnected: boolean;
  accountId: string | null;
  accountEmail?: string | null;
  accountName?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements?: string[];
  lastSync?: string | null;
  balance: { available: number; pending: number };
  error?: string;
};

const fmtEur = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export default function AdminStripeSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [status, setStatus] = useState<PlatformStripeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/finance/stripe-status");
      const data = await res.json();
      if (data.success) setStatus(data.status);
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

  const openDashboard = async () => {
    try {
      await Linking.openURL(STRIPE_DASHBOARD_URL);
    } catch {
      Alert.alert("Error", "No se pudo abrir el navegador");
    }
  };

  const connected = !!status?.isConnected;
  const paymentsReady =
    connected && !!status?.chargesEnabled && !!status?.payoutsEnabled;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.md,
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>
          Stripe (plataforma)
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={ComeYaColors.primary}
            style={{ marginTop: 48 }}
          />
        ) : (
          <>
            {/* Estado de la conexión */}
            <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: connected
                        ? ComeYaColors.success + "20"
                        : ComeYaColors.warning + "20",
                    },
                  ]}
                >
                  <Feather
                    name={connected ? "check-circle" : "alert-triangle"}
                    size={24}
                    color={connected ? ComeYaColors.success : ComeYaColors.warning}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4" style={{ color: theme.text }}>
                    {connected ? "Cuenta Stripe conectada" : "Stripe sin configurar"}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {connected
                      ? "Conexión establecida mediante variables de entorno del servidor"
                      : "Falta STRIPE_SECRET_KEY en el servidor"}
                  </ThemedText>
                </View>
              </View>

              {connected && (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  {!!status?.accountName && (
                    <Row
                      icon="briefcase"
                      label="Cuenta"
                      value={status.accountName}
                      theme={theme}
                    />
                  )}
                  {!!status?.accountEmail && (
                    <Row
                      icon="mail"
                      label="Email"
                      value={status.accountEmail}
                      theme={theme}
                    />
                  )}
                  {!!status?.accountId && (
                    <Row
                      icon="key"
                      label="ID de cuenta"
                      value={status.accountId}
                      theme={theme}
                    />
                  )}
                  <Row
                    icon="credit-card"
                    label="Cobros con tarjeta"
                    value={
                      status?.chargesEnabled
                        ? "Habilitados ✓"
                        : "No habilitados ⚠️"
                    }
                    valueColor={
                      status?.chargesEnabled ? ComeYaColors.success : ComeYaColors.warning
                    }
                    theme={theme}
                  />
                  <Row
                    icon="arrow-up-circle"
                    label="Pagos a cuentas bancarias"
                    value={
                      status?.payoutsEnabled
                        ? "Habilitados ✓"
                        : "No habilitados ⚠️"
                    }
                    valueColor={
                      status?.payoutsEnabled ? ComeYaColors.success : ComeYaColors.warning
                    }
                    theme={theme}
                  />
                </>
              )}

              {!!status?.error && (
                <ThemedText type="caption" style={{ color: ComeYaColors.warning, marginTop: Spacing.sm }}>
                  ⚠️ {status.error}
                </ThemedText>
              )}
            </View>

            {/* Saldo */}
            {connected && (
              <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
                <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>
                  Saldo de la plataforma
                </ThemedText>
                <View style={styles.balanceRow}>
                  <View style={styles.balanceCol}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Disponible
                    </ThemedText>
                    <ThemedText type="h3" style={{ color: ComeYaColors.success }}>
                      {fmtEur(status?.balance?.available || 0)}
                    </ThemedText>
                  </View>
                  <View style={styles.balanceCol}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Pendiente
                    </ThemedText>
                    <ThemedText type="h3" style={{ color: ComeYaColors.warning }}>
                      {fmtEur(status?.balance?.pending || 0)}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  Desde este saldo Stripe paga automáticamente a negocios y
                  repartidores con Stripe Connect cuando el cliente paga con tarjeta.
                </ThemedText>
              </View>
            )}

            {/* Info de flujo */}
            <View
              style={[
                styles.infoBanner,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Feather name="info" size={18} color={ComeYaColors.primary} />
              <ThemedText type="caption" style={{ color: ComeYaColors.primary, flex: 1 }}>
                Esta cuenta es la de la plataforma (configurada por variables de
                entorno) y no se desvincula desde aquí. Los cobros con tarjeta de
                los clientes entran aquí; Bizum, transferencia y PayPal se reciben
                en las cuentas manuales de "Cuentas de pago".
              </ThemedText>
            </View>

            {paymentsReady && (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: ComeYaColors.primary }]}
                onPress={openDashboard}
              >
                <Feather name="external-link" size={16} color="#FFF" />
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>
                  Abrir panel oficial de Stripe
                </ThemedText>
              </Pressable>
            )}
            {connected && !paymentsReady && (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: "#635BFF" }]}
                onPress={openDashboard}
              >
                <Feather name="external-link" size={16} color="#FFF" />
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>
                  Abrir Stripe para completar la activación
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              style={styles.secondaryBtn}
              onPress={async () => {
                setLoading(true);
                await loadStatus();
                showToast("Estado de Stripe actualizado", "success");
              }}
            >
              <Feather name="refresh-cw" size={16} color={theme.text} />
              <ThemedText type="body" style={{ color: theme.text }}>
                Verificar conexión de nuevo
              </ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  valueColor,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  valueColor?: string;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color={theme.textSecondary} />
      <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={{ color: valueColor || theme.text, fontWeight: "600" }} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  back: { padding: Spacing.xs },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, marginVertical: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  balanceRow: { flexDirection: "row", gap: Spacing.md },
  balanceCol: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#DDD",
  },
});
