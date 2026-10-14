// Centro de Avisos (nativo): historial persistente de notificaciones del
// servidor con filtros, marcado de leído y "Ver" que abre la pestaña
// correspondiente del panel admin móvil.
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiRequest } from "@/lib/query-client";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import {
  LEVEL_META,
  notifIcon,
  timeAgo,
} from "@/components/admin/notificationMeta";

const SECTION_TO_TAB: Record<string, string> = {
  operations: "map",
  dashboard: "map",
  orders_active: "orders",
  orders_history: "orders",
  support_issues: "issues",
  support_tickets: "support",
  support_verifications: "verifications",
  finance_earnings: "finance",
  finance_payouts: "finance",
  finance_reservations: "finance",
  finance_proofs: "finance",
  finance_refunds: "refunds",
  premiums: "finance",
  users: "users",
  businesses_list: "businesses",
  drivers_list: "drivers",
};

interface Props {
  theme: any;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
  onNavigate?: (tab: string) => void;
}

export const NotificationsTab: React.FC<Props> = ({
  theme,
  showToast,
  onNavigate,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/notifications?limit=120");
      const data = await res.json();
      setItems(data?.notifications ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    );
    try {
      await apiRequest("POST", `/api/admin/notifications/${id}/read`, {});
    } catch {}
  };

  const markAllRead = async () => {
    setItems((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
    );
    try {
      await apiRequest("POST", "/api/admin/notifications/read-all", {});
      showToast?.("Avisos marcados como leídos", "success");
    } catch {}
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  const unread = items.filter((n) => !n.readAt).length;
  const filtered =
    filter === "unread" ? items.filter((n) => !n.readAt) : items;

  return (
    <View style={s.root}>
      <View style={s.rowBetween}>
        <Text style={[s.title, { color: theme.text }]}>
          🔔 Centro de Avisos
        </Text>
        <Pressable onPress={markAllRead} style={s.markAll}>
          <Feather name="check-circle" size={13} color="#fff" />
          <Text style={s.markAllTxt}>Marcar leídos</Text>
        </Pressable>
      </View>

      <View style={s.filters}>
        {(
          [
            ["all", `Todos (${items.length})`],
            ["unread", `No leídos (${unread})`],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key as any)}
            style={[
              s.chip,
              {
                backgroundColor:
                  filter === key ? ComeYaColors.primary : theme.card,
                borderColor: filter === key ? ComeYaColors.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                s.chipTxt,
                { color: filter === key ? "#fff" : theme.textSecondary },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={ComeYaColors.primary}
          />
        }
        contentContainerStyle={{ padding: Spacing.md, gap: 8 }}
      >
        {filtered.length === 0 ? (
          <Text style={[s.empty, { color: theme.textSecondary }]}>
            No hay avisos con este filtro
          </Text>
        ) : (
          filtered.map((n) => {
            const meta = LEVEL_META[n.severity] || LEVEL_META.medium;
            const icon = notifIcon(n.type);
            const unreadItem = !n.readAt;
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (unreadItem) markRead(n.id);
                  const tab = n.section ? SECTION_TO_TAB[n.section] : undefined;
                  if (tab && onNavigate) onNavigate(tab);
                }}
                style={[
                  s.item,
                  {
                    backgroundColor: theme.card,
                    borderLeftColor: meta.color,
                    opacity: unreadItem ? 1 : 0.7,
                  },
                ]}
              >
                <View
                  style={[s.iconWrap, { backgroundColor: meta.color + "18" }]}
                >
                  <Feather name={icon as any} size={15} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.itemTop}>
                    <Text
                      style={[
                        s.itemTitle,
                        {
                          color: theme.text,
                          fontWeight: unreadItem ? "800" : "600",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    <View
                      style={[s.levelPill, { backgroundColor: meta.color + "18" }]}
                    >
                      <Text
                        style={{
                          color: meta.color,
                          fontSize: 9,
                          fontWeight: "800",
                        }}
                      >
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[s.body, { color: theme.textSecondary }]}
                    numberOfLines={2}
                  >
                    {n.body}
                  </Text>
                  <Text style={[s.time, { color: theme.textSecondary }]}>
                    {timeAgo(n.createdAt)}
                  </Text>
                </View>
                {unreadItem && <View style={s.dot} />}
              </Pressable>
            );
          })
        )}
        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "800" },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
  },
  markAllTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "center", paddingVertical: 30, fontSize: 13 },
  item: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemTitle: { fontSize: 13, flexShrink: 1 },
  levelPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  body: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  time: { fontSize: 10, marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E60000",
    alignSelf: "center",
  },
});
