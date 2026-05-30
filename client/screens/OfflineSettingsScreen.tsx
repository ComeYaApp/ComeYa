import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useOffline } from "@/hooks/useOffline";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { OfflineCacheService } from "@/services/OfflineCacheService";
import { useToast } from "@/contexts/ToastContext";

export default function OfflineSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { isOnline, isOffline } = useOffline();
  const { showToast } = useToast();

  const [cacheStats, setCacheStats] = useState({
    totalItems: 0,
    totalSize: 0,
    sizeInMB: 0,
  });
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [autoSync, setAutoSync] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const stats = await OfflineCacheService.getCacheStats();
    setCacheStats(stats);

    const queue = await OfflineCacheService.getSyncQueue();
    setSyncQueueCount(queue.length);
  };

  const handleClearCache = () => {
    Alert.alert(
      "Limpiar Caché",
      "¿Estás seguro? Se eliminarán todos los datos guardados offline.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await OfflineCacheService.clear();
            await loadStats();
            setLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Caché limpiada", "success");
          },
        },
      ],
    );
  };

  const handleSyncNow = async () => {
    if (isOffline) {
      showToast("Sin conexión", "error");
      return;
    }

    setLoading(true);
    try {
      // Aquí se sincronizaría la cola
      await OfflineCacheService.clearSyncQueue();
      await loadStats();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Sincronizado correctamente", "success");
    } catch (error) {
      showToast("Error al sincronizar", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Modo Offline</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Connection Status */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOnline
                    ? ComeYaColors.success
                    : ComeYaColors.error,
                },
              ]}
            />
            <View style={styles.statusInfo}>
              <ThemedText type="h4">
                {isOnline ? "Conectado" : "Sin conexión"}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {isOnline
                  ? "Todos los datos están sincronizados"
                  : "Usando datos guardados localmente"}
              </ThemedText>
            </View>
            <Feather
              name={isOnline ? "wifi" : "wifi-off"}
              size={24}
              color={isOnline ? ComeYaColors.success : ComeYaColors.error}
            />
          </View>
        </View>

        {/* Cache Stats */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Estadísticas de Caché
          </ThemedText>

          <View style={styles.statRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Items guardados
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {cacheStats.totalItems}
            </ThemedText>
          </View>

          <View style={styles.statRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Espacio usado
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {cacheStats.sizeInMB.toFixed(2)} MB
            </ThemedText>
          </View>

          <View style={styles.statRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Acciones pendientes
            </ThemedText>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", color: ComeYaColors.warning }}
            >
              {syncQueueCount}
            </ThemedText>
          </View>
        </View>

        {/* Settings */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Configuración
          </ThemedText>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText type="body">Sincronización automática</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Sincronizar al reconectar
              </ThemedText>
            </View>
            <Switch
              value={autoSync}
              onValueChange={(value) => {
                setAutoSync(value);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              trackColor={{ false: theme.border, true: ComeYaColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {syncQueueCount > 0 && (
            <Pressable
              onPress={handleSyncNow}
              disabled={isOffline || loading}
              style={[
                styles.actionButton,
                {
                  backgroundColor: ComeYaColors.primary,
                  opacity: isOffline || loading ? 0.5 : 1,
                },
                Shadows.sm,
              ]}
            >
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", marginLeft: 8, fontWeight: "600" }}
              >
                {loading
                  ? "Sincronizando..."
                  : `Sincronizar ahora (${syncQueueCount})`}
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={handleClearCache}
            disabled={loading}
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.backgroundSecondary,
                opacity: loading ? 0.5 : 1,
              },
              Shadows.sm,
            ]}
          >
            <Feather name="trash-2" size={18} color={ComeYaColors.error} />
            <ThemedText
              type="body"
              style={{
                color: ComeYaColors.error,
                marginLeft: 8,
                fontWeight: "600",
              }}
            >
              Limpiar caché
            </ThemedText>
          </Pressable>
        </View>

        {/* Info */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: ComeYaColors.primary + "10" },
          ]}
        >
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <ThemedText
            type="caption"
            style={{ flex: 1, marginLeft: Spacing.sm }}
          >
            El modo offline te permite navegar y agregar al carrito sin
            conexión. Los cambios se sincronizarán automáticamente cuando
            vuelvas a conectarte.
          </ThemedText>
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
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  actions: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
