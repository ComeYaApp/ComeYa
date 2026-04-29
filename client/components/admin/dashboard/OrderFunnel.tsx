import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface Props { metrics: any }

const STAGES = [
  { key: "pendingOrders",   label: "Pendientes",     icon: "clock",        color: "#F59E0B" },
  { key: "preparingOrders", label: "Preparando",     icon: "loader",       color: "#8B5CF6" },
  { key: "onTheWayOrders",  label: "En camino",      icon: "truck",        color: "#3B82F6" },
  { key: "deliveredToday",  label: "Entregados hoy", icon: "check-circle", color: "#10B981" },
  { key: "cancelledToday",  label: "Cancelados hoy", icon: "x-circle",     color: "#EF4444" },
];

export function OrderFunnel({ metrics }: Props) {
  const { isDark } = useTheme();

  const bg     = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const track  = isDark ? "#2a2a2a" : "#f0f0f0";

  const values = STAGES.map(s => metrics?.[s.key] ?? 0);
  const maxVal = Math.max(...values, 1);

  return (
    <View style={[fn.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={fn.header}>
        <View style={[fn.iconWrap, { backgroundColor: "#3B82F615" }]}>
          <Feather name="activity" size={15} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fn.title, { color: text }]}>Funnel de pedidos</Text>
          <Text style={[fn.sub, { color: sub }]}>Estado actual en tiempo real</Text>
        </View>
        <View style={[fn.totalBadge, { backgroundColor: "#3B82F610", borderColor: "#3B82F630" }]}>
          <Text style={[fn.totalTxt, { color: "#3B82F6" }]}>
            {values.reduce((a, b) => a + b, 0)} total
          </Text>
        </View>
      </View>

      {STAGES.map((s, i) => {
        const val = values[i];
        const pct = Math.round((val / maxVal) * 100);
        return (
          <View key={s.key} style={fn.row}>
            <View style={[fn.stageIcon, { backgroundColor: s.color + "18" }]}>
              <Feather name={s.icon as any} size={13} color={s.color} />
            </View>
            <Text style={[fn.stageLabel, { color: sub }]}>{s.label}</Text>
            <View style={[fn.track, { backgroundColor: track }]}>
              <View
                style={[
                  fn.fill,
                  { width: `${pct}%` as any, backgroundColor: s.color },
                ]}
              />
            </View>
            <Text style={[fn.stageVal, { color: text }]}>{val}</Text>
          </View>
        );
      })}
    </View>
  );
}

const fn = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  header:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconWrap:   { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 14, fontWeight: "700" },
  sub:        { fontSize: 11, marginTop: 1 },
  totalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  totalTxt:   { fontSize: 11, fontWeight: "700" },
  row:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  stageIcon:  { width: 26, height: 26, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  stageLabel: { width: 110, fontSize: 12 },
  track:      { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill:       { height: 8, borderRadius: 4, minWidth: 4 },
  stageVal:   { width: 28, fontSize: 13, fontWeight: "700", textAlign: "right" },
});
