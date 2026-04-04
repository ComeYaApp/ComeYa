import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Period = "today" | "week" | "month";

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

interface DashboardData {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  recentOrders: any[];
}

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
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <ThemedText type="h3" style={{ fontSize: 20 }}>{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center' }}>
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
      <View style={[styles.rankBadge, { backgroundColor: ComeYaColors.primary + "20" }]}>
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

export default function BusinessDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { businesses, selectedBusiness } = useBusiness();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [isOpen, setIsOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  
  const [dashboard, setDashboard] = useState<DashboardData>({
    pendingOrders: 0,
    todayOrders: 0,
    todayRevenue: 0,
    recentOrders: [],
  });
  
  const [stats, setStats] = useState<StatsData>({
    revenue: { today: 0, week: 0, month: 0, total: 0 },
    orders: { total: 0, completed: 0, cancelled: 0, avgValue: 0 },
    topProducts: [],
  });

  const loadData = async () => {
    try {
      const businessId = selectedBusiness?.id;
      const statsUrl = businessId ? `/api/business/stats?businessId=${businessId}` : "/api/business/stats";
      
      const [dashboardRes, statsRes] = await Promise.all([
        apiRequest("GET", "/api/business/dashboard"),
        apiRequest("GET", statsUrl),
      ]);
      
      const dashboardData = await dashboardRes.json();
      const statsData = await statsRes.json();
      
      if (dashboardData.success) {
        setDashboard({
          pendingOrders: dashboardData.dashboard.pendingOrders || 0,
          todayOrders: dashboardData.dashboard.todayOrders || 0,
          todayRevenue: dashboardData.dashboard.todayRevenue || 0,
          recentOrders: dashboardData.dashboard.recentOrders || [],
        });
        setIsOpen(dashboardData.dashboard.isOpen ?? true);
      }
      
      if (statsData.success) {
        setStats({
          revenue: statsData.revenue || { today: 0, week: 0, month: 0, total: 0 },
          orders: statsData.orders || { total: 0, completed: 0, cancelled: 0, avgValue: 0 },
          topProducts: statsData.topProducts || [],
        });
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (selectedBusiness) {
        loadData();
      }
    }, [selectedBusiness])
  );

  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dashboard.pendingOrders > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [dashboard.pendingOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleBusinessStatus = async () => {
    try {
      if (!selectedBusiness?.id) {
        console.error('No business selected');
        return;
      }
      
      const newStatus = !isOpen;
      setIsOpen(newStatus); // Actualizar UI inmediatamente
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await apiRequest("PUT", `/api/business/${selectedBusiness.id}/toggle-status`, {});
      const data = await response.json();
      
      if (data.success) {
        // Confirmar el estado desde el servidor
        setIsOpen(data.isOpen);
      } else {
        // Revertir si hubo error
        setIsOpen(!newStatus);
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      // Revertir en caso de error
      setIsOpen(!isOpen);
    }
  };

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const getRevenueForPeriod = () => {
    switch (selectedPeriod) {
      case "today": return stats.revenue.today;
      case "week": return stats.revenue.week;
      case "month": return stats.revenue.month;
      default: return 0;
    }
  };

  const completionRate = stats.orders.total > 0
    ? Math.round((stats.orders.completed / stats.orders.total) * 100)
    : 100;

  const getStatusTranslation = (status: string) => {
    const translations: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo",
      picked_up: "Recogido",
      on_the_way: "En camino",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return translations[status] || status;
  };

  if (loading) {
    return (
      <LinearGradient colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md }}>Cargando dashboard...</ThemedText>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ComeYaColors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h2">Dashboard</ThemedText>
            {businesses.length > 1 ? (
              <Pressable
                style={styles.businessSelector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MyBusinesses");
                }}
              >
                <ThemedText type="caption" style={{ color: ComeYaColors.primary }}>
                  {selectedBusiness?.name || "Seleccionar negocio"}
                </ThemedText>
                <Feather name="chevron-down" size={14} color={ComeYaColors.primary} />
              </Pressable>
            ) : (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {selectedBusiness?.name || "Panel de control"}
              </ThemedText>
            )}
          </View>
          <View style={styles.statusToggle}>
            <ThemedText type="small" style={{ marginRight: Spacing.sm, color: isOpen ? "#4CAF50" : theme.textSecondary }}>
              {isOpen ? "Abierto" : "Cerrado"}
            </ThemedText>
            <Switch
              value={isOpen}
              onValueChange={toggleBusinessStatus}
              trackColor={{ false: "#767577", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.revenueCard, { backgroundColor: "#4CAF50" }, Shadows.lg]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            Ingresos - {periodLabels[selectedPeriod]}
          </ThemedText>
          <ThemedText type="h1" style={{ color: "#FFFFFF", fontSize: 38, marginVertical: Spacing.sm }}>
            €{getRevenueForPeriod().toFixed(2)}
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
                  { backgroundColor: selectedPeriod === period ? "#FFFFFF" : "rgba(255,255,255,0.2)" },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{ color: selectedPeriod === period ? "#4CAF50" : "#FFFFFF", fontWeight: "600" }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.totalRevenue}>
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.7)" }}>
              Ingresos totales: €{stats.revenue.total.toFixed(2)}
            </ThemedText>
          </View>
        </Animated.View>

        <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
          Resumen de Pedidos
        </ThemedText>
        <View style={styles.statsGrid}>
          <StatCard icon="shopping-bag" label="Totales" value={stats.orders.total} delay={0} />
          <StatCard
            icon="check-circle"
            label="Completados"
            value={stats.orders.completed}
            subtext={`${completionRate}% éxito`}
            color="#4CAF50"
            delay={50}
          />
          <StatCard
            icon="clock"
            label="Pendientes"
            value={dashboard.pendingOrders}
            color={dashboard.pendingOrders > 0 ? ComeYaColors.warning : theme.textSecondary}
            delay={100}
          />
          <StatCard
            icon="x-circle"
            label="Cancelados"
            value={stats.orders.cancelled}
            color={ComeYaColors.error}
            delay={150}
          />
        </View>

        <View style={[styles.avgCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <Feather name="trending-up" size={20} color={ComeYaColors.primary} />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Ticket promedio</ThemedText>
            <ThemedText type="h3">€{stats.orders.avgValue.toFixed(2)}</ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Pedidos hoy</ThemedText>
            <ThemedText type="h3">{dashboard.todayOrders}</ThemedText>
          </View>
        </View>

        {stats.topProducts.length > 0 ? (
          <>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              Productos Más Vendidos
            </ThemedText>
            {stats.topProducts.map((product, index) => (
              <TopProductRow key={index} product={product} index={index} />
            ))}
          </>
        ) : null}

        {dashboard.recentOrders.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3">Pedidos Recientes</ThemedText>
              <Pressable onPress={() => navigation.navigate("BusinessOrders" as any)}>
                <ThemedText type="small" style={{ color: ComeYaColors.primary }}>Ver todos</ThemedText>
              </Pressable>
            </View>
            {dashboard.recentOrders.slice(0, 5).map((order: any, index: number) => (
              <Animated.View
                key={order.id}
                entering={FadeInDown.delay(index * 50).springify()}
                style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
              >
                <View style={styles.orderHeader}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Pedido #{order.id?.slice(-6) || index}
                  </ThemedText>
                  <Badge
                    text={getStatusTranslation(order.status)}
                    variant={order.status === "delivered" ? "success" : order.status === "cancelled" ? "error" : "primary"}
                  />
                </View>
                <View style={styles.orderDetails}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {order.customerName || "Cliente"}
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600", color: ComeYaColors.primary }}>
                    €{(order.subtotal || 0).toFixed(2)}
                  </ThemedText>
                </View>
              </Animated.View>
            ))}
          </>
        ) : null}

        <View style={styles.quickActions}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Acciones Rápidas</ThemedText>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessOrders" as any)}
            >
              <Feather name="clipboard" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>Pedidos</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessProducts" as any)}
            >
              <Feather name="package" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>Productos</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessFinances" as any)}
            >
              <Feather name="dollar-sign" size={24} color="#4CAF50" />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, textAlign: 'center' }}>Finanzas</ThemedText>
            </Pressable>
          </View>
          <View style={[styles.actionsRow, { marginTop: Spacing.sm }]}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessHours" as any)}
            >
              <Feather name="clock" size={24} color="#FF9800" />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, textAlign: 'center' }}>Horarios</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessProfile" as any)}
            >
              <Feather name="settings" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, textAlign: 'center' }}>Ajustes</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  businessSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  revenueCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  periodSelector: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  totalRevenue: {
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  avgCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  revenueCol: {
    alignItems: "flex-end",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  orderCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  quickActions: {
    marginTop: Spacing.xl,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    ...Shadows.sm,
  },
});
