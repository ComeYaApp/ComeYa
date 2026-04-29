import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { DriverDetail } from "./DriversTab.detail.web";

const PRIMARY = "#DC2626";
const PURPLE  = "#8B5CF6";

export interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isOnline: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  strikes: number;
  totalDeliveries: number;
  rating: number | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  currentLatitude: string | null;
  currentLongitude: string | null;
  pendingPayouts: number;
  pendingAmount: number;
}

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const DriversTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [filtered, setFiltered]     = useState<Driver[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState<"all" | "online" | "offline" | "blocked">("all");
  const [selected, setSelected]     = useState<Driver | null>(null);

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/drivers");
      const data = await res.json();
      setDrivers(data.drivers ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = drivers;
    if (filter === "online")  list = list.filter(d => d.isOnline);
    if (filter === "offline") list = list.filter(d => !d.isOnline && !d.isBlocked);
    if (filter === "blocked") list = list.filter(d => d.isBlocked);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.vehiclePlate?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, filter, drivers]);

  const onlineCount  = drivers.filter(d => d.isOnline).length;
  const blockedCount = drivers.filter(d => d.isBlocked).length;
  const strikesCount = drivers.filter(d => d.strikes > 0).length;

  const FILTERS = [
    { id: "all",     label: "Todos",      count: drivers.length, color: PURPLE    },
    { id: "online",  label: "En línea",   count: onlineCount,    color: "#10B981" },
    { id: "offline", label: "Offline",    count: drivers.length - onlineCount - blockedCount, color: sub },
    { id: "blocked", label: "Bloqueados", count: blockedCount,   color: "#EF4444" },
  ] as const;

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>

      {/* ── Panel izquierdo: lista ── */}
      <View style={{ flex: 1 }}>

        {/* KPI bar */}
        <View style={[kpi.bar, { backgroundColor: card, borderBottomColor: border }]}>
          {[
            { icon: "truck",          label: "Total",      value: drivers.length, color: PURPLE    },
            { icon: "wifi",           label: "En línea",   value: onlineCount,    color: "#10B981" },
            { icon: "alert-triangle", label: "Con strikes",value: strikesCount,   color: "#F59E0B" },
            { icon: "lock",           label: "Bloqueados", value: blockedCount,   color: "#EF4444" },
          ].map(k => (
            <View key={k.label} style={kpi.item}>
              <View style={[kpi.iconWrap, { backgroundColor: k.color + "15" }]}>
                <Feather name={k.icon as any} size={14} color={k.color} />
              </View>
              <Text style={[kpi.val, { color: k.color }]}>{k.value}</Text>
              <Text style={[kpi.lbl, { color: sub }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Toolbar */}
        <View style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}>
          <View style={[tb.searchWrap, { backgroundColor: inputBg, borderColor: border }]}>
            <Feather name="search" size={14} color={sub} />
            <TextInput
              style={[tb.input, { color: text }]}
              placeholder="Buscar nombre, teléfono, matrícula..."
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
          <Text style={[tb.count, { color: sub }]}>{filtered.length} repartidores</Text>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={[tb.filterRow, { borderBottomColor: border }]}
          contentContainerStyle={tb.filterContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[tb.chip, {
                backgroundColor: filter === f.id ? f.color : inputBg,
                borderColor: filter === f.id ? f.color : border,
              }]}
            >
              <Text style={[tb.chipTxt, { color: filter === f.id ? "#fff" : text }]}>
                {f.label}
              </Text>
              <View style={[tb.chipBadge, { backgroundColor: filter === f.id ? "rgba(255,255,255,0.25)" : f.color + "20" }]}>
                <Text style={[tb.chipBadgeTxt, { color: filter === f.id ? "#fff" : f.color }]}>{f.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        {filtered.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}>
            <Feather name="truck" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>Sin repartidores</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          >
            {filtered.map(driver => {
              const isSelected = selected?.id === driver.id;
              const statusColor = driver.isBlocked ? "#EF4444" : driver.isOnline ? "#10B981" : sub;
              const statusLabel = driver.isBlocked ? "Bloqueado" : driver.isOnline ? "En línea" : "Offline";

              return (
                <TouchableOpacity
                  key={driver.id}
                  onPress={() => setSelected(driver)}
                  style={[
                    li.card,
                    { backgroundColor: card, borderColor: isSelected ? PURPLE : border },
                    isSelected && { borderLeftColor: PURPLE, borderLeftWidth: 3 },
                  ]}
                >
                  <View style={li.row}>
                    {/* Avatar */}
                    <View style={[li.avatar, { backgroundColor: PURPLE + "20" }]}>
                      <Text style={[li.avatarTxt, { color: PURPLE }]}>
                        {driver.name.charAt(0).toUpperCase()}
                      </Text>
                      <View style={[li.onlineDot, { backgroundColor: driver.isBlocked ? "#EF4444" : driver.isOnline ? "#10B981" : "#9CA3AF" }]} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={li.nameRow}>
                        <Text style={[li.name, { color: text }]} numberOfLines={1}>{driver.name}</Text>
                        {driver.strikes > 0 && (
                          <View style={[li.strikePill, { backgroundColor: "#F59E0B20" }]}>
                            <Text style={[li.strikeTxt, { color: "#F59E0B" }]}>⚡ {driver.strikes}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[li.phone, { color: sub }]}>{driver.phone ?? "Sin teléfono"}</Text>
                      {driver.vehicleType && (
                        <Text style={[li.vehicle, { color: sub }]}>
                          🚗 {driver.vehicleType}{driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}
                        </Text>
                      )}
                    </View>

                    {/* Right */}
                    <View style={li.right}>
                      <View style={[li.statusPill, { backgroundColor: statusColor + "15" }]}>
                        <View style={[li.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[li.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                      <Text style={[li.deliveries, { color: sub }]}>{driver.totalDeliveries} entregas</Text>
                      {driver.rating != null && (
                        <Text style={[li.rating, { color: "#F59E0B" }]}>
                          ★ {(driver.rating / 10).toFixed(1)}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel derecho: detalle ── */}
      {selected && (
        <DriverDetail
          driver={selected}
          isDark={isDark}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
          onUpdate={(updated) => {
            setSelected(updated);
            setDrivers(prev => prev.map(d => d.id === updated.id ? updated : d));
          }}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const kpi = StyleSheet.create({
  bar:     { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  item:    { flex: 1, alignItems: "center", gap: 4 },
  iconWrap:{ width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  val:     { fontSize: 18, fontWeight: "800" },
  lbl:     { fontSize: 10, fontWeight: "600" },
});

const tb = StyleSheet.create({
  bar:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchWrap:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  input:         { flex: 1, fontSize: 13 } as any,
  count:         { fontSize: 12, fontWeight: "600" },
  filterRow:     { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  chip:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  chipTxt:       { fontSize: 12, fontWeight: "600" },
  chipBadge:     { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  chipBadgeTxt:  { fontSize: 10, fontWeight: "700" },
});

const li = StyleSheet.create({
  card:       { borderRadius: 12, padding: 12, borderWidth: 1 },
  row:        { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarTxt:  { fontSize: 18, fontWeight: "800" },
  onlineDot:  { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#fff" },
  nameRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name:       { fontSize: 14, fontWeight: "700", flex: 1 },
  strikePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  strikeTxt:  { fontSize: 10, fontWeight: "700" },
  phone:      { fontSize: 12, marginBottom: 1 },
  vehicle:    { fontSize: 11 },
  right:      { alignItems: "flex-end", gap: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { fontSize: 11, fontWeight: "700" },
  deliveries: { fontSize: 11 },
  rating:     { fontSize: 12, fontWeight: "700" },
});
