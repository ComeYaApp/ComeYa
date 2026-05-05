import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useBusiness } from "@/contexts/BusinessContext";
import { BusinessSidebar } from "@/components/BusinessSidebar";

const PRIMARY = "#DC2626";
type Period = "today" | "week" | "month";

export default function BusinessDashboardScreen() {
  const navigation = useNavigation<any>();
  const navigateTo = (screen: string, params?: object) => {
    navigation.navigate(screen as any, params);
  };
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();

  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");

  const bg     = isDark ? "#111"     : "#f7f7f7";
  const card   = isDark ? "#1e1e1e"  : "#fff";
  const text   = isDark ? "#fff"     : "#1a1a1a";
  const sub    = isDark ? "#aaa"     : "#666";
  const border = isDark ? "#333"     : "#e8e8e8";

  useEffect(() => {
    if (!selectedBusiness?.id) { setLoading(false); return; }
    Promise.all([
      apiRequest("GET", `/api/analytics/dashboard/${selectedBusiness.id}?period=week`).then(r => r.json()),
      apiRequest("GET", "/api/orders").then(r => r.json()),
    ]).then(([statsData, ordersData]) => {
      setStats(statsData.dashboard || statsData);
      setOrders((ordersData.orders || []).slice(0, 8));
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedBusiness?.id]);

  const STATUS_COLOR: Record<string, string> = {
    pending: "#F59E0B", confirmed: "#3B82F6", preparing: "#8B5CF6",
    ready: "#10B981", on_the_way: "#22C55E", delivered: "#6B7280", cancelled: "#EF4444",
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: "Pendiente", confirmed: "Confirmado", preparing: "Preparando",
    ready: "Listo", on_the_way: "En camino", delivered: "Entregado", cancelled: "Cancelado",
  };

  const periodLabels: Record<Period, string> = { today: "Hoy", week: "Esta semana", month: "Este mes" };

  const revenue = stats ? {
    today: (stats.todayRevenue || 0) / 100,
    week:  (stats.weekRevenue  || 0) / 100,
    month: (stats.monthRevenue || 0) / 100,
    total: (stats.totalRevenue || 0) / 100,
  } : { today: 0, week: 0, month: 0, total: 0 };

  const periodRevenue = revenue[selectedPeriod];

  const metrics = stats ? [
    { label: "Pedidos hoy",  value: stats.todayOrders  || 0,                                icon: "package",      color: "#3B82F6" },
    { label: "Completados",  value: stats.completedOrders || 0,                             icon: "check-circle", color: "#4CAF50" },
    { label: "Cancelados",   value: stats.cancelledOrders || 0,                             icon: "x-circle",     color: "#EF4444" },
    { label: "Ticket medio", value: `€${((stats.averageTicket || 0) / 100).toFixed(2)}`,   icon: "dollar-sign",  color: "#8B5CF6" },
    { label: "Rating",       value: `${((stats.averageRating || 0) / 10).toFixed(1)}★`,    icon: "star",         color: "#F59E0B" },
    { label: "Total pedidos",value: stats.totalOrders  || 0,                                icon: "bar-chart-2",  color: "#06B6D4" },
  ] : [];

  const topProducts: { name: string; quantity: number; revenue: number }[] = stats?.topProducts || [];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <BusinessSidebar />

      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.loading}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : (
          <>
            {/* ── Selector de período ── */}
            <View style={s.periodRow}>
              {(["today", "week", "month"] as Period[]).map(p => (
                <Pressable
                  key={p}
                  onPress={() => setSelectedPeriod(p)}
                  style={[s.periodBtn, { backgroundColor: selectedPeriod === p ? PRIMARY : card, borderColor: selectedPeriod === p ? PRIMARY : border }]}
                >
                  <Text style={[s.periodBtnText, { color: selectedPeriod === p ? "#fff" : text }]}>{periodLabels[p]}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Card de ingresos del período ── */}
            <View style={[s.revenueCard, { backgroundColor: "#4CAF50" }]}>
              <Text style={s.revenueLabel}>Ingresos — {periodLabels[selectedPeriod]}</Text>
              <Text style={s.revenueAmount}>€{periodRevenue.toFixed(2)}</Text>
              <Text style={s.revenueTotal}>Total histórico: €{revenue.total.toFixed(2)}</Text>
            </View>

            {/* ── Grid de métricas ── */}
            <Text style={[s.sectionTitle, { color: text }]}>Resumen</Text>
            <View style={s.metricsGrid}>
              {metrics.map(m => (
                <View key={m.label} style={[s.metricCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.metricIcon, { backgroundColor: m.color + "15" }]}>
                    <Feather name={m.icon as any} size={20} color={m.color} />
                  </View>
                  <Text style={[s.metricValue, { color: text }]}>{m.value}</Text>
                  <Text style={[s.metricLabel, { color: sub }]}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Top productos ── */}
            {topProducts.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: text }]}>Productos más vendidos</Text>
                {topProducts.slice(0, 8).map((p, i) => (
                  <View key={i} style={[s.productRow, { backgroundColor: card, borderColor: border }]}>
                    <View style={[s.rankBadge, { backgroundColor: PRIMARY + "15" }]}>
                      <Text style={[s.rankText, { color: PRIMARY }]}>{i + 1}</Text>
                    </View>
                    <Text style={[s.productName, { color: text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[s.productQty, { color: sub }]}>{p.quantity} uds.</Text>
                    <Text style={[s.productRevenue, { color: "#4CAF50" }]}>€{p.revenue.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* ── Pedidos recientes ── */}
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: text }]}>Pedidos recientes</Text>
              <Pressable onPress={() => navigateTo("BusinessOrders")}>
                <Text style={[s.sectionLink, { color: PRIMARY }]}>Ver todos →</Text>
              </Pressable>
            </View>
            <View style={[s.ordersCard, { backgroundColor: card, borderColor: border }]}>
              {orders.length === 0 ? (
                <Text style={[s.emptyText, { color: sub }]}>No hay pedidos recientes</Text>
              ) : orders.map(order => (
                <View key={order.id} style={[s.orderRow, { borderBottomColor: border }]}>
                  <View style={[s.orderDot, { backgroundColor: STATUS_COLOR[order.status] || "#999" }]} />
                  <View style={s.orderInfo}>
                    <Text style={[s.orderCustomer, { color: text }]}>{order.customerName || "Cliente"}</Text>
                    <Text style={[s.orderMeta, { color: sub }]}>
                      #{order.id?.slice(-6)} · {new Date(order.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Text style={[s.orderTotal, { color: text }]}>€{((order.total || 0) / 100).toFixed(2)}</Text>
                  <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[order.status] || "#999") + "20" }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[order.status] || "#999" }]}>
                      {STATUS_LABEL[order.status] || order.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Acciones rápidas ── */}
            <Text style={[s.sectionTitle, { color: text }]}>Acciones rápidas</Text>
            <View style={s.actionsGrid}>
              {[
                { label: "Gestionar productos", icon: "grid",     screen: "BusinessProducts", color: "#3B82F6" },
                { label: "Horarios",            icon: "clock",    screen: "BusinessHours",    color: "#8B5CF6" },
                { label: "Configuración",       icon: "settings", screen: "BusinessManage",   color: "#F59E0B" },
              ].map(a => (
                <Pressable key={a.label} style={[s.actionCard, { backgroundColor: card, borderColor: border }]} onPress={() => navigateTo(a.screen)}>
                  <View style={[s.actionIcon, { backgroundColor: a.color + "15" }]}>
                    <Feather name={a.icon as any} size={22} color={a.color} />
                  </View>
                  <Text style={[s.actionLabel, { color: text }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 1000 },
  loading: { paddingVertical: 80, alignItems: "center" },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  periodBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1.5 },
  periodBtnText: { fontSize: 13, fontWeight: "700" },

  revenueCard: { padding: 28, borderRadius: 20, alignItems: "center", marginBottom: 28 },
  revenueLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 4 },
  revenueAmount: { color: "#fff", fontSize: 52, fontWeight: "900" },
  revenueTotal: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionLink: { fontSize: 13, fontWeight: "600" },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  metricCard: { flex: 1, minWidth: 160, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  metricIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  metricValue: { fontSize: 22, fontWeight: "900", marginBottom: 4 },
  metricLabel: { fontSize: 12, textAlign: "center" },

  productRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: "800" },
  productName: { flex: 1, fontSize: 14, fontWeight: "600" },
  productQty: { fontSize: 13, marginRight: 16 },
  productRevenue: { fontSize: 15, fontWeight: "700" },

  ordersCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 28 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
  orderInfo: { flex: 1 },
  orderCustomer: { fontSize: 14, fontWeight: "600" },
  orderMeta: { fontSize: 12, marginTop: 2 },
  orderTotal: { fontSize: 14, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 24, color: "#999" },

  actionsGrid: { flexDirection: "row", gap: 16, flexWrap: "wrap", marginBottom: 32 },
  actionCard: { flex: 1, minWidth: 160, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 10 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
