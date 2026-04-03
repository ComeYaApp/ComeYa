import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";

interface StatsData {
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    avgValue: number;
  };
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

type Period = "today" | "week" | "month";

function StatCard({
  icon,
  label,
  value,
  subtext,
  color = ComeYaColors.primary,
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
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
      {subtext ? (
        <ThemedText type="small" style={{ color, marginTop: 2 }}>
          {subtext}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

function TopProductRow({
  product,
  index,
}: {
  product: { name: string; quantity: number; revenue: number };
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[styles.productRow, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: ComeYaColors.primary + "20" },
        ]}
      >
        <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
          {index + 1}
        </ThemedText>
      </View>
      <View style={styles.productInfo}>
        <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {product.quantity} vendidos
        </ThemedText>
      </View>
      <View style={styles.revenueCol}>
        <ThemedText type="body" style={{ fontWeight: "600", color: "#4CAF50" }}>
          ${product.revenue.toFixed(2)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function BusinessStatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");

  const { data, isLoading, refetch, isRefetching } = useQuery<StatsData>({
    queryKey: ["/api/business/stats"],
    enabled: !!user?.id,
  });

  const revenue = data?.revenue || { today: 0, week: 0, month: 0, total: 0 };
  const orders = data?.orders || {
    total: 0,
    completed: 0,
    cancelled: 0,
    avgValue: 0,
  };
  const topProducts = data?.topProducts || [];

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const getRevenueForPeriod = () => {
    switch (selectedPeriod) {
      case "today":
        return revenue.today;
      case "week":
        return revenue.week;
      case "month":
        return revenue.month;
      default:
        return 0;
    }
  };

  const completionRate =
    orders.total > 0
      ? Math.round((orders.completed / orders.total) * 100)
      : 100;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Estadísticas</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.revenueCard,
            { backgroundColor: "#4CAF50" },
            Shadows.lg,
          ]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            Ingresos - {periodLabels[selectedPeriod]}
          </ThemedText>
          <ThemedText
            type="h1"
            style={{
              color: "#FFFFFF",
              fontSize: 42,
              marginVertical: Spacing.sm,
            }}
          >
            ${(getRevenueForPeriod() / 100).toFixed(2)}
          </ThemedText>

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
                    color: selectedPeriod === period ? "#4CAF50" : "#FFFFFF",
                    fontWeight: "600",
                  }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <ThemedText
          type="h3"
          style={{ marginBottom: Spacing.md, marginTop: Spacing.lg }}
        >
          Resumen de Pedidos
        </ThemedText>

        <View style={styles.statsGrid}>
          <StatCard
            icon="shopping-bag"
            label="Pedidos totales"
            value={orders.total}
            color="#2196F3"
            delay={100}
          />
          <StatCard
            icon="check-circle"
            label="Completados"
            value={orders.completed}
            subtext={`${completionRate}% éxito`}
            color="#4CAF50"
            delay={150}
          />
          <StatCard
            icon="x-circle"
            label="Cancelados"
            value={orders.cancelled}
            color="#F44336"
            delay={200}
          />
          <StatCard
            icon="dollar-sign"
            label="Ticket promedio"
            value={`$${(orders.avgValue / 100).toFixed(0)}`}
            color={ComeYaColors.primary}
            delay={250}
          />
        </View>

        {topProducts.length > 0 ? (
          <>
            <ThemedText
              type="h3"
              style={{ marginBottom: Spacing.md, marginTop: Spacing.lg }}
            >
              Productos Más Vendidos
            </ThemedText>
            {topProducts.slice(0, 5).map((product, index) => (
              <TopProductRow
                key={product.name}
                product={product}
                index={index}
              />
            ))}
          </>
        ) : null}

        <View
          style={[
            styles.totalCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <View style={styles.totalRow}>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Ingresos totales
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#4CAF50" }}>
                ${(revenue.total / 100).toFixed(2)}
              </ThemedText>
            </View>
            <View
              style={[styles.iconCircle, { backgroundColor: "#4CAF50" + "20" }]}
            >
              <Feather name="bar-chart-2" size={24} color="#4CAF50" />
            </View>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  revenueCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  periodButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
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
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  revenueCol: {
    alignItems: "flex-end",
  },
  totalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
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
});
