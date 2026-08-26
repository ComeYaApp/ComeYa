import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { gpsService } from "@/services/gpsService";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { SmartOrderButton } from "@/components/SmartOrderButton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const statusLabels: Record<string, string> = {
  ready: "Listo para recoger",
  picked_up: "Recogido",
  preparing: "Preparando",
  on_the_way: "En camino",
  in_transit: "En tránsito",
  arriving: "Llegando al cliente",
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
  const [proximityError, setProximityError] = useState<{
    distanceMeters: number;
    maxDistanceMeters: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [deliveryPhotoUri, setDeliveryPhotoUri] = useState<string | null>(null);
  const [pendingDeliveryOrderId, setPendingDeliveryOrderId] = useState<
    string | null
  >(null);
  const [completedOrder, setCompletedOrder] = useState<{
    earnings: number;
    businessName: string;
  } | null>(null);

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

  // Entregas logísticas (Plan Logística Local B2B)
  const [logistics, setLogistics] = useState<any[]>([]);

  const loadLogistics = async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery-requests/driver-mine");
      const data = await res.json();
      setLogistics(data.requests || []);
    } catch {}
  };

  useEffect(() => {
    loadLogistics();
  }, []);

  const completeLogistics = async (id: string) => {
    try {
      const res = await apiRequest("POST", `/api/delivery-requests/${id}/complete`);
      const data = await res.json();
      if (data.success) {
        Alert.alert("Entregado", "Entrega logística completada.");
        loadLogistics();
      } else {
        Alert.alert("Error", data.error || "No se pudo completar");
      }
    } catch {
      Alert.alert("Error", "No se pudo completar la entrega");
    }
  };

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
      [
        "preparing",
        "ready",
        "picked_up",
        "on_the_way",
        "in_transit",
        "arriving",
      ].includes(o.status),
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

  // Flujo unificado: ready/accepted → on_the_way (pickup) → delivered (complete-delivery)
  const updateStatus = async (orderId: string, targetStatus: string) => {
    console.log("updateStatus called:", orderId, targetStatus);
    const previousOrders = orders;
    setActionOrderId(orderId);
    
    // Optimistic update: mostrar el estado intermedio correcto
    const optimisticStatus = targetStatus === "on_the_way" ? "on_the_way" : "delivered";
    setOrders((prev: any[]) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: optimisticStatus } : order,
      ),
    );
    
    try {
      let endpoint;
      const method = "POST";

      // Flujo unificado: solo dos transiciones para el driver
      if (targetStatus === "on_the_way") {
        // Recoger pedido: ready/accepted/preparing → on_the_way
        endpoint = `/api/orders/${orderId}/pickup`;
      } else if (targetStatus === "delivered") {
        // Entregar pedido: on_the_way → delivered
        endpoint = `/api/orders/${orderId}/complete-delivery`;
      } else {
        throw new Error("Estado no permitido: " + targetStatus);
      }

      console.log("Using endpoint:", method, endpoint);
      await apiRequest(method as any, endpoint, {});

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadOrders();
    } catch (error) {
      console.error("Error updating status:", error);
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
      updateStatus(pickupOrderId, "on_the_way");
    }
    setShowPickupModal(false);
    setPickupOrderId(null);
  };

  const handleOnTheWay = (orderId: string) => {
    updateStatus(orderId, "on_the_way");
  };

  const handleDelivered = async (orderId: string) => {
    setPendingDeliveryOrderId(orderId);
    setDeliveryPhotoUri(null);
    setPhotoModalVisible(true);
  };

  const pickDeliveryPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Cámara requerida",
        "Necesitas dar permiso de cámara para tomar la foto de entrega.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setDeliveryPhotoUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const confirmDeliveryWithPhoto = async () => {
    if (!deliveryPhotoUri) {
      Alert.alert(
        "Foto requerida",
        "Debes tomar una foto de la entrega para continuar.",
      );
      return;
    }
    if (!pendingDeliveryOrderId) return;
    setPhotoModalVisible(false);
    setPendingOrderId(pendingDeliveryOrderId);
    setShowConfirmModal(true);
  };

  const confirmDelivery = async () => {
    if (pendingOrderId) {
      const previousOrders = orders;
      const orderBeingDelivered = orders.find(
        (o: any) => o.id === pendingOrderId,
      );

      try {
        setActionOrderId(pendingOrderId);
        const location = await gpsService.getCurrentLocation();
        await completeDeliveryWithLocation(
          pendingOrderId,
          location,
          previousOrders,
          deliveryPhotoUri,
          orderBeingDelivered,
        );
      } catch (error) {
        console.error("Error in confirmDelivery:", error);
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
    previousOrders: any[],
    photoUri: string | null = null,
    orderData: any = null,
  ) => {
    try {
      // Convertir foto a base64 si existe
      let photoBase64: string | null = null;
      if (photoUri) {
        try {
          const FileSystem = await import("expo-file-system/legacy");
          const encoding =
            (FileSystem as any)?.EncodingType?.Base64 || "base64";
          const base64 = await (FileSystem as any).readAsStringAsync(photoUri, {
            encoding,
          });
          const ext = photoUri.split(".").pop()?.toLowerCase() || "jpg";
          photoBase64 = `data:image/${ext === "png" ? "png" : "jpeg"};base64,${base64}`;
        } catch {
          photoBase64 = null;
        }
      }

      const attemptComplete = async (confirmWithoutGps: boolean) => {
        await apiRequest("POST", `/api/orders/${orderId}/complete-delivery`, {
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          deliveryPhoto: photoBase64,
          confirmWithoutGps,
        });
      };

      try {
        await attemptComplete(false);
      } catch (error: any) {
        let msg = error.message || "No se pudo confirmar la entrega";
        try {
          const jsonStart = msg.indexOf("{");
          if (jsonStart !== -1) {
            const parsed = JSON.parse(msg.slice(jsonStart));
            msg = parsed.error || msg;
          }
        } catch {}
        if (msg.toLowerCase().includes("ubicación")) {
          // Sin señal GPS: confirmación explícita y reintento sin GPS
          const confirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "GPS no disponible",
              "No se pudo obtener tu ubicación. ¿Marcar el pedido como entregado de todos modos?",
              [
                {
                  text: "Cancelar",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                { text: "Sí, lo entregué", onPress: () => resolve(true) },
              ],
            );
          });
          if (!confirmed) {
            setOrders(previousOrders);
            return;
          }
          await attemptComplete(true);
        } else {
          throw error;
        }
      }

      // Marcar entregado solo tras éxito real del servidor
      setOrders((prev: any[]) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: "delivered" } : order,
        ),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Mostrar pantalla post-entrega
      setCompletedOrder({
        earnings:
          (orderData?.deliveryEarnings || orderData?.deliveryFee || 0) / 100,
        businessName: orderData?.businessName || "Pedido",
      });
      loadOrders();
    } catch (error: any) {
      console.error("Error confirming delivery:", error);
      let msg = error.message || "No se pudo confirmar la entrega";
      let distanceMeters: number | null = null;
      let maxDistanceMeters: number | null = null;
      try {
        const jsonStart = msg.indexOf("{");
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
    console.log("User cancelled delivery confirmation");
    setShowConfirmModal(false);
    setPendingOrderId(null);
  };

  const parseDeliveryAddress = (address: string | null): string => {
    if (!address) return "Dirección no disponible";
    try {
      const parsed = JSON.parse(address);
      if (typeof parsed === "object") {
        const parts = [
          parsed.street,
          parsed.city,
          parsed.state,
          parsed.zipCode,
        ].filter(Boolean);
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

  const getOrderCoordinates = (
    order: any,
  ): { lat: number | null; lng: number | null } => {
    const lat =
      [
        order.deliveryLatitude,
        order.deliveryLat,
        order.latitude,
        order.delivery_latitude,
      ]
        .map(parseCoordinate)
        .find((value) => value !== null) ?? null;

    const lng =
      [
        order.deliveryLongitude,
        order.deliveryLng,
        order.longitude,
        order.delivery_longitude,
      ]
        .map(parseCoordinate)
        .find((value) => value !== null) ?? null;

    return { lat, lng };
  };

  const getBusinessCoordinates = (
    order: any,
  ): { lat: number | null; lng: number | null } => {
    const lat =
      [order.businessLatitude, order.businessLat]
        .map(parseCoordinate)
        .find((value) => value !== null) ?? null;
    const lng =
      [order.businessLongitude, order.businessLng]
        .map(parseCoordinate)
        .find((value) => value !== null) ?? null;
    return { lat, lng };
  };

  /** Navega al destino del pedido según su estado:
   *  - Aceptado/preparando/listo → ir al LOCAL a recoger (coords del negocio)
   *  - Recogido/en camino → ir a la dirección de ENTREGA del cliente
   *  Si faltan coordenadas, abre Google Maps buscando por dirección. */
  const showNavigationOptions = (order: any) => {
    const goingToBusiness = ["accepted", "preparing", "ready"].includes(
      order.status,
    );
    const { lat, lng } = goingToBusiness
      ? getBusinessCoordinates(order)
      : getOrderCoordinates(order);
    const address = goingToBusiness
      ? order.businessAddress || order.businessName || ""
      : parseDeliveryAddress(order.deliveryAddress);

    if (lat === null || lng === null) {
      if (address) {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        ).catch(() => {});
        return;
      }
      Alert.alert(
        "Sin datos de navegación",
        "Este pedido no tiene coordenadas ni dirección guardadas. Contacta con el negocio.",
      );
      return;
    }

    navigation.navigate("DriverNavigation", {
      destLat: lat,
      destLng: lng,
      destAddress: address,
    });
  };

  const renderOrder = ({ item }: { item: any }) => {
    const items =
      typeof item.items === "string" ? JSON.parse(item.items) : item.items;
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
                    ? "success"
                    : "secondary"
            }
          />
        </View>

        <View style={styles.locationInfo}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              marginLeft: Spacing.xs,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {displayAddress}
          </ThemedText>
        </View>

        <View style={styles.orderFooter}>
          <ThemedText type="h4" style={{ color: ComeYaColors.success }}>
            +€
            {((item.deliveryEarnings || item.deliveryFee || 0) / 100).toFixed(
              2,
            )}
          </ThemedText>
          <View style={styles.mapButtons}>
            <Pressable
              onPress={() =>
                navigation.navigate("OrderTracking", { orderId: item.id })
              }
              style={[
                styles.trackButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="map" size={14} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginLeft: 4 }}
              >
                Ver
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                // Contacto con el cliente vía WhatsApp (teléfono viene del
                // perfil del cliente vía /api/delivery/my-orders)
                const digits = String(
                  (item as any).customerPhone || "",
                ).replace(/\D/g, "");
                // wa.me exige código de país: 9 dígitos starting 6/7/9 → España
                const phone =
                  digits.length === 9 && /^[679]/.test(digits)
                    ? `34${digits}`
                    : digits;
                if (phone) {
                  Linking.openURL(`https://wa.me/${phone}`).catch(() => {});
                } else {
                  Alert.alert(
                    "Sin teléfono",
                    "Este pedido no tiene teléfono de contacto del cliente.",
                  );
                }
              }}
              style={[
                styles.trackButton,
                { backgroundColor: "#25D366", marginLeft: Spacing.xs },
              ]}
            >
              <Feather name="message-circle" size={14} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: 4 }}
              >
                WhatsApp
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => showNavigationOptions(item)}
              style={[
                styles.trackButton,
                {
                  backgroundColor: ComeYaColors.primary,
                  marginLeft: Spacing.xs,
                },
              ]}
            >
              <Feather name="navigation" size={14} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: 4 }}
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
                  case "ready":
                    handlePickedUp(item.id);
                    break;
                  case "picked_up":
                  case "preparing":
                    handleOnTheWay(item.id);
                    break;
                  case "on_the_way":
                  case "in_transit":
                  case "arriving":
                    handleDelivered(item.id);
                    break;
                  default:
                    Alert.alert(
                      "Información",
                      `${buttonInfo.message}\n\n${buttonInfo.nextAction}`,
                      [{ text: "OK" }],
                    );
                }
              } else {
                Alert.alert(
                  "Estado del Pedido",
                  `${buttonInfo.message}\n\n${buttonInfo.nextAction}${buttonInfo.requiresBusinessAction ? "\n\n⚠️ Se requiere que el negocio tome acción primero." : ""}`,
                  [{ text: "Entendido" }],
                );
              }
            }}
            showStatusInfo={true}
          />
        </View>
      </View>
    );
  };

  // "arriving" e "in_transit" DEBEN estar: el pipeline los usa en el tramo
  // final de la entrega y sin ellos el pedido desaparecía de esta lista
  const activeOrders = orders.filter((o: any) =>
    [
      "ready",
      "picked_up",
      "preparing",
      "on_the_way",
      "in_transit",
      "arriving",
      "delivered",
    ].includes(o.status),
  );
  const completedOrders = orders.filter((o: any) => o.status === "completed");

  const renderLogisticsSection = () => {
    const activeLogistics = logistics.filter(
      (l) => l.status === "accepted" || l.status === "picked_up",
    );
    if (!activeLogistics.length) return null;
    return (
      <View style={{ marginBottom: Spacing.lg }}>
        <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
          📦 Entregas de comercios
        </ThemedText>
        {activeLogistics.map((l: any) => (
          <View
            key={l.id}
            style={[
              styles.orderCard,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <ThemedText type="h4">{l.businessName}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {l.pickupAddress} → {l.dropoffAddress}
            </ThemedText>
            <Pressable
              onPress={() => completeLogistics(l.id)}
              style={[
                styles.trackButton,
                { backgroundColor: ComeYaColors.success, marginTop: Spacing.sm },
              ]}
            >
              <Feather name="check" size={14} color="#FFF" />
              <ThemedText
                type="small"
                style={{ color: "#FFF", marginLeft: 4 }}
              >
                Marcar entregado (3,50 €)
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </View>
    );
  };

  const renderCompletedOrder = ({ item }: { item: any }) => {
    const displayAddress = parseDeliveryAddress(item.deliveryAddress);

    return (
      <View
        style={[
          styles.orderCard,
          { backgroundColor: theme.card, opacity: 0.8 },
          Shadows.sm,
        ]}
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
            style={{
              color: theme.textSecondary,
              marginLeft: Spacing.xs,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {displayAddress}
          </ThemedText>
        </View>

        <View style={styles.orderFooter}>
          <ThemedText type="h4" style={{ color: ComeYaColors.success }}>
            +€
            {((item.deliveryEarnings || item.deliveryFee || 0) / 100).toFixed(
              2,
            )}
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
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Pantalla post-entrega tipo Rappi */}
      {completedOrder && (
        <Modal visible transparent animationType="fade">
          <View style={styles.successOverlay}>
            <Animated.View
              entering={ZoomIn.springify()}
              style={styles.successCard}
            >
              <View style={styles.successIconCircle}>
                <Feather name="check-circle" size={56} color="#4CAF50" />
              </View>
              <ThemedText
                type="h2"
                style={{ color: "#1B5E20", marginTop: 16, textAlign: "center" }}
              >
                ¡Entrega completada!
              </ThemedText>
              <ThemedText
                type="body"
                style={{ color: "#388E3C", marginTop: 8, textAlign: "center" }}
              >
                {completedOrder.businessName}
              </ThemedText>
              <View style={styles.earningsBadge}>
                <ThemedText
                  type="h1"
                  style={{ color: "#4CAF50", fontSize: 40 }}
                >
                  +{completedOrder.earnings.toFixed(2)} €
                </ThemedText>
                <ThemedText type="small" style={{ color: "#388E3C" }}>
                  ganados
                </ThemedText>
              </View>
              <ThemedText
                type="caption"
                style={{ color: "#666", textAlign: "center", marginBottom: 24 }}
              >
                El cliente recibirá una notificación para confirmar la
                recepción.
              </ThemedText>
              <Pressable
                onPress={() => setCompletedOrder(null)}
                style={styles.successButton}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Continuar
                </ThemedText>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Modal foto de entrega */}
      <Modal visible={photoModalVisible} transparent animationType="slide">
        <View style={styles.photoModalOverlay}>
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.photoModalCard, { backgroundColor: theme.card }]}
          >
            <View style={styles.photoModalHeader}>
              <ThemedText type="h3">Foto de entrega</ThemedText>
              <Pressable onPress={() => setPhotoModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginBottom: 16 }}
            >
              Toma una foto del pedido entregado. Es obligatoria para confirmar
              la entrega.
            </ThemedText>

            {deliveryPhotoUri ? (
              <Pressable onPress={pickDeliveryPhoto}>
                <Image
                  source={{ uri: deliveryPhotoUri }}
                  style={styles.photoPreview}
                  contentFit="cover"
                />
                <ThemedText
                  type="small"
                  style={{
                    color: ComeYaColors.primary,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  Toca para cambiar foto
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={pickDeliveryPhoto}
                style={[styles.photoPlaceholder, { borderColor: theme.border }]}
              >
                <Feather name="camera" size={40} color={theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: 12 }}
                >
                  Tomar foto
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  Obligatoria para confirmar entrega
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={confirmDeliveryWithPhoto}
              disabled={!deliveryPhotoUri}
              style={[
                styles.confirmPhotoButton,
                {
                  backgroundColor: deliveryPhotoUri
                    ? "#4CAF50"
                    : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={18}
                color={deliveryPhotoUri ? "#FFF" : theme.textSecondary}
              />
              <ThemedText
                type="body"
                style={{
                  color: deliveryPhotoUri ? "#FFF" : theme.textSecondary,
                  marginLeft: 8,
                  fontWeight: "700",
                }}
              >
                Confirmar entrega
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <ThemedText type="h2">Mis Entregas</ThemedText>
          {isTracking ? (
            <View style={styles.trackingIndicator}>
              <View style={styles.trackingDot} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.success, marginLeft: Spacing.xs }}
              >
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
        {renderLogisticsSection()}

        {completedOrders.length > 0 && (
          <>
            <ThemedText
              type="h4"
              style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
            >
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
        title="Marcar como entregado"
        message="¿Ya entregaste el pedido al cliente? El cliente recibirá una notificación para confirmar la recepción y liberar tu pago."
        confirmText="Sí, lo entregué"
        onConfirm={confirmDelivery}
        onCancel={cancelDelivery}
      />

      <ConfirmModal
        visible={showPickupModal}
        title="Confirmar Recogida"
        message="¿Ya recogiste el pedido?"
        onConfirm={confirmPickup}
        onCancel={() => {
          setShowPickupModal(false);
          setPickupOrderId(null);
        }}
      />

      <ConfirmModal
        visible={proximityError !== null}
        title="📍 Muy lejos del cliente"
        message={
          proximityError
            ? `Estás a ${proximityError.distanceMeters}m del cliente.\n\nDebes estar a menos de ${proximityError.maxDistanceMeters}m para marcar el pedido como entregado.`
            : ""
        }
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
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  successCard: {
    backgroundColor: "#F1F8E9",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  earningsBadge: {
    alignItems: "center",
    marginVertical: 20,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  successButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  photoModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  photoModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
});
