import React, { useState, useEffect } from "react";
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
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { gpsService } from '@/services/gpsService';
import { GPS_CONFIG } from '@/constants/api';

export default function DriverAvailableOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      console.log('🔍 Loading driver status...');
      const response = await apiRequest("GET", "/api/delivery/status");
      const data = await response.json();
      
      console.log('📝 Status response:', data);
      
      if (data.success && typeof data.isOnline !== 'undefined') {
        console.log('✅ Current status:', data.isOnline);
        setIsOnline(data.isOnline);
      } else {
        console.error('❌ Failed to load status:', data);
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
      console.log('📦 Loading available orders...');
      const response = await apiRequest("GET", "/api/delivery/available-orders");
      const data = await response.json();
      console.log('📦 Orders response:', data);
      if (data.success) {
        console.log('✅ Found orders:', data.orders?.length || 0);
        setOrders(data.orders || []);
      } else {
        console.error('❌ Failed to load orders:', data);
      }
    } catch (error) {
      console.error("❌ Error loading orders:", error);
    }
    setLoadingOrders(false);
  };

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    try {
      console.log('🔄 Toggling driver status from:', isOnline);
      const response = await apiRequest("POST", "/api/delivery/toggle-status", {});
      const data = await response.json();
      
      console.log('📝 Toggle response:', data);
      
      if (data.success) {
        // Use the isOnline value from server response if available
        const newStatus = typeof data.isOnline !== 'undefined' ? data.isOnline : !isOnline;
        console.log('✅ Status changed to:', newStatus);
        setIsOnline(newStatus);
        
        // Start/stop GPS tracking based on status
        if (newStatus) {
          if (!GPS_CONFIG.DISABLE_IN_DEV) {
            gpsService.startTracking();
          } else {
            console.log('⚠️ GPS disabled by GPS_CONFIG.DISABLE_IN_DEV');
          }
        } else {
          gpsService.stopTracking();
        }
        Haptics.notificationAsync(
          newStatus
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
      } else {
        console.error('❌ Toggle failed:', data);
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
      const response = await apiRequest("POST", `/api/delivery/accept/${orderId}`, {});
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
    const payload = colonIndex >= 0 ? rawMessage.slice(colonIndex + 1).trim() : rawMessage;
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
    const items = typeof item.items === "string" ? JSON.parse(item.items) : item.items;

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText type="h4">{item.businessName}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pedido #{item.id.slice(-6)}
            </ThemedText>
          </View>
          <Badge text="Listo" variant="success" />
        </View>

        <View style={styles.locationInfo}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}
            numberOfLines={2}
          >
            {item.deliveryAddress}
          </ThemedText>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Feather name="package" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
              {items.length} productos
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather
              name={item.paymentMethod === "cash" ? "dollar-sign" : "credit-card"}
              size={16}
              color={theme.textSecondary}
            />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
              {item.paymentMethod === "cash" ? "💵 Efectivo" :
               item.paymentMethod === "pago_movil" ? "📱 Pago Móvil" :
               item.paymentMethod === "binance_pay" ? "🟡 Binance" :
               item.paymentMethod === "zinli" ? "💜 Zinli" :
               item.paymentMethod === "zelle" ? "💙 Zelle" : "💳 Digital"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Ganancia estimada
            </ThemedText>
            <ThemedText type="h3" style={{ color: ComeYaColors.success }}>
              Bs. {(item.deliveryFee || 0).toFixed(2)}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => {
              console.log('🔥 Button pressed for order:', item.id);
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
              style={{ color: "#FFF", marginLeft: Spacing.xs, fontWeight: "600" }}
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
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg, backgroundColor: theme.background }]}>
        <View style={styles.headerTop}>
          <ThemedText type="h2">Pedidos Disponibles</ThemedText>
          <View style={styles.statusToggle}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? ComeYaColors.success : theme.textSecondary },
              ]}
            />
            <ThemedText
              type="small"
              style={{ marginHorizontal: Spacing.xs, color: isOnline ? ComeYaColors.success : theme.textSecondary }}
            >
              {isOnline ? "En línea" : "Desconectado"}
            </ThemedText>
            <Switch
              value={isOnline}
              onValueChange={handleToggleStatus}
              disabled={isTogglingStatus}
              trackColor={{ false: theme.border, true: ComeYaColors.success + "60" }}
              thumbColor={isOnline ? ComeYaColors.success : theme.textSecondary}
            />
          </View>
        </View>
        {!isOnline && (
          <View style={[styles.offlineWarning, { backgroundColor: ComeYaColors.warning + "20" }]}>
            <Feather name="alert-circle" size={16} color={ComeYaColors.warning} />
            <ThemedText type="small" style={{ color: ComeYaColors.warning, marginLeft: Spacing.xs, flex: 1 }}>
              Activa tu estado para recibir pedidos
            </ThemedText>
          </View>
        )}
      </View>

      <FlatList
        data={orders}
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
