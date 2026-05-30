import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

const PRIMARY = "#DC2626";

function fmt(cents: number) {
  if (cents >= 10_000_000) return `€${(cents / 100 / 1_000_000).toFixed(1)}M`;
  if (cents >= 100_000) return `€${(cents / 100 / 1_000).toFixed(1)}K`;
  return `€${(cents / 100).toFixed(0)}`;
}

function pct(a: number, b: number) {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return { value: Math.abs(p).toFixed(1), up: p >= 0 };
}

interface Props {
  metrics: any;
  finance: any;
  lastUpdated: Date | null;
}

export function HeroBanner({ metrics, finance, lastUpdated }: Props) {
  const { isDark } = useTheme();

  const kpis = [
    {
      icon: "shopping-bag" as const,
      label: "Pedidos hoy",
      value: metrics?.todayOrders ?? 0,
      trend: pct(metrics?.todayOrders, metrics?.yesterdayOrders),
      color: "#3B82F6",
      sub: `${metrics?.pendingOrders ?? 0} activos`,
    },
    {
      icon: "dollar-sign" as const,
      label: "Ingresos hoy",
      value: fmt(metrics?.todayRevenue ?? 0),
      trend: pct(metrics?.todayRevenue, metrics?.yesterdayRevenue),
      color: "#10B981",
      sub: fmt(finance?.weekRevenue ?? 0) + " esta semana",
    },
    {
      icon: "users" as const,
      label: "Usuarios",
      value: metrics?.totalUsers ?? 0,
      trend: null,
      color: "#8B5CF6",
      sub: `+${metrics?.newUsersToday ?? 0} hoy`,
    },
    {
      icon: "alert-circle" as const,
      label: "Requieren acción",
      value: (metrics?.pendingPayments ?? 0) + (finance?.pendingPayouts ?? 0),
      trend: null,
      color: "#F59E0B",
      sub: `${metrics?.pendingPayments ?? 0} comprobantes · ${finance?.pendingPayouts ?? 0} payouts`,
    },
  ];

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <View style={[hero.wrap, { backgroundColor: isDark ? "#1a0a0a" : "#fff" }]}>
      {/* Gradient bar top */}
      <View style={hero.gradientBar} />

      <View style={hero.inner}>
        {/* Left: title */}
        <View style={hero.titleBlock}>
          <View style={hero.logoRow}>
            <View style={hero.logoBadge}>
              <Text style={hero.logoText}>CY</Text>
            </View>
            <View>
              <Text style={[hero.title, { color: isDark ? "#fff" : "#111" }]}>
                Panel de Control
              </Text>
              <View style={hero.liveRow}>
                <View style={hero.liveDot} />
                <Text style={hero.liveLabel}>EN VIVO</Text>
                <Text
                  style={[hero.liveTime, { color: isDark ? "#666" : "#aaa" }]}
                >
                  · última actualización {timeStr}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right: 4 KPI chips */}
        <View style={hero.kpiRow}>
          {kpis.map((k) => (
            <View
              key={k.label}
              style={[
                hero.kpiCard,
                {
                  backgroundColor: isDark ? "#111" : "#f8f8f8",
                  borderColor: k.color + "30",
                },
              ]}
            >
              <View style={[hero.kpiIcon, { backgroundColor: k.color + "18" }]}>
                <Feather name={k.icon} size={18} color={k.color} />
              </View>
              <Text
                style={[hero.kpiValue, { color: isDark ? "#fff" : "#111" }]}
              >
                {k.value}
              </Text>
              <Text
                style={[hero.kpiLabel, { color: isDark ? "#888" : "#999" }]}
              >
                {k.label}
              </Text>
              <Text
                style={[hero.kpiSub, { color: isDark ? "#555" : "#bbb" }]}
                numberOfLines={1}
              >
                {k.sub}
              </Text>
              {k.trend && (
                <View style={hero.trendRow}>
                  <Feather
                    name={k.trend.up ? "trending-up" : "trending-down"}
                    size={10}
                    color={k.trend.up ? "#10B981" : "#EF4444"}
                  />
                  <Text
                    style={[
                      hero.trendText,
                      { color: k.trend.up ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {k.trend.value}%
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const hero = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  gradientBar: { height: 4, backgroundColor: PRIMARY },
  inner: {
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap",
  },
  titleBlock: { flex: 1, minWidth: 200 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: { fontSize: 18, fontWeight: "900", color: "#fff" },
  title: { fontSize: 22, fontWeight: "800" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  liveLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.8,
  },
  liveTime: { fontSize: 10 },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpiCard: {
    width: 148,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 2,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  kpiValue: { fontSize: 26, fontWeight: "800", lineHeight: 30 },
  kpiLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  kpiSub: { fontSize: 10, marginTop: 1 },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  trendText: { fontSize: 10, fontWeight: "700" },
});
