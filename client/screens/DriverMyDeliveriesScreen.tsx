import React, { useState, useEffect } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
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
  completed: "Cliente confirmó la recepción",
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
  const [showOnTheWayModal, setShowOnTheWayModal] = useState(false);
  const [onTheWayOrderId, setOnTheWayOrderId] = useState<string | null>(null);
  const [showCashTipModal, setShowCashTipModal] = useState(false);
  const [cashTipOrderId, setCashTipOrderId] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [proximityError, setProximityError] = useState<{
    distanceMeters: number;
    maxDistanceMeters: number;
    target: "cliente" | "negocio";
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

  // Flujo en DOS pasos: ready → picked_up (recoger) → on_the_way (iniciar
  // entrega) → delivered (foto + entregar)
  const updateStatus = async (orderId: string, targetStatus: string) => {
    console.log("updateStatus called:", orderId, targetStatus);
    const previousOrders = orders;
    setActionOrderId(orderId);

    // Optimistic update: mostrar el estado intermedio correcto
    const optimisticStatus =
      targetStatus === "picked_up"
        ? "picked_up"
        : targetStatus === "on_the_way"
          ? "on_the_way"
          : "delivered";
    setOrders((prev: any[]) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: optimisticStatus } : order,
      ),
    );

    try {
      let endpoint;
      let method: "POST" | "PUT" = "POST";
      let body: any = {};

      if (targetStatus === "picked_up") {
        // Paso 1: recoger el pedido en el local → picked_up. El servidor
        // exige estar cerca del NEGOCIO (geovalla): se obtiene GPS aquí y
        // los errores de distancia se muestran en un modal dedicado.
        let location: { latitude: number; longitude: number } | null = null;
        try {
          location = await gpsService.getCurrentLocation();
        } catch {}
        await completePickupWithLocation(orderId, location, previousOrders);
        setActionOrderId(null);
        return;
      } else if (targetStatus === "on_the_way") {
        // Paso 2: iniciar la entrega → on_the_way (el mapa del repartidor
        // cambia de destino automáticamente: local → cliente)
        endpoint = `/api/delivery/orders/${orderId}/status`;
        method = "PUT";
        body = { status: "on_the_way" };
      } else if (targetStatus === "delivered") {
        // Entregar pedido: on_the_way → delivered
        endpoint = `/api/orders/${orderId}/complete-delivery`;
      } else {
        throw new Error("Estado no permitido: " + targetStatus);
      }

      console.log("Using endpoint:", method, endpoint);
      await apiRequest(method as any, endpoint, body);

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

  // Recoger el pedido en el local con geovalla: el servidor exige estar a
  // menos de 250 m del negocio. Sin GPS, confirmación explícita (web).
  const completePickupWithLocation = async (
    orderId: string,
    location: { latitude: number; longitude: number } | null,
    previousOrders: any[],
  ) => {
    const attemptPickup = async (confirmWithoutGps: boolean) => {
      await apiRequest("POST", `/api/orders/${orderId}/pickup`, {
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        confirmWithoutGps,
      });
    };

    const extractError = (raw: string) => {
      let msg = raw;
      try {
        const jsonStart = raw.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(raw.slice(jsonStart));
          msg = parsed.error || raw;
        }
      } catch {}
      return msg;
    };

    try {
      await attemptPickup(false);
    } catch (error: any) {
      const rawMsg = error.message || "No se pudo confirmar la recogida";
      let distanceMeters: number | null = null;
      let maxDistanceMeters: number | null = null;
      try {
        const jsonStart = rawMsg.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(rawMsg.slice(jsonStart));
          distanceMeters = parsed.distanceMeters ?? null;
          maxDistanceMeters = parsed.maxDistanceMeters ?? null;
        }
      } catch {}

      if (distanceMeters !== null && maxDistanceMeters !== null) {
        // Muy lejos del NEGOCIO: no se puede recoger sin haber llegado
        setProximityError({
          distanceMeters,
          maxDistanceMeters,
          target: "negocio",
        });
        setOrders(previousOrders);
        return;
      }

      const msg = extractError(rawMsg);
      if (msg.toLowerCase().includes("ubicación")) {
        // Sin señal GPS: confirmación explícita y reintento sin geovalla
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "GPS no disponible",
            "No se pudo obtener tu ubicación. ¿Confirmar la recogida de todos modos?",
            [
              {
                text: "Cancelar",
                style: "cancel",
                onPress: () => resolve(false),
              },
              { text: "Sí, recogí el pedido", onPress: () => resolve(true) },
            ],
          );
        });
        if (!confirmed) {
          setOrders(previousOrders);
          return;
        }
        try {
          await attemptPickup(true);
        } catch (retryError: any) {
          setOrders(previousOrders);
          Alert.alert(
            "Error",
            extractError(retryError.message || "No se pudo confirmar la recogida"),
          );
          return;
        }
      } else {
        setOrders(previousOrders);
        Alert.alert("Error", msg);
        return;
      }
    }

    // Éxito real del servidor: estado recogido + confirmación en pantalla
    setOrders((prev: any[]) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: "picked_up" } : order,
      ),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Pedido recogido 📦",
      "Inicia la entrega cuando salgas del local con el pedido correcto.",
    );
    loadOrders();
  };

  const confirmPickup = () => {
    if (pickupOrderId) {
      updateStatus(pickupOrderId, "picked_up");
    }
    setShowPickupModal(false);
    setPickupOrderId(null);
  };

  const handleOnTheWay = (orderId: string) => {
    // Aviso explícito antes de iniciar la entrega (como Uber Eats): el
    // repartidor confirma que sale del local con el pedido correcto.
    setOnTheWayOrderId(orderId);
    setShowOnTheWayModal(true);
  };

  // Propina en efectivo: doble confirmación. El cliente la declara y el
  // repartidor confirma haberla recibido, o al revés. Solo con ambas partes
  // de acuerdo queda registrada en las ganancias (nunca toca la wallet).
  const respondCashTip = async (orderId: string, approved: boolean) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/cash-tip/respond`,
        { approved },
      );
      const data = await res.json();
      if (!data.success) {
        Alert.alert("Error", data.error || "No se pudo procesar la propina");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          approved ? "Propina registrada 💝" : "Propina rechazada",
          approved
            ? "La propina en efectivo quedó registrada en tus ganancias."
            : "La propina no se registrará.",
        );
      }
      loadOrders();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo procesar la propina");
    }
  };

  const declareCashTip = async (amountCents: number) => {
    if (!cashTipOrderId) return;
    try {
      const res = await apiRequest(
        "POST",
        `/api/orders/${cashTipOrderId}/cash-tip/declare`,
        { amount: amountCents },
      );
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Propina declarada",
          data.message || "El cliente debe confirmarla en su app.",
        );
      } else {
        Alert.alert("Error", data.error || "No se pudo declarar la propina");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo declarar la propina");
    }
    setShowCashTipModal(false);
    setCashTipOrderId(null);
    loadOrders();
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
        setProximityError({ distanceMeters, maxDistanceMeters, target: "cliente" });
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
              Pedido {displayOrderNumber(item)}
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
            orderStatus={
              item.status === "delivered" && item.confirmedByCustomer
                ? "completed"
                : item.status
            }
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
  // final de la entrega y sin ellos el pedido desaparecía de esta lista.
  // Los "delivered" con confirmación del cliente pasan a Completadas: antes
  // quedaban eternamente en "esperando confirmación" porque nadie escribía
  // el estado "completed".
  const activeOrders = orders.filter(
    (o: any) =>
      ["ready", "picked_up", "preparing", "on_the_way", "in_transit", "arriving", "delivered"].includes(
        o.status,
      ) && !(o.status === "delivered" && o.confirmedByCustomer),
  );
  const completedOrders = orders.filter(
    (o: any) =>
      o.status === "completed" ||
      (o.status === "delivered" && o.confirmedByCustomer),
  );

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
              Pedido {displayOrderNumber(item)}
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

        {/* Propina en efectivo pendiente declarada por el cliente */}
        {item.pendingCashTip?.declaredBy === "customer" && (
          <View
            style={{
              marginTop: Spacing.sm,
              backgroundColor: "#FFF8E1",
              borderRadius: BorderRadius.md,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: "#F59E0B",
            }}
          >
            <ThemedText
              type="small"
              style={{ color: "#B45309", fontWeight: "600" }}
            >
              💵 El cliente declaró una propina de{" "}
              {(item.pendingCashTip.amountCents / 100).toFixed(2)} € en
              efectivo
            </ThemedText>
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.sm,
              }}
            >
              <Pressable
                onPress={() => respondCashTip(item.id, true)}
                style={[
                  styles.trackButton,
                  { backgroundColor: ComeYaColors.success, flex: 1 },
                ]}
              >
                <ThemedText type="small" style={{ color: "#FFF" }}>
                  La recibí
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => respondCashTip(item.id, false)}
                style={[
                  styles.trackButton,
                  { backgroundColor: theme.backgroundSecondary, flex: 1 },
                ]}
              >
                <ThemedText type="small" style={{ color: theme.text }}>
                  No la recibí
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Sin propina pendiente: el repartidor puede declarar una propia */}
        {!item.pendingCashTip && (
          <Pressable
            onPress={() => {
              setCashTipOrderId(item.id);
              setShowCashTipModal(true);
            }}
            style={{
              marginTop: Spacing.sm,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Feather name="dollar-sign" size={14} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{ color: ComeYaColors.primary, marginLeft: 4 }}
            >
              Registrar propina en efectivo
            </ThemedText>
          </Pressable>
        )}
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
        message="Asegúrate de estar EN EL LOCAL y de tener el pedido en tus manos antes de confirmar. Solo puedes confirmar la recogida estando cerca del negocio."
        confirmText="Sí, recogí el pedido"
        onConfirm={confirmPickup}
        onCancel={() => {
          setShowPickupModal(false);
          setPickupOrderId(null);
        }}
      />

      <ConfirmModal
        visible={showOnTheWayModal}
        title="Iniciar Entrega"
        message="¿Saliste del local con el pedido correcto? Verifica que llevas todos los productos antes de iniciar la entrega."
        confirmText="Sí, iniciar entrega"
        onConfirm={() => {
          if (onTheWayOrderId) updateStatus(onTheWayOrderId, "on_the_way");
          setShowOnTheWayModal(false);
          setOnTheWayOrderId(null);
        }}
        onCancel={() => {
          setShowOnTheWayModal(false);
          setOnTheWayOrderId(null);
        }}
      />

      <ConfirmModal
        visible={proximityError !== null}
        title={
          proximityError?.target === "negocio"
            ? "📍 Muy lejos del negocio"
            : "📍 Muy lejos del cliente"
        }
        message={
          proximityError
            ? proximityError.target === "negocio"
              ? `Estás a ${proximityError.distanceMeters}m del negocio.\n\nDebes estar a menos de ${proximityError.maxDistanceMeters}m del local para confirmar la recogida.`
              : `Estás a ${proximityError.distanceMeters}m del cliente.\n\nDebes estar a menos de ${proximityError.maxDistanceMeters}m para marcar el pedido como entregado.`
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

      {/* Propina en efectivo: elegir importe (el cliente la valida luego) */}
      <Modal visible={showCashTipModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <Animated.View
            entering={ZoomIn.springify()}
            style={[styles.successCard, { backgroundColor: theme.card }]}
          >
            <ThemedText type="h3" style={{ textAlign: "center" }}>
              💵 Propina en efectivo
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              ¿El cliente te dio una propina en efectivo? Elige el importe y
              él la confirmará en su app para que quede registrada en tus
              ganancias.
            </ThemedText>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: Spacing.sm,
                justifyContent: "center",
                marginTop: Spacing.lg,
              }}
            >
              {[1, 2, 3, 4, 5].map((euros) => (
                <Pressable
                  key={euros}
                  onPress={() => declareCashTip(euros * 100)}
                  style={{
                    paddingHorizontal: Spacing.lg,
                    paddingVertical: Spacing.sm,
                    borderRadius: BorderRadius.full,
                    borderWidth: 2,
                    borderColor: ComeYaColors.primary,
                  }}
                >
                  <ThemedText
                    type="body"
                    style={{ color: ComeYaColors.primary, fontWeight: "600" }}
                  >
                    {euros} €
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => {
                setShowCashTipModal(false);
                setCashTipOrderId(null);
              }}
              style={{ marginTop: Spacing.lg, alignSelf: "center" }}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Cancelar
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
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
