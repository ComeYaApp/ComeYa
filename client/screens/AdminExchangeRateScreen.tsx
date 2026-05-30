// Admin Exchange Rate Settings Screen
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ExchangeRateData {
  rate: number;
  source: "alcambio" | "manual" | "fallback";
  lastUpdated?: string;
}

export default function AdminExchangeRateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentRate, setCurrentRate] = useState<ExchangeRateData | null>(null);
  const [manualRate, setManualRate] = useState("");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadCurrentRate();
  }, []);

  const loadCurrentRate = async () => {
    try {
      const response = await apiRequest("GET", "/api/admin/exchange-rate");
      const data = await response.json();

      if (data.success !== false) {
        setCurrentRate({
          rate: data.rate,
          source: data.source,
          lastUpdated: data.lastUpdated,
        });
        setManualRate(data.rate.toFixed(2));
      }
    } catch (error) {
      console.error("Error loading exchange rate:", error);
      showToast("Error al cargar la tasa", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCurrentRate();
  };

  const handleUpdateManualRate = async () => {
    const rate = parseFloat(manualRate);

    if (isNaN(rate) || rate <= 0) {
      showToast("Ingresa una tasa válida", "error");
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("POST", "/api/admin/exchange-rate", {
        rate,
      });
      const data = await response.json();

      if (data.success) {
        showToast(data.message, "success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadCurrentRate();
      } else {
        showToast(data.message || "Error al actualizar", "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      showToast("Error al actualizar la tasa", "error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAutoUpdate = async (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    Haptics.selectionAsync();

    try {
      const response = await apiRequest(
        "POST",
        "/api/admin/exchange-rate/auto-update",
        { enabled },
      );
      const data = await response.json();

      if (data.success) {
        showToast(data.message, "success");
        loadCurrentRate();
      } else {
        showToast(data.message || "Error", "error");
        setAutoUpdateEnabled(!enabled);
      }
    } catch (error) {
      showToast("Error al cambiar configuración", "error");
      setAutoUpdateEnabled(!enabled);
    }
  };

  const handleForceUpdate = async () => {
    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest(
        "POST",
        "/api/admin/exchange-rate/force-update",
        {},
      );
      const data = await response.json();

      if (data.rate) {
        showToast(`Tasa actualizada: ${data.rate} Bs/USD`, "success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadCurrentRate();
      } else {
        showToast("No se pudo obtener la tasa", "error");
      }
    } catch (error) {
      showToast("Error al actualizar desde AlCambio", "error");
    } finally {
      setUpdating(false);
    }
  };

  const getSourceBadge = () => {
    if (!currentRate) return null;

    const badges = {
      alcambio: { label: "AlCambio.app", color: "#4CAF50", icon: "globe" },
      manual: { label: "Manual", color: "#FF9800", icon: "edit-3" },
      fallback: {
        label: "Por defecto",
        color: "#9E9E9E",
        icon: "alert-circle",
      },
    };

    const badge = badges[currentRate.source];

    return (
      <View
        style={[styles.sourceBadge, { backgroundColor: badge.color + "20" }]}
      >
        <Feather name={badge.icon as any} size={14} color={badge.color} />
        <ThemedText
          type="caption"
          style={{ color: badge.color, marginLeft: 4, fontWeight: "600" }}
        >
          {badge.label}
        </ThemedText>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Tasa de Cambio</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Tasa de Cambio</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {/* Current Rate Card */}
        <View
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: ComeYaColors.primaryLight },
              ]}
            >
              <Feather
                name="dollar-sign"
                size={28}
                color={ComeYaColors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Tasa Actual
              </ThemedText>
              <ThemedText type="h1" style={{ color: ComeYaColors.primary }}>
                {currentRate?.rate.toFixed(2)} Bs
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                por 1 USD
              </ThemedText>
            </View>
          </View>

          <View style={styles.sourceRow}>
            {getSourceBadge()}
            {currentRate?.lastUpdated && (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginLeft: 8 }}
              >
                Actualizado:{" "}
                {new Date(currentRate.lastUpdated).toLocaleTimeString("es-VE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Auto-Update Toggle */}
        <View
          style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Actualización Automática
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 4 }}
              >
                Obtener tasa desde AlCambio.app cada 5 minutos
              </ThemedText>
            </View>
            <Switch
              value={autoUpdateEnabled}
              onValueChange={handleToggleAutoUpdate}
              trackColor={{
                false: theme.border,
                true: ComeYaColors.primary + "80",
              }}
              thumbColor={
                autoUpdateEnabled ? ComeYaColors.primary : theme.textSecondary
              }
            />
          </View>

          {autoUpdateEnabled && (
            <Button
              onPress={handleForceUpdate}
              disabled={updating}
              style={{
                marginTop: Spacing.md,
                backgroundColor: theme.backgroundSecondary,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {updating ? (
                  <ActivityIndicator
                    size="small"
                    color={ComeYaColors.primary}
                  />
                ) : (
                  <Feather
                    name="refresh-cw"
                    size={18}
                    color={ComeYaColors.primary}
                  />
                )}
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, fontWeight: "600" }}
                >
                  Actualizar Ahora
                </ThemedText>
              </View>
            </Button>
          )}
        </View>

        {/* Manual Rate Update */}
        <View
          style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Actualizar Manualmente
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
          >
            {autoUpdateEnabled
              ? "Esta tasa se usará como fallback si AlCambio no responde"
              : "Esta será la tasa fija que se usará en la plataforma"}
          </ThemedText>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginBottom: 4 }}
              >
                Tasa (Bs/USD)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={manualRate}
                onChangeText={setManualRate}
                keyboardType="decimal-pad"
                placeholder="36.50"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <Button
              onPress={handleUpdateManualRate}
              disabled={updating}
              style={{ marginTop: 20, paddingHorizontal: Spacing.xl }}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                "Guardar"
              )}
            </Button>
          </View>
        </View>

        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: "#2196F320", borderColor: "#2196F3" },
          ]}
        >
          <Feather name="info" size={20} color="#2196F3" />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText
              type="small"
              style={{ color: "#2196F3", lineHeight: 20 }}
            >
              <ThemedText
                type="small"
                style={{ fontWeight: "600", color: "#2196F3" }}
              >
                AlCambio.app
              </ThemedText>{" "}
              es una fuente confiable que actualiza la tasa USDT en tiempo real.
              La tasa se cachea por 5 minutos para optimizar rendimiento.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
});
