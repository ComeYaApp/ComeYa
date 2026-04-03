import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { API_CONFIG } from "@/constants/api";

interface ConnectStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  canReceivePayments: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

export function StripeConnectSetup() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    loadConnectStatus();
  }, []);

  const loadConnectStatus = async () => {
    try {
      setStatusLoading(true);
      const token = user?.token;
      if (!token) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/connect/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setConnectStatus(data);
      }
    } catch (error) {
      console.error("Error loading Connect status:", error);
    } finally {
      setStatusLoading(false);
    }
  };

  const startOnboarding = async () => {
    if (!user) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/connect/onboard`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountType: "driver",
        }),
      });

      if (response.ok) {
        const data = await response.json();

        const supported = await Linking.canOpenURL(data.onboardingUrl);
        if (supported) {
          await Linking.openURL(data.onboardingUrl);
          // Reload status after user returns
          setTimeout(() => loadConnectStatus(), 2000);
        } else {
          Alert.alert("Error", "No se pudo abrir el enlace de configuración");
        }
      } else {
        const error = await response.json();
        Alert.alert("Error", error.error || "Error al iniciar configuración");
      }
    } catch (error) {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const refreshOnboarding = async () => {
    if (!connectStatus?.accountId) {
      Alert.alert("Error", "No hay cuenta Stripe para actualizar");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/connect/refresh-onboarding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId: connectStatus.accountId }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        const supported = await Linking.canOpenURL(data.onboardingUrl);
        if (supported) {
          await Linking.openURL(data.onboardingUrl);
          setTimeout(() => loadConnectStatus(), 2000);
        }
      } else {
        const error = await response.json().catch(() => ({}));
        Alert.alert("Error", error.error || "Error al actualizar configuración");
      }
    } catch (error) {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }, Shadows.sm]}>
        <ActivityIndicator color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }, Shadows.sm]}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: ComeYaColors.primary + "20" },
          ]}
        >
          <Feather name="credit-card" size={24} color={ComeYaColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="h4">Pagos Automáticos</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Stripe Connect
          </ThemedText>
        </View>
      </View>

      {connectStatus?.canReceivePayments ? (
        <>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: ComeYaColors.success },
              ]}
            />
            <ThemedText type="body" style={{ color: ComeYaColors.success }}>
              Cuenta verificada y activa
            </ThemedText>
          </View>

          <View style={styles.infoBox}>
            <Feather name="check-circle" size={16} color={ComeYaColors.success} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: 8, flex: 1 }}
            >
              Cuando confirmes una entrega, tu pago se libera y Stripe lo
              transfiere a tu cuenta en 1-2 días hábiles
            </ThemedText>
          </View>

          <Pressable
            onPress={refreshOnboarding}
            disabled={loading}
            style={[
              styles.button,
              styles.secondaryButton,
              { borderColor: theme.border },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.text} size="small" />
            ) : (
              <>
                <Feather name="settings" size={18} color={theme.text} />
                <ThemedText
                  type="body"
                  style={{ marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  Actualizar cuenta
                </ThemedText>
              </>
            )}
          </Pressable>
        </>
      ) : connectStatus?.hasAccount ? (
        <>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: ComeYaColors.warning },
              ]}
            />
            <ThemedText type="body" style={{ color: ComeYaColors.warning }}>
              Configuración incompleta
            </ThemedText>
          </View>

          <View style={styles.infoBox}>
            <Feather name="alert-circle" size={16} color={ComeYaColors.warning} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: 8, flex: 1 }}
            >
              Completa tu información bancaria para recibir pagos automáticos
            </ThemedText>
          </View>

          <Pressable
            onPress={refreshOnboarding}
            disabled={loading}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: ComeYaColors.warning },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
                <ThemedText
                  type="body"
                  style={{
                    color: "#FFFFFF",
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Completar configuración
                </ThemedText>
              </>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.infoBox}>
            <Feather name="info" size={16} color={ComeYaColors.primary} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: 8, flex: 1 }}
            >
              Configura tu cuenta Stripe para recibir pagos automáticos cuando
              completes entregas. Los fondos se liberan al confirmar la entrega
              y llegan a tu cuenta en 1-2 días.
            </ThemedText>
          </View>

          <Pressable
            onPress={startOnboarding}
            disabled={loading}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: ComeYaColors.primary },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="plus-circle" size={18} color="#FFFFFF" />
                <ThemedText
                  type="body"
                  style={{
                    color: "#FFFFFF",
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Configurar Stripe
                </ThemedText>
              </>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryButton: {
    // backgroundColor set dynamically
  },
  secondaryButton: {
    borderWidth: 1,
  },
});
