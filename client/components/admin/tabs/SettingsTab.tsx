import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

// Labels hardcodeados — sin depender del description de la BD (evita encoding roto)
const SETTING_META: Record<string, { label: string; category: string; placeholder?: string; sensitive?: boolean }> = {
  comeya_commission:          { label: "Comision ComeYa (%)",              category: "Comisiones",   placeholder: "15" },
  business_commission:        { label: "Comision Negocio (%)",             category: "Comisiones",   placeholder: "100" },
  driver_commission:          { label: "Comision Repartidor (%)",          category: "Comisiones",   placeholder: "100" },
  regret_period_seconds:      { label: "Periodo arrepentimiento (seg)",    category: "Operaciones",  placeholder: "60" },
  business_call_delay_minutes:{ label: "Retraso llamada negocio (min)",    category: "Operaciones",  placeholder: "3" },
  fund_hold_hours:            { label: "Retencion de fondos (horas)",      category: "Operaciones",  placeholder: "1" },
  bizum_phone:                { label: "Telefono Bizum ComeYa",            category: "Pagos",        placeholder: "600000000" },
  comeya_iban:                { label: "IBAN ComeYa",                      category: "Pagos",        placeholder: "ES00 0000 0000 0000 0000 0000" },
  stripe_public_key:          { label: "Stripe Public Key",                category: "Pagos",        placeholder: "pk_live_...", sensitive: true },
  stripe_secret_key:          { label: "Stripe Secret Key",                category: "Pagos",        placeholder: "sk_live_...", sensitive: true },
  gemini_api_key:             { label: "Gemini API Key (OCR)",             category: "Servicios",    placeholder: "AIza...", sensitive: true },
  twilio_verify_sid:          { label: "Twilio Verify SID",                category: "Servicios",    placeholder: "VA...", sensitive: true },
  resend_api_key:             { label: "Resend API Key (emails)",          category: "Servicios",    placeholder: "re_...", sensitive: true },
  google_maps_key:            { label: "Google Maps API Key",              category: "Servicios",    placeholder: "AIza...", sensitive: true },
};

const CATEGORY_ORDER = ["Comisiones", "Operaciones", "Pagos", "Servicios"];

export const SettingsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [values, setValues]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/settings");
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.settings || []).forEach((s: any) => { map[s.key] = s.value; });
      setValues(map);
    } catch {
      showToast("Error al cargar configuracion", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async (key: string) => {
    setSaving(key);
    try {
      const res  = await apiRequest("PUT", "/api/admin/settings", { key, value: values[key] ?? "" });
      const data = await res.json();
      if (data.success) {
        showToast("Guardado correctamente", "success");
      } else {
        showToast(data.error ?? "Error al guardar", "error");
      }
    } catch {
      showToast("Error de conexion", "error");
    } finally {
      setSaving(null);
    }
  };

  const initialize = async () => {
    try {
      const res  = await apiRequest("POST", "/api/admin/settings/initialize");
      const data = await res.json();
      if (data.success) { showToast("Configuracion inicializada", "success"); load(); }
    } catch {
      showToast("Error al inicializar", "error");
    }
  };

  const s = st(theme);

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color={ComeYaColors.primary} /></View>;
  }

  // Agrupar por categoria
  const byCategory: Record<string, string[]> = {};
  Object.entries(SETTING_META).forEach(([key, meta]) => {
    if (!byCategory[meta.category]) byCategory[meta.category] = [];
    byCategory[meta.category].push(key);
  });

  const hasAnySettings = Object.keys(values).length > 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: theme.text }]}>Configuracion del Sistema</Text>
        {!hasAnySettings && (
          <TouchableOpacity onPress={initialize} style={[s.initBtn, { backgroundColor: ComeYaColors.primary }]}>
            <Feather name="settings" size={14} color="#FFF" />
            <Text style={s.initBtnText}>Inicializar</Text>
          </TouchableOpacity>
        )}
      </View>

      {CATEGORY_ORDER.map(cat => {
        const keys = byCategory[cat] ?? [];
        return (
          <View key={cat} style={{ marginBottom: 20 }}>
            <Text style={[s.categoryLabel, { color: theme.textSecondary }]}>{cat.toUpperCase()}</Text>
            {keys.map(key => {
              const meta = SETTING_META[key];
              const isSensitive = meta.sensitive;
              const revealed = showSensitive[key];
              return (
                <View key={key} style={[s.card, { backgroundColor: theme.card }]}>
                  <Text style={[s.label, { color: theme.text }]}>{meta.label}</Text>
                  <View style={s.row}>
                    <TextInput
                      style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                      value={values[key] ?? ""}
                      onChangeText={v => setValues(prev => ({ ...prev, [key]: v }))}
                      placeholder={meta.placeholder ?? ""}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={isSensitive && !revealed}
                      autoCapitalize="none"
                    />
                    {isSensitive && (
                      <TouchableOpacity
                        style={[s.iconBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                        onPress={() => setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        <Feather name={revealed ? "eye-off" : "eye"} size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[s.saveBtn, { backgroundColor: ComeYaColors.primary }]}
                      onPress={() => save(key)}
                      disabled={saving === key}
                    >
                      {saving === key
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Feather name="check" size={18} color="#FFF" />
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
};

const st = (theme: any) => StyleSheet.create({
  container:     { flex: 1, padding: 16 },
  centered:      { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:         { fontSize: 18, fontWeight: "700" },
  initBtn:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  initBtnText:   { color: "#FFF", fontSize: 13, fontWeight: "600" },
  categoryLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
  card:          { borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  label:         { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  row:           { flexDirection: "row", gap: 8, alignItems: "center" },
  input:         { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  iconBtn:       { width: 40, height: 40, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  saveBtn:       { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});
