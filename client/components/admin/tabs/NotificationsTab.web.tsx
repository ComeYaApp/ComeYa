// Centro de Avisos del admin: historial PERSISTENTE de notificaciones del
// servidor con filtros, marcado de leído y botón "Ver" que lleva a la
// sección exacta del panel.
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { AdminSection } from "@/components/admin/AdminShell.web";

const PRIMARY = "#E60000";

const LEVEL_META: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítico", color: "#EF4444" },
  high: { label: "Importante", color: "#F59E0B" },
  medium: { label: "Info", color: "#3B82F6" },
};

const TYPE_ICON: Record<string, string> = {
  new_order: "shopping-bag",
  new_registration: "user-plus",
  new_delivery_verification: "user-check",
  driver_data_updated: "truck",
  driver_document_updated: "file-text",
  document_updated: "file-text",
  new_proof: "file-text",
  new_fee_proof: "calendar",
  new_payout: "send",
  new_ticket: "message-circle",
  new_issue: "alert-circle",
  fraud: "alert-octagon",
  order_stuck: "clock",
  ops_no_driver: "clock",
  ops_no_response: "bell-off",
  ops_stale_gps: "wifi-off",
  ops_too_long: "alert-triangle",
  cancellation_refund: "rotate-ccw",
  refund_failed: "alert-triangle",
  chargeback: "alert-octagon",
  new_subscription: "star",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  onNavigate?: (s: AdminSection) => void;
}

export const NotificationsTab: React.FC<Props> = ({ onNavigate }) => {
  const { isDark } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "critical" | "high">(
    "all",
  );

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#888" : "#888";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/notifications?limit=120");
      const data = await res.json();
      setItems(data?.notifications ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    try {
      await apiRequest("POST", `/api/admin/notifications/${id}/read`, {});
    } catch {}
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    try {
      await apiRequest("POST", "/api/admin/notifications/read-all", {});
    } catch {}
  };

  const filtered = items.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "critical") return n.severity === "critical";
    if (filter === "high") return n.severity === "high" || n.severity === "critical";
    return true;
  });

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border, backgroundColor: card }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: text }]}>🔔 Centro de Avisos</Text>
          <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>
            Historial de todo lo que pasa en la plataforma · {unread} sin leer
          </Text>
        </View>
        <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={s.markAllTxt}>Marcar todo leído</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={[s.filters, { borderBottomColor: border }]}>
        {(
          [
            ["all", "Todos"],
            ["unread", `No leídos (${unread})`],
            ["high", "Importantes+"],
            ["critical", "Críticos"],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key as any)}
            style={[
              s.chip,
              filter === key && { backgroundColor: PRIMARY, borderColor: PRIMARY },
            ]}
          >
            <Text style={[s.chipTxt, filter === key && { color: "#fff" }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Feather name="inbox" size={40} color={sub} />
          <Text style={{ color: sub, marginTop: 10 }}>
            No hay avisos con este filtro
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 8 }}
        >
          {filtered.map((n) => {
            const meta = LEVEL_META[n.severity] || LEVEL_META.medium;
            const icon = TYPE_ICON[n.type] || "bell";
            const unreadItem = !n.readAt;
            return (
              <View
                key={n.id}
                style={[
                  s.item,
                  {
                    backgroundColor: card,
                    borderLeftColor: meta.color,
                    opacity: n.resolvedAt && !unreadItem ? 0.65 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={s.itemMain}
                  onPress={() => {
                    if (unreadItem) markRead(n.id);
                    if (n.section && onNavigate) {
                      onNavigate(n.section as AdminSection);
                    }
                  }}
                >
                  <View style={[s.itemIcon, { backgroundColor: meta.color + "18" }]}>
                    <Feather name={icon as any} size={15} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={[
                          s.itemTitle,
                          { color: text, fontWeight: unreadItem ? "800" : "600" },
                        ]}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      <View style={[s.levelPill, { backgroundColor: meta.color + "18" }]}>
                        <Text style={{ color: meta.color, fontSize: 9, fontWeight: "800" }}>
                          {meta.label}
                        </Text>
                      </View>
                      {unreadItem && (
                        <View style={s.unreadDot} />
                      )}
                    </View>
                    <Text style={{ color: sub, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
                      {n.body}
                    </Text>
                  </View>
                  <Text style={{ color: sub, fontSize: 10, minWidth: 70, textAlign: "right" }}>
                    {timeAgo(n.createdAt)}
                  </Text>
                </TouchableOpacity>
                {n.section && onNavigate && (
                  <TouchableOpacity
                    onPress={() => {
                      if (unreadItem) markRead(n.id);
                      onNavigate(n.section as AdminSection);
                    }}
                    style={s.viewBtn}
                  >
                    <Text style={s.viewTxt}>Ver →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: { fontSize: 19, fontWeight: "800" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markAllTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#88888855",
  },
  chipTxt: { fontSize: 11, fontWeight: "700", color: "#888" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  itemTitle: { fontSize: 13, flexShrink: 1 },
  levelPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E6000015",
  },
  viewTxt: { color: PRIMARY, fontSize: 11, fontWeight: "800" },
});
