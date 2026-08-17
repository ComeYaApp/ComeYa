import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { OrderProgressBar } from "@/components/OrderProgressBar";
import { useTheme } from "@/hooks/useTheme";
import { useReorder } from "@/hooks/useReorder";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { Order, OrderStatus } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { ConfirmModal } from "@/components/ConfirmModal";

type OrdersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  assigned_driver: "Repartidor asignado",
  picked_up: "Recogido",
  on_the_way: "En camino",
  in_transit: "En tránsito",
  arriving: "Llegando",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  "primary" | "secondary" | "success" | "warning" | "error"
> = {
  pending: "warning",
  accepted: "primary",
  confirmed: "primary",
  preparing: "primary",
  ready: "success",
  assigned_driver: "primary",
  picked_up: "primary",
  on_the_way: "primary",
  in_transit: "primary",
  arriving: "primary",
  delivered: "success",
  cancelled: "error",
  refunded: "secondary",
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<OrdersScreenNavigationProp>();
  const { theme } = useTheme();
  const { reorder } = useReorder();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(
    null,
  );
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/orders");
      const data = await response.json();
      const apiOrders = (data.orders || []).map((row: any) => {
        const o = row.order ?? row;
        const b = row.business;
        return {
          ...o,
          businessName: o.businessName || b?.name || "",
          businessImage: o.businessImage || b?.image || "",
          items:
            typeof o.items === "string" ? JSON.parse(o.items) : (o.items ?? []),
        };
      });
      setOrders(
        apiOrders.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (error) {
      console.error("Error loading orders:", error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };

  const confirmDelivery = (orderId: string) => {
    setPendingConfirmId(orderId);
  };

  const handleConfirmDelivery = async () => {
    if (!pendingConfirmId) return;
    const orderId = pendingConfirmId;
    setPendingConfirmId(null);
    setConfirmingOrderId(orderId);
    try {
      const res = await apiRequest(
        "POST",
        `/api/fund-release/confirm-delivery`,
        { orderId },
      );
      const data = await res.json();
      if (data.success) {
        loadOrders();
      }
    } catch (e: any) {
      console.error("Error confirming delivery:", e);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Hoy, ${date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Ayer, ${date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return date.toLocaleDateString("es-VE", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  // delivered sin confirmar = activo (cliente debe confirmar)
  const activeOrders = orders.filter(
    (o) =>
      !(
        o.status === "cancelled" ||
        (o.status === "delivered" && (o as any).confirmedByCustomer)
      ),
  );
  const pastOrders = orders.filter(
    (o) =>
      o.status === "cancelled" ||
      (o.status === "delivered" && (o as any).confirmedByCustomer),
  );

  const renderOrder = ({ item }: { item: Order }) => {
    const needsConfirm =
      item.status === "delivered" && !(item as any).confirmedByCustomer;
    const isActive = !(
      item.status === "cancelled" ||
      (item.status === "delivered" && (item as any).confirmedByCustomer)
    );

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("OrderTracking", { orderId: item.id })
        }
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <Image
            source={
              item.businessImage
                ? { uri: item.businessImage }
                : require("../../assets/images/delivery-hero.png")
            }
            style={styles.businessImage}
            contentFit="cover"
          />
          <View style={styles.orderInfo}>
            <ThemedText type="h4" numberOfLines={1}>
              {item.businessName}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Badge
              text={STATUS_LABELS[item.status]}
              variant={STATUS_VARIANTS[item.status]}
            />
            <Badge
              text={
                (item as any).orderType === "pickup"
                  ? "🛍️ Recoger"
                  : "🚚 Delivery"
              }
              variant="secondary"
            />
          </View>
        </View>

        {isActive && (
          <View style={styles.statusSection}>
            <OrderProgressBar
              status={item.status}
              orderType={(item as any).orderType || "delivery"}
            />
          </View>
        )}

        <View style={styles.orderFooter}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.items.length}{" "}
            {item.items.length === 1 ? "producto" : "productos"}
          </ThemedText>
          <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
            {((item.total || 0) / 100).toFixed(2)} €
          </ThemedText>
        </View>

        {needsConfirm ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              confirmDelivery(item.id);
            }}
            disabled={confirmingOrderId === item.id}
            style={[
              styles.confirmButton,
              { backgroundColor: ComeYaColors.success },
            ]}
          >
            <Feather name="check-circle" size={16} color="#FFF" />
            <ThemedText
              type="small"
              style={{
                color: "#FFF",
                marginLeft: Spacing.xs,
                fontWeight: "600",
              }}
            >
              {confirmingOrderId === item.id
                ? "Confirmando..."
                : "✅ Confirmar que recibí mi pedido"}
            </ThemedText>
          </Pressable>
        ) : isActive ? (
          <View style={[styles.trackButton, { borderTopColor: theme.border }]}>
            <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
            >
              Ver seguimiento
            </ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={() => reorder(item)}
            style={[
              styles.reorderButton,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="refresh-cw" size={16} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
            >
              Pedir de nuevo
            </ThemedText>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const ListHeader = () => (
    <>
      {activeOrders.length > 0 ? (
        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Pedidos activos</ThemedText>
        </View>
      ) : null}
      {activeOrders.map((order) => (
        <View key={order.id}>{renderOrder({ item: order })}</View>
      ))}
      {pastOrders.length > 0 ? (
        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Historial</ThemedText>
        </View>
      ) : null}
    </>
  );

  if (!isLoading && orders.length === 0) {
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
        <EmptyState
          image={require("../../assets/images/delivery-hero.png")}
          title="Sin pedidos aún"
          description="Tus pedidos aparecerán aquí"
          actionLabel="Explorar negocios"
          onAction={() => navigation.navigate("BusinessList")}
        />
      </LinearGradient>
    );
  }

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
      <FlatList
        data={pastOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <ConfirmModal
        visible={pendingConfirmId !== null}
        title="Confirmar recepción"
        message="¿Recibiste tu pedido correctamente? Al confirmar, los fondos serán liberados al negocio y repartidor."
        confirmText="Sí, lo recibí"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelivery}
        onCancel={() => setPendingConfirmId(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  businessImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  orderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusSection: {
    marginTop: Spacing.md,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
  },
  reorderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
