import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

// ── Definición completa de settings ──────────────────────────────────────────
interface SettingDef {
  key: string;
  label: string;
  hint: string;
  placeholder: string;
  type: "number" | "text" | "boolean" | "euro";
  icon: string;
  color: string;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  settings: SettingDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "commissions", label: "Comisiones", icon: "percent", color: "#10B981",
    description: "Control de márgenes y distribución de ingresos entre la plataforma, negocios y repartidores",
    settings: [
      { key: "comeya_commission",   label: "Comisión ComeYa",      hint: "Markup % sobre el precio base de los productos. El cliente paga este extra.",          placeholder: "15",  type: "number", icon: "trending-up",  color: "#10B981" },
      { key: "business_commission", label: "Comisión Negocio",     hint: "% del precio base que recibe el negocio por cada pedido entregado.",                   placeholder: "100", type: "number", icon: "briefcase",    color: "#3B82F6" },
      { key: "driver_commission",   label: "Comisión Repartidor",  hint: "% de la tarifa de entrega que recibe el repartidor por cada entrega completada.",       placeholder: "100", type: "number", icon: "truck",        color: "#8B5CF6" },
    ],
  },
  {
    id: "operations", label: "Operaciones", icon: "settings", color: "#F59E0B",
    description: "Tiempos y comportamientos automáticos del flujo de pedidos",
    settings: [
      { key: "regret_period_seconds",       label: "Período de arrepentimiento", hint: "Segundos que tiene el cliente para cancelar gratis tras confirmar el pedido.",          placeholder: "60", type: "number", icon: "clock",         color: "#F59E0B" },
      { key: "business_call_delay_minutes", label: "Retraso llamada negocio",    hint: "Minutos de espera antes de llamar automáticamente al negocio si no acepta el pedido.", placeholder: "3",  type: "number", icon: "phone",         color: "#F97316" },
      { key: "fund_hold_hours",             label: "Retención de fondos",        hint: "Horas que se retienen los fondos antes de liberarlos al confirmar la entrega.",         placeholder: "1",  type: "number", icon: "lock",          color: "#EF4444" },
    ],
  },
  {
    id: "payments", label: "Cuentas de pago ComeYa", icon: "credit-card", color: "#06B6D4",
    description: "Cuentas donde los clientes envían sus pagos manuales (Bizum, SEPA, PayPal)",
    settings: [
      { key: "bizum_phone",    label: "Teléfono Bizum",   hint: "Número de teléfono donde los clientes envían pagos por Bizum.",                    placeholder: "600000000",                    type: "text",    icon: "smartphone",   color: "#00ADEF" },
      { key: "comeya_iban",    label: "IBAN ComeYa",      hint: "Cuenta bancaria SEPA para transferencias. Formato: ES00 0000 0000 0000 0000 0000.", placeholder: "ES00 0000 0000 0000 0000 0000", type: "text",    icon: "credit-card",  color: "#2E7D32" },
      { key: "paypal_email",   label: "Email PayPal",     hint: "Email de la cuenta PayPal de ComeYa para recibir pagos.",                          placeholder: "pagos@comeya.es",              type: "text",    icon: "mail",         color: "#003087" },
    ],
  },
  {
    id: "stripe", label: "Stripe", icon: "zap", color: "#635BFF",
    description: "Configuración del procesador de pagos con tarjeta. Las API keys van en variables de entorno de Render.",
    settings: [
      { key: "stripe_enabled", label: "Stripe habilitado", hint: "Activa o desactiva los pagos con tarjeta y Bizum via Stripe en el checkout.", placeholder: "true", type: "boolean", icon: "toggle-right", color: "#635BFF" },
    ],
  },
];

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const SettingsTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [values, setValues]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<Record<string, boolean>>({});
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [initializing, setInit] = useState(false);

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#222"    : "#f8f8f8";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/settings");
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.settings ?? []).forEach((s: any) => { map[s.key] = s.value; });
      setValues(map);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashSaved = (key: string) => {
    setSaved(p => ({ ...p, [key]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
  };

  const validate = (def: SettingDef, val: string): string | null => {
    if (def.type === "number") {
      const n = parseFloat(val);
      if (isNaN(n) || n < 0) return "Debe ser un número positivo";
      if (def.key.includes("commission") && n > 100) return "No puede superar 100%";
    }
    if (def.type === "euro" && isNaN(parseFloat(val))) return "Importe inválido";
    return null;
  };

  const save = async (def: SettingDef) => {
    const val = values[def.key] ?? "";
    const err = validate(def, val);
    if (err) { setErrors(p => ({ ...p, [def.key]: err })); return; }
    setErrors(p => ({ ...p, [def.key]: "" }));
    setSaving(def.key);
    try {
      const res  = await apiRequest("PUT", "/api/admin/settings", { key: def.key, value: val });
      const data = await res.json();
      if (data.success) flashSaved(def.key);
      else setErrors(p => ({ ...p, [def.key]: data.error ?? "Error al guardar" }));
    } catch { setErrors(p => ({ ...p, [def.key]: "Error de conexión" })); }
    finally { setSaving(null); }
  };

  const initialize = async () => {
    setInit(true);
    try {
      await apiRequest("POST", "/api/admin/settings/initialize");
      await load();
    } catch {}
    finally { setInit(false); }
  };

  const toggleBoolean = (key: string) => {
    const current = values[key] === "true";
    setValues(p => ({ ...p, [key]: current ? "false" : "true" }));
  };

  const hasSettings = Object.keys(values).length > 0;

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 28, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

      {/* Page header */}
      <View style={ph.row}>
        <View style={[ph.iconWrap, { backgroundColor: "#6B728015" }]}>
          <Feather name="sliders" size={20} color="#6B7280" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ph.title, { color: text }]}>Configuración del sistema</Text>
          <Text style={[ph.sub, { color: sub }]}>Parámetros globales de la plataforma · cambios en tiempo real</Text>
        </View>
        {!hasSettings && (
          <TouchableOpacity onPress={initialize} disabled={initializing} style={[ph.initBtn, { backgroundColor: PRIMARY }]}>
            {initializing ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Feather name="settings" size={13} color="#fff" /><Text style={ph.initTxt}>Inicializar</Text></>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      <View style={[ph.infoBanner, { backgroundColor: "#3B82F610", borderColor: "#3B82F630" }]}>
        <Feather name="info" size={14} color="#3B82F6" />
        <Text style={[ph.infoTxt, { color: "#3B82F6" }]}>
          Las API keys (Stripe, Gemini, Twilio, Cloudinary, etc.) se configuran en las variables de entorno de Render — no aquí. Solo se gestionan parámetros operativos del negocio.
        </Text>
      </View>

      {/* Categories */}
      {CATEGORIES.map(cat => (
        <View key={cat.id} style={[sec.card, { backgroundColor: card, borderColor: border }]}>
          {/* Category header */}
          <View style={sec.header}>
            <View style={[sec.iconWrap, { backgroundColor: cat.color + "15" }]}>
              <Feather name={cat.icon as any} size={18} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[sec.title, { color: text }]}>{cat.label}</Text>
              <Text style={[sec.desc, { color: sub }]}>{cat.description}</Text>
            </View>
          </View>

          <View style={[sec.divider, { backgroundColor: border }]} />

          {/* Settings */}
          {cat.settings.map((def, i) => {
            const val      = values[def.key] ?? "";
            const isSaving = saving === def.key;
            const isSaved  = saved[def.key];
            const errMsg   = errors[def.key];
            const isLast   = i === cat.settings.length - 1;
            const isBool   = def.type === "boolean";
            const boolOn   = val === "true";

            return (
              <View key={def.key} style={[si.row, !isLast && { borderBottomWidth: 1, borderBottomColor: border }]}>
                {/* Icon + label */}
                <View style={[si.iconWrap, { backgroundColor: def.color + "12" }]}>
                  <Feather name={def.icon as any} size={14} color={def.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[si.label, { color: text }]}>{def.label}</Text>
                  <Text style={[si.hint, { color: sub }]}>{def.hint}</Text>
                  {errMsg ? (
                    <Text style={si.errTxt}>{errMsg}</Text>
                  ) : isSaved ? (
                    <View style={si.savedRow}>
                      <Feather name="check-circle" size={11} color="#10B981" />
                      <Text style={si.savedTxt}>Guardado</Text>
                    </View>
                  ) : null}
                </View>

                {/* Control */}
                {isBool ? (
                  <View style={si.boolWrap}>
                    <TouchableOpacity
                      onPress={() => {
                        toggleBoolean(def.key);
                        // Auto-save on toggle
                        setTimeout(async () => {
                          const newVal = values[def.key] === "true" ? "false" : "true";
                          try {
                            const res  = await apiRequest("PUT", "/api/admin/settings", { key: def.key, value: newVal });
                            const data = await res.json();
                            if (data.success) flashSaved(def.key);
                          } catch {}
                        }, 50);
                      }}
                      style={[si.toggle, { backgroundColor: boolOn ? def.color : (isDark ? "#333" : "#ddd") }]}
                    >
                      <View style={[si.toggleThumb, { transform: [{ translateX: boolOn ? 18 : 2 }] }]} />
                    </TouchableOpacity>
                    <Text style={[si.boolLabel, { color: boolOn ? def.color : sub }]}>
                      {boolOn ? "Activado" : "Desactivado"}
                    </Text>
                  </View>
                ) : (
                  <View style={si.inputWrap}>
                    <View style={[si.inputRow, { backgroundColor: inputBg, borderColor: errMsg ? "#EF4444" : isSaved ? "#10B981" : border }]}>
                      {def.type === "euro" && <Text style={[si.prefix, { color: sub }]}>€</Text>}
                      {def.type === "number" && (
                        <Text style={[si.prefix, { color: sub }]}>
                          {def.key.includes("commission") ? "%" : def.key.includes("seconds") ? "s" : def.key.includes("minutes") ? "m" : "h"}
                        </Text>
                      )}
                      <TextInput
                        style={[si.input, { color: text }]}
                        value={val}
                        onChangeText={v => {
                          setValues(p => ({ ...p, [def.key]: v }));
                          setErrors(p => ({ ...p, [def.key]: "" }));
                        }}
                        placeholder={def.placeholder}
                        placeholderTextColor={sub}
                        keyboardType={def.type === "number" || def.type === "euro" ? "decimal-pad" : "default"}
                        autoCapitalize="none"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => save(def)}
                      disabled={isSaving}
                      style={[si.saveBtn, {
                        backgroundColor: isSaved ? "#10B981" : isSaving ? sub : def.color,
                      }]}
                    >
                      {isSaving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Feather name={isSaved ? "check" : "save"} size={14} color="#fff" />
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}


    </ScrollView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const ph = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  iconWrap:   { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 20, fontWeight: "800" },
  sub:        { fontSize: 12, marginTop: 2 },
  initBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  initTxt:    { color: "#fff", fontSize: 13, fontWeight: "700" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  infoTxt:    { flex: 1, fontSize: 12, lineHeight: 18 },
});

const sec = StyleSheet.create({
  card:    { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  header:  { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 18 },
  iconWrap:{ width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 15, fontWeight: "700" },
  desc:    { fontSize: 12, marginTop: 3, lineHeight: 17 },
  divider: { height: 1 },
});

const si = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  iconWrap:   { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:      { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  hint:       { fontSize: 11, lineHeight: 15 },
  errTxt:     { fontSize: 11, color: "#EF4444", marginTop: 3, fontWeight: "600" },
  savedRow:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  savedTxt:   { fontSize: 11, color: "#10B981", fontWeight: "600" },
  inputWrap:  { flexDirection: "row", alignItems: "center", gap: 8 },
  inputRow:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40, minWidth: 140 },
  prefix:     { fontSize: 12, fontWeight: "700", marginRight: 4 },
  input:      { flex: 1, fontSize: 14, minWidth: 80 } as any,
  saveBtn:    { width: 36, height: 36, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  boolWrap:   { flexDirection: "row", alignItems: "center", gap: 8 },
  toggle:     { width: 44, height: 26, borderRadius: 13, justifyContent: "center" },
  toggleThumb:{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  boolLabel:  { fontSize: 12, fontWeight: "700" },
});


