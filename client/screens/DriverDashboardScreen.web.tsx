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

import { DriverShell, DriverSection } from "@/components/driver/DriverShell.web";
import { AvailableOrdersTab }  from "@/components/driver/AvailableOrdersTab.web";
import { MyDeliveriesTab }     from "@/components/driver/MyDeliveriesTab.web";
import { EarningsTab }         from "@/components/driver/EarningsTab.web";
import { DriverProfileTab }    from "@/components/driver/DriverProfileTab.web";
import { DriverVehicleTab }    from "@/components/driver/DriverVehicleTab.web";

// Reuse existing web screens as panels
import DriverMapScreen         from "@/screens/DriverMapScreen.web";
import PaymentWalletSetupPanel from "@/screens/PaymentWalletSetupScreen.web";

const GREEN = "#16A34A";

export default function DriverDashboardScreen() {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [section, setSection]           = useState<DriverSection>("available");
  const [isOnline, setIsOnline]         = useState(false);
  const [togglingOnline, setToggling]   = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";

  // Load initial online status
  const loadStatus = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/delivery/status");
      const data = await res.json();
      if (data.success && typeof data.isOnline !== "undefined") {
        setIsOnline(data.isOnline);
      }
    } catch {}
    finally { setLoadingStatus(false); }
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
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setToggling(false);
    }
  };

  if (loadingStatus) return (
    <View style={[s.loading, { backgroundColor: bg }]}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  const renderContent = () => {
    switch (section) {
      case "available":
        return (
          <AvailableOrdersTab
            isOnline={isOnline}
            onToggleOnline={handleToggleOnline}
            togglingOnline={togglingOnline}
            showToast={showToast}
          />
        );

      case "deliveries_active":
        return <MyDeliveriesTab mode="active" showToast={showToast} />;

      case "deliveries_history":
        return <MyDeliveriesTab mode="history" showToast={showToast} />;

      case "earnings_stats":
        return <EarningsTab mode="stats" />;

      case "earnings_history":
        return <EarningsTab mode="history" />;

      case "map":
        return <DriverMapScreen />;

      case "profile_personal":
        return <DriverProfileTab />;

      case "profile_account":
        return <PaymentWalletSetupPanel />;

      case "profile_vehicle":
        return <DriverVehicleTab />;

      default:
        return (
          <AvailableOrdersTab
            isOnline={isOnline}
            onToggleOnline={handleToggleOnline}
            togglingOnline={togglingOnline}
            showToast={showToast}
          />
        );
    }
  };

  return (
    <DriverShell
      active={section}
      onChange={setSection}
      isOnline={isOnline}
      onToggleOnline={handleToggleOnline}
      togglingOnline={togglingOnline}
    >
      {renderContent()}
    </DriverShell>
  );
}



// ── Vehicle profile inline panel ─────────────────────────────────────────────
function VehicleProfilePanel({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm]     = useState({ vehicleType: "", vehiclePlate: "", vehicleBrand: "", vehicleModel: "", vehicleColor: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const bg     = isDark ? "#0d0d0d" : "#f2f3f5";
  const card   = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#222"   : "#f8f8f8";

  useEffect(() => {
    apiRequest("GET", "/api/users/profile/full")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setForm({
            vehicleType:  d.vehicleType  ?? "",
            vehiclePlate: d.vehiclePlate ?? "",
            vehicleBrand: d.vehicleBrand ?? "",
            vehicleModel: d.vehicleModel ?? "",
            vehicleColor: d.vehicleColor ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res  = await apiRequest("PUT", "/api/users/vehicle", form);
      const data = await res.json();
      if (data.success) showToast("Vehículo actualizado", "success");
      else showToast(data.error ?? "Error al guardar", "error");
    } catch { showToast("Error de conexión", "error"); }
    finally { setSaving(false); }
  };

  const VEHICLE_TYPES = ["moto", "bicicleta", "coche", "patinete"];

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={[vp.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Text style={[vp.title, { color: text }]}>Mi vehículo</Text>
        <Text style={[vp.subtitle, { color: sub }]}>Datos del vehículo de reparto</Text>
      </View>
      <ScrollView contentContainerStyle={vp.content}>
        <View style={[vp.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[vp.sectionTitle, { color: text }]}>Tipo de vehículo</Text>
          <View style={vp.typeRow}>
            {VEHICLE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm(f => ({ ...f, vehicleType: t }))}
                style={[vp.typeBtn, {
                  backgroundColor: form.vehicleType === t ? GREEN + "18" : inputBg,
                  borderColor: form.vehicleType === t ? GREEN : border,
                }]}
              >
                <Text style={{ fontSize: 20 }}>
                  {t === "moto" ? "🛵" : t === "bicicleta" ? "🚲" : t === "coche" ? "🚗" : "🛴"}
                </Text>
                <Text style={[vp.typeTxt, { color: form.vehicleType === t ? GREEN : text }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {[
            { key: "vehiclePlate", label: "Matrícula",  placeholder: "1234 ABC" },
            { key: "vehicleBrand", label: "Marca",      placeholder: "Honda, Yamaha..." },
            { key: "vehicleModel", label: "Modelo",     placeholder: "PCX 125..." },
            { key: "vehicleColor", label: "Color",      placeholder: "Rojo, Negro..." },
          ].map(field => (
            <View key={field.key} style={vp.fieldWrap}>
              <Text style={[vp.fieldLabel, { color: sub }]}>{field.label.toUpperCase()}</Text>
              <TextInput
                style={[vp.input, { backgroundColor: inputBg, borderColor: border, color: text }] as any}
                placeholder={field.placeholder}
                placeholderTextColor={sub}
                value={(form as any)[field.key]}
                onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[vp.saveBtn, { backgroundColor: GREEN, opacity: saving ? 0.7 : 1 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="save" size={16} color="#fff" />
            }
            <Text style={vp.saveTxt}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const vp = StyleSheet.create({
  header:       { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  title:        { fontSize: 20, fontWeight: "800" },
  subtitle:     { fontSize: 12, marginTop: 2 },
  content:      { padding: 24, paddingBottom: 40 },
  card:         { borderRadius: 14, borderWidth: 1, padding: 20, gap: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  typeRow:      { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  typeBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  typeTxt:      { fontSize: 13, fontWeight: "600" },
  fieldWrap:    { gap: 6 },
  fieldLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  saveTxt:      { fontSize: 15, fontWeight: "700", color: "#fff" },
});

const s = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
