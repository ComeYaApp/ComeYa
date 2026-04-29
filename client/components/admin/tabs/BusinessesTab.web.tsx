import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurante",
  market:     "Mercado",
  store:      "Tienda",
};

const LEVEL_META: Record<string, { label: string; color: string }> = {
  bronze:   { label: "Bronze",   color: "#CD7C2F" },
  silver:   { label: "Silver",   color: "#9CA3AF" },
  gold:     { label: "Gold",     color: "#F59E0B" },
  platinum: { label: "Platinum", color: "#8B5CF6" },
};

interface Props {
  businesses?: any[];
  onBusinessPress?: (b: any) => void;
  showCategories?: boolean;
}

export const BusinessesTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [filtered, setFiltered]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatus]   = useState("all");
  const [selected, setSelected]     = useState<any>(null);
  const [commission, setCommission] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/businesses");
      const data = await res.json();
      const list: any[] = data?.businesses ?? data ?? [];
      setBusinesses(list);
      setFiltered(list);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = businesses;
    if (typeFilter !== "all")   list = list.filter(b => b.type === typeFilter);
    if (statusFilter === "active")   list = list.filter(b => b.isActive);
    if (statusFilter === "inactive") list = list.filter(b => !b.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, typeFilter, statusFilter, businesses]);

  const saveCommission = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const val = commission.trim() === "" ? null : parseFloat(commission);
      if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
        setSaveMsg({ ok: false, text: "Debe ser un número entre 0 y 100" });
        return;
      }
      const res  = await apiRequest("PUT", `/api/admin/businesses/${selected.id}/commission`, { customCommission: val });
      const data = await res.json();
      if (data.success) {
        setSaveMsg({ ok: true, text: "Comisión actualizada" });
        setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, customCommission: val } : b));
        setSelected((prev: any) => ({ ...prev, customCommission: val }));
      } else {
        setSaveMsg({ ok: false, text: data.error ?? "Error al guardar" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (biz: any) => {
    try {
      await apiRequest("PUT", `/api/admin/businesses/${biz.id}`, { isActive: !biz.isActive });
      setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, isActive: !b.isActive } : b));
      if (selected?.id === biz.id) setSelected((p: any) => ({ ...p, isActive: !p.isActive }));
    } catch {}
  };

  // ── Detail panel ──────────────────────────────────────────────────────────
  if (selected) {
    const level = LEVEL_META[selected.partnerLevel] ?? null;
    return (
      <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>
        {/* List (narrow) */}
        <View style={[det.listPane, { backgroundColor: card, borderRightColor: border }]}>
          <TouchableOpacity style={det.backBtn} onPress={() => setSelected(null)}>
            <Feather name="arrow-left" size={14} color={PRIMARY} />
            <Text style={[det.backTxt, { color: PRIMARY }]}>Todos los negocios</Text>
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map(b => (
              <TouchableOpacity
                key={b.id}
                onPress={() => { setSelected(b); setCommission(b.customCommission?.toString() ?? ""); setSaveMsg(null); }}
                style={[det.listItem, selected.id === b.id && { backgroundColor: PRIMARY + "10", borderRightWidth: 3, borderRightColor: PRIMARY }]}
              >
                <View style={[det.listDot, { backgroundColor: b.isActive ? "#10B981" : "#EF4444" }]} />
                <Text style={[det.listName, { color: text }]} numberOfLines={1}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Detail */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 28 }}>
          {/* Header */}
          <View style={det.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[det.bizName, { color: text }]}>{selected.name}</Text>
              <Text style={[det.bizType, { color: sub }]}>{TYPE_LABEL[selected.type] ?? selected.type}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleActive(selected)}
              style={[det.toggleBtn, { backgroundColor: selected.isActive ? "#10B98115" : "#EF444415", borderColor: selected.isActive ? "#10B981" : "#EF4444" }]}
            >
              <View style={[det.toggleDot, { backgroundColor: selected.isActive ? "#10B981" : "#EF4444" }]} />
              <Text style={[det.toggleTxt, { color: selected.isActive ? "#10B981" : "#EF4444" }]}>
                {selected.isActive ? "Activo" : "Inactivo"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info cards row */}
          <View style={det.infoRow}>
            {[
              { icon: "map-pin",  label: "Dirección", value: selected.address ?? "—" },
              { icon: "phone",    label: "Teléfono",  value: selected.phone   ?? "—" },
              { icon: "mail",     label: "Email",     value: selected.email   ?? "—" },
              { icon: "star",     label: "Rating",    value: selected.rating  ? `${(selected.rating / 100).toFixed(1)} ★` : "—" },
            ].map(r => (
              <View key={r.label} style={[det.infoCard, { backgroundColor: card, borderColor: border }]}>
                <View style={[det.infoIcon, { backgroundColor: PRIMARY + "12" }]}>
                  <Feather name={r.icon as any} size={13} color={PRIMARY} />
                </View>
                <Text style={[det.infoLabel, { color: sub }]}>{r.label}</Text>
                <Text style={[det.infoValue, { color: text }]} numberOfLines={2}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* Level badge */}
          {level && (
            <View style={[det.levelBadge, { backgroundColor: level.color + "15", borderColor: level.color + "40" }]}>
              <Feather name="award" size={14} color={level.color} />
              <Text style={[det.levelTxt, { color: level.color }]}>Nivel {level.label}</Text>
            </View>
          )}

          {/* Commission editor */}
          <View style={[det.section, { backgroundColor: card, borderColor: border }]}>
            <View style={det.sectionHeader}>
              <View style={[det.sectionIcon, { backgroundColor: "#F59E0B15" }]}>
                <Feather name="percent" size={14} color="#F59E0B" />
              </View>
              <Text style={[det.sectionTitle, { color: text }]}>Comisión personalizada</Text>
            </View>
            <Text style={[det.sectionSub, { color: sub }]}>
              Actual: {selected.customCommission != null ? `${selected.customCommission}% (personalizada)` : "Global del sistema"}
            </Text>
            <View style={det.commRow}>
              <TextInput
                style={[det.commInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                value={commission}
                onChangeText={setCommission}
                placeholder="Vacío = usar global (ej: 15)"
                placeholderTextColor={sub}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                onPress={saveCommission}
                disabled={saving}
                style={[det.saveBtn, { backgroundColor: saving ? sub : PRIMARY }]}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="check" size={14} color="#fff" /><Text style={det.saveTxt}>Guardar</Text></>
                }
              </TouchableOpacity>
            </View>
            {saveMsg && (
              <View style={[det.msgBox, { backgroundColor: saveMsg.ok ? "#10B98115" : "#EF444415" }]}>
                <Feather name={saveMsg.ok ? "check-circle" : "alert-circle"} size={13} color={saveMsg.ok ? "#10B981" : "#EF4444"} />
                <Text style={[det.msgTxt, { color: saveMsg.ok ? "#10B981" : "#EF4444" }]}>{saveMsg.text}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          {(selected.totalOrders != null || selected.totalRevenue != null) && (
            <View style={[det.section, { backgroundColor: card, borderColor: border }]}>
              <View style={det.sectionHeader}>
                <View style={[det.sectionIcon, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="bar-chart-2" size={14} color="#3B82F6" />
                </View>
                <Text style={[det.sectionTitle, { color: text }]}>Estadísticas</Text>
              </View>
              <View style={det.statsRow}>
                {[
                  { label: "Pedidos totales", value: selected.totalOrders ?? 0,    color: "#3B82F6" },
                  { label: "Ingresos",        value: `€${((selected.totalRevenue ?? 0) / 100).toFixed(0)}`, color: "#10B981" },
                  { label: "Completados",     value: selected.completedOrders ?? 0, color: "#8B5CF6" },
                ].map(s => (
                  <View key={s.label} style={[det.statCard, { backgroundColor: s.color + "10" }]}>
                    <Text style={[det.statVal, { color: s.color }]}>{s.value}</Text>
                    <Text style={[det.statLabel, { color: sub }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Toolbar */}
      <View style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={[tb.searchWrap, { backgroundColor: inputBg, borderColor: border }]}>
          <Feather name="search" size={14} color={sub} />
          <TextInput
            style={[tb.searchInput, { color: text }]}
            placeholder="Buscar negocio, dirección..."
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={sub} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[tb.count, { color: sub }]}>{filtered.length} negocios</Text>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[tb.filterRow, { borderBottomColor: border }]} contentContainerStyle={tb.filterContent}>
        {[
          { id: "all",      label: "Todos",       color: PRIMARY    },
          { id: "active",   label: "Activos",     color: "#10B981"  },
          { id: "inactive", label: "Inactivos",   color: "#EF4444"  },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setStatus(f.id)}
            style={[tb.chip, { backgroundColor: statusFilter === f.id ? f.color : inputBg, borderColor: statusFilter === f.id ? f.color : border }]}
          >
            <Text style={[tb.chipTxt, { color: statusFilter === f.id ? "#fff" : text }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={[tb.divider, { backgroundColor: border }]} />
        {[
          { id: "all",        label: "Todos los tipos" },
          { id: "restaurant", label: "Restaurantes"    },
          { id: "market",     label: "Mercados"        },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setTypeFilter(f.id)}
            style={[tb.chip, { backgroundColor: typeFilter === f.id ? "#8B5CF6" : inputBg, borderColor: typeFilter === f.id ? "#8B5CF6" : border }]}
          >
            <Text style={[tb.chipTxt, { color: typeFilter === f.id ? "#fff" : text }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}>
          <Feather name="briefcase" size={40} color={sub} />
          <Text style={{ color: sub, fontSize: 15 }}>Sin negocios</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
        >
          {filtered.map(biz => {
            const level = LEVEL_META[biz.partnerLevel];
            return (
              <TouchableOpacity
                key={biz.id}
                onPress={() => { setSelected(biz); setCommission(biz.customCommission?.toString() ?? ""); setSaveMsg(null); }}
                style={[li.card, { backgroundColor: card, borderColor: border, borderLeftColor: biz.isActive ? "#10B981" : "#EF4444" }]}
              >
                <View style={li.top}>
                  <View style={[li.dot, { backgroundColor: biz.isActive ? "#10B981" : "#EF4444" }]} />
                  <Text style={[li.name, { color: text }]} numberOfLines={1}>{biz.name}</Text>
                  {level && (
                    <View style={[li.levelPill, { backgroundColor: level.color + "18" }]}>
                      <Text style={[li.levelTxt, { color: level.color }]}>{level.label}</Text>
                    </View>
                  )}
                  <View style={[li.typePill, { backgroundColor: "#8B5CF615" }]}>
                    <Text style={[li.typeTxt, { color: "#8B5CF6" }]}>{TYPE_LABEL[biz.type] ?? biz.type}</Text>
                  </View>
                </View>
                <View style={li.mid}>
                  <Feather name="map-pin" size={11} color={sub} />
                  <Text style={[li.addr, { color: sub }]} numberOfLines={1}>{biz.address ?? "Sin dirección"}</Text>
                  <Feather name="percent" size={11} color={sub} style={{ marginLeft: 10 }} />
                  <Text style={[li.addr, { color: sub }]}>
                    {biz.customCommission != null ? `${biz.customCommission}%` : "Global"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  bar:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  searchWrap:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  searchInput:   { flex: 1, fontSize: 13 } as any,
  count:         { fontSize: 12, fontWeight: "600" },
  filterRow:     { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  chipTxt:       { fontSize: 12, fontWeight: "600" },
  divider:       { width: 1, height: 20, marginHorizontal: 4 },
});

const li = StyleSheet.create({
  card:     { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  top:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  name:     { flex: 1, fontSize: 14, fontWeight: "700" },
  levelPill:{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  levelTxt: { fontSize: 10, fontWeight: "700" },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeTxt:  { fontSize: 10, fontWeight: "600" },
  mid:      { flexDirection: "row", alignItems: "center", gap: 5 },
  addr:     { fontSize: 12, flex: 1 },
});

const det = StyleSheet.create({
  listPane:    { width: 220, borderRightWidth: 1 },
  backBtn:     { flexDirection: "row", alignItems: "center", gap: 6, padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  backTxt:     { fontSize: 12, fontWeight: "700" },
  listItem:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  listDot:     { width: 7, height: 7, borderRadius: 4 },
  listName:    { flex: 1, fontSize: 12, fontWeight: "500" },
  headerRow:   { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 20 },
  bizName:     { fontSize: 22, fontWeight: "800" },
  bizType:     { fontSize: 13, marginTop: 3 },
  toggleBtn:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  toggleDot:   { width: 7, height: 7, borderRadius: 4 },
  toggleTxt:   { fontSize: 12, fontWeight: "700" },
  infoRow:     { flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  infoCard:    { flex: 1, minWidth: 140, borderRadius: 12, padding: 14, borderWidth: 1, gap: 4 },
  infoIcon:    { width: 26, height: 26, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  infoLabel:   { fontSize: 10, fontWeight: "600" },
  infoValue:   { fontSize: 13, fontWeight: "600" },
  levelBadge:  { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  levelTxt:    { fontSize: 12, fontWeight: "700" },
  section:     { borderRadius: 14, padding: 18, borderWidth: 1, marginBottom: 14 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  sectionTitle:{ fontSize: 14, fontWeight: "700" },
  sectionSub:  { fontSize: 12, marginBottom: 12 },
  commRow:     { flexDirection: "row", gap: 10, alignItems: "center" },
  commInput:   { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  saveBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveTxt:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  msgBox:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, padding: 10, borderRadius: 8 },
  msgTxt:      { fontSize: 12, fontWeight: "600" },
  statsRow:    { flexDirection: "row", gap: 10 },
  statCard:    { flex: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  statVal:     { fontSize: 20, fontWeight: "800" },
  statLabel:   { fontSize: 11, marginTop: 3 },
});
