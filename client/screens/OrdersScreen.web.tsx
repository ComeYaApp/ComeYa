import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useReorder } from "@/hooks/useReorder";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { OrderProgressBar } from "@/components/OrderProgressBar";
import { displayOrderNumber } from "@/utils/orderNumber";

const PRIMARY = "#DC2626";

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B", icon: "clock" },
  accepted: { label: "Aceptado", color: "#3B82F6", icon: "check" },
  confirmed: { label: "Confirmado", color: "#3B82F6", icon: "check-circle" },
  preparing: { label: "Preparando", color: "#8B5CF6", icon: "package" },
  ready: { label: "Listo", color: "#10B981", icon: "check-square" },
  assigned_driver: {
    label: "Repartidor asignado",
    color: "#6366F1",
    icon: "user",
  },
  picked_up: { label: "Recogido", color: "#8B5CF6", icon: "shopping-bag" },
  on_the_way: { label: "En camino", color: "#22C55E", icon: "truck" },
  in_transit: { label: "En tránsito", color: "#22C55E", icon: "navigation" },
  arriving: { label: "Llegando", color: "#10B981", icon: "map-pin" },
  delivered: { label: "Entregado", color: "#6B7280", icon: "check-circle" },
  cancelled: { label: "Cancelado", color: "#EF4444", icon: "x-circle" },
  refunded: { label: "Reembolsado", color: "#6B7280", icon: "rotate-ccw" },
};

export default function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { reorder } = useReorder();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<"active" | "done" | "cancelled">("active");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  const loadOrders = useCallback(async () => {
    try {
      const d = await apiRequest("GET", "/api/orders").then((r) => r.json());
      const mapped = (d.orders || [])
        .map((row: any) => {
          const o = row.order ?? row;
          const b = row.business;
          return {
            ...o,
            businessName: o.businessName || b?.name || "",
            businessImage: o.businessImage || b?.image || "",
            items:
              typeof o.items === "string"
                ? JSON.parse(o.items)
                : (o.items ?? []),
          };
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setOrders(mapped);
      if (!selected) {
        const active = mapped.find(
          (o: any) => !["delivered", "cancelled"].includes(o.status),
        );
        if (active) setSelected(active);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingId(orderId);
    try {
      const res = await apiRequest(
        "POST",
        `/api/fund-release/confirm-delivery`,
        { orderId },
      );
      const data = await res.json();
      if (data.success) {
        showToast("✅ Entrega confirmada. ¡Gracias!", "success");
        loadOrders();
      } else {
        showToast(data.error || "Error al confirmar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  const activeOrders = orders.filter(
    (o) =>
      !(
        o.status === "cancelled" ||
        (o.status === "delivered" && o.confirmedByCustomer)
      ),
  );
  const historyOrders = orders.filter(
    (o) =>
      o.status === "cancelled" ||
      (o.status === "delivered" && o.confirmedByCustomer),
  );
  const doneOrders = orders.filter((o) => o.status === "delivered");
  const cancelledOrders = orders.filter(
    (o) => o.status === "cancelled" || o.status === "refunded",
  );
  const displayOrders =
    tab === "done"
      ? doneOrders
      : tab === "cancelled"
        ? cancelledOrders
        : activeOrders;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* NAVBAR */}
      <View
        style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <Text style={[s.navTitle, { color: text }]}>Mis pedidos</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        {/* LISTA — en móvil ocupa todo el ancho, en desktop 360px */}
        <View
          style={[
            s.list,
            { borderRightColor: border, width: isMobile ? "100%" : 360 },
          ]}
        >
          {/* Tabs */}
          <View style={[s.tabs, { borderBottomColor: border }]}>
            {(["active", "done", "cancelled"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[s.tab, tab === t && s.tabActive]}
              >
                <Text style={[s.tabText, { color: tab === t ? PRIMARY : sub }]}>
                  {t === "active"
                    ? `Pendientes (${activeOrders.length})`
                    : t === "done"
                      ? `Realizados (${doneOrders.length})`
                      : `Cancelados (${cancelledOrders.length})`}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : displayOrders.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 40 }}>📦</Text>
                <Text style={[s.emptyText, { color: sub }]}>
                  {tab === "active"
                    ? "No tienes pedidos activos"
                    : "Sin historial de pedidos"}
                </Text>
              </View>
            ) : (
              displayOrders.map((order) => {
                const st = STATUS[order.status] || STATUS.pending;
                const isSelected = selected?.id === order.id;
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => setSelected(order)}
                    style={[
                      s.orderCard,
                      {
                        backgroundColor: isSelected ? PRIMARY + "08" : card,
                        borderColor: isSelected ? PRIMARY : border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.orderStatus,
                        { backgroundColor: st.color + "20" },
                      ]}
                    >
                      <Feather
                        name={st.icon as any}
                        size={16}
                        color={st.color}
                      />
                    </View>
                    <View style={s.orderInfo}>
                      <Text
                        style={[s.orderBiz, { color: text }]}
                        numberOfLines={1}
                      >
                        {order.businessName}
                      </Text>
                      <Text style={[s.orderMeta, { color: sub }]}>
                        {displayOrderNumber(order)} ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("es-ES")}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 3,
                        }}
                      >
                        <View
                          style={[
                            s.statusBadge,
                            { backgroundColor: st.color + "15" },
                          ]}
                        >
                          <Text style={[s.statusText, { color: st.color }]}>
                            {st.label}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.statusBadge,
                            { backgroundColor: "#e0e0e0" },
                          ]}
                        >
                          <Text style={[s.statusText, { color: "#555" }]}>
                            {order.orderType === "pickup"
                              ? "🛍️ Recoger"
                              : "🚚 Delivery"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[s.orderTotal, { color: text }]}>
                      {(order.total / 100).toFixed(2)} €
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* DETALLE — en móvil ocupa todo el ancho con botón volver */}
        <View style={[s.detail, { backgroundColor: card }]}>
          {isMobile && selected && (
            <Pressable
              onPress={() => setSelected(null)}
              style={[s.mobileBack, { borderBottomColor: border }]}
            >
              <Feather name="arrow-left" size={18} color={text} />
              <Text style={[{ color: text, fontSize: 15, fontWeight: "600" }]}>
                Volver a pedidos
              </Text>
            </Pressable>
          )}
          {!selected ? (
            <View style={s.detailEmpty}>
              <Text style={{ fontSize: 48 }}>👆</Text>
              <Text style={[s.detailEmptyText, { color: sub }]}>
                Selecciona un pedido para ver los detalles
              </Text>
            </View>
          ) : (
            (() => {
              const st = STATUS[selected.status] || STATUS.pending;
              const items = (() => {
                try {
                  return JSON.parse(selected.items || "[]");
                } catch {
                  return [];
                }
              })();
              return (
                <ScrollView
                  contentContainerStyle={s.detailContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={s.detailHeader}>
                    <Text style={[s.detailTitle, { color: text }]}>
                      {selected.businessName}
                    </Text>
                    <Text style={[s.detailId, { color: sub }]}>
                      Pedido {displayOrderNumber(selected)}
                    </Text>
                  </View>

                  <View
                    style={[
                      s.statusCard,
                      {
                        backgroundColor: st.color + "12",
                        borderColor: st.color + "30",
                      },
                    ]}
                  >
                    <Feather name={st.icon as any} size={22} color={st.color} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.statusCardTitle, { color: st.color }]}>
                        {st.label}
                      </Text>
                      <Text style={[s.statusCardSub, { color: sub }]}>
                        {selected.status === "on_the_way"
                          ? "Tu repartidor está en camino"
                          : selected.status === "delivered"
                            ? "Pedido entregado con éxito"
                            : "Actualizando estado..."}
                      </Text>
                    </View>
                    {[
                      "pending",
                      "confirmed",
                      "preparing",
                      "ready",
                      "on_the_way",
                    ].includes(selected.status) && (
                      <Pressable
                        style={[s.trackBtn, { backgroundColor: PRIMARY }]}
                        onPress={() =>
                          navigation.navigate("OrderTracking", {
                            orderId: selected.id,
                          })
                        }
                      >
                        <Text style={s.trackBtnText}>Seguir</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Barra de progreso */}
                  {!["delivered", "cancelled"].includes(selected.status) && (
                    <View style={{ marginBottom: 20 }}>
                      <OrderProgressBar
                        status={selected.status}
                        orderType={selected.orderType || "delivery"}
                      />
                    </View>
                  )}

                  {/* Confirmar entrega */}
                  {selected.status === "delivered" &&
                    !selected.confirmedByCustomer && (
                      <Pressable
                        onPress={() => handleConfirmDelivery(selected.id)}
                        disabled={confirmingId === selected.id}
                        style={[
                          s.confirmBtn,
                          { opacity: confirmingId === selected.id ? 0.6 : 1 },
                        ]}
                      >
                        <Feather name="check-circle" size={18} color="#fff" />
                        <Text style={s.confirmBtnText}>
                          {confirmingId === selected.id
                            ? "Confirmando..."
                            : "✅ Confirmar que recibí mi pedido"}
                        </Text>
                      </Pressable>
                    )}

                  {/* Valorar pedido / Pedido valorado */}
                  {selected.status === "delivered" &&
                    (selected as any).hasReview && (
                      <View
                        style={[
                          s.confirmBtn,
                          { backgroundColor: "#FFD70022" },
                        ]}
                      >
                        <Feather name="star" size={18} color="#FFD700" />
                        <Text
                          style={{
                            color: "#B8860B",
                            fontWeight: "700",
                            fontSize: 15,
                          }}
                        >
                          Pedido valorado
                        </Text>
                      </View>
                    )}
                  {selected.status === "delivered" &&
                    !(selected as any).hasReview && (
                      <Pressable
                        onPress={() =>
                          navigation.navigate("Review", {
                            orderId: selected.id,
                            businessId: (selected as any).businessId,
                            businessName: selected.businessName,
                            deliveryPersonId: (selected as any)
                              .deliveryPersonId,
                          })
                        }
                        style={[s.confirmBtn, { backgroundColor: PRIMARY }]}
                      >
                        <Feather name="star" size={18} color="#fff" />
                        <Text style={s.confirmBtnText}>Valorar pedido</Text>
                      </Pressable>
                    )}

                  {/* Pedir de nuevo */}
                  {(selected.status === "delivered" ||
                    selected.status === "cancelled") && (
                    <Pressable
                      onPress={() => reorder(selected)}
                      style={[s.reorderBtn, { borderColor: PRIMARY + "40" }]}
                    >
                      <Feather name="refresh-cw" size={16} color={PRIMARY} />
                      <Text style={[s.reorderBtnText, { color: PRIMARY }]}>
                        Pedir de nuevo
                      </Text>
                    </Pressable>
                  )}

                  <Text style={[s.detailSectionTitle, { color: text }]}>
                    Productos
                  </Text>
                  {items.map((item: any, i: number) => (
                    <View
                      key={i}
                      style={[s.detailItem, { borderBottomColor: border }]}
                    >
                      <Text style={[s.detailItemQty, { color: PRIMARY }]}>
                        {item.quantity}x
                      </Text>
                      <Text
                        style={[s.detailItemName, { color: text, flex: 1 }]}
                      >
                        {item.name}
                      </Text>
                      <Text style={[s.detailItemPrice, { color: text }]}>
                        €
                        {(((item.price || 0) * item.quantity) / 100).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <View style={[s.detailTotals, { borderTopColor: border }]}>
                    <View style={s.detailRow}>
                      <Text style={[s.detailRowLabel, { color: sub }]}>
                        Subtotal
                      </Text>
                      <Text style={[s.detailRowValue, { color: text }]}>
                        {((selected.subtotal || 0) / 100).toFixed(2)} €
                      </Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={[s.detailRowLabel, { color: sub }]}>
                        Envío
                      </Text>
                      <Text style={[s.detailRowValue, { color: text }]}>
                        {((selected.deliveryFee || 0) / 100).toFixed(2)} €
                      </Text>
                    </View>
                    <View style={[s.detailRow, s.detailTotalRow]}>
                      <Text style={[s.detailTotalLabel, { color: text }]}>
                        Total
                      </Text>
                      <Text style={[s.detailTotalValue, { color: PRIMARY }]}>
                        {((selected.total || 0) / 100).toFixed(2)} €
                      </Text>
                    </View>
                  </View>

                  <Text style={[s.detailSectionTitle, { color: text }]}>
                    Entrega
                  </Text>
                  <Text style={[s.detailAddress, { color: sub }]}>
                    {selected.deliveryAddress}
                  </Text>
                  <Text style={[s.detailDate, { color: sub }]}>
                    {new Date(selected.createdAt).toLocaleString("es-ES")}
                  </Text>
                </ScrollView>
              );
            })()
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  navTitle: { fontSize: 18, fontWeight: "800" },
  body: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  list: { borderRightWidth: 1, minWidth: 280 },
  mobileBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
  },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: ComeYaColors.primary },
  tabText: { fontSize: 14, fontWeight: "600" },
  loadingBox: { paddingVertical: 40, alignItems: "center" },
  emptyBox: { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, textAlign: "center" },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderWidth: 0,
    borderLeftWidth: 3,
  },
  orderStatus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  orderInfo: { flex: 1, gap: 3 },
  orderBiz: { fontSize: 14, fontWeight: "700" },
  orderMeta: { fontSize: 12 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  orderTotal: { fontSize: 15, fontWeight: "800" },
  detail: { flex: 1 },
  detailEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  detailEmptyText: { fontSize: 15, textAlign: "center" },
  detailContent: { padding: 28 },
  detailHeader: { marginBottom: 20 },
  detailTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  detailId: { fontSize: 13 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusCardTitle: { fontSize: 16, fontWeight: "700" },
  statusCardSub: { fontSize: 13, marginTop: 2 },
  trackBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  trackBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  detailItemQty: { fontSize: 13, fontWeight: "700", width: 28 },
  detailItemName: { fontSize: 14 },
  detailItemPrice: { fontSize: 14, fontWeight: "600" },
  detailTotals: { borderTopWidth: 1, paddingTop: 14, marginTop: 8, gap: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailRowLabel: { fontSize: 14 },
  detailRowValue: { fontSize: 14, fontWeight: "600" },
  detailTotalRow: { marginTop: 4 },
  detailTotalLabel: { fontSize: 17, fontWeight: "800" },
  detailTotalValue: { fontSize: 20, fontWeight: "900" },
  detailAddress: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  detailDate: { fontSize: 12 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  reorderBtnText: { fontSize: 14, fontWeight: "600" },
});
