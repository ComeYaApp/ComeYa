import React, { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

import { DriverShell, DriverSection } from "@/components/driver/DriverShell.web";
import { AvailableOrdersTab }  from "@/components/driver/AvailableOrdersTab.web";
import { MyDeliveriesTab }     from "@/components/driver/MyDeliveriesTab.web";
import { EarningsTab }         from "@/components/driver/EarningsTab.web";
import { DriverProfileTab }    from "@/components/driver/DriverProfileTab.web";
import { DriverVehicleTab }    from "@/components/driver/DriverVehicleTab.web";
import DriverMapScreen         from "@/screens/DriverMapScreen.web";
import PaymentWalletSetupPanel from "@/screens/PaymentWalletSetupScreen.web";

const GREEN = "#16A34A";

export default function DriverDashboardScreen() {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [section, setSection]         = useState<DriverSection>("available");
  const [isOnline, setIsOnline]       = useState(false);
  const [togglingOnline, setToggling] = useState(false);
  const [loadingStatus, setLoading]   = useState(true);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";

  const loadStatus = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/delivery/status");
      const data = await res.json();
      if (data.success && typeof data.isOnline !== "undefined") setIsOnline(data.isOnline);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleToggleOnline = async () => {
    setToggling(true);
    try {
      const res  = await apiRequest("POST", "/api/delivery/toggle-status", {});
      const data = await res.json();
      if (data.success) {
        const next = typeof data.isOnline !== "undefined" ? data.isOnline : !isOnline;
        setIsOnline(next);
        showToast(next ? "✅ Ahora estás en línea" : "⏸ Ahora estás desconectado", next ? "success" : "info");
      } else {
        showToast(data.error ?? "No se pudo cambiar el estado", "error");
      }
    } catch { showToast("Error de conexión", "error"); }
    finally { setToggling(false); }
  };

  if (loadingStatus) return (
    <View style={[s.loading, { backgroundColor: bg }]}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  const renderContent = () => {
    switch (section) {
      case "available":          return <AvailableOrdersTab isOnline={isOnline} onToggleOnline={handleToggleOnline} togglingOnline={togglingOnline} showToast={showToast} />;
      case "deliveries_active":  return <MyDeliveriesTab mode="active"  showToast={showToast} />;
      case "deliveries_history": return <MyDeliveriesTab mode="history" showToast={showToast} />;
      case "earnings_stats":     return <EarningsTab mode="stats" />;
      case "earnings_history":   return <EarningsTab mode="history" />;
      case "map":                return <DriverMapScreen />;
      case "profile_personal":   return <DriverProfileTab />;
      case "profile_account":    return <PaymentWalletSetupPanel />;
      case "profile_vehicle":    return <DriverVehicleTab />;
      default:                   return <AvailableOrdersTab isOnline={isOnline} onToggleOnline={handleToggleOnline} togglingOnline={togglingOnline} showToast={showToast} />;
    }
  };

  return (
    <DriverShell active={section} onChange={setSection} isOnline={isOnline} onToggleOnline={handleToggleOnline} togglingOnline={togglingOnline}>
      {renderContent()}
    </DriverShell>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
