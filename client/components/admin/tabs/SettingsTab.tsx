import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

// Solo configuraciones que el admin cambia en runtime desde el panel.
// Las API keys (Stripe, Gemini, Twilio, etc.) van en variables de entorno de Render.
const SETTINGS: { key: string; label: string; category: string; placeholder: string; hint?: string }[] = [
  // Comisiones
  { key: "comeya_commission",           label: "Comision ComeYa (%)",           category: "Comisiones",  placeholder: "15",   hint: "Markup sobre precio base de productos" },
  { key: "business_commission",         label: "Comision Negocio (%)",           category: "Comisiones",  placeholder: "100",  hint: "% del precio base que recibe el negocio" },
  { key: "driver_commission",           label: "Comision Repartidor (%)",        category: "Comisiones",  placeholder: "100",  hint: "% de la tarifa de entrega que recibe el repartidor" },
  // Operaciones
  { key: "regret_period_seconds",       label: "Periodo arrepentimiento (seg)",  category: "Operaciones", placeholder: "60",   hint: "Segundos que tiene el cliente para cancelar gratis" },
  { key: "business_call_delay_minutes", label: "Retraso llamada negocio (min)",  category: "Operaciones", placeholder: "3",    hint: "Minutos antes de llamar al negocio si no acepta" },
  { key: "fund_hold_hours",             label: "Retencion de fondos (horas)",    category: "Operaciones", placeholder: "1",    hint: "Horas hasta liberar fondos al confirmar entrega" },
  // Pagos - cuentas receptoras ComeYa (Espana)
  { key: "bizum_phone",                 label: "Telefono Bizum ComeYa",          category: "Pagos",       placeholder: "600000000" },
  { key: "comeya_iban",                 label: "IBAN ComeYa",                    category: "Pagos",       placeholder: "ES00 0000 0000 0000 0000 0000" },
  { key: "paypal_email",                label: "Email PayPal ComeYa",            category: "Pagos",       placeholder: "pagos@comeya.es" },
];

const CATEGORIES = ["Comisiones", "Operaciones", "Pagos"];

export const SettingsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [values, setValues]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

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
      if (data.success) showToast("Guardado", "success");
      else showToast(data.error ?? "Error", "error");
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

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={ComeYaColors.primary} /></View>;

  const hasSettings = Object.keys(values).length > 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: theme.text }]}>Configuracion del Sistema</Text>
        {!hasSettings && (
          <TouchableOpacity onPress={initialize} style={[s.initBtn, { backgroundColor: ComeYaColors.primary }]}>
            <Feather name="settings" size={14} color="#FFF" />
            <Text style={s.initBtnText}>Inicializar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info box */}
      <View style={[s.infoBox, { backgroundColor: ComeYaColors.primary + "12", borderColor: ComeYaColors.primary + "30" }]}>
        <Feather name="info" size={14} color={ComeYaColors.primary} />
        <Text style={[s.infoText, { color: ComeYaColors.primary }]}>
          Las API keys (Stripe, Gemini, Twilio, etc.) se configuran en las variables de entorno de Render, no aqui.
        </Text>
      </View>

      {CATEGORIES.map(cat => {
        const items = SETTINGS.filter(s => s.category === cat);
        return (
          <View key={cat} style={{ marginBottom: 20 }}>
            <Text style={[s.catLabel, { color: theme.textSecondary }]}>{cat.toUpperCase()}</Text>
            {items.map(item => (
              <View key={item.key} style={[s.card, { backgroundColor: theme.card }]}>
                <Text style={[s.label, { color: theme.text }]}>{item.label}</Text>
                {item.hint && <Text style={[s.hint, { color: theme.textSecondary }]}>{item.hint}</Text>}
                <View style={s.row}>
                  <TextInput
                    style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                    value={values[item.key] ?? ""}
                    onChangeText={v => setValues(prev => ({ ...prev, [item.key]: v }))}
                    placeholder={item.placeholder}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    keyboardType={item.key.includes("commission") || item.key.includes("seconds") || item.key.includes("minutes") || item.key.includes("hours") ? "numeric" : "default"}
                  />
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: saving === item.key ? theme.backgroundSecondary : ComeYaColors.primary }]}
                    onPress={() => save(item.key)}
                    disabled={saving === item.key}
                  >
                    {saving === item.key
                      ? <ActivityIndicator size="small" color={ComeYaColors.primary} />
                      : <Feather name="check" size={18} color="#FFF" />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
};

const st = (theme: any) => StyleSheet.create({
  container:  { flex: 1, padding: 16 },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title:      { fontSize: 18, fontWeight: "700" },
  initBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  initBtnText:{ color: "#FFF", fontSize: 13, fontWeight: "600" },
  infoBox:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  infoText:   { flex: 1, fontSize: 12, lineHeight: 18 },
  catLabel:   { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
  card:       { borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  label:      { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  hint:       { fontSize: 11, marginBottom: 8 },
  row:        { flexDirection: "row", gap: 8, alignItems: "center" },
  input:      { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  saveBtn:    { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});
