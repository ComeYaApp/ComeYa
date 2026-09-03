import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { AdminShell, AdminSection, SECTION_ALIASES } from "@/components/admin/AdminShell.web";

// Dashboard components
import { HeroBanner } from "@/components/admin/dashboard/HeroBanner";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { AlertsPanel } from "@/components/admin/dashboard/AlertsPanel";
import { OrderFunnel } from "@/components/admin/dashboard/OrderFunnel";
import { TopBusinesses } from "@/components/admin/dashboard/TopBusinesses";
import { LiveFeed } from "@/components/admin/dashboard/LiveFeed";

// Existing tabs
import { OrdersTab } from "@/components/admin/tabs/OrdersTab.web";
import { BusinessesTab } from "@/components/admin/tabs/BusinessesTab.web";
import { DriversTab } from "@/components/admin/tabs/DriversTab.web";
import { UsersTab } from "@/components/admin/tabs/UsersTab.web";
import { FinanceTab } from "@/components/admin/tabs/FinanceTab.web";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab.web";
import { GiftCardsAdminTab } from "@/components/admin/tabs/GiftCardsAdminTab.web";
import { PremiumSubsTab } from "@/components/admin/tabs/PremiumSubsTab.web";
import { CouponsTab } from "@/components/admin/tabs/CouponsTab.web";
import { SupportTab } from "@/components/admin/tabs/SupportTab.web";
import { IssuesTab } from "@/components/admin/tabs/IssuesTab.web";
import { RefundsTab } from "@/components/admin/tabs/RefundsTab.web";
import { SettingsTab } from "@/components/admin/tabs/SettingsTab.web";
import { ZonesTab } from "@/components/admin/tabs/ZonesTab.web";
import { CategoriesTab } from "@/components/admin/tabs/CategoriesTab.web";
import { VerificationsTab } from "@/components/admin/tabs/VerificationsTab.web";
import { AuditLogsTab } from "@/components/admin/tabs/AuditLogsTab.web";

// Web-specific screens embedded as panels
import AdminPaymentAccountsPanel from "@/screens/AdminPaymentAccountsScreen.web";
import AdminMapPanel from "@/screens/AdminOpsCenterScreen.web";
import DeliveryConfigPanel from "@/screens/DeliveryConfigScreen.web";
// Note: AdminPaymentAccountsScreen.web and AdminMapScreen.web export default, used directly as panels

const PRIMARY = "#E60000";

// ── Dashboard view ────────────────────────────────────────────────────────────
function DashboardView({
  onNavigate,
}: {
  onNavigate: (s: AdminSection) => void;
}) {
  const { isDark } = useTheme();
  const [metrics, setMetrics] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      const [m, e, p] = await Promise.all([
        mRes.json(),
        eRes.json(),
        pRes.json(),
      ]);
      if (m) setMetrics(m);
      setFinance({
        weekRevenue: e?.earnings?.week ?? 0,
        monthRevenue: e?.earnings?.month ?? 0,
        pendingPayouts: p?.payouts?.length ?? 0,
        pendingPayoutAmount: (p?.payouts ?? []).reduce(
          (a: number, x: any) => a + (x.amount ?? 0),
          0,
        ),
      });
      setLastUpdated(new Date());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 30_000);
    return () => clearInterval(timer.current);
  }, []);

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={dv.content}
      showsVerticalScrollIndicator={false}
    >
      <HeroBanner
        metrics={metrics}
        finance={finance}
        lastUpdated={lastUpdated}
      />
      <View style={dv.twoCol}>
        <View style={{ flex: 1 }}>
          <AlertsPanel
            metrics={metrics}
            finance={finance}
            onNavigate={(s) => onNavigate(s as AdminSection)}
          />
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
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 0 },
});

// ── Tab wrapper ───────────────────────────────────────────────────────────────
function TabWrap({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardScreen({ route }: any) {
  const { showToast } = useToast();
  // Las notificaciones y enlaces antiguos usan ids que ya no existen como
  // sección (p.ej. "AdminSupport", "proofs"): se redirigen por alias para no
  // acabar en el dashboard en silencio.
  const resolveSection = (raw: any): AdminSection => {
    const id = typeof raw === "string" ? raw : "dashboard";
    return (SECTION_ALIASES[id] as AdminSection) || id;
  };
  const initialSection = resolveSection(route?.params?.section);
  const [section, setSectionState] = useState<AdminSection>(initialSection);
  const [metrics, setMetrics] = useState<any>(null);

  const setSection = (s: AdminSection) => setSectionState(resolveSection(s));

  // Reaccionar a cambios de params (navegación desde perfil o push)
  useEffect(() => {
    if (route?.params?.section) {
      setSectionState(resolveSection(route.params.section));
    }
  }, [route?.params?.section]);

  useEffect(() => {
    apiRequest("GET", "/api/admin/dashboard/metrics")
      .then((r) => r.json())
      .then((m) => {
        if (m) setMetrics(m);
      })
      .catch(() => {});
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
      case "finance_refunds":
        return <RefundsTab />;
      case "finance_proofs":
        return <PaymentProofsTab />;
      case "finance_giftcards":
        return <GiftCardsAdminTab />;
      case "finance_accounts":
        return <AdminPaymentAccountsPanel />;

      case "premiums":
        return <PremiumSubsTab />;

      // ── Marketing ──
      case "marketing":
      case "coupons":
        return <CouponsTab />;

      // ── Soporte ──
      case "support_tickets":
        return <SupportTab />;
      case "support_issues":
        return <IssuesTab />;
      case "support_verifications":
        return <VerificationsTab />;

      case "logs":
      case "audit_logs":
        return <AuditLogsTab />;

      // ── Configuración ──
      case "settings":
        return <SettingsTab />;

      case "delivery_config":
        return <DeliveryConfigPanel />;

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
