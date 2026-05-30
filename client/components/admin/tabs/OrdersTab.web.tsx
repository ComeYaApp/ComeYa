import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B" },
  confirmed: { label: "Confirmado", color: "#3B82F6" },
  preparing: { label: "Preparando", color: "#8B5CF6" },
  ready: { label: "Listo", color: "#06B6D4" },
  on_the_way: { label: "En camino", color: "#10B981" },
  picked_up: { label: "Recogido", color: "#10B981" },
  delivered: { label: "Entregado", color: "#22C55E" },
  cancelled: { label: "Cancelado", color: "#EF4444" },
};

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
  "picked_up",
];
const HISTORY_STATUSES = ["delivered", "cancelled"];

interface Props {
  orders?: any[];
  onOrderPress?: (order: any) => void;
  mode?: "active" | "history";
}

export const OrdersTab: React.FC<Props> = ({ mode = "active" }) => {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/orders?limit=100");
      const data = await res.json();
      const all: any[] = data?.orders ?? data ?? [];
      const relevant = all.filter((o) =>
        mode === "active"
          ? ACTIVE_STATUSES.includes(o.status)
          : HISTORY_STATUSES.includes(o.status),
      );
      setOrders(relevant);
      setFiltered(relevant);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let list = orders;
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id?.toLowerCase().includes(q) ||
          o.businessName?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q),
      );
    }
    setFiltered(list);
  }, [search, statusFilter, orders]);

  const statuses = mode === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;

  // ── Detail ────────────────────────────────────────────────────────────────
  if (selected) {
    const meta = STATUS_META[selected.status] ?? {
      label: selected.status,
      color: "#888",
    };
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ padding: 28 }}
      >
        <TouchableOpacity style={det.back} onPress={() => setSelected(null)}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[det.backTxt, { color: text }]}>Volver a pedidos</Text>
        </TouchableOpacity>

        <View
          style={[det.card, { backgroundColor: card, borderColor: border }]}
        >
          <View style={det.row}>
            <Text style={[det.orderId, { color: text }]}>
              #{selected.id?.slice(-8).toUpperCase()}
            </Text>
            <View style={[det.pill, { backgroundColor: meta.color + "20" }]}>
              <Text style={[det.pillTxt, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>

          <View style={[det.divider, { backgroundColor: border }]} />

          {[
            {
              icon: "briefcase",
              label: "Negocio",
              value: selected.businessName,
            },
            { icon: "user", label: "Cliente", value: selected.customerName },
            {
              icon: "map-pin",
              label: "Dirección",
              value: selected.deliveryAddress,
            },
            {
              icon: "credit-card",
              label: "Pago",
              value: selected.paymentMethod,
            },
            {
              icon: "truck",
              label: "Repartidor",
              value: selected.deliveryPersonName ?? "Sin asignar",
            },
            {
              icon: "calendar",
              label: "Creado",
              value: new Date(selected.createdAt).toLocaleString("es-ES"),
            },
          ].map((r) =>
            r.value ? (
              <View key={r.label} style={det.infoRow}>
                <View
                  style={[
                    det.infoIcon,
                    { backgroundColor: ComeYaColors.primary + "15" },
                  ]}
                >
                  <Feather
                    name={r.icon as any}
                    size={13}
                    color={ComeYaColors.primary}
                  />
                </View>
                <Text style={[det.infoLabel, { color: sub }]}>{r.label}</Text>
                <Text
                  style={[det.infoValue, { color: text }]}
                  numberOfLines={2}
                >
                  {r.value}
                </Text>
              </View>
            ) : null,
          )}

          <View style={[det.divider, { backgroundColor: border }]} />

          {selected.items?.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[det.sectionTitle, { color: sub }]}>PRODUCTOS</Text>
              {selected.items.map((item: any, i: number) => (
                <View key={i} style={det.itemRow}>
                  <Text style={[det.itemQty, { color: ComeYaColors.primary }]}>
                    {item.quantity}×
                  </Text>
                  <Text
                    style={[det.itemName, { color: text }]}
                    numberOfLines={1}
                  >
                    {item.name ?? item.productName}
                  </Text>
                  <Text style={[det.itemPrice, { color: text }]}>
                    €{((item.price ?? 0) / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View
            style={[
              det.totalsBox,
              {
                backgroundColor: isDark ? "#111" : "#f8f8f8",
                borderColor: border,
              },
            ]}
          >
            {selected.subtotal != null && (
              <View style={det.totalRow}>
                <Text style={[det.totalLabel, { color: sub }]}>Subtotal</Text>
                <Text style={[det.totalVal, { color: text }]}>
                  €{(selected.subtotal / 100).toFixed(2)}
                </Text>
              </View>
            )}
            {selected.deliveryFee != null && (
              <View style={det.totalRow}>
                <Text style={[det.totalLabel, { color: sub }]}>Envío</Text>
                <Text style={[det.totalVal, { color: text }]}>
                  €{(selected.deliveryFee / 100).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[det.totalRow, { marginTop: 6 }]}>
              <Text
                style={[det.totalLabel, { color: text, fontWeight: "700" }]}
              >
                Total
              </Text>
              <Text
                style={[
                  det.totalVal,
                  {
                    color: ComeYaColors.primary,
                    fontWeight: "800",
                    fontSize: 18,
                  },
                ]}
              >
                €{((selected.total ?? 0) / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Toolbar */}
      <View
        style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}
      >
        <View
          style={[
            tb.searchWrap,
            { backgroundColor: inputBg, borderColor: border },
          ]}
        >
          <Feather name="search" size={14} color={sub} />
          <TextInput
            style={[tb.searchInput, { color: text }]}
            placeholder="Buscar pedido, negocio, cliente..."
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
        <Text style={[tb.count, { color: sub }]}>
          {filtered.length} pedidos
        </Text>
      </View>

      {/* Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[tb.filterRow, { borderBottomColor: border }]}
        contentContainerStyle={tb.filterContent}
      >
        <TouchableOpacity
          onPress={() => setStatus("all")}
          style={[
            tb.chip,
            {
              backgroundColor:
                statusFilter === "all" ? ComeYaColors.primary : inputBg,
              borderColor:
                statusFilter === "all" ? ComeYaColors.primary : border,
            },
          ]}
        >
          <Text
            style={[
              tb.chipTxt,
              { color: statusFilter === "all" ? "#fff" : text },
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>

        {statuses.map((s) => {
          const m = STATUS_META[s];
          const active = statusFilter === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              style={[
                tb.chip,
                {
                  backgroundColor: active ? m.color : inputBg,
                  borderColor: active ? m.color : border,
                },
              ]}
            >
              <Text style={[tb.chipTxt, { color: active ? "#fff" : text }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Feather name="inbox" size={40} color={sub} />
          <Text style={{ color: sub, fontSize: 15 }}>
            {mode === "active"
              ? "Sin pedidos activos"
              : "Sin historial de pedidos"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 10 }}
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
        >
          {filtered.map((order) => {
            const meta = STATUS_META[order.status] ?? {
              label: order.status,
              color: "#888",
            };
            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => setSelected(order)}
                style={[
                  li.card,
                  {
                    backgroundColor: card,
                    borderColor: border,
                    borderLeftColor: meta.color,
                  },
                ]}
              >
                <View style={li.top}>
                  <Text style={[li.id, { color: text }]}>
                    #{order.id?.slice(-8).toUpperCase()}
                  </Text>
                  <View
                    style={[li.pill, { backgroundColor: meta.color + "18" }]}
                  >
                    <View style={[li.dot, { backgroundColor: meta.color }]} />
                    <Text style={[li.pillTxt, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                  <Text style={[li.amount, { color: ComeYaColors.primary }]}>
                    €{((order.total ?? 0) / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={li.mid}>
                  <Feather name="briefcase" size={12} color={sub} />
                  <Text style={[li.bizName, { color: text }]} numberOfLines={1}>
                    {order.businessName}
                  </Text>
                  <Feather
                    name="user"
                    size={12}
                    color={sub}
                    style={{ marginLeft: 10 }}
                  />
                  <Text style={[li.bizName, { color: sub }]} numberOfLines={1}>
                    {order.customerName}
                  </Text>
                </View>
                <Text style={[li.date, { color: sub }]}>
                  {new Date(order.createdAt).toLocaleString("es-ES")}
                </Text>
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13 } as any,
  count: { fontSize: 12, fontWeight: "600" },
  filterRow: { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipTxt: { fontSize: 12, fontWeight: "600" },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  id: { fontSize: 13, fontWeight: "700", flex: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 14, fontWeight: "800" },
  mid: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  bizName: { fontSize: 12, fontWeight: "500", flex: 1 },
  date: { fontSize: 11 },
});

const det = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  backTxt: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 16, padding: 24, borderWidth: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  orderId: { fontSize: 20, fontWeight: "800" },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  pillTxt: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1, marginVertical: 16 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: { width: 80, fontSize: 12 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: "600" },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  itemQty: { fontSize: 13, fontWeight: "700", width: 24 },
  itemName: { flex: 1, fontSize: 13 },
  itemPrice: { fontSize: 13, fontWeight: "600" },
  totalsBox: { borderRadius: 10, padding: 14, borderWidth: 1, marginTop: 8 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 13 },
  totalVal: { fontSize: 14, fontWeight: "600" },
});
