import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { gpsService } from '@/services/gpsService';

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { SmartOrderButton } from "@/components/SmartOrderButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const statusLabels: Record<string, string> = {
  ready: "Listo para recoger",
  picked_up: "Recogido",
  preparing: "Preparando",
  on_the_way: "En camino",
  delivered: "Esperando confirmación",
  pending: "Pendiente",
  accepted: "Aceptado",
  cancelled: "Cancelado",
};

export default function DriverMyDeliveriesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupOrderId, setPickupOrderId] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [proximityError, setProximityError] = useState<{ distanceMeters: number; maxDistanceMeters: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);

  const loadOrders = async () => {
    try {
      const response = await apiRequest("GET", "/api/delivery/my-orders");
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const startLocationTracking = async () => {
    const success = await gpsService.startTracking();
    setIsTracking(success);
  };

  const stopLocationTracking = () => {
    gpsService.stopTracking();
    setIsTracking(false);
  };

  useEffect(() => {
    const hasActiveOrders = orders.some((o: any) =>
      ["preparing", "on_the_way"].includes(o.status)
    );

    if (hasActiveOrders && !isTracking) {
      startLocationTracking();
    } else if (!hasActiveOrders && isTracking) {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [orders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateStatus = async (orderId: string, status: string) => {
    console.log('updateStatus called:', orderId, status);
    const previousOrders = orders;
    setActionOrderId(orderId);
    setOrders((prev: any[]) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
    );
    try {
      let endpoint;
      let method = 'POST';
      
      // Usar los endpoints correctos según el estado
      switch (status) {
        case 'picked_up':
        case 'on_the_way':
          // Nuevo endpoint para recoger pedido
          endpoint = `/api/orders/${orderId}/pickup`;
          break;
        case 'delivered':
          endpoint = `/api/orders/${orderId}/complete-delivery`;
          break;
        default:
          endpoint = `/api/delivery/orders/${orderId}/status`;
          method = 'PUT';
      }

      console.log('Using endpoint:', method, endpoint);
      const body = method === 'PUT' ? { status } : {};
      await apiRequest(method as any, endpoint, body);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadOrders();
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", "No se pudo actualizar el estado");
      setOrders(previousOrders);
    }
    setActionOrderId(null);
  };

  const handlePickedUp = (orderId: string) => {
    setPickupOrderId(orderId);
    setShowPickupModal(true);
  };

  const confirmPickup = () => {
    if (pickupOrderId) {
      updateStatus(pickupOrderId, "picked_up");
    }
    setShowPickupModal(false);
    setPickupOrderId(null);
  };

  const handleOnTheWay = (orderId: string) => {
    updateStatus(orderId, "on_the_way");
  };

  const handleDelivered = async (orderId: string) => {
    console.log('handleDelivered called for:', orderId);
    setPendingOrderId(orderId);
    setShowConfirmModal(true);
  };

  const confirmDelivery = async () => {
    if (pendingOrderId) {
      const previousOrders = orders;
      
      try {
        setActionOrderId(pendingOrderId);
        
        // Intentar obtener ubicación
        const location = await gpsService.getCurrentLocation();
        await completeDeliveryWithLocation(pendingOrderId, location, previousOrders);
      } catch (error) {
        console.error('Error in confirmDelivery:', error);
        setOrders(previousOrders);
        setActionOrderId(null);
      }
    }
    setShowConfirmModal(false);
    setPendingOrderId(null);
  };
  
  const completeDeliveryWithLocation = async (
    orderId: string, 
    location: { latitude: number; longitude: number } | null,
    previousOrders: any[]
  ) => {
    setOrders((prev: any[]) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: "delivered" } : order,
      ),
    );

    try {
      await apiRequest('POST', `/api/orders/${orderId}/complete-delivery`, {
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("¡Entregado!", "El pedido ha sido marcado como entregado. Esperando confirmación del cliente.");
      loadOrders();
    } catch (error: any) {
      console.error('Error confirming delivery:', error);
      let msg = error.message || "No se pudo confirmar la entrega";
      let distanceMeters: number | null = null;
      let maxDistanceMeters: number | null = null;
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(msg.slice(jsonStart));
          msg = parsed.error || msg;
          distanceMeters = parsed.distanceMeters ?? null;
          maxDistanceMeters = parsed.maxDistanceMeters ?? null;
        }
      } catch {}
      if (distanceMeters !== null && maxDistanceMeters !== null) {
        setProximityError({ distanceMeters, maxDistanceMeters });
      } else if (msg.toLowerCase().includes("ubicación")) {
        setGpsError(true);
      } else {
        Alert.alert("Error", msg);
      }
      setOrders(previousOrders);
    } finally {
      setActionOrderId(null);
    }
  };

  const cancelDelivery = () => {
    console.log('User cancelled delivery confirmation');
    setShowConfirmModal(false);
    setPendingOrderId(null);
  };

  const parseDeliveryAddress = (address: string | null): string => {
    if (!address) return "Dirección no disponible";
    try {
      const parsed = JSON.parse(address);
      if (typeof parsed === "object") {
        const parts = [parsed.street, parsed.city, parsed.state, parsed.zipCode].filter(Boolean);
        return parts.join(", ") || address;
      }
      return address;
    } catch {
      return address;
    }
  };

  const parseCoordinate = (value: any): number | null => {
    if (value === undefined || value === null || value === "") return null;
    const num = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const getOrderCoordinates = (order: any): { lat: number | null; lng: number | null } => {
    const lat = [
      order.deliveryLatitude,
      order.deliveryLat,
      order.latitude,
      order.delivery_latitude,
    ]
      .map(parseCoordinate)
      .find((value) => value !== null) ?? null;

    const lng = [
      order.deliveryLongitude,
      order.deliveryLng,
      order.longitude,
      order.delivery_longitude,
    ]
      .map(parseCoordinate)
      .find((value) => value !== null) ?? null;

    return { lat, lng };
  };

  const openGoogleMaps = (lat: number, lng: number, address: string) => {
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
      }
    });
  };

  const openWaze = (lat: number, lng: number) => {
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    Linking.openURL(url);
  };

  const openAppleMaps = (lat: number, lng: number, address: string) => {
    const url = Platform.OS === "ios"
      ? `maps:?daddr=${lat},${lng}&dirflg=d`
      : `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`);
      }
    });
  };

  const showNavigationOptions = (order: any) => {
    const { lat, lng } = getOrderCoordinates(order);
    const address = parseDeliveryAddress(order.deliveryAddress);

    if (lat === null || lng === null) {
      Alert.alert("Error", "No hay coordenadas disponibles para este pedido");
      return;
    }

    Alert.alert(
      "Iniciar Navegación",
      "Selecciona la aplicación de navegación",
      [
        {
          text: "Google Maps",
          onPress: () => openGoogleMaps(lat, lng, address),
        },
        {
          text: "Waze",
          onPress: () => openWaze(lat, lng),
        },
        ...(Platform.OS === "ios" ? [{
          text: "Apple Maps",
          onPress: () => openAppleMaps(lat, lng, address),
        }] : []),
        { text: "Cancelar", style: "cancel" as const },
      ]
    );
  };

  const renderOrder = ({ item }: { item: any }) => {
    const items = typeof item.items === "string" ? JSON.parse(item.items) : item.items;
    const displayAddress = parseDeliveryAddress(item.deliveryAddress);

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText type="h4">{item.businessName}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pedido #{item.id.slice(-8)}
            </ThemedText>
          </View>
          <Badge
            text={statusLabels[item.status] || item.status}
            variant={
              item.status === "preparing"
                ? "primary"
                : item.status === "on_the_way"
                ? "warning"
                : item.status === "delivered"
                ? "info"
                : "secondary"
            }
          />
        </View>

        <View style={styles.locationInfo}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}
            numberOfLines={2}
          >
            {displayAddress}
          </ThemedText>
        </View>

        <View style={styles.orderFooter}>
          <ThemedText type="h4" style={{ color: ComeYaColors.success }}>
            +€{(item.deliveryEarnings || item.deliveryFee || 0).toFixed(2)}
          </ThemedText>
          <View style={styles.mapButtons}>
            <Pressable
              onPress={() => navigation.navigate("OrderTracking", { orderId: item.id })}
              style={[
                styles.trackButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="map" size={16} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs }}
              >
                Ver
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => showNavigationOptions(item)}
              style={[
                styles.trackButton,
                { backgroundColor: ComeYaColors.primary, marginLeft: Spacing.sm },
              ]}
            >
              <Feather name="navigation" size={16} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: Spacing.xs }}
              >
                Navegar
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Botón inteligente usando el componente reutilizable */}
        <View style={styles.actions}>
          <SmartOrderButton
            orderStatus={item.status}
            userRole="delivery_driver"
            loading={actionOrderId === item.id}
            onPress={(canProceed, buttonInfo) => {
              if (canProceed) {
                switch (item.status) {
                  case 'ready':
                    handlePickedUp(item.id);
                    break;
                  case 'picked_up':
                  case 'preparing':
                    handleOnTheWay(item.id);
                    break;
                  case 'on_the_way':
                    handleDelivered(item.id);
                    break;
                  default:
                    Alert.alert("Información", `${buttonInfo.message}\n\n${buttonInfo.nextAction}`, [{ text: "OK" }]);
                }
              } else {
                Alert.alert(
                  "Estado del Pedido",
                  `${buttonInfo.message}\n\n${buttonInfo.nextAction}${buttonInfo.requiresBusinessAction ? '\n\n⚠️ Se requiere que el negocio tome acción primero.' : ''}`,
                  [{ text: "Entendido" }]
                );
              }
            }}
            showStatusInfo={true}
          />
        </View>
      </View>
    );
  };

  const activeOrders = orders.filter((o: any) =>
    ["ready", "picked_up", "preparing", "on_the_way", "delivered"].includes(o.status)
  );
  const completedOrders = orders.filter((o: any) => o.status === "completed");

  const renderCompletedOrder = ({ item }: { item: any }) => {
    const displayAddress = parseDeliveryAddress(item.deliveryAddress);

    return (
      <View
        style={[styles.orderCard, { backgroundColor: theme.card, opacity: 0.8 }, Shadows.sm]}
      >
        <View style={styles.orderHeader}>
          <View>
            <ThemedText type="h4">{item.businessName}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Pedido #{item.id.slice(-8)}
            </ThemedText>
          </View>
          <Badge text="Entregado" variant="success" />
        </View>

        <View style={styles.locationInfo}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}
            numberOfLines={2}
          >
            {displayAddress}
          </ThemedText>
        </View>

        <View style={styles.orderFooter}>
          <ThemedText type="h4" style={{ color: ComeYaColors.success }}>
            +€{(item.deliveryEarnings || item.deliveryFee || 0).toFixed(2)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Completado
          </ThemedText>
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
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <ThemedText type="h2">Mis Entregas</ThemedText>
          {isTracking ? (
            <View style={styles.trackingIndicator}>
              <View style={styles.trackingDot} />
              <ThemedText type="small" style={{ color: ComeYaColors.success, marginLeft: Spacing.xs }}>
                GPS Activo
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {activeOrders.length > 0 ? (
          <>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Activas ({activeOrders.length})
            </ThemedText>
            {activeOrders.map((item: any) => (
              <View key={item.id}>{renderOrder({ item })}</View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="truck" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No tienes entregas activas
            </ThemedText>
          </View>
        )}

        {completedOrders.length > 0 && (
          <>
            <ThemedText type="h4" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
              Completadas ({completedOrders.length})
            </ThemedText>
            {completedOrders.map((item: any) => (
              <View key={item.id}>{renderCompletedOrder({ item })}</View>
            ))}
          </>
        )}
      </ScrollView>
      
      <ConfirmModal
        visible={showConfirmModal}
        title="Confirmar Entrega"
        message="¿El pedido fue entregado?"
        onConfirm={confirmDelivery}
        onCancel={cancelDelivery}
      />
      
      <ConfirmModal
        visible={showPickupModal}
        title="Confirmar Recogida"
        message="¿Ya recogiste el pedido?"
        onConfirm={confirmPickup}
        onCancel={() => { setShowPickupModal(false); setPickupOrderId(null); }}
      />

      <ConfirmModal
        visible={proximityError !== null}
        title="📍 Muy lejos del cliente"
        message={proximityError ? `Estás a ${proximityError.distanceMeters}m del cliente.\n\nDebes estar a menos de ${proximityError.maxDistanceMeters}m para marcar el pedido como entregado.` : ""}
        confirmText="Entendido"
        cancelText=""
        onConfirm={() => setProximityError(null)}
        onCancel={() => setProximityError(null)}
        variant="danger"
      />

      <ConfirmModal
        visible={gpsError}
        title="🛠️ GPS no disponible"
        message="No se pudo obtener tu ubicación GPS.\n\nActiva el GPS en los ajustes de tu dispositivo e inténtalo de nuevo."
        confirmText="Entendido"
        cancelText=""
        onConfirm={() => setGpsError(false)}
        onCancel={() => setGpsError(false)}
        variant="danger"
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ComeYaColors.success,
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
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  mapButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actions: {
    marginTop: Spacing.sm,
  },
  actionButton: {
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
