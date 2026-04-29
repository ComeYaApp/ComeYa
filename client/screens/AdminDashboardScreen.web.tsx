import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { confirm } from "@/hooks/useWebDialog";
import { DriversTab } from "@/components/admin/tabs/DriversTab";
import { FinanceTab } from "@/components/admin/tabs/FinanceTab";
import { BusinessesTab } from "@/components/admin/tabs/BusinessesTab";
import { UsersTab } from "@/components/admin/tabs/UsersTab";
import { OrdersTab } from "@/components/admin/tabs/OrdersTab";
import { CouponsTab } from "@/components/admin/tabs/CouponsTab";
import { SupportTab } from "@/components/admin/tabs/SupportTab";
import { SettingsTab } from "@/components/admin/tabs/SettingsTab";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab";

const PRIMARY = "#DC2626";

type Section =
  | "dashboard" | "orders" | "businesses" | "drivers"
  | "users" | "finance" | "proofs" | "coupons" | "support" | "settings";

const NAV: { id: Section; label: string; icon: string; color: string }[] = [
  { id: "dashboard",   label: "Dashboard",      icon: "bar-chart-2",    color: PRIMARY },
  { id: "orders",      label: "Pedidos",         icon: "shopping-bag",   color: "#3B82F6" },
  { id: "businesses",  label: "Negocios",        icon: "briefcase",      color: "#10B981" },
  { id: "drivers",     label: "Repartidores",    icon: "truck",          color: "#8B5CF6" },
  { id: "users",       label: "Usuarios",        icon: "users",          color: "#F59E0B" },
  { id: "finance",     label: "Finanzas",        icon: "dollar-sign",    color: "#06B6D4" },
  { id: "proofs",      label: "Comprobantes",    icon: "file-text",      color: "#F97316" },
  { id: "coupons",     label: "Cupones",         icon: "tag",            color: "#EC4899" },
  { id: "support",     label: "Soporte",         icon: "message-circle", color: "#84CC16" },
  { id: "settings",    label: "Configuración",   icon: "sliders",        color: "#6B7280" },
];

function fmt(cents: number) {
  if (cents >= 100_000_00) return `€${(cents / 100 / 1_000_000).toFixed(1)}M`;
  if (cents >= 1_000_00)   return `€${(cents / 100 / 1_000).toFixed(1)}K`;
  return `€${(cents / 100).toFixed(0)}`;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function AdminSidebar({ active, onChange, metrics }: { active: Section; onChange: (s: Section) => void; metrics: any }) {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const card   = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const sub    = isDark ? "#888"    : "#999";

  const badges: Partial<Record<Section, number>> = {
    orders:  metrics?.pendingOrders   || 0,
    proofs:  metrics?.pendingPayments || 0,
    support: metrics?.openTickets     || 0,
  };

  return (
    <View style={[sb.root, { backgroundColor: card, borderRightColor: border }]}>
      {/* Header */}
      <View style={[sb.header, { borderBottomColor: border }]}>
        <View style={[sb.logoWrap, { backgroundColor: PRIMARY + "15" }]}>
          <Text style={sb.logoText}>CY</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sb.appName, { color: text }]}>ComeYa Admin</Text>
          <Text style={[sb.userName, { color: sub }]} numberOfLines={1}>{user?.name}</Text>
        </View>
        <View style={[sb.liveDot]} />
      </View>

      {/* Nav */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={sb.section}>
          <Text style={[sb.sectionLabel, { color: sub }]}>MENÚ</Text>
          {NAV.map(item => {
            const isActive = active === item.id;
            const badge = badges[item.id];
            return (
              <Pressable
                key={item.id}
                onPress={() => onChange(item.id)}
                style={[sb.navItem, isActive && { backgroundColor: item.color + "12", borderRightWidth: 3, borderRightColor: item.color }]}
              >
                <View style={[sb.navIcon, { backgroundColor: isActive ? item.color + "20" : "transparent" }]}>
                  <Feather name={item.icon as any} size={17} color={isActive ? item.color : sub} />
                </View>
                <Text style={[sb.navLabel, { color: isActive ? item.color : text }]}>{item.label}</Text>
                {!!badge && (
                  <View style={[sb.badge, { backgroundColor: item.color }]}>
                    <Text style={sb.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[sb.footer, { borderTopColor: border }]}>
        <Pressable
          onPress={async () => {
            const ok = await confirm({ title: "Cerrar sesión", message: "¿Estás seguro?", confirmLabel: "Salir", variant: "warning" });
            if (ok) logout();
          }}
          style={sb.logoutBtn}
        >
          <Feather name="log-out" size={16} color="#EF4444" />
          <Text style={[sb.logoutText]}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, trend }: any) {
  const { isDark } = useTheme();
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff"    : "#1a1a1a";
  const subC = isDark ? "#888"    : "#999";
  return (
    <View style={[kpi.card, { backgroundColor: card }]}>
      <View style={[kpi.iconWrap, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[kpi.value, { color: text }]}>{value}</Text>
      <Text style={[kpi.label, { color: subC }]}>{label}</Text>
      {sub && <Text style={[kpi.sub, { color: subC }]}>{sub}</Text>}
      {trend && (
        <View style={kpi.trendRow}>
          <Feather name={trend.up ? "trending-up" : "trending-down"} size={11} color={trend.up ? "#10B981" : "#EF4444"} />
          <Text style={[kpi.trendText, { color: trend.up ? "#10B981" : "#EF4444" }]}>{trend.value}%</Text>
        </View>
      )}
    </View>
  );
}

// ── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ icon, label, value, color }: any) {
  const { isDark } = useTheme();
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub  = isDark ? "#888" : "#999";
  return (
    <View style={sr.row}>
      <View style={[sr.icon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[sr.label, { color: sub }]}>{label}</Text>
      <Text style={[sr.value, { color: text }]}>{value}</Text>
    </View>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────
function SCard({ title, icon, color, children }: any) {
  const { isDark } = useTheme();
  const card   = isDark ? "#1e1e1e" : "#fff";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  return (
    <View style={[sc.card, { backgroundColor: card, borderColor: border }]}>
      <View style={sc.header}>
        <View style={[sc.iconWrap, { backgroundColor: color + "15" }]}>
          <Feather name={icon} size={15} color={color} />
        </View>
        <Text style={[sc.title, { color: text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardView() {
  const { isDark } = useTheme();
  const [metrics, setMetrics] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<any>(null);

  const bg   = isDark ? "#111"    : "#f4f5f7";
  const text = isDark ? "#fff"    : "#1a1a1a";
  const sub  = isDark ? "#888"    : "#999";

  const load = async () => {
    try {
      const [mRes, eRes, pRes] = await Promise.all([
        apiRequest("GET", "/api/admin/dashboard/metrics"),
        apiRequest("GET", "/api/admin/finance/platform-earnings?period=month"),
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
      ]);
      const [m, e, p] = await Promise.all([mRes.json(), eRes.json(), pRes.json()]);
      if (m) setMetrics(m);
      setFinance({
        weekRevenue:         e?.earnings?.week  ?? 0,
        monthRevenue:        e?.earnings?.month ?? 0,
        pendingPayouts:      p?.payouts?.length ?? 0,
        pendingPayoutAmount: p?.payouts?.reduce((a: number, x: any) => a + (x.amount ?? 0), 0) ?? 0,
        fraudCount:          m?.fraudCount ?? 0,
      });
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  const pct = (a: number, b: number) => {
    if (!b) return null;
    const p = ((a - b) / b) * 100;
    return { value: Math.abs(p).toFixed(1), up: p >= 0 };
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={dv.content} showsVerticalScrollIndicator={false}>
      {/* Page header */}
      <View style={dv.pageHeader}>
        <View>
          <Text style={[dv.pageTitle, { color: text }]}>Dashboard Global</Text>
          <Text style={[dv.pageSub, { color: sub }]}>Vista en tiempo real · actualiza cada 30s</Text>
        </View>
        <View style={dv.liveChip}>
          <View style={dv.liveDot} />
          <Text style={dv.liveText}>LIVE</Text>
        </View>
      </View>

      {/* KPIs fila 1 — plataforma */}
      <View style={dv.kpiRow}>
        <KpiCard icon="users"        label="Usuarios"       value={metrics?.totalUsers      ?? 0} color="#3B82F6" sub={`+${metrics?.newUsersToday ?? 0} hoy`} />
        <KpiCard icon="briefcase"    label="Negocios"       value={metrics?.totalBusinesses ?? 0} color="#10B981" sub={`${metrics?.activeBusinesses ?? metrics?.totalBusinesses ?? 0} activos`} />
        <KpiCard icon="truck"        label="Repartidores"   value={metrics?.totalDrivers    ?? 0} color="#8B5CF6" sub={`${metrics?.onlineDrivers ?? 0} online`} />
        <KpiCard icon="shopping-bag" label="Pedidos totales" value={metrics?.totalOrders    ?? 0} color="#F59E0B" sub={`${metrics?.completedOrders ?? 0} completados`} />
      </View>

      {/* KPIs fila 2 — hoy */}
      <View style={dv.kpiRow}>
        <KpiCard icon="calendar"     label="Pedidos hoy"    value={metrics?.todayOrders    ?? 0}                    color="#10B981" trend={pct(metrics?.todayOrders, metrics?.yesterdayOrders)} />
        <KpiCard icon="dollar-sign"  label="Ingresos hoy"   value={fmt(metrics?.todayRevenue ?? 0)}                 color={PRIMARY} trend={pct(metrics?.todayRevenue, metrics?.yesterdayRevenue)} />
        <KpiCard icon="clock"        label="Pedidos activos" value={metrics?.pendingOrders  ?? 0}                   color="#F97316" sub="en proceso" />
        <KpiCard icon="alert-circle" label="Pagos pendientes" value={metrics?.pendingPayments ?? 0}                 color="#EF4444" sub="por verificar" />
      </View>

      {/* Fila 3 — Estado pedidos + Finanzas */}
      <View style={dv.twoCol}>
        <SCard title="Estado de pedidos" icon="activity" color="#3B82F6">
          <StatRow icon="clock"        label="Pendientes"     value={metrics?.pendingOrders   ?? 0} color="#F59E0B" />
          <StatRow icon="loader"       label="Preparando"     value={metrics?.preparingOrders ?? 0} color="#8B5CF6" />
          <StatRow icon="truck"        label="En camino"      value={metrics?.onTheWayOrders  ?? 0} color="#10B981" />
          <StatRow icon="check-circle" label="Entregados hoy" value={metrics?.deliveredToday  ?? 0} color="#06B6D4" />
          <StatRow icon="x-circle"     label="Cancelados hoy" value={metrics?.cancelledToday  ?? 0} color="#EF4444" />
        </SCard>

        <SCard title="Finanzas" icon="dollar-sign" color="#10B981">
          <StatRow icon="trending-up"  label="Ingresos semana"    value={fmt(finance?.weekRevenue         ?? 0)} color="#10B981" />
          <StatRow icon="bar-chart-2"  label="Ingresos mes"       value={fmt(finance?.monthRevenue        ?? 0)} color={PRIMARY} />
          <StatRow icon="send"         label="Payouts pendientes" value={finance?.pendingPayouts           ?? 0} color="#F59E0B" />
          <StatRow icon="credit-card"  label="Monto a pagar"      value={fmt(finance?.pendingPayoutAmount ?? 0)} color="#F97316" />
          <StatRow icon="shield"       label="Fraudes detectados" value={finance?.fraudCount               ?? 0} color="#EF4444" />
        </SCard>
      </View>

      {/* Fila 4 — Métricas plataforma */}
      <SCard title="Métricas de plataforma" icon="pie-chart" color={PRIMARY}>
        <View style={dv.miniGrid}>
          {[
            { label: "Ticket promedio",   value: metrics?.avgOrderValue   ? fmt(metrics.avgOrderValue)                    : "—", color: PRIMARY    },
            { label: "Tasa completados",  value: metrics?.completionRate  ? `${metrics.completionRate}%`                  : "—", color: "#10B981"  },
            { label: "Tiempo entrega",    value: metrics?.avgDeliveryTime ? `${metrics.avgDeliveryTime}m`                 : "—", color: "#F59E0B"  },
            { label: "Rating promedio",   value: metrics?.avgRating       ? `${(metrics.avgRating / 100).toFixed(1)}★`   : "—", color: "#8B5CF6"  },
            { label: "Pedidos/negocio",   value: metrics?.ordersPerBusiness ? metrics.ordersPerBusiness.toFixed(1)        : "—", color: "#06B6D4"  },
            { label: "Usuarios activos",  value: metrics?.activeUsers     ? metrics.activeUsers                           : "—", color: "#F97316"  },
          ].map(m => (
            <View key={m.label} style={[dv.miniCard, { backgroundColor: m.color + "10" }]}>
              <Text style={[dv.miniValue, { color: m.color }]}>{m.value}</Text>
              <Text style={[dv.miniLabel, { color: sub }]}>{m.label}</Text>
            </View>
          ))}
        </View>
      </SCard>
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardScreen() {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [section, setSection] = useState<Section>("dashboard");
  const [metrics, setMetrics] = useState<any>(null);

  const bg = isDark ? "#111" : "#f4f5f7";

  useEffect(() => {
    apiRequest("GET", "/api/admin/dashboard/metrics")
      .then(r => r.json()).then(m => { if (m) setMetrics(m); }).catch(() => {});
  }, []);

  const renderContent = () => {
    switch (section) {
      case "dashboard":  return <DashboardView />;
      case "orders":     return <TabWrapper bg={bg}><OrdersTab orders={[]} onOrderPress={() => {}} /></TabWrapper>;
      case "businesses": return <TabWrapper bg={bg}><BusinessesTab businesses={[]} onBusinessPress={() => {}} /></TabWrapper>;
      case "drivers":    return <TabWrapper bg={bg}><DriversTab theme={{} as any} showToast={showToast} /></TabWrapper>;
      case "users":      return <TabWrapper bg={bg}><UsersTab users={[]} onUserPress={() => {}} /></TabWrapper>;
      case "finance":    return <TabWrapper bg={bg}><FinanceTab theme={{} as any} showToast={showToast} /></TabWrapper>;
      case "proofs":     return <TabWrapper bg={bg}><PaymentProofsTab theme={{} as any} showToast={showToast} /></TabWrapper>;
      case "coupons":    return <TabWrapper bg={bg}><CouponsTab theme={{} as any} showToast={showToast} /></TabWrapper>;
      case "support":    return <TabWrapper bg={bg}><SupportTab theme={{} as any} showToast={showToast} /></TabWrapper>;
      case "settings":   return <TabWrapper bg={bg}><SettingsTab theme={{} as any} showToast={showToast} /></TabWrapper>;
    }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <AdminSidebar active={section} onChange={setSection} metrics={metrics} />
      <View style={s.content}>
        {renderContent()}
      </View>
    </View>
  );
}

function TabWrapper({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 32 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
});

const sb = StyleSheet.create({
  root:         { width: 240, borderRightWidth: 1, flexDirection: "column" },
  header:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 20, borderBottomWidth: 1 },
  logoWrap:     { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  logoText:     { fontSize: 14, fontWeight: "900", color: PRIMARY },
  appName:      { fontSize: 14, fontWeight: "800" },
  userName:     { fontSize: 11, marginTop: 1 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  section:      { paddingTop: 8, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: "700", paddingHorizontal: 20, paddingVertical: 8, letterSpacing: 0.8 },
  navItem:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  navIcon:      { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  navLabel:     { flex: 1, fontSize: 13, fontWeight: "600" },
  badge:        { minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  badgeText:    { fontSize: 10, fontWeight: "800", color: "#fff" },
  footer:       { borderTopWidth: 1, padding: 16 },
  logoutBtn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  logoutText:   { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});

const kpi = StyleSheet.create({
  card:      { flex: 1, borderRadius: 14, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  iconWrap:  { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  value:     { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  label:     { fontSize: 12, marginTop: 3 },
  sub:       { fontSize: 11, marginTop: 2 },
  trendRow:  { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  trendText: { fontSize: 11, fontWeight: "700" },
});

const sr = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.05)" },
  icon:  { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  label: { flex: 1, fontSize: 13 },
  value: { fontSize: 15, fontWeight: "700" },
});

const sc = StyleSheet.create({
  card:    { borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 16 },
  header:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconWrap:{ width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 15, fontWeight: "700" },
});

const dv = StyleSheet.create({
  content:    { padding: 28, paddingBottom: 60 },
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  pageTitle:  { fontSize: 24, fontWeight: "800" },
  pageSub:    { fontSize: 13, marginTop: 3 },
  liveChip:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EF444418", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText:   { fontSize: 11, fontWeight: "800", color: "#EF4444" },
  kpiRow:     { flexDirection: "row", gap: 14, marginBottom: 14 },
  twoCol:     { flexDirection: "row", gap: 14 },
  miniGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  miniCard:   { flex: 1, minWidth: 140, borderRadius: 12, padding: 14, alignItems: "center" },
  miniValue:  { fontSize: 22, fontWeight: "800" },
  miniLabel:  { fontSize: 11, marginTop: 4, textAlign: "center" },
});
