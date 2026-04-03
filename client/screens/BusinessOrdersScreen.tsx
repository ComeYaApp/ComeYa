import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { io, Socket } from "socket.io-client";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export default function BusinessOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
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

  // WebSocket connection
  useEffect(() => {
    const socket = io(getApiUrl().replace('/api', ''), {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      // Join business room
      socket.emit('join', { userId: user?.id, role: 'business_owner', businessId: user?.businessId });
    });

    socket.on('new_order', (order: any) => {
      console.log('📦 New order received via WebSocket:', order);
      playNotificationSound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadOrders(); // Refresh orders
    });

    socket.on('payment_verified', ({ orderId }: { orderId: string }) => {
      console.log('💳 Payment verified for order:', orderId);
      loadOrders();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.businessId]);

  const playNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" },
        { shouldPlay: true }
      );
      await sound.playAsync();
    } catch (error) {
      console.log("Could not play sound", error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/orders");
      const data = await response.json();
      if (data.success) {
        const newOrders = data.orders;
        const pendingCount = newOrders.filter((o: any) => o.status === "pending").length;
        
        if (pendingCount > previousPendingCount.current && previousPendingCount.current > 0) {
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
    // Polling reducido a 30s como fallback
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await apiRequest("PUT", `/api/business/orders/${orderId}/status`, {
        status,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      loadOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "No se pudo actualizar el pedido");
    }
  };

  const handleAccept = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmModal({
      visible: true,
      title: "Aceptar Pedido",
      message: "¿Confirmar este pedido?",
      onConfirm: () => {
        updateOrderStatus(orderId, "accepted");
        setConfirmModal({ ...confirmModal, visible: false });
      },
    });
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

  const handleStartPreparing = (orderId: string) => {
    updateOrderStatus(orderId, "preparing");
  };

  const filteredOrders = orders.filter((order: any) => {
    if (filter === "pending") return order.status === "pending";
    if (filter === "active")
      return ["accepted", "preparing", "ready", "on_the_way"].includes(order.status);
    return true;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      accepted: "Aceptado",
      preparing: "Preparando",
      ready: "Listo ✓",
      on_the_way: "En camino",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getPaymentLabel = (method: string) => {
    const map: Record<string, string> = {
      pago_movil:   "📱 Pago Móvil",
      pagomovil:    "📱 Pago Móvil",
      binance:      "🟡 Binance Pay",
      binance_pay:  "🟡 Binance Pay",
      zinli:        "💜 Zinli",
      zelle:        "💵 Zelle",
      cash:         "💵 Efectivo",
      efectivo:     "💵 Efectivo",
    };
    return map[method?.toLowerCase()] ?? "💳 " + (method ?? "Pago digital");
  };

  const renderOrder = ({ item }: { item: any }) => {
    const items = typeof item.items === "string" ? JSON.parse(item.items) : item.items;

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4">Pedido #{item.id.slice(-6)}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {new Date(item.createdAt).toLocaleTimeString("es-VE", {
                hour: "2-digit",
                minute: "2-digit",
              })} - {new Date(item.createdAt).toLocaleDateString("es-VE")}
            </ThemedText>
            {item.businessName ? (
              <ThemedText type="small" style={{ color: ComeYaColors.primary, marginTop: 2 }}>
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
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {item.customer.name} - {item.customer.phone}
            </ThemedText>
          </View>
        ) : null}

        {item.address ? (
          <View style={styles.customerInfo}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
              {item.address.street}, {item.address.city}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.itemsList}>
          {Array.isArray(items) && items.map((orderItem: any, index: number) => (
            <View key={index} style={styles.item}>
              <ThemedText type="body">
                {orderItem.quantity}x {orderItem.name || orderItem.product?.name || "Producto"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                ${((orderItem.price || orderItem.product?.price || 0) / 100).toFixed(2)}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              ${(item.subtotal / 100).toFixed(2)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {getPaymentLabel(item.paymentMethod)}
            </ThemedText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <ThemedText type="small" style={{ color: ComeYaColors.success, fontWeight: "600" }}>
              Recibes: ${(item.subtotal / 100).toFixed(2)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {item.status === "delivered" ? "✅ Liquidado" : "⏳ Pendiente"}
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
                  handleAccept(item.id);
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

          {item.status === "accepted" && (
            <Pressable
              onPress={() => handleStartPreparing(item.id)}
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

          {item.status === "on_the_way" && (
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
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
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
              backgroundColor: filter === "all" ? ComeYaColors.primary : theme.card,
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
});
