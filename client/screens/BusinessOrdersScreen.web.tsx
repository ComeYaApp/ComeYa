import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { BusinessSidebar } from "@/components/BusinessSidebar";
import { useToast } from "@/contexts/ToastContext";
import { displayOrderNumber } from "@/utils/orderNumber";

type Filter = "pending" | "active" | "all";

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  accepted: "#3B82F6",
  preparing: "#8B5CF6",
  ready: "#10B981",
  picked_up: "#0EA5E9",
  on_the_way: "#22C55E",
  in_transit: "#22C55E",
  arriving: "#EC4899",
  delivered: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  accepted: "Aceptado",
  preparing: "Preparando",
  ready: "Listo ✓",
  picked_up: "Recogido",
  on_the_way: "En camino",
  in_transit: "En tránsito",
  arriving: "Llegando al cliente",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// Estados que cuentan como "en reparto" para filtros y etiquetas
const IN_DELIVERY = ["picked_up", "on_the_way", "in_transit", "arriving"];

const PAYMENT_LABEL: Record<string, string> = {
  bizum: "📱 Bizum",
  transferencia: "🏦 Transferencia",
  paypal: "💳 PayPal",
  card: "💳 Tarjeta",
  cash: "💵 Efectivo",
};

// Estado de pago (todo digital): los pedidos "pending" se ven SIEMPRE, pero
// solo se aceptan pagados — los demás se activan solos al confirmarse el pago
const PAYMENT_STATE_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  paid: { label: "Pago completado", color: "#10B981", icon: "check-circle" },
  proof_pending: {
    label: "Verificando pago",
    color: "#F59E0B",
    icon: "clock",
  },
  awaiting_payment: {
    label: "Esperando pago",
    color: "#EF4444",
    icon: "alert-circle",
  },
  failed: { label: "Pago fallido", color: "#EF4444", icon: "x-circle" },
};

function paymentBlockedToast(state: string | undefined): string | null {
  if (state === "proof_pending") {
    return "El pago está en verificación por administración. El pedido se activará automáticamente al aprobarse el comprobante.";
  }
  if (state === "awaiting_payment") {
    return "El cliente aún no ha completado el pago. El pedido se activará automáticamente al confirmarse.";
  }
  return null;
}

export default function BusinessOrdersScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  // El selector de negocios de la barra lateral debe filtrar esta lista:
  // sin businessId el servidor devuelve otro negocio del mismo dueño
  const { selectedBusiness } = useBusiness();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedTime, setSelectedTime] = useState(20);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pickupCodeOrder, setPickupCodeOrder] = useState<any>(null);
  const [pickupCodeInput, setPickupCodeInput] = useState("");
  const [pickupCodeLoading, setPickupCodeLoading] = useState(false);
  const prevPendingCount = useRef(0);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const loadOrders = async () => {
    try {
      const url = selectedBusiness
        ? `/api/business/orders?businessId=${selectedBusiness.id}`
        : "/api/business/orders";
      const res = await apiRequest("GET", url);
      const data = await res.json();
      if (data.success) {
        const newOrders = data.orders;
        const pendingCount = newOrders.filter(
          (o: any) => o.status === "pending",
        ).length;
        if (
          pendingCount > prevPendingCount.current &&
          prevPendingCount.current > 0
        ) {
          // Notificación sonora en web
          try {
            new Audio(
              "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
            ).play();
          } catch {}
        }
        prevPendingCount.current = pendingCount;
        setOrders(newOrders);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [selectedBusiness?.id]);

  const updateStatus = async (
    orderId: string,
    status: string,
    extra?: { estimatedPrepMinutes?: number; estimatedPrepRange?: string },
  ) => {
    setActionLoading(orderId + status);
    try {
      await apiRequest("PUT", `/api/business/orders/${orderId}/status`, {
        status,
        ...(extra || {}),
      });
      await loadOrders();
    } catch (err: any) {
      // El servidor explica el motivo (p. ej. pago sin confirmar)
      showToast(err?.message || "No se pudo actualizar el pedido", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const applySubstitution = async (
    orderId: string,
    itemProductId: string,
    substituteProductId: string,
  ) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/business/orders/${orderId}/substitutions`,
        { itemProductId, substituteProductId },
      );
      const data = await res.json();
      if (data.applied) {
        showToast(
          data.refunded
            ? `Sustitución aplicada — devolución de ${(data.refunded / 100).toFixed(2)} € al cliente`
            : "Sustitución aplicada (mismo precio)",
          "success",
        );
      } else if (data.proposed) {
        showToast(
          "Propuesta enviada al cliente (debe aprobar la diferencia)",
          "info",
        );
      }
      await loadOrders();
    } catch (err: any) {
      showToast(err?.message || "No se pudo aplicar la sustitución", "error");
    }
  };

  const confirmPickupWithCode = async () => {
    if (!pickupCodeOrder) return;
    const code = pickupCodeInput.trim();
    if (code.length !== 6) {
      showToast("El código debe tener 6 dígitos", "warning");
      return;
    }
    setPickupCodeLoading(true);
    try {
      const validateRes = await apiRequest(
        "POST",
        `/api/pickup/${pickupCodeOrder.id}/validate-code`,
        { code },
      );
      const validateData = await validateRes.json();
      if (!validateData.valid) {
        showToast("El código no coincide con este pedido", "error");
        return;
      }
      await apiRequest(
        "POST",
        `/api/orders/${pickupCodeOrder.id}/mark-picked-up`,
        { code },
      );
      await loadOrders();
      showToast("Pedido marcado como recogido", "success");
      setPickupCodeOrder(null);
      setPickupCodeInput("");
    } catch {
      showToast("No se pudo marcar como recogido", "error");
    } finally {
      setPickupCodeLoading(false);
    }
  };

  const handleStartPreparing = (
    orderId: string,
    isPickup = false,
  ) => {
    // Recogida en local: no hay repartidores que avisar
    if (isPickup) {
      updateStatus(orderId, "preparing");
      return;
    }
    // Selector simple de tiempo estimado (aviso anticipado a repartidores)
    if (typeof window !== "undefined" && (window as any).confirm) {
      const choice = (window as any).prompt(
        "Tiempo estimado de preparación:\n1) 5-10 min\n2) 10-20 min\n3) PEDIDO LISTO",
        "1",
      );
      if (choice === "1") {
        updateStatus(orderId, "preparing", {
          estimatedPrepMinutes: 8,
          estimatedPrepRange: "5-10 min",
        });
      } else if (choice === "2") {
        updateStatus(orderId, "preparing", {
          estimatedPrepMinutes: 15,
          estimatedPrepRange: "10-20 min",
        });
      } else if (choice === "3") {
        updateStatus(orderId, "ready");
      }
    } else {
      updateStatus(orderId, "preparing");
    }
  };

  const handleAcceptPickup = async () => {
    if (!selectedOrder) return;
    setActionLoading(selectedOrder.id + "accept");
    try {
      // Mismo endpoint que el resto de acciones: aplica la guardia de pago
      await apiRequest(
        "PUT",
        `/api/business/orders/${selectedOrder.id}/status`,
        {
          status: "accepted",
        },
      );
      await apiRequest("POST", `/api/pickup/${selectedOrder.id}/update-time`, {
        estimatedMinutes: selectedTime,
      });
      setShowTimeModal(false);
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: any) {
      showToast(err?.message || "No se pudo aceptar el pedido", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Estados activos del negocio (incluye el tramo final del reparto que el
  // pipeline marca como in_transit/arriving — antes quedaban fuera del filtro)
  const ACTIVE_FOR_BUSINESS = [
    "accepted",
    "preparing",
    "ready",
    ...IN_DELIVERY,
  ];

  const filteredOrders = orders.filter((o) => {
    if (filter === "pending") return o.status === "pending";
    if (filter === "active") return ACTIVE_FOR_BUSINESS.includes(o.status);
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const activeCount = orders.filter((o) =>
    ACTIVE_FOR_BUSINESS.includes(o.status),
  ).length;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <BusinessSidebar />

      {/* Main */}
      <View style={s.main}>
        {/* Toolbar */}
        <View
          style={[
            s.toolbar,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          <View style={s.toolbarLeft}>
            <Text style={[s.toolbarTitle, { color: text }]}>Pedidos</Text>
            <View style={[s.statChip, { backgroundColor: "#F59E0B" + "20" }]}>
              <Text style={[s.statChipValue, { color: "#F59E0B" }]}>
                {pendingCount}
              </Text>
              <Text style={[s.statChipLabel, { color: "#F59E0B" }]}>
                Pendientes
              </Text>
            </View>
            <View
              style={[
                s.statChip,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Text style={[s.statChipValue, { color: ComeYaColors.primary }]}>
                {activeCount}
              </Text>
              <Text style={[s.statChipLabel, { color: ComeYaColors.primary }]}>
                Activos
              </Text>
            </View>
            <View style={[s.statChip, { backgroundColor: border }]}>
              <Text style={[s.statChipValue, { color: text }]}>
                {orders.length}
              </Text>
              <Text style={[s.statChipLabel, { color: sub }]}>Total</Text>
            </View>
          </View>
          <View style={s.toolbarRight}>
            {(
              [
                { id: "pending", label: "Pendientes", color: "#F59E0B" },
                { id: "active", label: "Activos", color: ComeYaColors.primary },
                { id: "all", label: "Todos", color: sub },
              ] as { id: Filter; label: string; color: string }[]
            ).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  s.filterBtn,
                  {
                    backgroundColor:
                      filter === f.id ? f.color + "15" : "transparent",
                    borderColor: filter === f.id ? f.color : border,
                  },
                ]}
              >
                <View style={[s.filterDot, { backgroundColor: f.color }]} />
                <Text
                  style={[
                    s.filterBtnText,
                    { color: filter === f.id ? f.color : text },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={loadOrders}
              style={[
                s.refreshBtn,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="refresh-cw" size={15} color={text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={s.scrollArea}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={s.loading}>
              <ActivityIndicator color={ComeYaColors.primary} size="large" />
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={s.empty}>
              <Feather name="inbox" size={48} color={sub} />
              <Text style={[s.emptyText, { color: sub }]}>
                No hay pedidos{" "}
                {filter === "pending"
                  ? "pendientes"
                  : filter === "active"
                    ? "activos"
                    : ""}
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const items =
                typeof order.items === "string"
                  ? JSON.parse(order.items)
                  : order.items || [];
              const statusColor = STATUS_COLOR[order.status] || "#999";
              return (
                <View
                  key={order.id}
                  style={[
                    s.orderCard,
                    {
                      backgroundColor: card,
                      borderColor:
                        order.status === "pending" ? "#F59E0B" : border,
                      borderWidth: order.status === "pending" ? 2 : 1,
                    },
                  ]}
                >
                  {/* Header */}
                  <View style={s.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.orderId, { color: text }]}>
                        Pedido {displayOrderNumber(order)}
                      </Text>
                      <Text style={[s.orderTime, { color: sub }]}>
                        {new Date(order.createdAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("es-ES")}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.statusBadge,
                        { backgroundColor: statusColor + "20" },
                      ]}
                    >
                      <View
                        style={[s.statusDot, { backgroundColor: statusColor }]}
                      />
                      <Text style={[s.statusText, { color: statusColor }]}>
                        {STATUS_LABEL[order.status] || order.status}
                      </Text>
                    </View>
                  </View>

                  {/* Estado de pago: siempre visible para saber por qué un
                      pendiente no se puede aceptar todavía */}
                  {order.paymentState &&
                    (order.status === "pending" ||
                      order.paymentState === "failed") &&
                    (() => {
                      const ps =
                        PAYMENT_STATE_CONFIG[order.paymentState] ||
                        PAYMENT_STATE_CONFIG.awaiting_payment;
                      return (
                        <View
                          style={[
                            s.paymentStateRow,
                            { backgroundColor: ps.color + "15" },
                          ]}
                        >
                          <Feather
                            name={ps.icon as any}
                            size={13}
                            color={ps.color}
                          />
                          <Text
                            style={[s.paymentStateText, { color: ps.color }]}
                          >
                            {ps.label}
                          </Text>
                        </View>
                      );
                    })()}

                  {/* Cliente */}
                  {order.customer && (
                    <View style={s.infoRow}>
                      <Feather name="user" size={14} color={sub} />
                      <Text style={[s.infoText, { color: sub }]}>
                        {order.customer.name} · {order.customer.phone}
                      </Text>
                    </View>
                  )}
                  {order.address && (
                    <View style={s.infoRow}>
                      <Feather name="map-pin" size={14} color={sub} />
                      <Text
                        style={[s.infoText, { color: sub }]}
                        numberOfLines={1}
                      >
                        {order.address.street}, {order.address.city}
                      </Text>
                    </View>
                  )}

                  {/* Items */}
                  <View
                    style={[
                      s.itemsList,
                      { borderTopColor: border, borderBottomColor: border },
                    ]}
                  >
                    {Array.isArray(items) &&
                      items.map((item: any, i: number) => (
                        <View key={i} style={s.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.itemName, { color: text }]}>
                              {item.quantity}x{" "}
                              {item.name || item.product?.name || "Producto"}
                            </Text>
                            {/* Nota del cliente por producto (sin gluten…) */}
                            {item.note ? (
                              <Text
                                style={[
                                  s.itemNote,
                                  { color: ComeYaColors.warning },
                                ]}
                              >
                                ✏️ Nota: {item.note}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[s.itemPrice, { color: sub }]}>
                            €
                            {(
                              (item.price || item.product?.price || 0) / 100
                            ).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                  </View>

                  {/* Sustitución: preferencia y producto sustituto con nombre */}
                  {(order.substitutionPreference ||
                    order.substituteProductIds ||
                    order.itemSubstitutionPreferences) && (
                    <View
                      style={{
                        marginTop: 8,
                        padding: 10,
                        backgroundColor: "#F59E0B15",
                        borderLeftWidth: 3,
                        borderLeftColor: "#F59E0B",
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#B45309",
                        }}
                      >
                        ⚠️ Si algo no está disponible:
                      </Text>
                      {order.substitutionPreference && (
                        <Text style={[s.itemNote, { color: "#92400E" }]}>
                          • Preferencia general:{" "}
                          {order.substitutionPreference === "refund"
                            ? "💵 Reembolsar"
                            : order.substitutionPreference === "call"
                              ? "📞 Llamar al cliente"
                              : "🔄 Sustituir por producto similar"}
                        </Text>
                      )}
                      {order.substituteProductIds &&
                        (() => {
                          try {
                            const map =
                              typeof order.substituteProductIds === "string"
                                ? JSON.parse(order.substituteProductIds)
                                : order.substituteProductIds;
                            const names = order.substituteProductNames || {};
                            const details = order.substituteProducts || {};
                            const subs = Array.isArray(order.substitutions)
                              ? order.substitutions
                              : [];
                            let parsedItems: any[] = [];
                            try {
                              parsedItems = Array.isArray(order.items)
                                ? order.items
                                : JSON.parse(order.items || "[]");
                            } catch {}
                            const closedOrder = [
                              "delivered",
                              "cancelled",
                              "payment_failed",
                            ].includes(order.status);
                            return Object.entries(map).map(
                              ([origId, subId]: [string, any]) => {
                                const sid = String(subId);
                                const det = details[sid] || {};
                                const name =
                                  det.name || names[sid] || `Producto ${sid.slice(-6)}`;
                                const subPrice = det.price ?? null;
                                const origItem = parsedItems.find(
                                  (it: any) => it.product?.id === origId,
                                );
                                const origPriceCents = origItem
                                  ? Math.round(
                                      Number(origItem.product?.price ?? 0) * 100,
                                    )
                                  : null;
                                const delta =
                                  subPrice != null && origPriceCents != null
                                    ? subPrice - origPriceCents
                                    : null;
                                const state = subs.find(
                                  (x: any) => x.itemProductId === origId,
                                );
                                const applied =
                                  state?.status === "applied" ||
                                  state?.status === "approved";
                                const pendingState = state?.status === "proposed";
                                return (
                                  <View
                                    key={origId}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      marginTop: 6,
                                      padding: 6,
                                      backgroundColor: "rgba(128,128,128,0.08)",
                                      borderRadius: 8,
                                    }}
                                  >
                                    {det.image ? (
                                      <img
                                        src={det.image}
                                        alt={name}
                                        style={{
                                          width: 44,
                                          height: 44,
                                          borderRadius: 6,
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : (
                                      <View
                                        style={{
                                          width: 44,
                                          height: 44,
                                          borderRadius: 6,
                                          backgroundColor: "rgba(128,128,128,0.2)",
                                        }}
                                      />
                                    )}
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                      <Text style={[s.itemNote, { color: "#92400E" }]}>
                                        Sustituir por: <b>{name}</b>
                                      </Text>
                                      {delta != null && (
                                        <Text
                                          style={{
                                            fontSize: 12,
                                            fontWeight: "700",
                                            color:
                                              delta < 0
                                                ? "#10B981"
                                                : delta > 0
                                                  ? "#EF4444"
                                                  : "#92400E",
                                          }}
                                        >
                                          {delta < 0
                                            ? `−${(Math.abs(delta) / 100).toFixed(2)} € a devolver`
                                            : delta > 0
                                              ? `+${(delta / 100).toFixed(2)} € a cobrar`
                                              : "mismo precio"}
                                          {applied ? " · ✅ Aplicada" : ""}
                                          {pendingState
                                            ? " · ⏳ Esperando aprobación"
                                            : ""}
                                          {state?.status === "rejected"
                                            ? " · ❌ Rechazada"
                                            : ""}
                                        </Text>
                                      )}
                                    </View>
                                    {!applied && !pendingState && !closedOrder && (
                                      <Pressable
                                        onPress={() =>
                                          applySubstitution(order.id, origId, sid)
                                        }
                                        style={[
                                          {
                                            backgroundColor: ComeYaColors.primary,
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderRadius: 6,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={{
                                            color: "#fff",
                                            fontSize: 12,
                                            fontWeight: "700",
                                          }}
                                        >
                                          Aplicar
                                        </Text>
                                      </Pressable>
                                    )}
                                  </View>
                                );
                              },
                            );
                          } catch {
                            return null;
                          }
                        })()}
                    </View>
                  )}

                  {/* Footer */}
                  <View style={s.orderFooter}>
                    <View>
                      <Text
                        style={[s.orderTotal, { color: ComeYaColors.primary }]}
                      >
                        {((order.subtotal || 0) / 100).toFixed(2)} €
                      </Text>
                      <Text style={[s.paymentMethod, { color: sub }]}>
                        {PAYMENT_LABEL[order.paymentMethod] ||
                          "💳 " + (order.paymentMethod || "Pago")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          s.earningsText,
                          { color: ComeYaColors.success },
                        ]}
                      >
                        Recibes: {((order.subtotal || 0) / 100).toFixed(2)} €
                      </Text>
                      <Text style={[s.earningsStatus, { color: sub }]}>
                        {order.status === "delivered"
                          ? "✅ Liquidado"
                          : "⏳ Pendiente"}
                      </Text>
                    </View>
                  </View>

                  {/* Acciones */}
                  <View style={s.actions}>
                    {order.status === "pending" && (
                      <>
                        <Pressable
                          onPress={() => updateStatus(order.id, "cancelled")}
                          disabled={!!actionLoading}
                          style={[
                            s.actionBtn,
                            {
                              backgroundColor: ComeYaColors.error + "15",
                              borderColor: ComeYaColors.error + "40",
                            },
                          ]}
                        >
                          <Feather
                            name="x"
                            size={16}
                            color={ComeYaColors.error}
                          />
                          <Text
                            style={[
                              s.actionBtnText,
                              { color: ComeYaColors.error },
                            ]}
                          >
                            Rechazar
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            const blocked = paymentBlockedToast(
                              order.paymentState,
                            );
                            if (blocked) {
                              showToast(blocked, "warning");
                              return;
                            }
                            if (order.orderType === "pickup") {
                              setSelectedOrder(order);
                              setShowTimeModal(true);
                            } else {
                              updateStatus(order.id, "accepted");
                            }
                          }}
                          disabled={
                            !!actionLoading ||
                            (!!order.paymentState &&
                              order.paymentState !== "paid")
                          }
                          style={[
                            s.actionBtn,
                            {
                              backgroundColor: ComeYaColors.primary,
                              flex: 1.5,
                              opacity:
                                order.paymentState && order.paymentState !== "paid"
                                  ? 0.55
                                  : 1,
                            },
                          ]}
                        >
                          {actionLoading === order.id + "accepted" ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <Feather name="check" size={16} color="#fff" />
                              <Text
                                style={[s.actionBtnText, { color: "#fff" }]}
                              >
                                {order.paymentState === "proof_pending"
                                  ? "En verificación"
                                  : order.paymentState === "awaiting_payment"
                                    ? "Esperando pago"
                                    : "Aceptar"}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </>
                    )}
                    {order.status === "accepted" && (
                      <Pressable
                        onPress={() =>
                          handleStartPreparing(
                            order.id,
                            order.orderType === "pickup",
                          )
                        }
                        disabled={!!actionLoading}
                        style={[
                          s.actionBtn,
                          { backgroundColor: "#8B5CF6", flex: 1 },
                        ]}
                      >
                        <Feather name="clock" size={16} color="#fff" />
                        <Text style={[s.actionBtnText, { color: "#fff" }]}>
                          Iniciar preparación
                        </Text>
                      </Pressable>
                    )}
                    {order.status === "preparing" && (
                      <Pressable
                        onPress={() => updateStatus(order.id, "ready")}
                        disabled={!!actionLoading}
                        style={[
                          s.actionBtn,
                          { backgroundColor: ComeYaColors.success, flex: 1 },
                        ]}
                      >
                        <Feather name="check-circle" size={16} color="#fff" />
                        <Text style={[s.actionBtnText, { color: "#fff" }]}>
                          Listo para recoger
                        </Text>
                      </Pressable>
                    )}
                    {["ready", "on_the_way", "picked_up"].includes(
                      order.status,
                    ) &&
                      order.orderType === "pickup" && (
                        <Pressable
                          onPress={() => {
                            setPickupCodeOrder(order);
                            setPickupCodeInput("");
                          }}
                          style={[
                            s.actionBtn,
                            { backgroundColor: ComeYaColors.primary, flex: 1 },
                          ]}
                        >
                          <Feather name="shopping-bag" size={16} color="#fff" />
                          <Text style={[s.actionBtnText, { color: "#fff" }]}>
                            Cliente recogió
                          </Text>
                        </Pressable>
                      )}
                    {order.status === "on_the_way" &&
                      order.orderType !== "pickup" && (
                      <View
                        style={[
                          s.actionBtn,
                          {
                            backgroundColor: ComeYaColors.success + "20",
                            flex: 1,
                          },
                        ]}
                      >
                        <Feather
                          name="truck"
                          size={16}
                          color={ComeYaColors.success}
                        />
                        <Text
                          style={[
                            s.actionBtnText,
                            { color: ComeYaColors.success },
                          ]}
                        >
                          En camino al cliente
                        </Text>
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
          <View
            style={[s.modal, { backgroundColor: card, borderColor: border }]}
          >
            <Text style={[s.modalTitle, { color: text }]}>
              ¿Cuánto tiempo tomará?
            </Text>
            <View style={s.timeGrid}>
              {[10, 15, 20, 25, 30, 40].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setSelectedTime(t)}
                  style={[
                    s.timeOption,
                    {
                      backgroundColor:
                        selectedTime === t
                          ? ComeYaColors.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedTime === t ? ComeYaColors.primary : border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.timeOptionText,
                      { color: selectedTime === t ? "#fff" : text },
                    ]}
                  >
                    {t} min
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.modalBtns}>
              <Pressable
                onPress={() => {
                  setShowTimeModal(false);
                  setSelectedOrder(null);
                }}
                style={[
                  s.modalBtn,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Text style={{ color: text }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleAcceptPickup}
                disabled={!!actionLoading}
                style={[s.modalBtn, { backgroundColor: ComeYaColors.primary }]}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Aceptar y notificar
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {/* Modal código de recogida (pickup) */}
      {pickupCodeOrder && (
        <View style={s.modalOverlay}>
          <View
            style={[s.modal, { backgroundColor: card, borderColor: border }]}
          >
            <Text style={[s.modalTitle, { color: text }]}>
              Código de recogida
            </Text>
            <Text style={[s.modalSub, { color: sub }]}>
              Pide al cliente el código de 6 dígitos (o escanea su QR desde la
              app) para confirmar la entrega.
            </Text>
            <TextInput
              value={pickupCodeInput}
              onChangeText={(v) =>
                setPickupCodeInput(v.replace(/[^0-9]/g, "").slice(0, 6))
              }
              placeholder="000000"
              placeholderTextColor={sub}
              maxLength={6}
              style={[
                s.codeInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: text,
                  borderColor:
                    pickupCodeInput.length === 6
                      ? ComeYaColors.success
                      : border,
                },
              ]}
            />
            <View style={s.modalBtns}>
              <Pressable
                onPress={() => setPickupCodeOrder(null)}
                style={[
                  s.modalBtn,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Text style={{ color: text }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={confirmPickupWithCode}
                disabled={pickupCodeLoading || pickupCodeInput.length !== 6}
                style={[
                  s.modalBtn,
                  {
                    backgroundColor: ComeYaColors.primary,
                    opacity:
                      pickupCodeLoading || pickupCodeInput.length !== 6
                        ? 0.6
                        : 1,
                  },
                ]}
              >
                {pickupCodeLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    Confirmar recogida
                  </Text>
                )}
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  toolbarTitle: { fontSize: 20, fontWeight: "800", marginRight: 4 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statChipValue: { fontSize: 15, fontWeight: "800" },
  statChipLabel: { fontSize: 11 },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  filterBtnText: { fontSize: 13, fontWeight: "600" },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: "transparent" },
  scrollArea: { flex: 1 },
  content: { padding: 24, maxWidth: 900 },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  orderCard: { borderRadius: 16, padding: 20, marginBottom: 14 },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: "700" },
  orderTime: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  paymentStateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  paymentStateText: { fontSize: 12, fontWeight: "700" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoText: { fontSize: 13, flex: 1 },
  itemsList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
    marginVertical: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  itemName: { fontSize: 14 },
  itemNote: { fontSize: 12, marginTop: 2, fontWeight: "500" },
  itemPrice: { fontSize: 13 },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  orderTotal: { fontSize: 20, fontWeight: "900" },
  paymentMethod: { fontSize: 12, marginTop: 2 },
  earningsText: { fontSize: 13, fontWeight: "700" },
  earningsStatus: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  } as any,
  modal: { width: 440, padding: 28, borderRadius: 20, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  modalSub: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  codeInput: {
    fontSize: 28,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  timeOption: {
    width: "30%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  timeOptionText: { fontSize: 15, fontWeight: "700" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});
