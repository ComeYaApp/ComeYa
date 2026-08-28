import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { OrderProgressBar } from "@/components/OrderProgressBar";
import { CollapsibleMap } from "@/components/CollapsibleMap";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { useTheme } from "@/hooks/useTheme";
import { useDriverLocationSocket } from "@/hooks/useDriverLocationSocket";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { Order } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { displayOrderNumber, orderNumberLabel } from "@/utils/orderNumber";
import { printInvoiceNative } from "@/utils/invoice";
import { toCoord } from "@/utils/directions";
import {
  ISSUE_LABELS,
  ISSUE_STATUS_LABELS,
  RESOLUTION_LABELS,
} from "@shared/orderIssues";

type OrderTrackingRouteProp = RouteProp<RootStackParamList, "OrderTracking">;
type OrderTrackingNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "OrderTracking"
>;

const ORDERS_KEY = "@ComeYa_orders";
const { width } = Dimensions.get("window");

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

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<OrderTrackingRouteProp>();
  const navigation = useNavigation<OrderTrackingNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  // Incidencias que el cliente ha reportado sobre este pedido
  const [issues, setIssues] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [pickupInfo, setPickupInfo] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [businessLocation, setBusinessLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [businessAddressText, setBusinessAddressText] = useState<string | null>(
    null,
  );
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [driverVehicle, setDriverVehicle] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [businessCategories, setBusinessCategories] = useState<string | null>(
    null,
  );
  // La propina ya NO se ofrece durante el seguimiento: solo tras la entrega,
  // desde la pantalla de valoración del pedido.
  const [dynamicETA, setDynamicETA] = useState<{
    minutes: number;
    confidence: number;
  } | null>(null);

  // Cuenta atrás de la política de aceptación (10 min) — hook sin condiciones
  const [policyNow, setPolicyNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setPolicyNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Incidencias reportadas sobre este pedido: estado, resolución y fotos.
  // Refresca al volver de ReportIssueScreen (focus) para ver la nueva al momento.
  useEffect(() => {
    if (!orderId) return;
    const loadIssues = async () => {
      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}/issues`);
        const data = await response.json();
        if (data.success) setIssues(data.issues ?? []);
      } catch {
        // Sin incidencias o sin permiso: no bloquea la pantalla
      }
    };
    loadIssues();
    const unsub = navigation.addListener("focus", loadIssues);
    return unsub;
  }, [orderId, navigation]);

  // Poll for ETA updates every 30 seconds (en pickup el tiempo restante
  // viene de la info de pickup, no del repartidor)
  useEffect(() => {
    if (orderType === "pickup") return;
    const fetchETA = async () => {
      if (!orderId) return;
      try {
        const response = await apiRequest(
          "GET",
          `/api/tracking/eta/${orderId}`,
        );
        const data = await response.json();
        if (data.success && data.eta) {
          // Histéresis: no parpadear el número con cada poll — solo se
          // actualiza si cambia ≥1 minuto
          setDynamicETA((prev) => {
            const next = Math.round(Number(data.eta.minutes) || 0);
            if (!prev || Math.abs(prev.minutes - next) >= 1) {
              return { minutes: next, confidence: data.eta.confidence };
            }
            return prev;
          });
        }
      } catch (error) {
        console.log("ETA not available");
      }
    };

    fetchETA();
    const interval = setInterval(fetchETA, 30000);
    return () => clearInterval(interval);
  }, [orderId, orderType]);

  // Seguimiento en vivo del repartidor: WebSocket con fallback a polling
  // (solo pedidos delivery: en pickup no hay repartidor)
  const {
    location: socketLocation,
    connected: socketConnected,
    usingFallback: locationFallback,
  } = useDriverLocationSocket(orderType === "pickup" ? null : orderId, {
    fallbackIntervalMs: 5000,
  });

  useEffect(() => {
    if (!socketLocation) return;
    setDeliveryLocation({
      latitude: socketLocation.latitude,
      longitude: socketLocation.longitude,
    });
  }, [socketLocation]);

  // Fetch inicial inmediato (hasta que conecte el socket)
  useEffect(() => {
    if (orderType === "pickup" || !orderId) return;
    let cancelled = false;
    const fetchDeliveryLocation = async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/delivery/location/${orderId}`,
        );
        if (response.ok && !cancelled) {
          const data = await response.json();
          if (data.location) {
            // toCoord descarta NaN/0: coordenadas inválidas en el mapa
            // provocan un crash nativo en iOS
            const coord = toCoord(
              data.location.latitude,
              data.location.longitude,
            );
            if (coord) setDeliveryLocation(coord);
          }
        }
      } catch (error) {
        console.log("Delivery location not available for this order");
      }
    };
    fetchDeliveryLocation();
    return () => {
      cancelled = true;
    };
  }, [orderId, orderType]);

  // Cargar info de pickup y actualizar cada 30s
  useEffect(() => {
    if (orderType !== "pickup" || !orderId) return;

    const fetchPickupInfo = async () => {
      try {
        const response = await apiRequest("GET", `/api/pickup/${orderId}/info`);
        const data = await response.json();
        if (data.success) {
          setPickupInfo(data.pickup);
          setTimeRemaining(data.pickup.timeRemaining);
        }
      } catch (error) {
        console.log("Pickup info not available");
      }
    };

    fetchPickupInfo();
    const interval = setInterval(fetchPickupInfo, 30000);
    return () => clearInterval(interval);
  }, [orderId, orderType]);

  // Countdown timer - actualizar cada minuto
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev! > 0 ? prev! - 1 : 0));
    }, 60000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Request location permission + watch position
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      // Get immediate fix
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      // Watch for updates
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        (l) =>
          setUserLocation({
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
          }),
      );
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  // Ref para recargar el pedido tras acciones (confirmar entrega, etc.)
  const loadOrderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const response = await apiRequest("GET", `/api/orders/${orderId}`);
        const data = await response.json();
        if (data.order) {
          const apiOrder = data.order;
          const transformedOrder: Order = {
            id: apiOrder.id,
            orderNumber: apiOrder.orderNumber ?? undefined,
            userId: apiOrder.userId,
            businessId: apiOrder.businessId,
            businessName: apiOrder.businessName,
            businessImage: apiOrder.businessImage || "",
            items:
              typeof apiOrder.items === "string"
                ? JSON.parse(apiOrder.items)
                : apiOrder.items,
            status: apiOrder.status,
            // Sin estos campos el botón de confirmar reaparecía tras la
            // recogida y forzaba la transición a la reseña que crasheaba
            confirmedByCustomer: (apiOrder as any).confirmedByCustomer,
            hasReview: (apiOrder as any).hasReview,
            substitutionPreference: (apiOrder as any).substitutionPreference,
            itemSubstitutionPreferences: (apiOrder as any)
              .itemSubstitutionPreferences,
            scheduledFor: (apiOrder as any).scheduledFor,
            subtotal: apiOrder.subtotal / 100,
            productosBase: apiOrder.productosBase
              ? apiOrder.productosBase / 100
              : undefined,
            nemyCommission: apiOrder.nemyCommission
              ? apiOrder.nemyCommission / 100
              : undefined,
            deliveryFee: apiOrder.deliveryFee / 100,
            total: apiOrder.total / 100,
            paymentMethod: apiOrder.paymentMethod,
            deliveryAddress: parseDeliveryAddress(apiOrder.deliveryAddress),
            createdAt: apiOrder.createdAt,
            estimatedDelivery: apiOrder.estimatedDelivery,
            deliveryPersonId: apiOrder.deliveryPersonId,
            deliveryPersonName: apiOrder.deliveryPersonName,
            deliveryPersonPhone: apiOrder.deliveryPersonPhone,
          };
          setOrder(transformedOrder);
          setOrderType(apiOrder.orderType || "delivery");

          // Cargar ubicación real del negocio
          if (apiOrder.businessId) {
            try {
              const bizRes = await apiRequest(
                "GET",
                `/api/business/${apiOrder.businessId}`,
              );
              const bizData = await bizRes.json();
              const biz = bizData.business;
              if (biz?.latitude && biz?.longitude) {
                setBusinessLocation({
                  latitude: parseFloat(biz.latitude),
                  longitude: parseFloat(biz.longitude),
                });
              }
              if (biz?.address) setBusinessAddressText(biz.address);
              if (biz?.type) setBusinessType(biz.type);
              if (biz?.categories) setBusinessCategories(biz.categories);
            } catch {
              /* sin ubicación del negocio */
            }
          }

          // Vehículo del repartidor (para el icono del mapa)
          if (apiOrder.driverInfo?.vehicleType) {
            setDriverVehicle(apiOrder.driverInfo.vehicleType);
          }

          // Cargar foto del repartidor
          if (apiOrder.deliveryPersonId) {
            try {
              const driverRes = await apiRequest(
                "GET",
                `/api/users/${apiOrder.deliveryPersonId}`,
              );
              const driverData = await driverRes.json();
              if (driverData.user?.profilePicture) {
                setDriverPhoto(driverData.user.profilePicture);
              }
            } catch {
              /* sin foto del repartidor */
            }
          }
          return;
        }
      } catch (error: any) {
        console.error("Error loading order from API:", error);
        // Si la API falla, intentar recuperar el pedido del storage local
      }

      try {
        const stored = await AsyncStorage.getItem(ORDERS_KEY);
        const savedOrders: Order[] = stored ? JSON.parse(stored) : [];
        const foundOrder = savedOrders.find((o) => o.id === orderId);

        if (foundOrder) {
          setOrder(foundOrder);
        } else {
          // Pedido no disponible — no mostrar datos ficticios en producción
          setOrder(null);
        }
      } catch (error) {
        console.error("Error loading order from storage:", error);
        setOrder(null);
      }
    };

    loadOrder();
    loadOrderRef.current = loadOrder;

    // Poll for order updates every 30 seconds
    const interval = setInterval(loadOrder, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  /**
   * Programa el recordatorio de valoración 1 hora después de la entrega.
   * Antes la reseña se abría inmediatamente al confirmar y la app se cerraba.
   */
  const scheduleReviewReminder = async (
    reviewOrderId: string,
    businessName?: string,
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Notifications = await import("expo-notifications");
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== "granted") return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "¿Cómo fue tu pedido? ⭐",
          body: `Cuéntanos tu experiencia con ${businessName || "el negocio"}. Solo te llevará un momento.`,
          data: { orderId: reviewOrderId, screen: "OrderTracking" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 60 * 60,
        } as any,
      });
    } catch {
      // sin permisos o sin soporte — el botón "Valorar pedido" sigue disponible
    }
  };

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cleanPhone = phone.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  /** "Cómo llegar" al local: usa la navegación interna si hay coordenadas
   *  del negocio y, si no, abre Google Maps buscando por dirección.
   *  travelMode: coche o a pie (elegido en la tarjeta de recogida). */
  const handleNavigateToBusiness = (
    travelMode?: "driving" | "walking",
  ) => {
    if (businessLocation) {
      navigation.navigate("DriverNavigation", {
        destLat: businessLocation.latitude,
        destLng: businessLocation.longitude,
        destAddress:
          businessAddressText ||
          (order ? parseDeliveryAddress(order.deliveryAddress) : "") ||
          order?.businessName ||
          "Local",
        travelMode,
      });
      return;
    }
    const query = businessAddressText || order?.businessName;
    if (query) {
      const modeSuffix = travelMode === "walking" ? "&travelmode=walking" : "";
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${modeSuffix}`,
      ).catch(() => {});
    }
  };

  if (!order) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Seguimiento</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.notFound}>
          <ThemedText type="h3">Pedido no encontrado</ThemedText>
        </View>
      </View>
    );
  }

  const getStatusMinutes = (
    status: string,
  ): { min: number; max: number } | null => {
    switch (status) {
      case "pending":
        return { min: 35, max: 50 };
      case "accepted":
        return { min: 25, max: 40 };
      case "preparing":
        return { min: 15, max: 25 };
      case "picked_up":
      case "on_the_way":
      case "in_transit":
        return { min: 5, max: 15 };
      case "arriving":
        return { min: 1, max: 5 };
      case "delivered":
      case "cancelled":
        return null;
      default:
        return { min: 30, max: 45 };
    }
  };

  const etaRange = dynamicETA
    ? `${dynamicETA.minutes} min`
    : getStatusMinutes(order.status)
      ? `${getStatusMinutes(order.status)!.min}-${getStatusMinutes(order.status)!.max} min`
      : null;

  const estimatedTime = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // nemyCommission ya viene transformado a unidades (dividido entre 100)
  const nemyCommission = order.nemyCommission
    ? order.nemyCommission
    : order.subtotal * 0.15;

  // ── Política de aceptación: cuenta atrás derivada (hooks arriba) ─────────
  const isAwaitingAcceptance =
    order.status === "pending" || order.status === "payment_failed";
  const acceptanceDeadline = order.createdAt
    ? new Date(order.createdAt).getTime() + 10 * 60 * 1000
    : null;
  const acceptanceRemainingMs = acceptanceDeadline
    ? Math.max(0, acceptanceDeadline - policyNow)
    : null;
  const acceptanceRemainingLabel =
    acceptanceRemainingMs != null
      ? `${String(Math.floor(acceptanceRemainingMs / 60000)).padStart(2, "0")}:${String(
          Math.floor((acceptanceRemainingMs % 60000) / 1000),
        ).padStart(2, "0")}`
      : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Modal QR Code */}
      {pickupInfo && (pickupInfo.code || pickupInfo.qrCode) && (
        <QRCodeDisplay
          visible={showQR}
          code={pickupInfo.code || "—"}
          qrData={pickupInfo.qrCode}
          onClose={() => setShowQR(false)}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Seguimiento</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown Timer */}
        {dynamicETA && (
          <View
            style={[
              styles.statusCard,
              { backgroundColor: theme.card },
              Shadows.md,
            ]}
          >
            <View style={styles.businessRow}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: ComeYaColors.primary + "20" },
                ]}
              >
                <Feather name="clock" size={24} color={ComeYaColors.primary} />
              </View>
              <View style={styles.businessInfo}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {order.status === "pending"
                    ? "Esperando confirmación"
                    : order.status === "accepted"
                      ? "Pedido aceptado"
                      : order.status === "preparing"
                        ? "Preparando tu pedido"
                        : order.status === "picked_up" ||
                            order.status === "on_the_way" ||
                            order.status === "in_transit"
                          ? "En camino"
                          : order.status === "arriving"
                            ? "Llegando a tu dirección"
                            : order.status === "ready"
                              ? "Listo para recoger"
                              : "Procesando"}
                </ThemedText>
                <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
                  {dynamicETA.minutes} min
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Buscando repartidor - SOLO PARA DELIVERY */}
        {orderType === "delivery" && (order as any).searchingDriver && (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: ComeYaColors.warning + "15",
                borderWidth: 1,
                borderColor: ComeYaColors.warning,
              },
              Shadows.md,
            ]}
          >
            <View style={styles.businessRow}>
              <ActivityIndicator size="small" color={ComeYaColors.warning} />
              <View style={[styles.businessInfo, { marginLeft: Spacing.md }]}>
                <ThemedText type="h4" style={{ color: ComeYaColors.warning }}>
                  Buscando repartidor disponible...
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Esto puede tomar unos minutos
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Progress Bar */}
        {/* Política de aceptación: cuenta atrás de 10 min mientras el
            negocio no acepta (transparencia del reembolso automático) */}
        {isAwaitingAcceptance && acceptanceRemainingLabel && (
          <View style={styles.acceptanceNotice}>
            <Feather name="clock" size={16} color="#B45309" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText
                type="small"
                style={{ color: "#B45309", fontWeight: "700" }}
              >
                {acceptanceRemainingMs! > 0
                  ? `El negocio tiene ${acceptanceRemainingLabel} para aceptar tu pedido`
                  : "El plazo de aceptación ha finalizado"}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: "#92400E", marginTop: 2 }}
              >
                Si no lo acepta en 10 minutos, el pedido se cancela
                automáticamente y se te reembolsa el 100% del importe.
              </ThemedText>
            </View>
          </View>
        )}

        <OrderProgressBar status={order.status} orderType={orderType} />

        {/* Timer para Pickup */}
        {orderType === "pickup" &&
          pickupInfo &&
          order.status !== "delivered" && (
            <View
              style={[
                styles.timerCard,
                { backgroundColor: theme.card },
                Shadows.md,
              ]}
            >
              {order.status === "ready" ? (
                <>
                  <Feather
                    name="check-circle"
                    size={40}
                    color={ComeYaColors.success}
                  />
                  <ThemedText
                    type="h3"
                    style={{
                      color: ComeYaColors.success,
                      marginTop: Spacing.sm,
                    }}
                  >
                    ¡Tu pedido está listo!
                  </ThemedText>
                  <ThemedText
                    type="body"
                    style={{
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: Spacing.xs,
                    }}
                  >
                    Puedes venir a recogerlo cuando quieras
                  </ThemedText>
                  <Pressable
                    onPress={() => setShowQR(true)}
                    style={[
                      styles.codeContainer,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        marginTop: Spacing.lg,
                      },
                    ]}
                  >
                    <ThemedText
                      type="h1"
                      style={{ fontFamily: "monospace", letterSpacing: 4 }}
                    >
                      {pickupInfo.code}
                    </ThemedText>
                    <Feather
                      name="maximize"
                      size={20}
                      color={theme.textSecondary}
                      style={{ marginTop: Spacing.xs }}
                    />
                  </Pressable>
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginTop: Spacing.sm,
                    }}
                  >
                    Toca para ver QR Code
                  </ThemedText>
                </>
              ) : timeRemaining !== null && timeRemaining > 0 ? (
                <>
                  <View
                    style={[
                      styles.timerCircle,
                      { borderColor: ComeYaColors.primary },
                    ]}
                  >
                    <ThemedText
                      type="h1"
                      style={{ color: ComeYaColors.primary, fontSize: 36 }}
                    >
                      {timeRemaining}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary }}
                    >
                      minutos
                    </ThemedText>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${pickupInfo.progress}%`,
                          backgroundColor: ComeYaColors.primary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText
                    type="body"
                    style={{ color: theme.textSecondary, textAlign: "center" }}
                  >
                    Tiempo estimado restante
                  </ThemedText>
                  {pickupInfo.pendingBefore > 0 && (
                    <View
                      style={[
                        styles.queueBadge,
                        {
                          backgroundColor: ComeYaColors.warning + "20",
                          marginTop: Spacing.md,
                        },
                      ]}
                    >
                      <Feather
                        name="users"
                        size={16}
                        color={ComeYaColors.warning}
                      />
                      <ThemedText
                        type="small"
                        style={{
                          color: ComeYaColors.warning,
                          marginLeft: Spacing.xs,
                        }}
                      >
                        Hay {pickupInfo.pendingBefore} pedido
                        {pickupInfo.pendingBefore > 1 ? "s" : ""} antes del tuyo
                      </ThemedText>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Feather
                    name="clock"
                    size={40}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText type="h4" style={{ marginTop: Spacing.sm }}>
                    Preparando tu pedido
                  </ThemedText>
                </>
              )}
            </View>
          )}

        {/* Botón Ya Llegué */}
        {orderType === "pickup" &&
          order.status === "ready" &&
          !(order as any).customerArrivedAt && (
            <Pressable
              onPress={async () => {
                try {
                  await apiRequest("POST", `/api/pickup/${orderId}/arrived`);
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  Alert.alert(
                    "✅ Notificado",
                    "El negocio sabe que ya llegaste",
                  );
                } catch (error) {
                  Alert.alert("Error", "No se pudo notificar al negocio");
                }
              }}
              style={[
                styles.arrivedButton,
                { backgroundColor: ComeYaColors.primary },
                Shadows.md,
              ]}
            >
              <Feather name="map-pin" size={20} color="#FFF" />
              <ThemedText
                type="body"
                style={{
                  color: "#FFF",
                  marginLeft: Spacing.sm,
                  fontWeight: "600",
                }}
              >
                Ya Llegué al Local
              </ThemedText>
            </Pressable>
          )}

        <View
          style={[
            styles.statusCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <View style={styles.businessRow}>
            <Image
              source={
                order.businessImage
                  ? { uri: order.businessImage }
                  : require("../../assets/images/delivery-hero.png")
              }
              style={styles.businessImage}
              contentFit="cover"
            />
            <View style={styles.businessInfo}>
              <ThemedText type="h4">{order.businessName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Pedido {displayOrderNumber(order)}
              </ThemedText>
            </View>
            {dynamicETA ? (
              <View style={styles.etaContainer}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  ETA
                </ThemedText>
                <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
                  {etaRange}
                </ThemedText>
              </View>
            ) : order.status === "delivered" ? (
              <View style={styles.etaContainer}>
                <Feather name="check-circle" size={24} color="#4CAF50" />
                <ThemedText
                  type="caption"
                  style={{ color: "#4CAF50", marginTop: 4 }}
                >
                  Entregado
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Mapa - Diferente según orderType */}
        {orderType === "delivery" ? (
          <CollapsibleMap
            businessLocation={businessLocation || undefined}
            deliveryPersonLocation={deliveryLocation || undefined}
            customerLocation={userLocation || undefined}
            businessName={order.businessName}
            businessType={businessType || undefined}
            businessCategories={businessCategories || undefined}
            driverName={order.deliveryPersonName}
            driverPhoto={driverPhoto || undefined}
            driverVehicle={driverVehicle || undefined}
            eta={etaRange ?? undefined}
            status={order.status}
            onCallDriver={
              order.deliveryPersonPhone
                ? () => handleCall(order.deliveryPersonPhone!)
                : undefined
            }
          />
        ) : (
          <CollapsibleMap
            businessLocation={businessLocation || undefined}
            customerLocation={userLocation || undefined}
            businessName={order.businessName}
            businessType={businessType || undefined}
            businessCategories={businessCategories || undefined}
            status={order.status}
            isPickup={true}
            onNavigateInApp={handleNavigateToBusiness}
          />
        )}

        <View
          style={[
            styles.addressCard,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View style={styles.addressHeader}>
            <Feather
              name={orderType === "pickup" ? "shopping-bag" : "map-pin"}
              size={20}
              color={ComeYaColors.primary}
            />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {orderType === "pickup"
                ? "Dirección del negocio"
                : "Dirección de entrega"}
            </ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {order.deliveryAddress}
          </ThemedText>
          {orderType === "pickup" && order.status === "ready" && (
            <View
              style={{
                marginTop: Spacing.md,
                padding: Spacing.md,
                backgroundColor: ComeYaColors.success + "15",
                borderRadius: BorderRadius.sm,
              }}
            >
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.success, fontWeight: "600" }}
              >
                ✅ Tu pedido está listo para recoger
              </ThemedText>
            </View>
          )}
        </View>

        <View
          style={[
            styles.orderDetails,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Detalles del pedido
          </ThemedText>

          {/* Pedido programado: fecha pactada (facturación/seguimiento) */}
          {order.scheduledFor && (
            <View style={styles.acceptanceNotice}>
              <Feather name="clock" size={15} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{
                  color: ComeYaColors.primary,
                  marginLeft: Spacing.sm,
                  flex: 1,
                  fontWeight: "600",
                }}
              >
                🕒 Pedido programado para{" "}
                {new Date(order.scheduledFor).toLocaleString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
            </View>
          )}

          {/* Constancia de la política de indisponibilidad elegida */}
          {order.substitutionPreference &&
            order.substitutionPreference !== "refund" && (
              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  marginBottom: Spacing.sm,
                }}
              >
                Si algo no estaba disponible:{" "}
                {order.substitutionPreference === "call"
                  ? "pediste que te llamaran"
                  : order.substitutionPreference === "substitute"
                    ? "autorizaste sustituir por un producto similar"
                    : order.substitutionPreference}
              </ThemedText>
            )}

          {order.items &&
          Array.isArray(order.items) &&
          order.items.length > 0 ? (
            order.items.map((item, index) => {
              const itemName = item.product?.name || item.name || "Producto";
              // Los precios de los ítems viajan en CÉNTIMOS (misma unidad que
              // en el panel del negocio) — sin heurísticas de "si >1000…"
              const itemPrice = (item.product?.price || item.price || 0) / 100;
              const itemQty = item.quantity || 1;
              return (
                <View key={item.id || `item-${index}`} style={styles.itemRow}>
                  <ThemedText type="body">
                    {itemQty}x {itemName}
                  </ThemedText>
                  <ThemedText type="body">
                    {(itemPrice * itemQty).toFixed(2)} €
                  </ThemedText>
                </View>
              );
            })
          ) : (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No hay items en este pedido
            </ThemedText>
          )}
          <View style={[styles.totalSection, { borderTopColor: theme.border }]}>
            {orderType === "delivery" && (
              <View style={styles.itemRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Envío
                </ThemedText>
                <ThemedText type="small">
                  {order.deliveryFee.toFixed(2)} €
                </ThemedText>
              </View>
            )}
            <View style={styles.itemRow}>
              <ThemedText type="h4">Total</ThemedText>
              <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                {order.total.toFixed(2)} €
              </ThemedText>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Feather name="credit-card" size={16} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
            >
              {order.paymentMethod === "pago_movil"
                ? "Pago Móvil"
                : order.paymentMethod === "binance_pay"
                  ? "Binance Pay"
                  : order.paymentMethod === "zinli"
                    ? "Zinli"
                    : order.paymentMethod === "zelle"
                      ? "Zelle"
                      : order.paymentMethod === "paypal"
                        ? "PayPal"
                        : order.paymentMethod === "cash"
                          ? "Efectivo"
                          : "Tarjeta"}
            </ThemedText>
          </View>

          {/* Factura descargable (PDF) */}
          {["delivered", "completed", "cancelled", "refunded"].includes(
            order.status,
          ) && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                printInvoiceNative(order).then((ok) => {
                  if (!ok)
                    Alert.alert(
                      "Factura",
                      "No se pudo generar la factura. Inténtalo de nuevo.",
                    );
                });
              }}
              style={[
                styles.invoiceButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            >
              <Feather name="file-text" size={15} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, fontWeight: "600", marginLeft: 6 }}
              >
                Descargar factura (PDF)
              </ThemedText>
            </Pressable>
          )}
        </View>

        {order.status === "delivered" &&
        !(order as any).confirmedByCustomer &&
        user?.role === "customer" ? (
          <Pressable
            onPress={async () => {
              Alert.alert(
                "✅ Confirmar entrega",
                "¿Recibiste tu pedido correctamente?",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Sí, lo recibí",
                    onPress: async () => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        const res = await apiRequest(
                          "POST",
                          `/api/fund-release/confirm-delivery`,
                          { orderId: order.id },
                        );
                        const data = await res.json();
                        if (data.success) {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success,
                          );
                          // La reseña ya NO se pide en el momento (provocaba
                          // cierres de la app): se agradece y se programa un
                          // recordatorio local 1 hora después
                          scheduleReviewReminder(
                            order.id,
                            order.businessName,
                          );
                          Alert.alert(
                            "¡Gracias! 🎉",
                            "Entrega confirmada. En unos minutos podrás valorar tu experiencia desde este pedido o desde Mis Pedidos.",
                            [
                              {
                                text: "OK",
                                onPress: () => loadOrderRef.current?.(),
                              },
                            ],
                          );
                        } else {
                          Alert.alert(
                            "Error",
                            data.error || "No se pudo confirmar la entrega",
                          );
                        }
                      } catch (error: any) {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Error,
                        );
                        Alert.alert(
                          "Error",
                          error.message || "No se pudo confirmar la entrega",
                        );
                      }
                    },
                  },
                ],
              );
            }}
            style={[
              styles.confirmButton,
              { backgroundColor: ComeYaColors.success },
              Shadows.md,
            ]}
          >
            <Feather name="check-circle" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{
                color: "#FFFFFF",
                marginLeft: Spacing.sm,
                fontWeight: "600",
              }}
            >
              Confirmar que recibí mi pedido
            </ThemedText>
          </Pressable>
        ) : order.status === "delivered" &&
          (order as any).confirmedByCustomer &&
          user?.role === "customer" ? (
          <View>
            <View style={[styles.confirmButton, { backgroundColor: "#E8F5E9" }]}>
              <Feather name="check-circle" size={20} color="#4CAF50" />
              <ThemedText
                type="body"
                style={{
                  color: "#4CAF50",
                  marginLeft: Spacing.sm,
                  fontWeight: "600",
                }}
              >
                Entrega confirmada ✔
              </ThemedText>
            </View>
            {(order as any).hasReview ? (
              <View
                style={[
                  styles.confirmButton,
                  { backgroundColor: "#FFD70022", marginTop: Spacing.sm },
                ]}
              >
                <Feather name="star" size={20} color="#FFD700" />
                <ThemedText
                  type="body"
                  style={{
                    color: "#B8860B",
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Pedido valorado
                </ThemedText>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // allowTip: la propina al repartidor se ofrece SOLO tras la
                  // entrega confirmada (como en la web) — antes nunca salía
                  // la pregunta en la app nativa
                  navigation.replace("Review", {
                    orderId: order.id,
                    businessId: order.businessId,
                    businessName: order.businessName,
                    deliveryPersonId: order.deliveryPersonId,
                    allowTip: true,
                  });
                }}
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: ComeYaColors.primary,
                    marginTop: Spacing.sm,
                  },
                  Shadows.md,
                ]}
              >
                <Feather name="star" size={20} color="#FFFFFF" />
                <ThemedText
                  type="body"
                  style={{
                    color: "#FFFFFF",
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Valorar pedido
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : null}

        {order.status !== "cancelled" && (
          <>
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                try {
                  const response = await apiRequest(
                    "POST",
                    `/api/gps/tracking-token/${order.id}`,
                  );
                  const data = await response.json();
                  if (!data.success || !data.trackingUrl) {
                    throw new Error(
                      data.error || "No se pudo generar el enlace",
                    );
                  }
                  await Share.share({
                    message: `Sigue mi pedido en vivo 🛵 ${data.trackingUrl}`,
                    url: data.trackingUrl,
                  });
                } catch (e: any) {
                  Alert.alert(
                    "Error",
                    e?.message || "No se pudo compartir el seguimiento",
                  );
                }
              }}
              style={[styles.reportButton, { borderColor: theme.border, marginBottom: Spacing.sm }]}
            >
              <Feather name="share-2" size={18} color={ComeYaColors.primary} />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, color: theme.text }}
              >
                Compartir seguimiento en vivo
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (user?.role === "delivery_driver") {
                  // El repartidor va a soporte general, no al reporte de pedido de cliente
                  navigation.navigate("Support");
                } else {
                  navigation.navigate("ReportIssue", {
                    orderId: order.id,
                    orderNumber: orderNumberLabel(order),
                  });
                }
              }}
              style={[styles.reportButton, { borderColor: theme.border }]}
            >
              <Feather
                name="alert-circle"
                size={18}
                color={ComeYaColors.warning}
              />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}
              >
                Reportar incidencia
              </ThemedText>
            </Pressable>

            {issues.length > 0 && (
              <View
                style={[
                  styles.issuesBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <ThemedText type="h4" style={{ marginBottom: 10 }}>
                  Tus incidencias reportadas
                </ThemedText>
                {issues.map((issue: any) => {
                  const statusColor =
                    issue.status === "resolved"
                      ? ComeYaColors.success
                      : issue.status === "rejected"
                        ? "#9E9E9E"
                        : issue.status === "in_review"
                          ? ComeYaColors.warning
                          : "#3B82F6";
                  const photos: string[] = Array.isArray(issue.photos)
                    ? issue.photos
                    : [];
                  return (
                    <View
                      key={issue.id}
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        paddingTop: 10,
                        marginTop: 4,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 4,
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: statusColor + "20",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 10,
                          }}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: statusColor, fontWeight: "700" }}
                          >
                            {ISSUE_STATUS_LABELS[issue.status] ?? issue.status}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="caption"
                          style={{ color: theme.textSecondary, marginLeft: "auto" }}
                        >
                          {new Date(issue.createdAt).toLocaleDateString("es-ES")}
                        </ThemedText>
                      </View>

                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {ISSUE_LABELS[issue.issueType] ?? issue.issueType}
                      </ThemedText>

                      {photos.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginTop: 8 }}
                        >
                          {photos.map((p, i) => (
                            <Image
                              key={i}
                              source={{ uri: p }}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 8,
                                marginRight: 6,
                              }}
                            />
                          ))}
                        </ScrollView>
                      )}

                      {issue.status === "resolved" && (
                        <View
                          style={{
                            backgroundColor: ComeYaColors.success + "12",
                            borderRadius: 10,
                            padding: 10,
                            marginTop: 8,
                          }}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: ComeYaColors.success, fontWeight: "700" }}
                          >
                            ✓{" "}
                            {RESOLUTION_LABELS[issue.resolutionType] ??
                              issue.resolutionType}
                            {issue.resolutionAmount
                              ? ` — ${(issue.resolutionAmount / 100).toFixed(2)} € devueltos`
                              : ""}
                          </ThemedText>
                          {issue.customerMessage && (
                            <ThemedText
                              type="caption"
                              style={{ marginTop: 4, color: theme.textSecondary }}
                            >
                              {issue.customerMessage}
                            </ThemedText>
                          )}
                        </View>
                      )}

                      {issue.status === "rejected" && issue.customerMessage && (
                        <ThemedText
                          type="caption"
                          style={{ marginTop: 6, color: theme.textSecondary }}
                        >
                          {issue.customerMessage}
                        </ThemedText>
                      )}

                      {issue.ticketId && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            navigation.navigate("TicketDetail", {
                              ticketId: issue.ticketId,
                            });
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 8,
                          }}
                        >
                          <Feather
                            name="message-circle"
                            size={14}
                            color={ComeYaColors.primary}
                          />
                          <ThemedText
                            type="caption"
                            style={{
                              marginLeft: 6,
                              color: ComeYaColors.primary,
                              fontWeight: "600",
                            }}
                          >
                            Ver conversación con soporte
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  acceptanceNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  statusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  businessRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  businessImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  businessInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  etaContainer: {
    alignItems: "flex-end",
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  mapContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  addressCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderDetails: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  totalSection: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  invoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  issuesBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  timerCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: Spacing.md,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  queueBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  codeContainer: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  arrivedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
