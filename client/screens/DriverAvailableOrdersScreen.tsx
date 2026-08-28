import React, { useState, useEffect } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { gpsService } from "@/services/gpsService";
import { GPS_CONFIG } from "@/constants/api";

export default function DriverAvailableOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [logisticsRequests, setLogisticsRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isApproved, setIsApproved] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      console.log("🔍 Loading driver status...");
      const response = await apiRequest("GET", "/api/delivery/status");
      const data = await response.json();

      console.log("📝 Status response:", data);

      if (data.success && typeof data.isOnline !== "undefined") {
        console.log("✅ Current status:", data.isOnline);
        setIsOnline(data.isOnline);
        setIsApproved(
          data.verificationStatus
            ? data.verificationStatus === "verified"
            : true,
        );
      } else {
        console.error("❌ Failed to load status:", data);
        // Set default to false if we can't get status
        setIsOnline(false);
      }
    } catch (error) {
      console.error("❌ Error loading status:", error);
      setIsOnline(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      console.log("📦 Loading available orders...");
      const response = await apiRequest(
        "GET",
        "/api/delivery/available-orders",
      );
      const data = await response.json();
      console.log("📦 Orders response:", data);
      if (data.success) {
        console.log("✅ Found orders:", data.orders?.length || 0);
        setOrders(data.orders || []);
      } else {
        console.error("❌ Failed to load orders:", data);
      }
    } catch (error) {
      console.error("❌ Error loading orders:", error);
    }

    // Recogidas de comercios (Logística Local)
    try {
      const res = await apiRequest("GET", "/api/delivery-requests/available");
      const data = await res.json();
      setLogisticsRequests(data.requests || []);
    } catch {
      // sin recogidas disponibles
    }
    setLoadingOrders(false);
  };

  const handleAcceptLogistics = async (id: string) => {
    try {
      const res = await apiRequest("POST", `/api/delivery-requests/${id}/accept`);
      const data = await res.json();
      if (data.success) {
        Alert.alert("Recogida aceptada", "Completa la entrega desde tus entregas.");
        loadOrders();
      } else {
        Alert.alert("Error", data.error || "No se pudo aceptar");
      }
    } catch {
      Alert.alert("Error", "No se pudo aceptar la recogida");
    }
  };

  const renderLogisticsSection = () => {
    if (!logisticsRequests.length) return null;
    return (
      <View style={{ marginBottom: Spacing.md }}>
        <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
          📦 Recogidas de comercios (3,50 €)
        </ThemedText>
        {logisticsRequests.map((r: any) => (
          <View
            key={r.id}
            style={[
              styles.logisticsCard,
              { backgroundColor: theme.card },
            ]}
          >
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {r.businessName}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {r.pickupAddress} → {r.dropoffAddress}
            </ThemedText>
            <Pressable
              onPress={() => handleAcceptLogistics(r.id)}
              style={[
                styles.logisticsBtn,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <ThemedText type="caption" style={{ color: "#fff", fontWeight: "700" }}>
                Aceptar — 3,50 €
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </View>
    );
  };

  const handleToggleStatus = async () => {
    if (!isApproved) {
      Alert.alert(
        "Pendiente de aprobación",
        "Tu perfil de repartidor aún no ha sido aprobado por el administrador. Espera a que revisen tu documentación.",
      );
      return;
    }
    setIsTogglingStatus(true);
    try {
      console.log("🔄 Toggling driver status from:", isOnline);
      const response = await apiRequest(
        "POST",
        "/api/delivery/toggle-status",
        {},
      );
      const data = await response.json();

      console.log("📝 Toggle response:", data);

      if (data.success) {
        // Use the isOnline value from server response if available
        const newStatus =
          typeof data.isOnline !== "undefined" ? data.isOnline : !isOnline;
        console.log("✅ Status changed to:", newStatus);
        setIsOnline(newStatus);

        // Start/stop GPS tracking based on status
        if (newStatus) {
          if (!GPS_CONFIG.DISABLE_IN_DEV) {
            gpsService.startTracking();
          } else {
            console.log("⚠️ GPS disabled by GPS_CONFIG.DISABLE_IN_DEV");
          }
        } else {
          gpsService.stopTracking();
        }
        Haptics.notificationAsync(
          newStatus
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      } else {
        console.error("❌ Toggle failed:", data);
        Alert.alert("Error", data.error || "No se pudo cambiar el estado");
      }
    } catch (error) {
      console.error("❌ Error toggling status:", error);
      Alert.alert("Error", "No se pudo cambiar el estado");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadOrders();
    const interval = setInterval(loadOrders, 5000);

    // Start GPS tracking if online
    if (isOnline && !GPS_CONFIG.DISABLE_IN_DEV) {
      gpsService.startTracking();
    }

    return () => {
      clearInterval(interval);
      gpsService.stopTracking();
    };
  }, [isOnline]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!isApproved) {
      Alert.alert(
        "Pendiente de aprobación",
        "Tu perfil de repartidor aún no ha sido aprobado por el administrador.",
      );
      return;
    }

    if (!isOnline) {
      setShowOfflineModal(true);
      return;
    }

    setPendingOrderId(orderId);
    setShowConfirmModal(true);
  };

  const confirmAccept = async () => {
    if (!pendingOrderId) return;
    const orderId = pendingOrderId;
    const previousOrders = orders;

    setAcceptingOrderId(orderId);
    setOrders((prev: any[]) => prev.filter((o) => o.id !== orderId));

    try {
      const response = await apiRequest(
        "POST",
        `/api/delivery/accept/${orderId}`,
        {},
      );
      const data = await response.json();

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Éxito", "Pedido aceptado exitosamente");
        loadOrders();
      } else {
        Alert.alert("Error", data.error || "No se pudo aceptar el pedido");
        setOrders(previousOrders);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? parseApiError(error.message)
          : "No se pudo aceptar el pedido";
      Alert.alert("Error", message);
      setOrders(previousOrders);
    } finally {
      setShowConfirmModal(false);
      setPendingOrderId(null);
      setAcceptingOrderId(null);
    }
  };

  const parseApiError = (rawMessage: string) => {
    const colonIndex = rawMessage.indexOf(":");
    const payload =
      colonIndex >= 0 ? rawMessage.slice(colonIndex + 1).trim() : rawMessage;
    try {
      const parsed = JSON.parse(payload);
      return parsed?.error || parsed?.message || rawMessage;
    } catch (parseError) {
      return payload || rawMessage;
    }
  };

  const cancelAccept = () => {
    setShowConfirmModal(false);
    setPendingOrderId(null);
  };

  const renderOrder = ({ item }: { item: any }) => {
    // items puede no venir en el endpoint: sin el fallback, `items.length`
    // crasheaba la pantalla completa
    const parsedItems =
      typeof item.items === "string"
        ? (() => {
            try {
              return JSON.parse(item.items);
            } catch {
              return [];
            }
          })()
        : item.items;
    const items: any[] = Array.isArray(parsedItems) ? parsedItems : [];
    const distanceKm = item.distanceKm
      ? (item.distanceKm / 1000).toFixed(1)
      : null;
    const estimatedMin =
      item.estimatedMinutes ||
      (distanceKm ? Math.round(parseFloat(distanceKm) * 3) : null);

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText type="h4">{item.businessName}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pedido {displayOrderNumber(item)}
            </ThemedText>
          </View>
          <Badge text="Listo" variant="success" />
        </View>

        {/* Ruta: negocio → cliente */}
        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#FF9800" }]} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, flex: 1 }}
              numberOfLines={1}
            >
              {item.businessAddress || item.businessName}
            </ThemedText>
          </View>
          <View style={[styles.routeLine, { backgroundColor: theme.border }]} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#9C27B0" }]} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, flex: 1 }}
              numberOfLines={1}
            >
              {item.deliveryAddress}
            </ThemedText>
          </View>
        </View>

        {/* Métricas */}
        <View style={styles.metricsRow}>
          {distanceKm && (
            <View style={styles.metricChip}>
              <Feather name="map-pin" size={13} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginLeft: 4 }}
              >
                {distanceKm} km
              </ThemedText>
            </View>
          )}
          {estimatedMin && (
            <View style={styles.metricChip}>
              <Feather name="clock" size={13} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginLeft: 4 }}
              >
                ~{estimatedMin} min
              </ThemedText>
            </View>
          )}
          <View style={styles.metricChip}>
            <Feather
              name={
                item.paymentMethod === "cash" ? "dollar-sign" : "credit-card"
              }
              size={13}
              color={theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginLeft: 4 }}
            >
              {item.paymentMethod === "cash" ? "Efectivo" : "Digital"}
            </ThemedText>
          </View>
          <View style={styles.metricChip}>
            <Feather name="package" size={13} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginLeft: 4 }}
            >
              {items.length} prod.
            </ThemedText>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Tu ganancia
            </ThemedText>
            <ThemedText type="h3" style={{ color: ComeYaColors.success }}>
              {((item.deliveryFee || 0) / 100).toFixed(2)} €
            </ThemedText>
          </View>
          <Pressable
            onPress={() => {
              console.log("🔥 Button pressed for order:", item.id);
              handleAcceptOrder(item.id);
            }}
            disabled={!!acceptingOrderId}
            style={[
              styles.acceptButton,
              {
                backgroundColor: ComeYaColors.primary,
                opacity: acceptingOrderId === item.id ? 0.7 : 1,
              },
            ]}
          >
            {acceptingOrderId === item.id ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="check" size={18} color="#FFF" />
            )}
            <ThemedText
              type="body"
              style={{
                color: "#FFF",
                marginLeft: Spacing.xs,
                fontWeight: "600",
              }}
            >
              {acceptingOrderId === item.id ? "Aceptando..." : "Aceptar"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.lg,
            backgroundColor: theme.background,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <ThemedText type="h2">Pedidos Disponibles</ThemedText>
          <View style={styles.statusToggle}>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: isOnline
                    ? ComeYaColors.success
                    : theme.textSecondary,
                },
              ]}
            />
            <ThemedText
              type="small"
              style={{
                marginHorizontal: Spacing.xs,
                color: isOnline ? ComeYaColors.success : theme.textSecondary,
              }}
            >
              {isOnline ? "En línea" : "Desconectado"}
            </ThemedText>
            <Switch
              value={isOnline}
              onValueChange={handleToggleStatus}
              disabled={isTogglingStatus || !isApproved}
              trackColor={{
                false: theme.border,
                true: ComeYaColors.success + "60",
              }}
              thumbColor={isOnline ? ComeYaColors.success : theme.textSecondary}
            />
          </View>
        </View>
        {!isApproved && (
          <View
            style={[
              styles.offlineWarning,
              { backgroundColor: ComeYaColors.warning + "20" },
            ]}
          >
            <Feather name="clock" size={16} color={ComeYaColors.warning} />
            <ThemedText
              type="small"
              style={{
                color: ComeYaColors.warning,
                marginLeft: Spacing.xs,
                flex: 1,
              }}
            >
              Tu perfil está pendiente de aprobación por el administrador
            </ThemedText>
          </View>
        )}
        {!isOnline && (
          <View
            style={[
              styles.offlineWarning,
              { backgroundColor: ComeYaColors.warning + "20" },
            ]}
          >
            <Feather
              name="alert-circle"
              size={16}
              color={ComeYaColors.warning}
            />
            <ThemedText
              type="small"
              style={{
                color: ComeYaColors.warning,
                marginLeft: Spacing.xs,
                flex: 1,
              }}
            >
              Activa tu estado para recibir pedidos
            </ThemedText>
          </View>
        )}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item: any) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={renderLogisticsSection}
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
            {loadingOrders ? (
              <ActivityIndicator size="large" color={ComeYaColors.primary} />
            ) : (
              <>
                <Feather name="inbox" size={64} color={theme.textSecondary} />
                <ThemedText
                  type="h4"
                  style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
                >
                  No hay pedidos disponibles
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
                >
                  Los pedidos listos aparecerán aquí
                </ThemedText>
              </>
            )}
          </View>
        }
      />

      <ConfirmModal
        visible={showConfirmModal}
        title="Aceptar Pedido"
        message="¿Quieres aceptar este pedido?"
        onConfirm={confirmAccept}
        onCancel={cancelAccept}
      />

      <ConfirmModal
        visible={showOfflineModal}
        title="Estado Requerido"
        message="Debes estar en línea para aceptar pedidos"
        onConfirm={() => setShowOfflineModal(false)}
        onCancel={() => setShowOfflineModal(false)}
        confirmText="Entendido"
        cancelText="Cancelar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logisticsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logisticsBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
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
  locationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  orderDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeRow: {
    marginBottom: Spacing.md,
    gap: 4,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  routeLine: {
    width: 2,
    height: 12,
    marginLeft: 4,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.md,
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
});
