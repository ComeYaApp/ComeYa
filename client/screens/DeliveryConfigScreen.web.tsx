import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";
const CYAN    = "#06B6D4";

const TIERS = [
  { key: "tier1",      label: "Tramo 0 – 2 km",       hint: "Entregas muy cercanas dentro del centro",         icon: "map-pin",   color: "#10B981" },
  { key: "tier2",      label: "Tramo 2 – 3 km",       hint: "Distancia media, barrios próximos",               icon: "navigation",color: "#3B82F6" },
  { key: "tier3",      label: "Tramo 3 – 4 km",       hint: "Distancia larga, periferia de la ciudad",         icon: "truck",     color: "#F59E0B" },
  { key: "extraPerKm", label: "Extra por km (> 4 km)", hint: "Se suma por cada km adicional a partir de 4 km",  icon: "plus",      color: "#EF4444" },
];

const PREVIEW_KMS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8];

export default function DeliveryConfigScreen() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [config, setConfig]   = useState({ tier1: "2.50", tier2: "4.00", tier3: "5.00", extraPerKm: "1.00" });
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#222"    : "#f8f8f8";

  useEffect(() => {
    apiRequest("GET", "/api/delivery/config")
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setConfig({
            tier1:      data.config.tier1.toFixed(2),
            tier2:      data.config.tier2.toFixed(2),
            tier3:      data.config.tier3.toFixed(2),
            extraPerKm: data.config.extraPerKm.toFixed(2),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const feeFor = (km: number) => {
    const t1 = parseFloat(config.tier1)      || 0;
    const t2 = parseFloat(config.tier2)      || 0;
    const t3 = parseFloat(config.tier3)      || 0;
    const ex = parseFloat(config.extraPerKm) || 0;
    if (km <= 2) return t1;
    if (km <= 3) return t2;
    if (km <= 4) return t3;
    return t3 + Math.ceil(km - 4) * ex;
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const res  = await apiRequest("PUT", "/api/delivery/config", {
        tier1:      parseFloat(config.tier1),
        tier2:      parseFloat(config.tier2),
        tier3:      parseFloat(config.tier3),
        extraPerKm: parseFloat(config.extraPerKm),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setErr(data.error ?? "Error al guardar");
      }
    } catch { setErr("Error de conexión"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 28, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={hd.row}>
        <View style={[hd.iconWrap, { backgroundColor: CYAN + "15" }]}>
          <Feather name="navigation" size={20} color={CYAN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hd.title, { color: text }]}>Tarifas de entrega</Text>
          <Text style={[hd.sub, { color: sub }]}>Costes de envío por tramos de distancia · Soria, España</Text>
        </View>
      </View>

      {/* Info */}
      <View style={[hd.info, { backgroundColor: CYAN + "10", borderColor: CYAN + "30" }]}>
        <Feather name="info" size={13} color={CYAN} />
        <Text style={[hd.infoTxt, { color: CYAN }]}>
          Soria es una ciudad compacta (~8 km máximo). Las tarifas se aplican según la distancia en línea recta entre el negocio y la dirección de entrega.
        </Text>
      </View>

      <View style={lay.cols}>
        {/* Columna izquierda: configuración */}
        <View style={{ flex: 1, gap: 12 }}>
          <Text style={[lay.sectionTitle, { color: sub }]}>CONFIGURACIÓN DE TRAMOS</Text>

          {TIERS.map(tier => {
            const val = config[tier.key as keyof typeof config];
            return (
              <View key={tier.key} style={[ti.card, { backgroundColor: card, borderColor: border, borderLeftColor: tier.color }]}>
                <View style={ti.header}>
                  <View style={[ti.iconWrap, { backgroundColor: tier.color + "15" }]}>
                    <Feather name={tier.icon as any} size={14} color={tier.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ti.label, { color: text }]}>{tier.label}</Text>
                    <Text style={[ti.hint, { color: sub }]}>{tier.hint}</Text>
                  </View>
                  <View style={[ti.currentBadge, { backgroundColor: tier.color + "12" }]}>
                    <Text style={[ti.currentTxt, { color: tier.color }]}>€{parseFloat(val || "0").toFixed(2)}</Text>
                  </View>
                </View>
                <View style={[ti.inputRow, { backgroundColor: inputBg, borderColor: border }]}>
                  <Text style={[ti.euro, { color: sub }]}>€</Text>
                  <TextInput
                    style={[ti.input, { color: text }]}
                    value={val}
                    onChangeText={v => setConfig(p => ({ ...p, [tier.key]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={sub}
                  />
                </View>
              </View>
            );
          })}

          {/* Feedback + Guardar */}
          {err && (
            <View style={[btn.errBox, { backgroundColor: "#EF444415" }]}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={[btn.errTxt, { color: "#EF4444" }]}>{err}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[btn.save, { backgroundColor: saved ? "#10B981" : saving ? sub : PRIMARY }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Feather name={saved ? "check" : "save"} size={15} color="#fff" />
                  <Text style={btn.saveTxt}>{saved ? "¡Guardado!" : "Guardar tarifas"}</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Columna derecha: preview */}
        <View style={[pv.card, { backgroundColor: card, borderColor: border }]}>
          <View style={pv.header}>
            <View style={[pv.iconWrap, { backgroundColor: "#8B5CF615" }]}>
              <Feather name="eye" size={14} color="#8B5CF6" />
            </View>
            <Text style={[pv.title, { color: text }]}>Vista previa de tarifas</Text>
          </View>

          <View style={[pv.tableHeader, { borderBottomColor: border }]}>
            <Text style={[pv.thKm, { color: sub }]}>Distancia</Text>
            <Text style={[pv.thFee, { color: sub }]}>Tarifa</Text>
            <Text style={[pv.thBar, { color: sub }]}>Relativo</Text>
          </View>

          {PREVIEW_KMS.map(km => {
            const fee    = feeFor(km);
            const maxFee = feeFor(8);
            const pct    = maxFee > 0 ? (fee / maxFee) * 100 : 0;
            const color  = km <= 2 ? "#10B981" : km <= 3 ? "#3B82F6" : km <= 4 ? "#F59E0B" : "#EF4444";
            return (
              <View key={km} style={[pv.row, { borderBottomColor: border }]}>
                <View style={pv.kmCell}>
                  <View style={[pv.kmDot, { backgroundColor: color }]} />
                  <Text style={[pv.kmTxt, { color: text }]}>{km} km</Text>
                </View>
                <Text style={[pv.feeTxt, { color }]}>€{fee.toFixed(2)}</Text>
                <View style={[pv.barTrack, { backgroundColor: isDark ? "#333" : "#f0f0f0" }]}>
                  <View style={[pv.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}

          <View style={[pv.note, { backgroundColor: isDark ? "#222" : "#f8f8f8", borderColor: border }]}>
            <Feather name="info" size={11} color={sub} />
            <Text style={[pv.noteTxt, { color: sub }]}>
              La distancia se calcula en línea recta (Haversine) entre el negocio y la dirección de entrega.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const hd = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  iconWrap:{ width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 20, fontWeight: "800" },
  sub:     { fontSize: 12, marginTop: 2 },
  info:    { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  infoTxt: { flex: 1, fontSize: 12, lineHeight: 18 },
});

const lay = StyleSheet.create({
  cols:        { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  sectionTitle:{ fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
});

const ti = StyleSheet.create({
  card:        { borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, padding: 14, gap: 10 },
  header:      { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap:    { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  label:       { fontSize: 13, fontWeight: "700" },
  hint:        { fontSize: 11, marginTop: 1 },
  currentBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  currentTxt:  { fontSize: 14, fontWeight: "800" },
  inputRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  euro:        { fontSize: 15, fontWeight: "700", marginRight: 6 },
  input:       { flex: 1, fontSize: 16 } as any,
});

const btn = StyleSheet.create({
  errBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8 },
  errTxt: { fontSize: 12, fontWeight: "600" },
  save:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  saveTxt:{ color: "#fff", fontSize: 14, fontWeight: "700" },
});

const pv = StyleSheet.create({
  card:       { flex: 1, borderRadius: 16, borderWidth: 1, padding: 18 },
  header:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconWrap:   { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 14, fontWeight: "700" },
  tableHeader:{ flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, marginBottom: 4 },
  thKm:       { width: 70, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  thFee:      { width: 60, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  thBar:      { flex: 1, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  kmCell:     { width: 70, flexDirection: "row", alignItems: "center", gap: 6 },
  kmDot:      { width: 7, height: 7, borderRadius: 4 },
  kmTxt:      { fontSize: 13, fontWeight: "600" },
  feeTxt:     { width: 60, fontSize: 13, fontWeight: "800" },
  barTrack:   { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill:    { height: 6, borderRadius: 3, minWidth: 4 },
  note:       { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  noteTxt:    { flex: 1, fontSize: 10, lineHeight: 15 },
});
