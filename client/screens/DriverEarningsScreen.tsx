import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";

interface EarningsData {
  stats: {
    totalDeliveries: number;
    rating?: number;
    completionRate: number;
    avgDeliveryTime: number;
    todayEarnings?: number;
    weekEarnings?: number;
    monthEarnings?: number;
    totalEarnings?: number;
  };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

type Period = "today" | "week" | "month";

function StatCard({
  icon,
  label,
  value,
  color = ComeYaColors.primary,
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  delay?: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <ThemedText type="h3">{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");

  const { data, isLoading, refetch, isRefetching } = useQuery<EarningsData>({
    queryKey: ["/api/delivery/stats"],
    enabled: !!user?.id,
  });

  const { data: transactionsData, refetch: refetchTransactions } = useQuery<{
    success: boolean;
    transactions: Transaction[];
  }>({
    queryKey: ["/api/wallet/transactions"],
    enabled: !!user?.id,
  });

  const earnings = {
    today: (data?.stats?.todayEarnings || 0) / 100,
    week: (data?.stats?.weekEarnings || 0) / 100,
    month: (data?.stats?.monthEarnings || 0) / 100,
    total: (data?.stats?.totalEarnings || 0) / 100,
  };

  const stats = {
    totalDeliveries: data?.stats?.totalDeliveries || 0,
    averageRating: data?.stats?.rating || 0,
    completionRate: data?.stats?.completionRate || 100,
    avgDeliveryTime: data?.stats?.avgDeliveryTime || 0,
  };

  const transactions = transactionsData?.transactions || [];
  const deliveryTransactions = transactions.filter(
    (t) => t.type === "delivery_income" || t.type === "income"
  );

  // Debug log
  console.log("📊 Driver Earnings Debug:");
  console.log("  Today:", earnings.today);
  console.log("  Week:", earnings.week);
  console.log("  Month:", earnings.month);
  console.log("  Total:", earnings.total);
  console.log("  Transactions:", deliveryTransactions.length);

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const getEarningsForPeriod = () => {
    switch (selectedPeriod) {
      case "today":
        return earnings.today;
      case "week":
        return earnings.week;
      case "month":
        return earnings.month;
      default:
        return 0;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-VE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = () => {
    refetch();
    refetchTransactions();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <ThemedText type="h2">💰 Mis Ganancias</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Pagos automáticos vía Stripe
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {/* Earnings Card */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[
            styles.earningsCard,
            { backgroundColor: ComeYaColors.primary },
            Shadows.lg,
          ]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            {periodLabels[selectedPeriod]}
          </ThemedText>
          <ThemedText
            type="h1"
            style={{
              color: "#FFFFFF",
              fontSize: 42,
              marginVertical: Spacing.sm,
            }}
          >
            €{getEarningsForPeriod().toFixed(2)}
          </ThemedText>
          
          {getEarningsForPeriod() === 0 && earnings.total > 0 && (
            <View style={styles.emptyPeriodHint}>
              <Feather name="info" size={14} color="rgba(255,255,255,0.8)" />
              <ThemedText
                type="caption"
                style={{ color: "rgba(255,255,255,0.8)", marginLeft: 6 }}
              >
                Sin entregas en este período
              </ThemedText>
            </View>
          )}

          <View style={styles.periodSelector}>
            {(["today", "week", "month"] as Period[]).map((period) => (
              <Pressable
                key={period}
                onPress={() => {
                  setSelectedPeriod(period);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor:
                      selectedPeriod === period
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color:
                      selectedPeriod === period
                        ? ComeYaColors.primary
                        : "#FFFFFF",
                    fontWeight: "600",
                  }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Info Card - Stripe Automatic Payments */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Pagos automáticos
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 4 }}
            >
              Cuando confirmes la entrega, tu pago se libera automáticamente y
              Stripe lo transfiere a tu cuenta bancaria en 1-2 días hábiles.
              Configura tu cuenta en Perfil → Pagos y Cuenta Bancaria.
            </ThemedText>
          </View>
        </View>

        {/* Total Earned Card */}
        <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.md]}>
          <View style={styles.totalRow}>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Total ganado histórico
              </ThemedText>
              <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
                €{earnings.total.toFixed(2)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: ComeYaColors.primary + "20" },
              ]}
            >
              <Feather name="award" size={24} color={ComeYaColors.primary} />
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <ThemedText
          type="h3"
          style={{ marginBottom: Spacing.md, marginTop: Spacing.lg }}
        >
          📈 Estadísticas
        </ThemedText>

        <View style={styles.statsGrid}>
          <StatCard
            icon="truck"
            label="Entregas totales"
            value={stats.totalDeliveries}
            color="#4CAF50"
            delay={200}
          />
          <StatCard
            icon="star"
            label="Calificación"
            value={stats.averageRating.toFixed(1)}
            color="#FF9800"
            delay={250}
          />
          <StatCard
            icon="check-circle"
            label="Completadas"
            value={`${stats.completionRate}%`}
            color="#2196F3"
            delay={300}
          />
          <StatCard
            icon="clock"
            label="Tiempo prom."
            value={`${stats.avgDeliveryTime}m`}
            color="#9C27B0"
            delay={350}
          />
        </View>

        {/* Delivery History */}
        <ThemedText
          type="h3"
          style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
        >
          📦 Historial de Entregas
        </ThemedText>

        {deliveryTransactions.length > 0 ? (
          deliveryTransactions.slice(0, 15).map((tx, index) => (
            <Animated.View
              key={tx.id}
              entering={FadeInRight.delay(index * 50).springify()}
              style={[styles.deliveryItem, { backgroundColor: theme.card }, Shadows.sm]}
            >
              <View
                style={[
                  styles.deliveryIcon,
                  { backgroundColor: ComeYaColors.success + "20" },
                ]}
              >
                <Feather name="check-circle" size={20} color={ComeYaColors.success} />
              </View>
              <View style={styles.deliveryInfo}>
                <ThemedText type="body">{tx.description}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {formatDate(tx.createdAt)}
                </ThemedText>
              </View>
              <ThemedText
                type="body"
                style={{
                  color: ComeYaColors.success,
                  fontWeight: "600",
                }}
              >
                +€{(Math.abs(tx.amount) / 100).toFixed(2)}
              </ThemedText>
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md }}
            >
              No hay entregas completadas aún
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  earningsCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  totalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  deliveryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  deliveryInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyPeriodHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
});
