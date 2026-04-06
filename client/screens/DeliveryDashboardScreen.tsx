import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type DeliveryDashboardNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
type OrderStatus = "ready" | "picked_up" | "delivered";

interface DeliveryOrder {
  id: string;
  businessName: string;
  businessAddress?: string;
  customerName?: string;
  customerPhone?: string;
  items: string;
  status: string;
  total: number;
  paymentMethod: string;
  deliveryAddress: string;
  notes?: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  ready: "Listo para recoger",
  picked_up: "En camino",
  on_the_way: "En camino",
  in_transit: "En camino",
  delivered: "Entregado",
};

function DeliveryOrderCard({
  order,
  onPickUp,
  onDeliver,
  onShowDeliveryConfirm,
  isUpdating,
}: {
  order: DeliveryOrder;
  onPickUp: (orderId: string) => void;
  onDeliver: (orderId: string) => void;
  onShowDeliveryConfirm: (orderId: string) => void;
  isUpdating: boolean;
}) {
  const { theme } = useTheme();
  const items = JSON.parse(order.items || "[]");

  const openMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
      default: `https://maps.google.com/?q=${encodedAddress}`,
    });
    Linking.openURL(url);
  };

  const callCustomer = () => {
    if (order.customerPhone) {
      Linking.openURL(`tel:${order.customerPhone}`);
    }
  };

  const handlePickUp = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPickUp(order.id);
  };

  const handleDeliver = () => {
    onShowDeliveryConfirm(order.id);
  };

  const isReady = order.status === "ready";
  const isPickedUp = order.status === "picked_up";
  const isOnTheWay = order.status === "on_the_way" || order.status === "in_transit";

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.md]}
    >
      <View style={styles.orderHeader}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: (isPickedUp || isOnTheWay) ? "#00BCD4" + "20" : "#4CAF50" + "20",
            },
          ]}
        >
          <Feather
            name={(isPickedUp || isOnTheWay) ? "truck" : "package"}
            size={14}
            color={(isPickedUp || isOnTheWay) ? "#00BCD4" : "#4CAF50"}
          />
          <ThemedText
            type="small"
            style={{
              color: (isPickedUp || isOnTheWay) ? "#00BCD4" : "#4CAF50",
              marginLeft: 6,
              fontWeight: "600",
            }}
          >
            {statusLabels[order.status] || order.status}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Total: ${(order.total / 100).toFixed(2)}
          </ThemedText>
          <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
            Ganas: ${((order.deliveryFee || 0) / 100).toFixed(2)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="shopping-bag" size={16} color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ fontWeight: "600", marginLeft: 8 }}>
            {order.businessName}
          </ThemedText>
        </View>
        {isReady && order.businessAddress ? (
          <Pressable
            onPress={() => openMaps(order.businessAddress!)}
            style={styles.addressRow}
          >
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, flex: 1 }}
            >
              {order.businessAddress}
            </ThemedText>
            <Feather name="navigation" size={16} color={ComeYaColors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="user" size={16} color="#9C27B0" />
          <ThemedText type="body" style={{ fontWeight: "600", marginLeft: 8 }}>
            Cliente
          </ThemedText>
        </View>
        <Pressable
          onPress={() => openMaps(order.deliveryAddress)}
          style={styles.addressRow}
        >
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, flex: 1 }}
          >
            {order.deliveryAddress}
          </ThemedText>
          <Feather name="navigation" size={16} color={ComeYaColors.primary} />
        </Pressable>
        {order.customerPhone ? (
          <Pressable onPress={callCustomer} style={styles.phoneRow}>
            <Feather name="phone" size={14} color="#4CAF50" />
            <ThemedText
              type="small"
              style={{ color: "#4CAF50", marginLeft: 6 }}
            >
              Llamar al cliente
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.itemsSection}>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginBottom: 4 }}
        >
          {items.length} producto{items.length !== 1 ? "s" : ""}
        </ThemedText>
        {items.slice(0, 2).map((item: any, idx: number) => (
          <ThemedText key={idx} type="small" numberOfLines={1}>
            {item.quantity}x {item.name}
          </ThemedText>
        ))}
        {items.length > 2 && (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            +{items.length - 2} más
          </ThemedText>
        )}
      </View>

      {order.notes ? (
        <View
          style={[
            styles.notesSection,
            { backgroundColor: ComeYaColors.primary + "10" },
          ]}
        >
          <Feather name="message-circle" size={14} color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ marginLeft: 8, flex: 1 }}>
            {order.notes}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.paymentInfo}>
        <View
          style={[
            styles.paymentBadge,
            {
              backgroundColor:
                order.paymentMethod === "card"
                  ? "#4CAF50" + "15"
                  : "#FF9800" + "15",
            },
          ]}
        >
          <Feather
            name={
              order.paymentMethod === "card" ? "credit-card" : "dollar-sign"
            }
            size={14}
            color={order.paymentMethod === "card" ? "#4CAF50" : "#FF9800"}
          />
          <ThemedText
            type="small"
            style={{
              color: order.paymentMethod === "card" ? "#4CAF50" : "#FF9800",
              marginLeft: 6,
            }}
          >
            {order.paymentMethod === "card"
              ? "Pagado con tarjeta"
              : `Cobrar $${(order.total / 100).toFixed(2)} en efectivo`}
          </ThemedText>
        </View>
      </View>

      {isReady ? (
        <Pressable
          onPress={handlePickUp}
          disabled={isUpdating}
          style={[
            styles.actionButton,
            { backgroundColor: "#00BCD4", opacity: isUpdating ? 0.6 : 1 },
          ]}
        >
          <Feather name="package" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }}
          >
            Pedido recogido
          </ThemedText>
        </Pressable>
      ) : isPickedUp || isOnTheWay ? (
        <Pressable
          onPress={handleDeliver}
          disabled={isUpdating}
          style={[
            styles.actionButton,
            { backgroundColor: "#4CAF50", opacity: isUpdating ? 0.6 : 1 },
          ]}
        >
          <Feather name="check-circle" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }}
          >
            Marcar como entregado
          </ThemedText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export default function DeliveryDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<DeliveryDashboardNavigationProp>();
  const queryClient = useQueryClient();
  // Get driver status from backend
  const {
    data: statusData,
    isLoading: statusLoading,
  } = useQuery<{ success: boolean; isOnline: boolean; strikes: number }>({
    queryKey: ["/api/delivery/status", user?.id],
    enabled: !!user?.id,
  });

  // Sync local state with backend
  useEffect(() => {
    if (statusData?.isOnline !== undefined) {
      setIsOnline(statusData.isOnline);
    }
  }, [statusData]);

  // Toggle online status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/delivery/toggle-status", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.isOnline !== undefined) {
        setIsOnline(data.isOnline);
        showToast(data.message || (data.isOnline ? "Ahora estás en línea" : "Ahora estás desconectado"), "success");
        queryClient.invalidateQueries({ queryKey: ["/api/delivery/status"] });
      }
    },
    onError: (error) => {
      console.error("Toggle status error:", error);
      showToast("Error al cambiar estado", "error");
    },
  });
  const [isOnline, setIsOnline] = useState(false); // Default to false until loaded from backend
  const [activeTab, setActiveTab] = useState<
    "available" | "active" | "history"
  >("available");
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [deliveryConfirmModalVisible, setDeliveryConfirmModalVisible] =
    useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);

  // Share location in real-time when online
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationSharing = async () => {
      if (!isOnline || !user?.id) return;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          async (location) => {
            const { latitude, longitude } = location.coords;
            setCurrentLocation({ latitude, longitude });

            try {
              await apiRequest("POST", "/api/delivery/location", {
                deliveryPersonId: user.id,
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                isOnline: true,
              });
            } catch (error) {
              console.log("Error updating location");
            }
          },
        );
      } catch (error) {
        console.log("Error starting location sharing");
      }
    };

    const stopLocationSharing = async () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (user?.id) {
        try {
          await apiRequest("POST", "/api/delivery/toggle-online", {
            deliveryPersonId: user.id,
            isOnline: false,
          });
        } catch (error) {
          console.log("Error updating offline status");
        }
      }
    };

    if (isOnline) {
      startLocationSharing();
    } else {
      stopLocationSharing();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isOnline, user?.id]);

  const {
    data: ordersData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ orders: DeliveryOrder[]; availableOrders: DeliveryOrder[] }>({
    queryKey: ["/api/delivery/orders", user?.id],
    enabled: !!user?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/orders/${orderId}/status`,
        {
          status,
          deliveryPersonId: user?.id,
        },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
    },
    onError: () => {
      showToast("No se pudo actualizar el estado", "error");
    },
  });

  const parseApiError = (rawMessage: string) => {
    const colonIndex = rawMessage.indexOf(":");
    const payload = colonIndex >= 0 ? rawMessage.slice(colonIndex + 1).trim() : rawMessage;
    try {
      const parsed = JSON.parse(payload);
      return parsed?.error || parsed?.message || rawMessage;
    } catch (parseError) {
      return payload || rawMessage;
    }
  };

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/delivery/accept-order/${orderId}`,
        {
          deliveryPersonId: user?.id,
        },
      );
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? parseApiError(error.message)
          : "No se pudo aceptar el pedido";
      showToast(message, "error");
    },
  });

  const orders: DeliveryOrder[] = ordersData?.orders || [];
  const availableOrders = ordersData?.availableOrders || [];
  const activeOrders = orders.filter((o) =>
    ["ready", "picked_up", "on_the_way", "in_transit"].includes(o.status),
  );
  const historyOrders = orders.filter((o) => o.status === "delivered");

  const todayDeliveries = historyOrders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const todayEarnings = todayDeliveries.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

  const handlePickUp = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: "picked_up" });
  };

  const handleDeliver = async (orderId: string) => {
    try {
      // Get current location before marking as delivered
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Se requiere permiso de ubicación para confirmar entrega', 'error');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Send location with delivery confirmation
      const response = await apiRequest(
        'POST',
        `/api/orders/${orderId}/complete-delivery`,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      );

      const data = await response.json();
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Pedido entregado correctamente', 'success');
        queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders'] });
      } else {
        showToast(data.error || 'Error al confirmar entrega', 'error');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error al confirmar entrega';
      showToast(errorMessage, 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleAcceptOrder = (orderId: string) => {
    acceptOrderMutation.mutate(orderId);
  };

  const handleShowDeliveryConfirm = (orderId: string) => {
    setOrderToConfirm(orderId);
    setDeliveryConfirmModalVisible(true);
  };

  const handleConfirmDelivery = () => {
    if (orderToConfirm) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleDeliver(orderToConfirm);
      setDeliveryConfirmModalVisible(false);
      setOrderToConfirm(null);
    }
  };

  const handleCancelDeliveryConfirm = () => {
    setDeliveryConfirmModalVisible(false);
    setOrderToConfirm(null);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <ThemedText type="h2">ComeYa Delivery</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {user?.name || "Repartidor"}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleStatusMutation.mutate();
          }}
          disabled={toggleStatusMutation.isPending}
          style={[
            styles.onlineToggle,
            { 
              backgroundColor: isOnline ? "#4CAF50" : theme.card,
              opacity: toggleStatusMutation.isPending ? 0.6 : 1
            },
          ]}
        >
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: isOnline ? "#FFFFFF" : "#F44336" },
            ]}
          />
          <ThemedText
            type="small"
            style={{ color: isOnline ? "#FFFFFF" : theme.text, marginLeft: 6 }}
          >
            {toggleStatusMutation.isPending 
              ? "Cambiando..." 
              : isOnline 
                ? "En línea" 
                : "Fuera de línea"
            }
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#4CAF50" + "15" }]}>
          <ThemedText type="h2" style={{ color: "#4CAF50" }}>
            {todayDeliveries.length}
          </ThemedText>
          <ThemedText type="small" style={{ color: "#4CAF50" }}>
            Entregas hoy
          </ThemedText>
        </View>
        <Pressable
          style={[
            styles.statCard,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
          onPress={() => navigation.navigate("DeliveryEarnings")}
        >
          <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
            ${(todayEarnings / 100).toFixed(0)}
          </ThemedText>
          <ThemedText type="small" style={{ color: ComeYaColors.primary }}>
            Ganado hoy
          </ThemedText>
          <Feather
            name="chevron-right"
            size={16}
            color={ComeYaColors.primary}
            style={{ marginTop: 4 }}
          />
        </Pressable>
        <View style={[styles.statCard, { backgroundColor: "#2196F3" + "15" }]}>
          <ThemedText type="h2" style={{ color: "#2196F3" }}>
            {activeOrders.length}
          </ThemedText>
          <ThemedText type="small" style={{ color: "#2196F3" }}>
            Activos
          </ThemedText>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setActiveTab("available")}
          style={[
            styles.tab,
            activeTab === "available" && {
              backgroundColor: ComeYaColors.primary,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{
              color: activeTab === "available" ? "#FFFFFF" : theme.text,
            }}
          >
            Disponibles ({availableOrders.length})
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("active")}
          style={[
            styles.tab,
            activeTab === "active" && { backgroundColor: ComeYaColors.primary },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: activeTab === "active" ? "#FFFFFF" : theme.text }}
          >
            Mis pedidos ({activeOrders.length})
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("history")}
          style={[
            styles.tab,
            activeTab === "history" && { backgroundColor: ComeYaColors.primary },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: activeTab === "history" ? "#FFFFFF" : theme.text }}
          >
            Historial
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.ordersList}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Cargando...
            </ThemedText>
          </View>
        ) : activeTab === "available" ? (
          availableOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color={theme.textSecondary} />
              <ThemedText
                type="h4"
                style={{ color: theme.text, marginTop: Spacing.md }}
              >
                No hay pedidos disponibles
              </ThemedText>
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                Los nuevos pedidos listos para recoger aparecerán aquí
              </ThemedText>
            </View>
          ) : (
            availableOrders.map((order: DeliveryOrder) => (
              <Animated.View
                key={order.id}
                entering={FadeInDown.springify()}
                style={[
                  styles.availableCard,
                  { backgroundColor: theme.card },
                  Shadows.md,
                ]}
              >
                <View style={styles.availableHeader}>
                  <ThemedText type="h4">{order.businessName}</ThemedText>
                  <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                    ${(order.total / 100).toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.availableInfo}>
                  <Feather
                    name="map-pin"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.textSecondary,
                      marginLeft: 6,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {order.deliveryAddress}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => handleAcceptOrder(order.id)}
                  style={[styles.acceptButton, { backgroundColor: "#4CAF50" }]}
                >
                  <ThemedText
                    type="body"
                    style={{ color: "#FFFFFF", fontWeight: "600" }}
                  >
                    Aceptar pedido
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ))
          )
        ) : activeTab === "active" ? (
          activeOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="truck" size={48} color={theme.textSecondary} />
              <ThemedText
                type="h4"
                style={{ color: theme.text, marginTop: Spacing.md }}
              >
                Sin pedidos activos
              </ThemedText>
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                Acepta un pedido de la pestaña "Disponibles"
              </ThemedText>
            </View>
          ) : (
            activeOrders.map((order) => (
              <DeliveryOrderCard
                key={order.id}
                order={order}
                onPickUp={handlePickUp}
                onDeliver={handleDeliver}
                onShowDeliveryConfirm={handleShowDeliveryConfirm}
                isUpdating={updateStatusMutation.isPending}
              />
            ))
          )
        ) : historyOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={48} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.text, marginTop: Spacing.md }}
            >
              Sin historial
            </ThemedText>
          </View>
        ) : (
          historyOrders.map((order) => (
            <View
              key={order.id}
              style={[styles.historyCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.historyHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {order.businessName}
                </ThemedText>
                <ThemedText type="body" style={{ color: "#4CAF50" }}>
                  ${(order.total / 100).toFixed(2)}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {new Date(order.createdAt).toLocaleDateString("es-VE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={deliveryConfirmModalVisible}
        title="Marcar como entregado"
        message="¿Ya entregaste el pedido al cliente? El cliente recibirá una notificación para confirmar la recepción y liberar tu pago."
        confirmText="Sí, lo entregué"
        cancelText="Cancelar"
        confirmColor="#4CAF50"
        icon="check-circle"
        iconColor="#4CAF50"
        onConfirm={handleConfirmDelivery}
        onCancel={handleCancelDeliveryConfirm}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  onlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  ordersList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  orderCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 24,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 24,
    marginTop: 4,
  },
  itemsSection: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  notesSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  paymentInfo: {
    marginTop: Spacing.md,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  availableCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  availableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  availableInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  acceptButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  historyCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
});
