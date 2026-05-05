import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { LineChart } from "react-native-chart-kit";
import { Platform } from "react-native";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  if (cents >= 100_000_00) return `€${(cents / 100 / 1_000_000).toFixed(1)}M`;
  if (cents >= 1_000_00) return `€${(cents / 100 / 1_000).toFixed(1)}K`;
  return `€${(cents / 100).toFixed(0)}`;
}

function pct(val: number, prev: number) {
  if (!prev) return null;
  const p = ((val - prev) / prev) * 100;
  return { value: Math.abs(p).toFixed(1), up: p >= 0 };
}

// ─── sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  color,
  sub,
  trend,
  width,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  trend?: { value: string; up: boolean } | null;
  width: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={[kpi.card, { backgroundColor: theme.card, width }]}>
      <View style={[kpi.iconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[kpi.value, { color: theme.text }]}>{value}</Text>
      <Text style={[kpi.label, { color: theme.textSecondary }]}>{label}</Text>
      {(sub || trend) && (
        <View style={kpi.footer}>
          {trend && (
            <View style={kpi.trendRow}>
              <Feather
                name={trend.up ? "trending-up" : "trending-down"}
                size={11}
                color={trend.up ? ComeYaColors.success : ComeYaColors.error}
              />
              <Text
                style={[
                  kpi.trendText,
                  { color: trend.up ? ComeYaColors.success : ComeYaColors.error },
                ]}
              >
                {trend.value}%
              </Text>
            </View>
          )}
          {sub && (
            <Text style={[kpi.sub, { color: theme.textSecondary }]}>{sub}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  const { theme } = useTheme();
  return (
    <View style={sh.row}>
      <View style={[sh.iconWrap, { backgroundColor: ComeYaColors.primary + "18" }]}>
        <Feather name={icon} size={16} color={ComeYaColors.primary} />
      </View>
      <Text style={[sh.title, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

function StatRow({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: any;
}) {
  const { theme } = useTheme();
  return (
    <View style={sr.row}>
      <View style={[sr.dot, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <Text style={[sr.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[sr.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [salesChart, setSalesChart] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);

  const load = async () => {
    try {
      const [metricsRes, salesRes, earningsRes, payoutsRes] = await Promise.all([
        apiRequest("GET", "/api/admin/dashboard/metrics"),
        apiRequest("GET", "/api/admin/finance/earnings-chart?days=7"),
        apiRequest("GET", "/api/admin/finance/platform-earnings?period=month"),
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
      ]);
      const [m, s, e, p] = await Promise.all([
        metricsRes.json(),
        salesRes.json(),
        earningsRes.json(),
        payoutsRes.json(),
      ]);
      if (m) setMetrics(m);
      if (s.success) setSalesChart(s);
      const pendingPayouts = p?.payouts?.length ?? 0;
      const pendingPayoutAmount = p?.payouts?.reduce((acc: number, x: any) => acc + (x.amount ?? 0), 0) ?? 0;
      setFinance({
        weekRevenue: e?.earnings?.week ?? 0,
        monthRevenue: e?.earnings?.month ?? 0,
        pendingPayouts,
        pendingPayoutAmount,
        fraudCount: m?.fraudCount ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  // responsive: 2 cols on narrow, 4 cols on wide
  const isWide = width >= 700;
  const cols = isWide ? 4 : 2;
  const gap = 12;
  const padding = 16;
  const cardW = (width - padding * 2 - gap * (cols - 1)) / cols;

  const todayTrend = pct(metrics?.todayOrders, metrics?.yesterdayOrders);
  const revTrend = pct(metrics?.todayRevenue, metrics?.yesterdayRevenue);

  const chartWidth = width - padding * 2 - 32; // card padding

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot ?? theme.background }}
      contentContainerStyle={{ padding, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={ComeYaColors.primary}
        />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.text }]}>Dashboard Global</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>
            Vista en tiempo real de la plataforma
          </Text>
        </View>
        <View style={[s.liveBadge, { backgroundColor: ComeYaColors.error + "18" }]}>
          <View style={s.liveDot} />
          <Text style={[s.liveText, { color: ComeYaColors.error }]}>LIVE</Text>
        </View>
      </View>

      {/* ── KPIs principales ── */}
      <View style={[s.grid, { gap }]}>
        <KpiCard icon="users" label="Usuarios" value={metrics?.totalUsers ?? 0}
          color={ComeYaColors.primary} width={cardW}
          sub={`${metrics?.newUsersToday ?? 0} hoy`} />
        <KpiCard icon="briefcase" label="Negocios" value={metrics?.totalBusinesses ?? 0}
          color={ComeYaColors.success} width={cardW}
          sub={`${metrics?.activeBusinesses ?? metrics?.totalBusinesses ?? 0} activos`} />
        <KpiCard icon="truck" label="Repartidores" value={metrics?.totalDrivers ?? 0}
          color={ComeYaColors.warning} width={cardW}
          sub={`${metrics?.onlineDrivers ?? 0} online`} />
        <KpiCard icon="shopping-bag" label="Pedidos totales" value={metrics?.totalOrders ?? 0}
          color="#6C5CE7" width={cardW}
          sub={`${metrics?.completedOrders ?? 0} completados`} />
      </View>

      {/* ── Hoy ── */}
      <View style={[s.grid, { gap, marginTop: gap }]}>
        <KpiCard icon="calendar" label="Pedidos hoy" value={metrics?.todayOrders ?? 0}
          color={ComeYaColors.success} width={cardW} trend={todayTrend} />
        <KpiCard icon="dollar-sign" label="Ingresos hoy" value={fmt(metrics?.todayRevenue ?? 0)}
          color={ComeYaColors.primary} width={cardW} trend={revTrend} />
        <Pressable onPress={() => navigation.navigate("Orders")}> 
          <KpiCard icon="clock" label="Pedidos activos" value={metrics?.pendingOrders ?? 0}
            color={ComeYaColors.warning} width={cardW}
            sub="en proceso" />
        </Pressable>
        <KpiCard icon="alert-circle" label="Pagos pendientes" value={metrics?.pendingPayments ?? 0}
          color={ComeYaColors.error} width={cardW}
          sub="por verificar" />
      </View>

      {/* ── Gráfico ventas ── */}
      {salesChart?.chartData?.length > 0 && (
        <View style={[s.card, { backgroundColor: theme.card, marginTop: gap }]}>
          <SectionHeader icon="trending-up" title="Ventas — últimos 7 días" />
          {Platform.OS !== "web" ? (
            <LineChart
              data={{
                labels: salesChart.chartData.map((d: any) => d.date.slice(5)),
                datasets: [{ data: salesChart.chartData.map((d: any) => d.amount / 100) }],
              }}
              width={chartWidth}
              height={180}
              chartConfig={{
                backgroundColor: theme.card,
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 0,
                color: (o = 1) => `rgba(232,180,168,${o})`,
                labelColor: () => theme.textSecondary,
                propsForDots: { r: "4", strokeWidth: "2", stroke: ComeYaColors.primary },
                propsForBackgroundLines: { stroke: theme.border, strokeDasharray: "4" },
              }}
              bezier
              style={{ borderRadius: 8, marginTop: 8 }}
              withInnerLines
              withOuterLines={false}
            />
          ) : (
            <View style={{ marginTop: 8, gap: 6 }}>
              {salesChart.chartData.map((d: any) => (
                <View key={d.date} style={[s.row2, { justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{d.date.slice(5)}</Text>
                  <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>€{(d.amount / 100).toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Estado de pedidos + Finanzas ── */}
      <View style={[s.row2, { gap, marginTop: gap }]}>
        {/* Estado pedidos */}
        <View style={[s.card, s.flex1, { backgroundColor: theme.card }]}>
          <SectionHeader icon="activity" title="Estado de pedidos" />
          <StatRow label="Pendientes" value={metrics?.pendingOrders ?? 0}
            color={ComeYaColors.warning} icon="clock" />
          <StatRow label="Preparando" value={metrics?.preparingOrders ?? 0}
            color={ComeYaColors.primary} icon="loader" />
          <StatRow label="En camino" value={metrics?.onTheWayOrders ?? 0}
            color={ComeYaColors.success} icon="truck" />
          <StatRow label="Entregados hoy" value={metrics?.deliveredToday ?? 0}
            color="#6C5CE7" icon="check-circle" />
          <StatRow label="Cancelados hoy" value={metrics?.cancelledToday ?? 0}
            color={ComeYaColors.error} icon="x-circle" />
        </View>

        {/* Finanzas */}
        <View style={[s.card, s.flex1, { backgroundColor: theme.card }]}>
          <SectionHeader icon="dollar-sign" title="Finanzas" />
          <StatRow label="Ingresos semana" value={fmt(finance?.weekRevenue ?? metrics?.weekRevenue ?? 0)}
            color={ComeYaColors.success} icon="trending-up" />
          <StatRow label="Ingresos mes" value={fmt(finance?.monthRevenue ?? metrics?.monthRevenue ?? 0)}
            color={ComeYaColors.primary} icon="bar-chart-2" />
          <StatRow label="Payouts pendientes" value={finance?.pendingPayouts ?? metrics?.pendingPayouts ?? 0}
            color={ComeYaColors.warning} icon="send" />
          <StatRow label="Monto a pagar" value={fmt(finance?.pendingPayoutAmount ?? 0)}
            color={ComeYaColors.warning} icon="credit-card" />
          <StatRow label="Fraudes detectados" value={finance?.fraudCount ?? metrics?.fraudCount ?? 0}
            color={ComeYaColors.error} icon="shield" />
        </View>
      </View>

      {/* ── Plataforma ── */}
      <View style={[s.card, { backgroundColor: theme.card, marginTop: gap }]}>
        <SectionHeader icon="pie-chart" title="Plataforma" />
        <View style={[s.row2, { gap: 8, marginTop: 8 }]}>
          <View style={[s.flex1, s.miniStat, { backgroundColor: ComeYaColors.primary + "12" }]}>
            <Text style={[s.miniVal, { color: ComeYaColors.primary }]}>
              {metrics?.avgOrderValue ? fmt(metrics.avgOrderValue) : "—"}
            </Text>
            <Text style={[s.miniLabel, { color: theme.textSecondary }]}>Ticket promedio</Text>
          </View>
          <View style={[s.flex1, s.miniStat, { backgroundColor: ComeYaColors.success + "12" }]}>
            <Text style={[s.miniVal, { color: ComeYaColors.success }]}>
              {metrics?.completionRate ? `${metrics.completionRate}%` : "—"}
            </Text>
            <Text style={[s.miniLabel, { color: theme.textSecondary }]}>Tasa completados</Text>
          </View>
          <View style={[s.flex1, s.miniStat, { backgroundColor: ComeYaColors.warning + "12" }]}>
            <Text style={[s.miniVal, { color: ComeYaColors.warning }]}>
              {metrics?.avgDeliveryTime ? `${metrics.avgDeliveryTime}m` : "—"}
            </Text>
            <Text style={[s.miniLabel, { color: theme.textSecondary }]}>Tiempo entrega</Text>
          </View>
          <View style={[s.flex1, s.miniStat, { backgroundColor: "#6C5CE7" + "12" }]}>
            <Text style={[s.miniVal, { color: "#6C5CE7" }]}>
              {metrics?.avgRating ? `${(metrics.avgRating / 100).toFixed(1)}★` : "—"}
            </Text>
            <Text style={[s.miniLabel, { color: theme.textSecondary }]}>Rating promedio</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ComeYaColors.error },
  liveText: { fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { padding: 16, borderRadius: 14, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  row2: { flexDirection: "row" },
  flex1: { flex: 1 },
  miniStat: { borderRadius: 10, padding: 12, alignItems: "center" },
  miniVal: { fontSize: 18, fontWeight: "700" },
  miniLabel: { fontSize: 10, marginTop: 3, textAlign: "center" },
});

const kpi = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  value: { fontSize: 26, fontWeight: "700", lineHeight: 30 },
  label: { fontSize: 12, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  trendText: { fontSize: 11, fontWeight: "600" },
  sub: { fontSize: 11 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700" },
});

const sr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
  dot: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  label: { flex: 1, fontSize: 13 },
  value: { fontSize: 15, fontWeight: "700" },
});
