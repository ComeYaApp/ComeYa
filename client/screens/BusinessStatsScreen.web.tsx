import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing } from "@/constants/theme";

type Period = "today" | "week" | "month";

interface StatsData {
  revenue: { today: number; week: number; month: number; total: number };
  orders: { total: number; completed: number; cancelled: number; avgValue: number };
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export default function BusinessStatsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const { data, isLoading, refetch } = useQuery<StatsData>({
    queryKey: ["/api/business/stats"],
    enabled: !!user?.id,
  });

  const revenue = data?.revenue || { today: 0, week: 0, month: 0, total: 0 };
  const orders = data?.orders || { total: 0, completed: 0, cancelled: 0, avgValue: 0 };
  const topProducts = data?.topProducts || [];
  const completionRate = orders.total > 0 ? Math.round((orders.completed / orders.total) * 100) : 100;

  const periodLabels: Record<Period, string> = { today: "Hoy", week: "Esta semana", month: "Este mes" };
  const periodRevenue = { today: revenue.today, week: revenue.week, month: revenue.month }[selectedPeriod];

  const statCards = [
    { icon: "shopping-bag", label: "Pedidos totales", value: orders.total, color: "#2196F3" },
    { icon: "check-circle", label: "Completados", value: `${orders.completed} (${completionRate}%)`, color: "#4CAF50" },
    { icon: "x-circle", label: "Cancelados", value: orders.cancelled, color: "#F44336" },
    { icon: "dollar-sign", label: "Ticket promedio", value: `€${(orders.avgValue / 100).toFixed(2)}`, color: ComeYaColors.primary },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: "#4CAF50" + "15" }]}>
          <Feather name="bar-chart-2" size={28} color="#4CAF50" />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Estadísticas</Text>

        {/* Total histórico */}
        <View style={[s.totalCard, { backgroundColor: "#4CAF50" + "15", borderColor: "#4CAF50" + "40" }]}>
          <Text style={[s.totalLabel, { color: sub }]}>Ingresos totales</Text>
          <Text style={[s.totalValue, { color: "#4CAF50" }]}>€{(revenue.total / 100).toFixed(2)}</Text>
        </View>

        {/* Selector de período */}
        <Text style={[s.periodTitle, { color: sub }]}>Período</Text>
        {(["today", "week", "month"] as Period[]).map(p => (
          <Pressable
            key={p}
            onPress={() => setSelectedPeriod(p)}
            style={[s.periodBtn, { backgroundColor: selectedPeriod === p ? ComeYaColors.primary + "15" : "transparent", borderColor: selectedPeriod === p ? ComeYaColors.primary : border }]}
          >
            <Text style={[s.periodBtnText, { color: selectedPeriod === p ? ComeYaColors.primary : text }]}>{periodLabels[p]}</Text>
          </Pressable>
        ))}

        <Pressable onPress={() => refetch()} style={[s.refreshBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="refresh-cw" size={16} color={text} />
          <Text style={[s.refreshBtnText, { color: text }]}>Actualizar</Text>
        </Pressable>

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </View>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : (
          <>
            {/* Card de ingresos del período */}
            <View style={[s.revenueCard, { backgroundColor: "#4CAF50" }]}>
              <Text style={s.revenueLabel}>Ingresos — {periodLabels[selectedPeriod]}</Text>
              <Text style={s.revenueAmount}>€{(periodRevenue / 100).toFixed(2)}</Text>
            </View>

            {/* Grid de stats */}
            <Text style={[s.sectionTitle, { color: text }]}>Resumen de pedidos</Text>
            <View style={s.statsGrid}>
              {statCards.map((st, i) => (
                <View key={i} style={[s.statCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.statIcon, { backgroundColor: st.color + "15" }]}>
                    <Feather name={st.icon as any} size={20} color={st.color} />
                  </View>
                  <Text style={[s.statValue, { color: text }]}>{st.value}</Text>
                  <Text style={[s.statLabel, { color: sub }]}>{st.label}</Text>
                </View>
              ))}
            </View>

            {/* Top productos */}
            {topProducts.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: text }]}>Productos más vendidos</Text>
                {topProducts.slice(0, 10).map((p, i) => (
                  <View key={i} style={[s.productRow, { backgroundColor: card, borderColor: border }]}>
                    <View style={[s.rankBadge, { backgroundColor: ComeYaColors.primary + "15" }]}>
                      <Text style={[s.rankText, { color: ComeYaColors.primary }]}>{i + 1}</Text>
                    </View>
                    <Text style={[s.productName, { color: text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[s.productQty, { color: sub }]}>{p.quantity} uds.</Text>
                    <Text style={[s.productRevenue, { color: "#4CAF50" }]}>€{p.revenue.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 260, padding: 24, borderRightWidth: 1, paddingTop: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  sideTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 16 },
  totalCard: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", marginBottom: 20 },
  totalLabel: { fontSize: 12, marginBottom: 4 },
  totalValue: { fontSize: 28, fontWeight: "900" },
  periodTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  periodBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 6 },
  periodBtnText: { fontSize: 14, fontWeight: "600" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 12, justifyContent: "center" },
  refreshBtnText: { fontSize: 13, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 8, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 800 },
  loading: { paddingVertical: 80, alignItems: "center" },
  revenueCard: { padding: 28, borderRadius: 20, alignItems: "center", marginBottom: 24 },
  revenueLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 4 },
  revenueAmount: { color: "#fff", fontSize: 48, fontWeight: "900" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14, marginTop: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: { width: "calc(50% - 6px)" as any, padding: 20, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 12, textAlign: "center" },
  productRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: "800" },
  productName: { flex: 1, fontSize: 14, fontWeight: "600" },
  productQty: { fontSize: 13, marginRight: 16 },
  productRevenue: { fontSize: 15, fontWeight: "700" },
});
