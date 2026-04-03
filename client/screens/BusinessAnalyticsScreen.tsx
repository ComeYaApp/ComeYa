import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LineChart, BarChart } from 'react-native-chart-kit';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

const { width } = Dimensions.get('window');

export default function BusinessAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [refreshing, setRefreshing] = useState(false);

  // Obtener businessId del usuario
  const businessId = user?.businessId || 'demo_business';

  // Dashboard principal
  const { data: dashboardData, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/analytics/dashboard', businessId, period],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/dashboard/${businessId}?period=${period}`);
      return response.json();
    },
  });

  // Productos más vendidos
  const { data: topProductsData } = useQuery({
    queryKey: ['/api/analytics/top-products', businessId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/top-products/${businessId}?limit=5`);
      return response.json();
    },
  });

  // Horas pico
  const { data: peakHoursData } = useQuery({
    queryKey: ['/api/analytics/peak-hours', businessId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/peak-hours/${businessId}`);
      return response.json();
    },
  });

  // Gráfico de ventas
  const { data: salesChartData } = useQuery({
    queryKey: ['/api/analytics/sales-chart', businessId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/sales-chart/${businessId}?days=7`);
      return response.json();
    },
  });

  // Comparativa semanal
  const { data: comparisonData } = useQuery({
    queryKey: ['/api/analytics/weekly-comparison', businessId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/weekly-comparison/${businessId}`);
      return response.json();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchDashboard();
    setRefreshing(false);
  };

  const dashboard = dashboardData?.dashboard;
  const topProducts = topProductsData?.topProducts || [];
  const peakHours = peakHoursData?.peakHours || [];
  const salesChart = salesChartData?.chartData || [];
  const comparison = comparisonData?.comparison;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Análisis</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['today', 'week', 'month'] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              styles.periodButton,
              {
                backgroundColor: period === p ? ComeYaColors.primary : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={{
                color: period === p ? '#FFFFFF' : theme.text,
                fontWeight: period === p ? '600' : '400',
              }}
            >
              {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Métricas principales */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <Feather name="shopping-bag" size={24} color={ComeYaColors.primary} />
            <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
              {dashboard?.totalOrders || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pedidos
            </ThemedText>
            {dashboard?.ordersChange !== undefined && (
              <ThemedText
                type="caption"
                style={{
                  color: dashboard.ordersChange >= 0 ? ComeYaColors.success : ComeYaColors.error,
                  marginTop: 4,
                }}
              >
                {dashboard.ordersChange >= 0 ? '+' : ''}
                {dashboard.ordersChange.toFixed(1)}%
              </ThemedText>
            )}
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <Feather name="dollar-sign" size={24} color={ComeYaColors.success} />
            <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
              Bs.{dashboard?.totalRevenue?.toFixed(2) || '0.00'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Ingresos
            </ThemedText>
            {dashboard?.revenueChange !== undefined && (
              <ThemedText
                type="caption"
                style={{
                  color: dashboard.revenueChange >= 0 ? ComeYaColors.success : ComeYaColors.error,
                  marginTop: 4,
                }}
              >
                {dashboard.revenueChange >= 0 ? '+' : ''}
                {dashboard.revenueChange.toFixed(1)}%
              </ThemedText>
            )}
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <Feather name="trending-up" size={24} color={ComeYaColors.warning} />
            <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
              Bs.{dashboard?.avgOrderValue?.toFixed(2) || '0.00'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Ticket Promedio
            </ThemedText>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <Feather name="star" size={24} color="#FFD700" />
            <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
              {dashboard?.rating?.toFixed(1) || '0.0'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Rating ({dashboard?.totalReviews || 0})
            </ThemedText>
          </View>
        </View>

        {/* Comparativa semanal */}
        {comparison && (
          <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Comparativa Semanal
            </ThemedText>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonCol}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Esta Semana
                </ThemedText>
                <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                  {comparison.thisWeek.orders} pedidos
                </ThemedText>
                <ThemedText type="body">Bs.{comparison.thisWeek.revenue.toFixed(2)}</ThemedText>
              </View>
              <View style={styles.comparisonCol}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Semana Anterior
                </ThemedText>
                <ThemedText type="h4">{comparison.lastWeek.orders} pedidos</ThemedText>
                <ThemedText type="body">Bs.{comparison.lastWeek.revenue.toFixed(2)}</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Gráfico de ventas */}
        {salesChart.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Ventas (Últimos 7 días)
            </ThemedText>
            <LineChart
              data={{
                labels: salesChart.map((d: any) => d.date.split('-')[2]),
                datasets: [{ data: salesChart.map((d: any) => d.revenue) }],
              }}
              width={width - 64}
              height={200}
              chartConfig={{
                backgroundColor: theme.card,
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(232, 180, 168, ${opacity})`,
                labelColor: (opacity = 1) => theme.text,
                style: { borderRadius: BorderRadius.lg },
                propsForDots: { r: '4', strokeWidth: '2', stroke: ComeYaColors.primary },
              }}
              bezier
              style={{ borderRadius: BorderRadius.lg }}
            />
          </View>
        )}

        {/* Productos más vendidos */}
        {topProducts.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Productos Más Vendidos
            </ThemedText>
            {topProducts.map((product: any, index: number) => (
              <View key={product.productId} style={styles.productRow}>
                <View style={[styles.productRank, { backgroundColor: ComeYaColors.primary + '20' }]}>
                  <ThemedText type="caption" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <View style={styles.productInfo}>
                  <ThemedText type="body" numberOfLines={1}>
                    {product.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {product.unitsSold} unidades • Bs.{product.revenue.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Horas pico */}
        {peakHours.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Horas Pico
            </ThemedText>
            <BarChart
              data={{
                labels: peakHours.slice(0, 6).map((h: any) => `${h.hour}h`),
                datasets: [{ data: peakHours.slice(0, 6).map((h: any) => h.orderCount) }],
              }}
              width={width - 64}
              height={200}
              chartConfig={{
                backgroundColor: theme.card,
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(212, 168, 156, ${opacity})`,
                labelColor: (opacity = 1) => theme.text,
                style: { borderRadius: BorderRadius.lg },
              }}
              style={{ borderRadius: BorderRadius.lg }}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  comparisonCol: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  productRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  productInfo: {
    flex: 1,
  },
});
