import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { io, Socket } from "socket.io-client";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { displayOrderNumber } from "@/utils/orderNumber";

export default function BusinessOrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  // Con varios negocios por dueño, la lista debe filtrarse por el negocio
  // seleccionado en el panel; sin filtro el servidor devolvía otro negocio
  const { selectedBusiness } = useBusiness();
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "active">("pending");
  const previousPendingCount = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "default" | "danger";
  }>({ visible: false, title: "", message: "", onConfirm: () => {} });
  const [timeModal, setTimeModal] = useState<{
    visible: boolean;
    orderId: string;
  }>({ visible: false, orderId: "" });
  const [selectedTime, setSelectedTime] = useState(20);
  const [prepModal, setPrepModal] = useState<{
    visible: boolean;
    orderId: string | null;
  }>({ visible: false, orderId: null });

  // WebSocket connection
  useEffect(() => {
    const socket = io(getApiUrl().replace("/api", ""), {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("🔌 WebSocket connected");
      // Join business room
      socket.emit("join", {
        userId: user?.id,
        role: "business_owner",
        businessId: user?.businessId,
      });
    });

    socket.on("new_order", (order: any) => {
      console.log("📦 New order received via WebSocket:", order);
      playNotificationSound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadOrders(); // Refresh orders
    });

    socket.on("payment_verified", ({ orderId }: { orderId: string }) => {
      console.log("💳 Payment verified for order:", orderId);
      loadOrders();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.businessId]);

  /**
   * Aviso sonoro de pedido nuevo. Usa expo-haptics (nativo estable) en vez de
   * expo-av: ese módulo está deprecado con la New Architecture y era uno de
   * los sospechosos de los cierres inesperados en iOS. Además el MP3 venía de
   * una URL externa, así que sin red no sonaba.
   */
  const playNotificationSound = async () => {
    try {
      const Haptics = await import("expo-haptics");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      // Doble vibración para que destaque sobre el ruido del local
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 220);
    } catch (error) {
      console.log("Could not trigger notification feedback", error);
    }
  };

  const loadOrders = async () => {
    try {
      const url = selectedBusiness
        ? `/api/business/orders?businessId=${selectedBusiness.id}`
        : "/api/business/orders";
      const response = await apiRequest("GET", url);
      const data = await response.json();
      if (data.success) {
        const newOrders = data.orders;
        const pendingCount = newOrders.filter(
          (o: any) => o.status === "pending",
        ).length;

        if (
          pendingCount > previousPendingCount.current &&
          previousPendingCount.current > 0
        ) {
          playNotificationSound();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        previousPendingCount.current = pendingCount;
        setOrders(newOrders);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [selectedBusiness?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateOrderStatus = async (
    orderId: string,
    status: string,
    extra?: { estimatedPrepMinutes?: number; estimatedPrepRange?: string },
  ) => {
    try {
      await apiRequest("PUT", `/api/business/orders/${orderId}/status`, {
        status,
        ...(extra || {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      loadOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "No se pudo actualizar el pedido");
    }
  };

  const handleAccept = (orderId: string, isPickup: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (isPickup) {
      // Mostrar modal de tiempo para pickup
      setTimeModal({ visible: true, orderId });
    } else {
      // Aceptar delivery directamente
      setConfirmModal({
        visible: true,
        title: "Aceptar Pedido",
        message: "¿Confirmar este pedido?",
        onConfirm: () => {
          updateOrderStatus(orderId, "accepted");
          setConfirmModal({ ...confirmModal, visible: false });
        },
      });
    }
  };

  const handleReject = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmModal({
      visible: true,
      title: "Rechazar Pedido",
      message: "¿Estás seguro de rechazar este pedido?",
      variant: "danger",
      onConfirm: () => {
        updateOrderStatus(orderId, "cancelled");
        setConfirmModal({ ...confirmModal, visible: false });
      },
    });
  };

  const handleStartPreparing = (orderId: string, isPickup = false) => {
    if (isPickup) {
      // Recogida en local: no hay repartidores que avisar, simplemente pasar
      // a preparando (el cliente ya recibió el tiempo estimado al aceptar)
      updateOrderStatus(orderId, "preparing");
      return;
    }
    // Delivery: preguntar el tiempo estimado para avisar a los repartidores
    // por adelantado
    setPrepModal({ visible: true, orderId });
  };

  const confirmStartPreparing = (orderId: string, range: string, minutes: number) => {
    setPrepModal({ visible: false, orderId: null });
    updateOrderStatus(orderId, "preparing", {
      estimatedPrepMinutes: minutes,
      estimatedPrepRange: range,
    });
  };

  const filteredOrders = orders.filter((order: any) => {
    if (filter === "pending") return order.status === "pending";
    if (filter === "active")
      return [
        "accepted",
        "preparing",
        "ready",
        "picked_up",
        "on_the_way",
        "in_transit",
        "arriving",
      ].includes(order.status);
    return true;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
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
    return labels[status] || status;
  };

  const getPaymentLabel = (method: string) => {
    const map: Record<string, string> = {
      pago_movil: "📱 Pago Móvil",
      pagomovil: "📱 Pago Móvil",
      binance: "🟡 Binance Pay",
      binance_pay: "🟡 Binance Pay",
      zinli: "💜 Zinli",
      zelle: "💵 Zelle",
      cash: "💵 Efectivo",
      efectivo: "💵 Efectivo",
    };
    return map[method?.toLowerCase()] ?? "💳 " + (method ?? "Pago digital");
  };

  const renderOrder = ({ item }: { item: any }) => {
    const items =
      typeof item.items === "string" ? JSON.parse(item.items) : item.items;

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4">Pedido {displayOrderNumber(item)}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {new Date(item.createdAt).toLocaleTimeString("es-VE", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              - {new Date(item.createdAt).toLocaleDateString("es-VE")}
            </ThemedText>
            {item.businessName ? (
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginTop: 2 }}
              >
                {item.businessName}
              </ThemedText>
            ) : null}
          </View>
          <Badge
            text={getStatusLabel(item.status)}
            variant={
              item.status === "pending"
                ? "warning"
                : item.status === "preparing"
                  ? "info"
                  : item.status === "ready"
                    ? "success"
                    : item.status === "cancelled"
                      ? "error"
                      : "primary"
            }
          />
        </View>

        {item.customer ? (
          <View style={styles.customerInfo}>
            <Feather name="user" size={14} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
            >
              {item.customer.name} - {item.customer.phone}
            </ThemedText>
          </View>
        ) : null}

        {item.address ? (
          <View style={styles.customerInfo}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginLeft: Spacing.xs,
                flex: 1,
              }}
            >
              {item.address.street}, {item.address.city}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.itemsList}>
          {Array.isArray(items) &&
            items.map((orderItem: any, index: number) => (
              <View key={index} style={styles.item}>
                <ThemedText type="body">
                  {orderItem.quantity}x{" "}
                  {orderItem.name || orderItem.product?.name || "Producto"}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  €
                  {(
                    (orderItem.price || orderItem.product?.price || 0) / 100
                  ).toFixed(2)}
                </ThemedText>
              </View>
            ))}
        </View>

        {/* Mostrar preferencias de sustitución si existen */}
        {(item.substitutionPreference ||
          item.itemSubstitutionPreferences ||
          item.substituteProductIds) && (
          <View
            style={{
              marginTop: Spacing.md,
              padding: Spacing.md,
              backgroundColor: ComeYaColors.warning + "15",
              borderRadius: BorderRadius.md,
              borderLeftWidth: 3,
              borderLeftColor: ComeYaColors.warning,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
              <Feather name="alert-triangle" size={14} color={ComeYaColors.warning} />
              <ThemedText
                type="small"
                style={{
                  color: ComeYaColors.warning,
                  fontWeight: "600",
                  marginLeft: Spacing.xs,
                }}
              >
                Si algo no está disponible:
              </ThemedText>
            </View>
            {item.substitutionPreference && (
              <ThemedText type="small" style={{ color: theme.text, marginTop: 2 }}>
                • Preferencia general:{" "}
                <ThemedText type="small" style={{ fontWeight: "600" }}>
                  {item.substitutionPreference === "refund"
                    ? "💵 Reembolsar"
                    : item.substitutionPreference === "call"
                      ? "📞 Llamar al cliente"
                      : "🔄 Sustituir por producto similar"}
                </ThemedText>
              </ThemedText>
            )}
            {item.substituteProductIds && (() => {
              try {
                const substituteIds =
                  typeof item.substituteProductIds === "string"
                    ? JSON.parse(item.substituteProductIds)
                    : item.substituteProductIds;
                const entries = Object.entries(substituteIds);
                if (entries.length > 0) {
                  return (
                    <View style={{ marginTop: Spacing.xs }}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.text }}>
                        Productos sustitutos elegidos:
                      </ThemedText>
                      {entries.map(([originalId, substituteId]: [string, unknown]) => (
                        <ThemedText key={originalId} type="caption" style={{ color: theme.textSecondary }}>
                          • Producto ID: {originalId.slice(-6)} → Sustituto ID: {String(substituteId).slice(-6)}
                        </ThemedText>
                      ))}
                    </View>
                  );
                }
              } catch {
                return null;
              }
              return null;
            })()}
            {item.itemSubstitutionPreferences && (() => {
              try {
                const itemPrefs =
                  typeof item.itemSubstitutionPreferences === "string"
                    ? JSON.parse(item.itemSubstitutionPreferences)
                    : item.itemSubstitutionPreferences;
                const prefs = Object.entries(itemPrefs);
                if (prefs.length > 0) {
                  return (
                    <View style={{ marginTop: Spacing.xs }}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.text }}>
                        Preferencias por producto:
                      </ThemedText>
                      {prefs.map(([itemId, pref]: [string, unknown]) => (
                        <ThemedText key={itemId} type="caption" style={{ color: theme.textSecondary }}>
                          • {String(itemId).slice(-6)}:{" "}
                          {String(pref) === "refund"
                            ? "Reembolsar"
                            : String(pref) === "call"
                              ? "Llamar"
                              : "Sustituir"}
                        </ThemedText>
                      ))}
                    </View>
                  );
                }
              } catch {
                return null;
              }
              return null;
            })()}
          </View>
        )}

        <View style={styles.orderFooter}>
          <View>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              {(item.subtotal / 100).toFixed(2)} €
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {getPaymentLabel(item.paymentMethod)}
            </ThemedText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <ThemedText
              type="small"
              style={{ color: ComeYaColors.success, fontWeight: "600" }}
            >
              Recibes: {(item.subtotal / 100).toFixed(2)} €
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {item.status === "delivered" || item.status === "completed"
                ? "✅ Liquidado"
                : ["picked_up", "on_the_way", "in_transit", "arriving"].includes(
                      item.status,
                    )
                  ? "🛵 En reparto"
                  : item.status === "cancelled"
                    ? "— Cancelado"
                    : "⏳ Pendiente"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.actions}>
          {item.status === "pending" && (
            <>
              <Pressable
                onPress={() => {
                  console.log("Reject button pressed", item.id);
                  handleReject(item.id);
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="x" size={18} color={ComeYaColors.error} />
                <ThemedText
                  type="small"
                  style={{ color: ComeYaColors.error, marginLeft: Spacing.xs }}
                >
                  Rechazar
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  console.log("Accept button pressed", item.id);
                  handleAccept(item.id, item.orderType === "pickup");
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: ComeYaColors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="check" size={18} color="#FFF" />
                <ThemedText
                  type="small"
                  style={{ color: "#FFF", marginLeft: Spacing.xs }}
                >
                  Aceptar
                </ThemedText>
              </Pressable>
            </>
          )}

          {["ready", "on_the_way", "picked_up"].includes(item.status) &&
            item.orderType === "pickup" && (
              <Pressable
                onPress={() => navigation.navigate("PickupScanner" as any)}
                style={[
                  styles.actionButton,
                  { backgroundColor: ComeYaColors.success, flex: 1 },
                ]}
              >
                <Feather name="hash" size={18} color="#FFF" />
                <ThemedText
                  type="small"
                  style={{ color: "#FFF", marginLeft: Spacing.xs }}
                >
                  Escanear Código
                </ThemedText>
              </Pressable>
            )}

          {item.status === "accepted" && (
            <Pressable
              onPress={() =>
                handleStartPreparing(item.id, item.orderType === "pickup")
              }
              style={[
                styles.actionButton,
                { backgroundColor: ComeYaColors.primary, flex: 1 },
              ]}
            >
              <Feather name="clock" size={18} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: Spacing.xs }}
              >
                Iniciar Preparación
              </ThemedText>
            </Pressable>
          )}

          {item.status === "preparing" && (
            <Pressable
              onPress={() => updateOrderStatus(item.id, "ready")}
              style={[
                styles.actionButton,
                { backgroundColor: ComeYaColors.success, flex: 1 },
              ]}
            >
              <Feather name="check-circle" size={18} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: Spacing.xs }}
              >
                Listo para Recoger
              </ThemedText>
            </Pressable>
          )}

          {item.status === "on_the_way" && item.orderType !== "pickup" && (
            <View
              style={[
                styles.actionButton,
                { backgroundColor: ComeYaColors.success + "20", flex: 1 },
              ]}
            >
              <Feather name="truck" size={18} color={ComeYaColors.success} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.success, marginLeft: Spacing.xs }}
              >
                En Camino al Cliente
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
        variant={confirmModal.variant}
      />

      {/* Modal de Tiempo Estimado */}
      <Modal visible={timeModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
              ¿Cuánto tiempo tomará?
            </ThemedText>

            <View style={styles.timeGrid}>
              {[10, 15, 20, 25, 30, 40].map((time) => (
                <Pressable
                  key={time}
                  onPress={() => setSelectedTime(time)}
                  style={[
                    styles.timeOption,
                    {
                      backgroundColor:
                        selectedTime === time
                          ? ComeYaColors.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedTime === time
                          ? ComeYaColors.primary
                          : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="h4"
                    style={{
                      color: selectedTime === time ? "#FFF" : theme.text,
                    }}
                  >
                    {time} min
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setTimeModal({ visible: false, orderId: "" })}
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText type="body">Cancelar</ThemedText>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    await apiRequest(
                      "PATCH",
                      `/api/orders/${timeModal.orderId}/status`,
                      { status: "accepted" },
                    );
                    await apiRequest(
                      "POST",
                      `/api/pickup/${timeModal.orderId}/update-time`,
                      { estimatedMinutes: selectedTime },
                    );
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    ).catch(() => {});
                    setTimeModal({ visible: false, orderId: "" });
                    loadOrders();
                  } catch (error) {
                    Alert.alert("Error", "No se pudo aceptar el pedido");
                  }
                }}
                style={[
                  styles.modalButton,
                  { backgroundColor: ComeYaColors.primary },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "600" }}
                >
                  Aceptar y Notificar
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de tiempo de preparación (aviso anticipado al repartidor) */}
      <Modal visible={prepModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
              ¿Cuánto tardará la preparación?
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}
            >
              Se avisará a los repartidores para que se acerquen al local.
            </ThemedText>

            <View style={styles.timeGrid}>
              {[
                { label: "5–10 min", range: "5-10 min", minutes: 8 },
                { label: "10–20 min", range: "10-20 min", minutes: 15 },
              ].map((opt) => (
                <Pressable
                  key={opt.range}
                  onPress={() =>
                    confirmStartPreparing(prepModal.orderId!, opt.range, opt.minutes)
                  }
                  style={[
                    styles.timeOption,
                    { backgroundColor: ComeYaColors.primary },
                  ]}
                >
                  <ThemedText type="h4" style={{ color: "#FFF" }}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                const id = prepModal.orderId;
                setPrepModal({ visible: false, orderId: null });
                if (id) updateOrderStatus(id, "ready");
              }}
              style={[
                styles.modalButton,
                { backgroundColor: ComeYaColors.success, marginTop: Spacing.md },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFF", fontWeight: "700" }}
              >
                PEDIDO LISTO
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setPrepModal({ visible: false, orderId: null })}
              style={[
                styles.modalButton,
                { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.sm },
              ]}
            >
              <ThemedText type="body">Cancelar</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h2">Pedidos</ThemedText>
      </View>

      <View style={styles.filters}>
        <Pressable
          onPress={() => setFilter("pending")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filter === "pending" ? ComeYaColors.primary : theme.card,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: filter === "pending" ? "#FFF" : theme.text }}
          >
            Pendientes
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter("active")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filter === "active" ? ComeYaColors.primary : theme.card,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: filter === "active" ? "#FFF" : theme.text }}
          >
            Activos
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter("all")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filter === "all" ? ComeYaColors.primary : theme.card,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: filter === "all" ? "#FFF" : theme.text }}
          >
            Todos
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item: any) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No hay pedidos
            </ThemedText>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  filters: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  orderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  itemsList: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  timeOption: {
    width: "30%",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
