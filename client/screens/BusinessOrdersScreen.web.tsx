import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { BusinessSidebar } from "@/components/BusinessSidebar";

type Filter = "pending" | "active" | "all";

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6", accepted: "#3B82F6",
  preparing: "#8B5CF6", ready: "#10B981", on_the_way: "#22C55E",
  delivered: "#6B7280", cancelled: "#EF4444",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmado", accepted: "Aceptado",
  preparing: "Preparando", ready: "Listo ✓", on_the_way: "En camino",
  delivered: "Entregado", cancelled: "Cancelado",
};

const PAYMENT_LABEL: Record<string, string> = {
  bizum: "📱 Bizum", transferencia: "🏦 Transferencia", paypal: "💳 PayPal",
  card: "💳 Tarjeta", cash: "💵 Efectivo",
};

export default function BusinessOrdersScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedTime, setSelectedTime] = useState(20);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const prevPendingCount = useRef(0);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const loadOrders = async () => {
    try {
      const res = await apiRequest("GET", "/api/business/orders");
      const data = await res.json();
      if (data.success) {
        const newOrders = data.orders;
        const pendingCount = newOrders.filter((o: any) => o.status === "pending").length;
        if (pendingCount > prevPendingCount.current && prevPendingCount.current > 0) {
          // Notificación sonora en web
          try { new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3").play(); } catch {}
        }
        prevPendingCount.current = pendingCount;
        setOrders(newOrders);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    setActionLoading(orderId + status);
    try {
      await apiRequest("PUT", `/api/business/orders/${orderId}/status`, { status });
      await loadOrders();
    } catch { alert("No se pudo actualizar el pedido"); }
    finally { setActionLoading(null); }
  };

  const handleAcceptPickup = async () => {
    if (!selectedOrder) return;
    setActionLoading(selectedOrder.id + "accept");
    try {
      await apiRequest("PATCH", `/api/orders/${selectedOrder.id}/status`, { status: "accepted" });
      await apiRequest("POST", `/api/pickup/${selectedOrder.id}/update-time`, { estimatedMinutes: selectedTime });
      setShowTimeModal(false);
      setSelectedOrder(null);
      await loadOrders();
    } catch { alert("No se pudo aceptar el pedido"); }
    finally { setActionLoading(null); }
  };

  const filteredOrders = orders.filter(o => {
    if (filter === "pending") return o.status === "pending";
    if (filter === "active") return ["accepted", "preparing", "ready", "on_the_way"].includes(o.status);
    return true;
  });

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const activeCount = orders.filter(o => ["accepted", "preparing", "ready", "on_the_way"].includes(o.status)).length;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <BusinessSidebar />

      {/* Main */}
      <View style={s.main}>
        {/* Toolbar */}
        <View style={[s.toolbar, { backgroundColor: card, borderBottomColor: border }]}>
          <View style={s.toolbarLeft}>
            <Text style={[s.toolbarTitle, { color: text }]}>Pedidos</Text>
            <View style={[s.statChip, { backgroundColor: "#F59E0B" + "20" }]}>
              <Text style={[s.statChipValue, { color: "#F59E0B" }]}>{pendingCount}</Text>
              <Text style={[s.statChipLabel, { color: "#F59E0B" }]}>Pendientes</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: ComeYaColors.primary + "15" }]}>
              <Text style={[s.statChipValue, { color: ComeYaColors.primary }]}>{activeCount}</Text>
              <Text style={[s.statChipLabel, { color: ComeYaColors.primary }]}>Activos</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: border }]}>
              <Text style={[s.statChipValue, { color: text }]}>{orders.length}</Text>
              <Text style={[s.statChipLabel, { color: sub }]}>Total</Text>
            </View>
          </View>
          <View style={s.toolbarRight}>
            {([
              { id: "pending", label: "Pendientes", color: "#F59E0B" },
              { id: "active", label: "Activos", color: ComeYaColors.primary },
              { id: "all", label: "Todos", color: sub },
            ] as { id: Filter; label: string; color: string }[]).map(f => (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[s.filterBtn, { backgroundColor: filter === f.id ? f.color + "15" : "transparent", borderColor: filter === f.id ? f.color : border }]}
              >
                <View style={[s.filterDot, { backgroundColor: f.color }]} />
                <Text style={[s.filterBtnText, { color: filter === f.id ? f.color : text }]}>{f.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={loadOrders} style={[s.refreshBtn, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="refresh-cw" size={15} color={text} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : filteredOrders.length === 0 ? (
          <View style={s.empty}>
            <Feather name="inbox" size={48} color={sub} />
            <Text style={[s.emptyText, { color: sub }]}>No hay pedidos {filter === "pending" ? "pendientes" : filter === "active" ? "activos" : ""}</Text>
          </View>
        ) : (
          filteredOrders.map(order => {
            const items = typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []);
            const statusColor = STATUS_COLOR[order.status] || "#999";
            return (
              <View key={order.id} style={[s.orderCard, { backgroundColor: card, borderColor: order.status === "pending" ? "#F59E0B" : border, borderWidth: order.status === "pending" ? 2 : 1 }]}>
                {/* Header */}
                <View style={s.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.orderId, { color: text }]}>Pedido #{order.id?.slice(-6)}</Text>
                    <Text style={[s.orderTime, { color: sub }]}>
                      {new Date(order.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {new Date(order.createdAt).toLocaleDateString("es-ES")}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[order.status] || order.status}</Text>
                  </View>
                </View>

                {/* Cliente */}
                {order.customer && (
                  <View style={s.infoRow}>
                    <Feather name="user" size={14} color={sub} />
                    <Text style={[s.infoText, { color: sub }]}>{order.customer.name} · {order.customer.phone}</Text>
                  </View>
                )}
                {order.address && (
                  <View style={s.infoRow}>
                    <Feather name="map-pin" size={14} color={sub} />
                    <Text style={[s.infoText, { color: sub }]} numberOfLines={1}>{order.address.street}, {order.address.city}</Text>
                  </View>
                )}

                {/* Items */}
                <View style={[s.itemsList, { borderTopColor: border, borderBottomColor: border }]}>
                  {Array.isArray(items) && items.map((item: any, i: number) => (
                    <View key={i} style={s.itemRow}>
                      <Text style={[s.itemName, { color: text }]}>{item.quantity}x {item.name || item.product?.name || "Producto"}</Text>
                      <Text style={[s.itemPrice, { color: sub }]}>€{((item.price || item.product?.price || 0) / 100).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Footer */}
                <View style={s.orderFooter}>
                  <View>
                    <Text style={[s.orderTotal, { color: ComeYaColors.primary }]}>€{((order.subtotal || 0) / 100).toFixed(2)}</Text>
                    <Text style={[s.paymentMethod, { color: sub }]}>{PAYMENT_LABEL[order.paymentMethod] || "💳 " + (order.paymentMethod || "Pago")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.earningsText, { color: ComeYaColors.success }]}>Recibes: €{((order.subtotal || 0) / 100).toFixed(2)}</Text>
                    <Text style={[s.earningsStatus, { color: sub }]}>{order.status === "delivered" ? "✅ Liquidado" : "⏳ Pendiente"}</Text>
                  </View>
                </View>

                {/* Acciones */}
                <View style={s.actions}>
                  {order.status === "pending" && (
                    <>
                      <Pressable
                        onPress={() => updateStatus(order.id, "cancelled")}
                        disabled={!!actionLoading}
                        style={[s.actionBtn, { backgroundColor: ComeYaColors.error + "15", borderColor: ComeYaColors.error + "40" }]}
                      >
                        <Feather name="x" size={16} color={ComeYaColors.error} />
                        <Text style={[s.actionBtnText, { color: ComeYaColors.error }]}>Rechazar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (order.orderType === "pickup") {
                            setSelectedOrder(order);
                            setShowTimeModal(true);
                          } else {
                            updateStatus(order.id, "accepted");
                          }
                        }}
                        disabled={!!actionLoading}
                        style={[s.actionBtn, { backgroundColor: ComeYaColors.primary, flex: 1.5 }]}
                      >
                        {actionLoading === order.id + "accepted" ? <ActivityIndicator color="#fff" size="small" /> : (
                          <>
                            <Feather name="check" size={16} color="#fff" />
                            <Text style={[s.actionBtnText, { color: "#fff" }]}>Aceptar</Text>
                          </>
                        )}
                      </Pressable>
                    </>
                  )}
                  {order.status === "accepted" && (
                    <Pressable onPress={() => updateStatus(order.id, "preparing")} disabled={!!actionLoading} style={[s.actionBtn, { backgroundColor: "#8B5CF6", flex: 1 }]}>
                      <Feather name="clock" size={16} color="#fff" />
                      <Text style={[s.actionBtnText, { color: "#fff" }]}>Iniciar preparación</Text>
                    </Pressable>
                  )}
                  {order.status === "preparing" && (
                    <Pressable onPress={() => updateStatus(order.id, "ready")} disabled={!!actionLoading} style={[s.actionBtn, { backgroundColor: ComeYaColors.success, flex: 1 }]}>
                      <Feather name="check-circle" size={16} color="#fff" />
                      <Text style={[s.actionBtnText, { color: "#fff" }]}>Listo para recoger</Text>
                    </Pressable>
                  )}
                  {order.status === "ready" && order.orderType === "pickup" && (
                    <Pressable
                      onPress={async () => {
                        try { await apiRequest("POST", `/api/orders/${order.id}/mark-picked-up`); await loadOrders(); }
                        catch { alert("No se pudo marcar como recogido"); }
                      }}
                      style={[s.actionBtn, { backgroundColor: ComeYaColors.primary, flex: 1 }]}
                    >
                      <Feather name="shopping-bag" size={16} color="#fff" />
                      <Text style={[s.actionBtnText, { color: "#fff" }]}>Cliente recogió</Text>
                    </Pressable>
                  )}
                  {order.status === "on_the_way" && (
                    <View style={[s.actionBtn, { backgroundColor: ComeYaColors.success + "20", flex: 1 }]}>
                      <Feather name="truck" size={16} color={ComeYaColors.success} />
                      <Text style={[s.actionBtnText, { color: ComeYaColors.success }]}>En camino al cliente</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
        </ScrollView>
      </View>

      {/* Modal tiempo estimado (pickup) */}
      {showTimeModal && (
        <View style={s.modalOverlay}>
          <View style={[s.modal, { backgroundColor: card, borderColor: border }]}>
            <Text style={[s.modalTitle, { color: text }]}>¿Cuánto tiempo tomará?</Text>
            <View style={s.timeGrid}>
              {[10, 15, 20, 25, 30, 40].map(t => (
                <Pressable key={t} onPress={() => setSelectedTime(t)} style={[s.timeOption, { backgroundColor: selectedTime === t ? ComeYaColors.primary : theme.backgroundSecondary, borderColor: selectedTime === t ? ComeYaColors.primary : border }]}>
                  <Text style={[s.timeOptionText, { color: selectedTime === t ? "#fff" : text }]}>{t} min</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.modalBtns}>
              <Pressable onPress={() => { setShowTimeModal(false); setSelectedOrder(null); }} style={[s.modalBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={{ color: text }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleAcceptPickup} disabled={!!actionLoading} style={[s.modalBtn, { backgroundColor: ComeYaColors.primary }]}>
                {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar y notificar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  main: { flex: 1, flexDirection: "column" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1 },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolbarTitle: { fontSize: 20, fontWeight: "800", marginRight: 4 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statChipValue: { fontSize: 15, fontWeight: "800" },
  statChipLabel: { fontSize: 11 },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5 },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  filterBtnText: { fontSize: 13, fontWeight: "600" },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: "transparent" },
  scrollArea: { flex: 1 },
  content: { padding: 24, maxWidth: 900 },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  orderCard: { borderRadius: 16, padding: 20, marginBottom: 14 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orderId: { fontSize: 16, fontWeight: "700" },
  orderTime: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, flex: 1 },
  itemsList: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10, marginVertical: 10 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  itemName: { fontSize: 14 },
  itemPrice: { fontSize: 13 },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  orderTotal: { fontSize: 20, fontWeight: "900" },
  paymentMethod: { fontSize: 12, marginTop: 2 },
  earningsText: { fontSize: 13, fontWeight: "700" },
  earningsStatus: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  modalOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" } as any,
  modal: { width: 440, padding: 28, borderRadius: 20, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  timeOption: { width: "30%", paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: "center" },
  timeOptionText: { fontSize: 15, fontWeight: "700" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
});
