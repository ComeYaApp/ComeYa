import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: "Pendiente",  color: "#F59E0B", icon: "clock"        },
  confirmed:  { label: "Confirmado", color: "#3B82F6", icon: "check"        },
  preparing:  { label: "Preparando", color: "#8B5CF6", icon: "loader"       },
  ready:      { label: "Listo",      color: "#06B6D4", icon: "package"      },
  on_the_way: { label: "En camino",  color: "#10B981", icon: "truck"        },
  delivered:  { label: "Entregado",  color: "#10B981", icon: "check-circle" },
  cancelled:  { label: "Cancelado",  color: "#EF4444", icon: "x-circle"     },
};

function fmt(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export function LiveFeed() {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [pulse, setPulse]   = useState(false);
  const timer               = useRef<any>(null);

  const load = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/orders?status=active&limit=12");
      const data = await res.json();
      const list = data?.orders ?? data ?? [];
      if (list.length) {
        setOrders(list.slice(0, 12));
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15_000);
    return () => clearInterval(timer.current);
  }, []);

  const bg     = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const rowBg  = isDark ? "#222"    : "#fafafa";

  return (
    <View style={[lf.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={lf.header}>
        <View style={[lf.iconWrap, { backgroundColor: "#10B98115" }]}>
          <Feather name="zap" size={15} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[lf.title, { color: text }]}>Feed en vivo</Text>
          <Text style={[lf.sub, { color: sub }]}>Pedidos activos · actualiza cada 15s</Text>
        </View>
        <View style={[lf.livePill, { backgroundColor: pulse ? "#10B98130" : "#10B98115" }]}>
          <View style={lf.liveDot} />
          <Text style={lf.liveTxt}>LIVE</Text>
        </View>
      </View>

      {orders.length === 0 ? (
        <Text style={[lf.empty, { color: sub }]}>Sin pedidos activos ahora mismo</Text>
      ) : (
        orders.map((o, i) => {
          const meta = STATUS_META[o.status] ?? STATUS_META.pending;
          return (
            <View
              key={o.id ?? i}
              style={[lf.row, { backgroundColor: rowBg, borderLeftColor: meta.color }]}
            >
              {/* Status icon */}
              <View style={[lf.statusIcon, { backgroundColor: meta.color + "20" }]}>
                <Feather name={meta.icon as any} size={13} color={meta.color} />
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <View style={lf.topRow}>
                  <Text style={[lf.orderId, { color: text }]}>
                    #{(o.id ?? "").toString().slice(-6).toUpperCase()}
                  </Text>
                  <View style={[lf.statusPill, { backgroundColor: meta.color + "18" }]}>
                    <Text style={[lf.statusTxt, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={[lf.business, { color: sub }]} numberOfLines={1}>
                  {o.businessName ?? "—"}
                </Text>
              </View>

              {/* Amount + time */}
              <View style={lf.right}>
                <Text style={[lf.amount, { color: text }]}>{fmt(o.total ?? 0)}</Text>
                <Text style={[lf.time, { color: sub }]}>{timeAgo(o.createdAt)}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const lf = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  header:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconWrap:   { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 14, fontWeight: "700" },
  sub:        { fontSize: 11, marginTop: 1 },
  livePill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  liveTxt:    { fontSize: 9, fontWeight: "800", color: "#10B981", letterSpacing: 0.8 },
  empty:      { fontSize: 13, textAlign: "center", paddingVertical: 16 },
  row:        { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, marginBottom: 6, borderLeftWidth: 3 },
  statusIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  topRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  orderId:    { fontSize: 12, fontWeight: "700" },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusTxt:  { fontSize: 10, fontWeight: "700" },
  business:   { fontSize: 11, marginTop: 2 },
  right:      { alignItems: "flex-end" },
  amount:     { fontSize: 13, fontWeight: "700" },
  time:       { fontSize: 10, marginTop: 2 },
});
