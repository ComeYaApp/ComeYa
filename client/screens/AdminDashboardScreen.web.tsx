import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { AdminShell, AdminSection } from "@/components/admin/AdminShell.web";

// Dashboard components
import { HeroBanner }     from "@/components/admin/dashboard/HeroBanner";
import { SalesChart }     from "@/components/admin/dashboard/SalesChart";
import { AlertsPanel }    from "@/components/admin/dashboard/AlertsPanel";
import { OrderFunnel }    from "@/components/admin/dashboard/OrderFunnel";
import { TopBusinesses }  from "@/components/admin/dashboard/TopBusinesses";
import { LiveFeed }       from "@/components/admin/dashboard/LiveFeed";

// Existing tabs
import { OrdersTab }        from "@/components/admin/tabs/OrdersTab.web";
import { BusinessesTab }    from "@/components/admin/tabs/BusinessesTab.web";
import { DriversTab }       from "@/components/admin/tabs/DriversTab.web";
import { UsersTab }         from "@/components/admin/tabs/UsersTab.web";
import { FinanceTab }       from "@/components/admin/tabs/FinanceTab.web";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab.web";
import { CouponsTab }       from "@/components/admin/tabs/CouponsTab.web";
import { SupportTab }       from "@/components/admin/tabs/SupportTab.web";
import { SettingsTab }      from "@/components/admin/tabs/SettingsTab.web";
import { ZonesTab }         from "@/components/admin/tabs/ZonesTab.web";
import { CategoriesTab }    from "@/components/admin/tabs/CategoriesTab.web";
import { VerificationsTab } from "@/components/admin/tabs/VerificationsTab.web";

// Web-specific screens embedded as panels
import AdminPaymentAccountsPanel from "@/screens/AdminPaymentAccountsScreen.web";
import AdminMapPanel             from "@/screens/AdminMapScreen.web";
// Note: AdminPaymentAccountsScreen.web and AdminMapScreen.web export default, used directly as panels

const PRIMARY = "#DC2626";

// ── Dashboard view ────────────────────────────────────────────────────────────
function DashboardView({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { isDark } = useTheme();
  const [metrics, setMetrics]         = useState<any>(null);
  const [finance, setFinance]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timer = useRef<any>(null);
  const bg = isDark ? "#0d0d0d" : "#f2f3f5";

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
        pendingPayoutAmount: (p?.payouts ?? []).reduce((a: number, x: any) => a + (x.amount ?? 0), 0),
      });
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 30_000);
    return () => clearInterval(timer.current);
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={dv.content} showsVerticalScrollIndicator={false}>
      <HeroBanner metrics={metrics} finance={finance} lastUpdated={lastUpdated} />
      <View style={dv.twoCol}>
        <View style={{ flex: 1 }}>
          <AlertsPanel metrics={metrics} finance={finance} onNavigate={onNavigate} />
          <OrderFunnel metrics={metrics} />
        </View>
        <View style={{ flex: 1 }}>
          <SalesChart />
          <TopBusinesses />
        </View>
      </View>
      <LiveFeed />
    </ScrollView>
  );
}

const dv = StyleSheet.create({
  content: { padding: 28, paddingBottom: 60 },
  twoCol:  { flexDirection: "row", gap: 16, marginBottom: 0 },
});

// ── Tab wrapper ───────────────────────────────────────────────────────────────
function TabWrap({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 32 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardScreen() {
  const { showToast } = useToast();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    apiRequest("GET", "/api/admin/dashboard/metrics")
      .then(r => r.json()).then(m => { if (m) setMetrics(m); }).catch(() => {});
  }, []);

  const renderContent = () => {
    switch (section) {
      // ── Dashboard ──
      case "dashboard":
        return <DashboardView onNavigate={setSection} />;

      // ── Pedidos ──
      case "orders":
      case "orders_active":
        return <OrdersTab mode="active" />;
      case "orders_history":
        return <OrdersTab mode="history" />;

      // ── Negocios ──
      case "businesses":
      case "businesses_list":
        return <BusinessesTab />;
      case "businesses_zones":
        return <ZonesTab />;
      case "businesses_categories":
        return <CategoriesTab />;

      // ── Repartidores ──
      case "drivers":
      case "drivers_list":
        return <DriversTab />;
      case "drivers_map":
        return <AdminMapPanel />;

      // ── Usuarios ──
      case "users":
        return <UsersTab />;

      // ── Finanzas ──
      case "finance":
      case "finance_earnings":
        return <FinanceTab defaultTab="earnings" />;
      case "finance_payouts":
        return <FinanceTab defaultTab="payouts" />;
      case "finance_proofs":
        return <PaymentProofsTab />;
      case "finance_accounts":
        return <AdminPaymentAccountsPanel />;

      // ── Marketing ──
      case "marketing":
      case "coupons":
        return <CouponsTab />;

      // ── Soporte ──
      case "support":
      case "support_tickets":
        return <SupportTab />;
      case "support_verifications":
        return <VerificationsTab />;

      // ── Configuración ──
      case "settings":
        return <SettingsTab />;

      default:
        return <DashboardView onNavigate={setSection} />;
    }
  };

  return (
    <AdminShell active={section} onChange={setSection} metrics={metrics}>
      {renderContent()}
    </AdminShell>
  );
}
