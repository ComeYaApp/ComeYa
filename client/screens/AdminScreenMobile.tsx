import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
}

export default function AdminScreenMobile() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToast("Error al cargar estadísticas", "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchStats();
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h1">Panel Admin</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Bienvenido, {user?.name}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {stats ? (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}>
              <Feather name="users" size={24} color={ComeYaColors.primary} />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {stats.totalUsers}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Usuarios
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}>
              <Feather name="shopping-bag" size={24} color={ComeYaColors.primary} />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {stats.totalOrders}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Pedidos
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}>
              <Feather name="dollar-sign" size={24} color={ComeYaColors.success} />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                ${stats.totalRevenue.toFixed(0)}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Ingresos
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}>
              <Feather name="clock" size={24} color={ComeYaColors.warning} />
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {stats.pendingOrders}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Pendientes
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Feather name="alert-circle" size={48} color={theme.textSecondary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
              No se pudieron cargar las estadísticas
            </ThemedText>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
            Para acceder al panel completo, usa la versión web en tu computadora
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  emptyState: {
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
