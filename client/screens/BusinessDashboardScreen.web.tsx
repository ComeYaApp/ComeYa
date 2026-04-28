import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useBusiness } from "@/contexts/BusinessContext";

// Rojo para versión web
const PRIMARY = "#DC2626";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "bar-chart-2" },
  { id: "orders", label: "Pedidos", icon: "package" },
  { id: "products", label: "Productos", icon: "grid" },
  { id: "analytics", label: "Analytics", icon: "trending-up" },
  { id: "profile", label: "Perfil", icon: "user" },
];

export default function BusinessDashboardScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  useEffect(() => {
    if (!selectedBusiness?.id) { setLoading(false); return; }
    Promise.all([
      apiRequest("GET", `/api/analytics/dashboard/${selectedBusiness.id}?period=week`).then(r => r.json()),
      apiRequest("GET", "/api/orders/business").then(r => r.json()),
    ]).then(([statsData, ordersData]) => {
      setStats(statsData.dashboard || statsData);
      setOrders((ordersData.orders || []).slice(0, 10));
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedBusiness?.id]);

  const STATUS_COLOR: Record<string, string> = {
    pending: "#F59E0B", confirmed: "#3B82F6", preparing: "#8B5CF6",
    ready: "#10B981", on_the_way: "#22C55E", delivered: "#6B7280", cancelled: "#EF4444",
  };

  const METRICS = stats ? [
    { label: "Pedidos hoy", value: stats.todayOrders || 0, icon: "package", color: "#3B82F6" },
    { label: "Ingresos hoy", value: `€${((stats.todayRevenue || 0) / 100).toFixed(2)}`, icon: "trending-up", color: "#10B981" },
    { label: "Ticket medio", value: `€${((stats.averageTicket || 0) / 100).toFixed(2)}`, icon: "dollar-sign", color: "#8B5CF6" },
    { label: "Rating", value: ((stats.averageRating || 0) / 10).toFixed(1) + "★", icon: "star", color: "#F59E0B" },
  ] : [];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* SIDEBAR */}
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={s.sideHeader}>
          <Text style={[s.sideLogoText, { color: PRIMARY }]}>🐰 ComeYa</Text>
          <Text style={[s.sideBizName, { color: text }]} numberOfLines={1}>{selectedBusiness?.name || "Mi Negocio"}</Text>
          <Text style={[s.sideRole, { color: sub }]}>Panel de negocio</Text>
        </View>
        {NAV_ITEMS.map(item => (
          <Pressable
            key={item.id}
            onPress={() => {
              setActiveNav(item.id);
              if (item.id === "orders") navigation.navigate("BusinessOrders");
              if (item.id === "products") navigation.navigate("BusinessProducts");
              if (item.id === "analytics") navigation.navigate("BusinessAnalytics");
              if (item.id === "profile") navigation.navigate("Main");
            }}
            style={[s.navItem, activeNav === item.id && s.navItemActive]}
          >
            <Feather name={item.icon as any} size={18} color={activeNav === item.id ? PRIMARY : sub} />
            <Text style={[s.navItemText, { color: activeNav === item.id ? PRIMARY : text }]}>{item.label}</Text>
          </Pressable>
        ))}
        <View style={s.sideFooter}>
          <Pressable onPress={() => navigation.navigate("Main")} style={s.navItem}>
            <Feather name="log-out" size={18} color={sub} />
            <Text style={[s.navItemText, { color: sub }]}>Salir</Text>
          </Pressable>
        </View>
      </View>

      {/* CONTENIDO */}
      <ScrollView style={s.main} contentContainerStyle={s.mainContent} showsVerticalScrollIndicator={false}>
        <View style={s.pageHeader}>
          <Text style={[s.pageTitle, { color: text }]}>Dashboard</Text>
          <Text style={[s.pageSub, { color: sub }]}>Resumen de esta semana</Text>
        </View>

        {loading ? (
          <View style={s.loadingBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : (
          <>
            {/* Métricas */}
            <View style={s.metricsGrid}>
              {METRICS.map(m => (
                <View key={m.label} style={[s.metricCard, { backgroundColor: card }]}>
                  <View style={[s.metricIcon, { backgroundColor: m.color + "15" }]}>
                    <Feather name={m.icon as any} size={22} color={m.color} />
                  </View>
                  <Text style={[s.metricValue, { color: text }]}>{m.value}</Text>
                  <Text style={[s.metricLabel, { color: sub }]}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* Pedidos recientes */}
            <View style={[s.section, { backgroundColor: card }]}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: text }]}>Pedidos recientes</Text>
                <Pressable onPress={() => navigation.navigate("BusinessOrders")}>
                  <Text style={[s.sectionLink, { color: PRIMARY }]}>Ver todos →</Text>
                </Pressable>
              </View>
              {orders.length === 0 ? (
                <Text style={[s.emptyText, { color: sub }]}>No hay pedidos recientes</Text>
              ) : orders.map(order => (
                <View key={order.id} style={[s.orderRow, { borderBottomColor: border }]}>
                  <View style={[s.orderStatusDot, { backgroundColor: STATUS_COLOR[order.status] || "#999" }]} />
                  <View style={s.orderInfo}>
                    <Text style={[s.orderCustomer, { color: text }]}>{order.customerName || "Cliente"}</Text>
                    <Text style={[s.orderMeta, { color: sub }]}>#{order.id?.slice(-6)} · {new Date(order.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <Text style={[s.orderTotal, { color: text }]}>€{((order.total || 0) / 100).toFixed(2)}</Text>
                  <View style={[s.orderStatusBadge, { backgroundColor: (STATUS_COLOR[order.status] || "#999") + "20" }]}>
                    <Text style={[s.orderStatusText, { color: STATUS_COLOR[order.status] || "#999" }]}>{order.status}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Acciones rápidas */}
            <View style={s.actionsGrid}>
              {[
                { label: "Gestionar productos", icon: "grid", screen: "BusinessProducts", color: "#3B82F6" },
                { label: "Ver analytics", icon: "trending-up", screen: "BusinessAnalytics", color: "#10B981" },
                { label: "Horarios", icon: "clock", screen: "BusinessHours", color: "#8B5CF6" },
                { label: "Configuración", icon: "settings", screen: "BusinessManage", color: "#F59E0B" },
              ].map(a => (
                <Pressable key={a.label} style={[s.actionCard, { backgroundColor: card }]} onPress={() => navigation.navigate(a.screen)}>
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
  sidebar: { width: 240, borderRightWidth: 1, flexDirection: "column" },
  sideHeader: { padding: 24, paddingBottom: 16 },
  sideLogoText: { fontSize: 18, fontWeight: "900", marginBottom: 12 },
  sideBizName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  sideRole: { fontSize: 12 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navItemActive: { backgroundColor: PRIMARY + "10", borderRightWidth: 3, borderRightColor: PRIMARY },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: { marginTop: "auto" as any, borderTopWidth: 1, borderTopColor: "#e0e0e0" },
  main: { flex: 1 },
  mainContent: { padding: 32 },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: "800" },
  pageSub: { fontSize: 14, marginTop: 4 },
  loadingBox: { paddingVertical: 80, alignItems: "center" },
  metricsGrid: { flexDirection: "row", gap: 16, marginBottom: 24, flexWrap: "wrap" },
  metricCard: { flex: 1, minWidth: 160, padding: 20, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  metricIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  metricValue: { fontSize: 24, fontWeight: "900", marginBottom: 4 },
  metricLabel: { fontSize: 13 },
  section: { borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionLink: { fontSize: 13, fontWeight: "600" },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 20 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  orderStatusDot: { width: 10, height: 10, borderRadius: 5 },
  orderInfo: { flex: 1 },
  orderCustomer: { fontSize: 14, fontWeight: "600" },
  orderMeta: { fontSize: 12, marginTop: 2 },
  orderTotal: { fontSize: 14, fontWeight: "700" },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  orderStatusText: { fontSize: 11, fontWeight: "700" },
  actionsGrid: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  actionCard: { flex: 1, minWidth: 160, padding: 20, borderRadius: 16, alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
