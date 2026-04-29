import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

function fmt(cents: number) {
  if (cents >= 100_000) return `€${(cents / 100 / 1_000).toFixed(1)}K`;
  return `€${(cents / 100).toFixed(0)}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const TIER_COLORS = ["#F59E0B", "#9CA3AF", "#CD7C2F", "#10B981", "#3B82F6"];

export function TopBusinesses() {
  const { isDark } = useTheme();
  const [list, setList]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/admin/finance/top-businesses")
      .then(r => r.json())
      .then(res => { if (res?.topBusinesses) setList(res.topBusinesses.slice(0, 5)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bg     = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const track  = isDark ? "#2a2a2a" : "#f4f4f4";

  const maxComm = Math.max(...list.map(b => b.totalCommissions), 1);

  return (
    <View style={[tb.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={tb.header}>
        <View style={[tb.iconWrap, { backgroundColor: "#F59E0B15" }]}>
          <Feather name="award" size={15} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[tb.title, { color: text }]}>Top negocios</Text>
          <Text style={[tb.sub, { color: sub }]}>Por comisiones generadas</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={PRIMARY} />}
      </View>

      {!loading && list.length === 0 && (
        <Text style={[tb.empty, { color: sub }]}>Sin datos aún</Text>
      )}

      {list.map((b, i) => {
        const pct = Math.round((b.totalCommissions / maxComm) * 100);
        const color = TIER_COLORS[i] ?? "#6B7280";
        return (
          <View key={b.businessId} style={tb.row}>
            <Text style={tb.medal}>{MEDALS[i] ?? `#${i + 1}`}</Text>
            <View style={{ flex: 1 }}>
              <View style={tb.nameRow}>
                <Text style={[tb.name, { color: text }]} numberOfLines={1}>{b.businessName}</Text>
                <Text style={[tb.comm, { color }]}>{fmt(b.totalCommissions)}</Text>
              </View>
              <View style={tb.barRow}>
                <View style={[tb.track, { backgroundColor: track }]}>
                  <View style={[tb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={[tb.orders, { color: sub }]}>{b.totalOrders} pedidos</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  card:    { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  header:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconWrap:{ width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 14, fontWeight: "700" },
  sub:     { fontSize: 11, marginTop: 1 },
  empty:   { fontSize: 13, textAlign: "center", paddingVertical: 12 },
  row:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  medal:   { fontSize: 18, width: 26, textAlign: "center" },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name:    { fontSize: 13, fontWeight: "600", flex: 1, marginRight: 8 },
  comm:    { fontSize: 13, fontWeight: "800" },
  barRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  track:   { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill:    { height: 6, borderRadius: 3, minWidth: 4 },
  orders:  { fontSize: 10, width: 60, textAlign: "right" },
});
