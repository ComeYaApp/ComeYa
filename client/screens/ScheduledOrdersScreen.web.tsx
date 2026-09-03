import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#E60000";

type Tab = "upcoming" | "history";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  executed: { label: "Completado", color: "#10B981", icon: "check-circle" },
  cancelled: { label: "Cancelado", color: "#EF4444", icon: "x-circle" },
  failed: { label: "Fallido", color: "#F59E0B", icon: "alert-circle" },
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensualmente",
};

export default function ScheduledOrdersScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: scheduledOrders = [], isLoading } = useQuery({
    queryKey: ["scheduled-orders", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scheduled-orders");
      const d = await res.json();
      return d.success ? d.scheduledOrders : [];
    },
    enabled: !!user?.id,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/scheduled-orders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      showToast("Pedido cancelado", "success");
      queryClient.invalidateQueries({ queryKey: ["scheduled-orders"] });
    },
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const formatCurrency = (amount: number) => `${(amount / 100).toFixed(2)} €`;

  const upcomingOrders = (scheduledOrders as any[]).filter(
    (o) => o.status === "pending",
  );
  const historyOrders = (scheduledOrders as any[]).filter((o) =>
    ["executed", "cancelled", "failed"].includes(o.status),
  );

  const TABS: { id: Tab; label: string; icon: string; count: number }[] = [
    {
      id: "upcoming",
      label: "Próximos",
      icon: "clock",
      count: upcomingOrders.length,
    },
    {
      id: "history",
      label: "Historial",
      icon: "archive",
      count: historyOrders.length,
    },
  ];

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Sidebar */}
        <MobileSidebarWrapper
          title="Pedidos Programados"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="calendar" size={36} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>
              Pedidos Programados
            </Text>
            <Text style={[s.sideSub, { color: sub }]}>
              Gestiona tus pedidos automáticos
            </Text>

            <View style={s.sideStats}>
              <View style={[s.statBox, { backgroundColor: cardBg }]}>
                <Text style={[s.statNum, { color: PRIMARY }]}>
                  {upcomingOrders.length}
                </Text>
                <Text style={[s.statLabel, { color: sub }]}>Próximos</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: cardBg }]}>
                <Text style={[s.statNum, { color: text }]}>
                  {historyOrders.length}
                </Text>
                <Text style={[s.statLabel, { color: sub }]}>Historial</Text>
              </View>
            </View>
          </View>

          <View style={s.sideNav}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[s.navItem, activeTab === tab.id && s.navItemActive]}
              >
                <Feather
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.navItemText,
                    { color: activeTab === tab.id ? PRIMARY : text },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    s.navBadge,
                    {
                      backgroundColor: activeTab === tab.id ? PRIMARY : cardBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.navBadgeText,
                      { color: activeTab === tab.id ? "#fff" : sub },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>

        {/* Main */}
        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Tab bar */}
          <View
            style={[s.tabRow, { backgroundColor: card, borderColor: border }]}
          >
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  s.tab,
                  activeTab === tab.id && {
                    borderBottomColor: PRIMARY,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Feather
                  name={tab.icon as any}
                  size={16}
                  color={activeTab === tab.id ? PRIMARY : sub}
                />
                <Text
                  style={[
                    s.tabText,
                    { color: activeTab === tab.id ? PRIMARY : sub },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    s.tabBadge,
                    {
                      backgroundColor:
                        activeTab === tab.id ? PRIMARY + "20" : cardBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.tabBadgeText,
                      { color: activeTab === tab.id ? PRIMARY : sub },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {isLoading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={[s.loadingText, { color: sub }]}>
                Cargando pedidos...
              </Text>
            </View>
          ) : activeTab === "upcoming" ? (
            upcomingOrders.length === 0 ? (
              <View
                style={[
                  s.empty,
                  { backgroundColor: card, borderColor: border },
                ]}
              >
                <Feather name="calendar" size={44} color={sub} />
                <Text style={[s.emptyTitle, { color: text }]}>
                  Sin pedidos programados
                </Text>
                <Text style={[s.emptyText, { color: sub }]}>
                  Programa tus pedidos favoritos para que lleguen cuando los
                  necesites
                </Text>
              </View>
            ) : (
              upcomingOrders.map((order: any) => {
                const { date, time } = formatDateTime(order.scheduledFor);
                const items = (() => {
                  try {
                    return JSON.parse(order.items);
                  } catch {
                    return [];
                  }
                })();
                return (
                  <View
                    key={order.id}
                    style={[
                      s.orderCard,
                      { backgroundColor: card, borderColor: border },
                    ]}
                  >
                    <View style={s.orderCardHeader}>
                      <View
                        style={[
                          s.orderIconWrap,
                          { backgroundColor: PRIMARY + "15" },
                        ]}
                      >
                        <Feather
                          name="shopping-bag"
                          size={20}
                          color={PRIMARY}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.businessName, { color: text }]}>
                          {order.businessName || "Negocio"}
                        </Text>
                        {order.recurringPattern && (
                          <View style={s.recurringBadge}>
                            <Feather name="repeat" size={11} color={PRIMARY} />
                            <Text style={[s.recurringText, { color: PRIMARY }]}>
                              {RECURRENCE_LABELS[order.recurringPattern] ||
                                order.recurringPattern}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.totalText, { color: PRIMARY }]}>
                        {formatCurrency(order.total || 0)}
                      </Text>
                    </View>

                    <View style={[s.orderCardBody, { borderTopColor: border }]}>
                      <View style={s.dateRow}>
                        <Feather name="calendar" size={14} color={sub} />
                        <Text style={[s.dateText, { color: sub }]}>{date}</Text>
                      </View>
                      <View style={s.dateRow}>
                        <Feather name="clock" size={14} color={sub} />
                        <Text style={[s.dateText, { color: sub }]}>{time}</Text>
                      </View>
                    </View>

                    {items.length > 0 && (
                      <View style={[s.itemsWrap, { borderTopColor: border }]}>
                        {items.slice(0, 3).map((item: any, idx: number) => (
                          <Text key={idx} style={[s.itemText, { color: sub }]}>
                            · {item.quantity}x {item.product?.name || item.name}
                          </Text>
                        ))}
                        {items.length > 3 && (
                          <Text style={[s.moreItems, { color: sub }]}>
                            +{items.length - 3} productos más
                          </Text>
                        )}
                      </View>
                    )}

                    <View
                      style={[s.orderCardFooter, { borderTopColor: border }]}
                    >
                      <Pressable
                        onPress={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        style={[s.cancelBtn, { borderColor: "#EF4444" }]}
                      >
                        {cancelMutation.isPending ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <>
                            <Feather name="trash-2" size={14} color="#EF4444" />
                            <Text
                              style={{
                                color: "#EF4444",
                                fontSize: 13,
                                fontWeight: "600",
                                marginLeft: 6,
                              }}
                            >
                              Cancelar pedido
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )
          ) : historyOrders.length === 0 ? (
            <View
              style={[s.empty, { backgroundColor: card, borderColor: border }]}
            >
              <Feather name="archive" size={44} color={sub} />
              <Text style={[s.emptyTitle, { color: text }]}>Sin historial</Text>
              <Text style={[s.emptyText, { color: sub }]}>
                Aquí aparecerán tus pedidos ejecutados y cancelados
              </Text>
            </View>
          ) : (
            historyOrders.map((order: any) => {
              const { date, time } = formatDateTime(order.scheduledFor);
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.failed;
              return (
                <View
                  key={order.id}
                  style={[
                    s.historyCard,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View
                    style={[
                      s.historyIconWrap,
                      { backgroundColor: cfg.color + "15" },
                    ]}
                  >
                    <Feather
                      name={cfg.icon as any}
                      size={20}
                      color={cfg.color}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.businessName, { color: text }]}>
                      {order.businessName || "Negocio"}
                    </Text>
                    <Text style={[s.historyDate, { color: sub }]}>
                      {date} · {time}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.statusPill,
                      { backgroundColor: cfg.color + "15" },
                    ]}
                  >
                    <Text style={[s.statusText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  sideIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  sideTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 16 },
  sideStats: { flexDirection: "row", gap: 12, width: "100%" },
  statBox: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  sideNav: { flex: 1, paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: "#E6000010",
    borderRightWidth: 3,
    borderRightColor: PRIMARY,
  },
  navItemText: { fontSize: 14, fontWeight: "600", flex: 1 },
  navBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  navBadgeText: { fontSize: 11, fontWeight: "700" },
  sideFooter: { borderTopWidth: 1, padding: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1, height: "100vh" as any },
  content: { padding: 32, maxWidth: 720, paddingBottom: 80 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden" as any,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  tabBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { fontSize: 11, fontWeight: "700" },
  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden" as any,
  },
  orderCardHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  orderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  businessName: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  recurringBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  recurringText: { fontSize: 11, fontWeight: "600" },
  totalText: { fontSize: 18, fontWeight: "800" },
  orderCardBody: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13 },
  itemsWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  itemText: { fontSize: 13 },
  moreItems: { fontSize: 12, fontStyle: "italic" },
  orderCardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  historyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  historyDate: { fontSize: 13, marginTop: 3 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700" },
});
