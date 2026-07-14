import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

const PRIMARY = "#DC2626";

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function loadGoogleMaps(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("gmap-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const key = await fetch(
      (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api/config/maps-key",
    )
      .then((r) => r.json())
      .then((d) => d.key)
      .catch(() => "");
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  confirmed: {
    label: "Pedido confirmado",
    color: "#3B82F6",
    icon: "check-circle",
  },
  preparing: {
    label: "Preparando tu pedido",
    color: "#8B5CF6",
    icon: "package",
  },
  ready: {
    label: "Listo para recoger",
    color: "#10B981",
    icon: "check-square",
  },
  on_the_way: {
    label: "En camino 🛵",
    color: ComeYaColors.success,
    icon: "truck",
  },
  delivered: { label: "Entregado ✓", color: "#4CAF50", icon: "check-circle" },
};

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
];

export default function OrderTrackingScreen() {
  const route = useRoute() as any;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const orderId = route.params?.orderId;

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);
  const [dynamicETA, setDynamicETA] = useState<{
    minutes: number;
    confidence: number;
  } | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [businessLocation, setBusinessLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const { user } = useAuth();
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [tipSent, setTipSent] = useState(false);
  const [sendingTip, setSendingTip] = useState(false);

  const businessMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const driverRouteLineRef = useRef<any>(null);

  const tipOptions = [10, 20, 30, 50];

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  // Cargar pedido con toda la info
  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      try {
        const res = await apiRequest("GET", `/api/orders/${orderId}`);
        const data = await res.json();
        const apiOrder = data.order || data;

        // Extraer lat/lng del JSON de delivery_address si los campos separados son null
        if (
          (!apiOrder.deliveryLatitude || !apiOrder.deliveryLongitude) &&
          apiOrder.deliveryAddress
        ) {
          try {
            const addr =
              typeof apiOrder.deliveryAddress === "string"
                ? JSON.parse(apiOrder.deliveryAddress)
                : apiOrder.deliveryAddress;
            if (addr?.latitude)
              apiOrder.deliveryLatitude = String(addr.latitude);
            if (addr?.longitude)
              apiOrder.deliveryLongitude = String(addr.longitude);
          } catch {}
        }

        setOrder(apiOrder);

        if (apiOrder?.estimatedDelivery) {
          setEta(
            Math.max(
              0,
              Math.round(
                (new Date(apiOrder.estimatedDelivery).getTime() - Date.now()) /
                  60000,
              ),
            ),
          );
        }

        // Cargar ubicación del negocio
        if (apiOrder?.businessId) {
          try {
            const bizRes = await apiRequest(
              "GET",
              `/api/business/${apiOrder.businessId}`,
            );
            const bizData = await bizRes.json();
            const biz = bizData.business;
            if (biz?.latitude && biz?.longitude) {
              setBusinessLocation({
                lat: parseFloat(biz.latitude),
                lng: parseFloat(biz.longitude),
              });
            } else if (biz?.address) {
              // Geocodificar la dirección si no hay coordenadas
              await loadGoogleMaps();
              const google = (window as any).google;
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode(
                { address: biz.address + ", Soria, España" },
                (results: any, status: any) => {
                  if (status === "OK" && results[0]) {
                    const loc = results[0].geometry.location;
                    setBusinessLocation({ lat: loc.lat(), lng: loc.lng() });
                  }
                },
              );
            }
          } catch {}
        }

        // Cargar foto del repartidor
        if (apiOrder?.deliveryPersonId) {
          try {
            const driverRes = await apiRequest(
              "GET",
              `/api/users/${apiOrder.deliveryPersonId}`,
            );
            const driverData = await driverRes.json();
            if (driverData.user?.profilePicture) {
              setDriverPhoto(driverData.user.profilePicture);
            }
          } catch {}
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Poll ETA dinámico cada 30s
  useEffect(() => {
    if (!orderId || order?.status !== "on_the_way") return;
    const fetchETA = async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/tracking/eta/${orderId}`,
        );
        const data = await response.json();
        if (data.success && data.eta) {
          setDynamicETA({
            minutes: data.eta.minutes,
            confidence: data.eta.confidence,
          });
        }
      } catch {}
    };
    fetchETA();
    const interval = setInterval(fetchETA, 30000);
    return () => clearInterval(interval);
  }, [orderId, order?.status]);

  // Inicializar mapa (solo una vez)
  useEffect(() => {
    if (!mapsReady || !mapRef.current || !order || gmap.current) return;
    const google = (window as any).google;
    const center = businessLocation || { lat: 41.7636, lng: -2.4677 };
    gmap.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });
  }, [mapsReady, order]);

  // ── Marcador del cliente ── se crea una vez cuando llega order con coordenadas
  useEffect(() => {
    if (
      !mapsReady ||
      !gmap.current ||
      !order?.deliveryLatitude ||
      !order?.deliveryLongitude
    )
      return;
    if (customerMarkerRef.current) return; // ya existe
    const google = (window as any).google;
    const pos = {
      lat: parseFloat(order.deliveryLatitude),
      lng: parseFloat(order.deliveryLongitude),
    };
    customerMarkerRef.current = new google.maps.Marker({
      position: pos,
      map: gmap.current,
      title: "Tu dirección",
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#DC2626" stroke="white" stroke-width="3"/><path d="M10 20l10-8 10 8M12 20v8h6v-5h4v5h6v-8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polygon points="14,38 26,38 20,48" fill="#DC2626"/></svg>')}`,
        scaledSize: new google.maps.Size(40, 48),
        anchor: new google.maps.Point(20, 48),
      },
      zIndex: 90,
    });
  }, [
    mapsReady,
    order?.deliveryLatitude,
    order?.deliveryLongitude,
  ]);

  // ── Ruta roja negocio→cliente (pending / confirmed / preparing / ready) ──
  // Se dibuja siempre que tengamos negocio + cliente y NO haya repartidor en camino
  useEffect(() => {
    let cancelled = false;
    if (!mapsReady || !gmap.current) return;
    if (
      !businessLocation ||
      !order?.deliveryLatitude ||
      !order?.deliveryLongitude
    )
      return;
    if (
      order.status === "on_the_way" ||
      order.status === "delivered" ||
      order.status === "cancelled"
    )
      return;
    const google = (window as any).google;

    // Limpiar ruta anterior
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }

    const clientPos = {
      lat: parseFloat(order.deliveryLatitude),
      lng: parseFloat(order.deliveryLongitude),
    };

    // Ruta real por calles (Directions API - 1 sola llamada)
    (async () => {
      try {
        const directionsService = new google.maps.DirectionsService();
        const result = await new Promise<any>(
          (resolve: any, reject: any) => {
            directionsService.route(
              {
                origin: businessLocation as any,
                destination: clientPos as any,
                travelMode: google.maps.TravelMode.DRIVING,
              },
              (response: any, status: any) => {
                if (status === google.maps.DirectionsStatus.OK && response) {
                  resolve(response);
                } else {
                  reject(new Error(`Directions failed: ${status}`));
                }
              },
            );
          },
        );
        if (!cancelled) {
          routeLineRef.current = new google.maps.DirectionsRenderer({
            map: gmap.current,
            directions: result,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#DC2626",
              strokeOpacity: 0.85,
              strokeWeight: 5,
            },
          });
        }
      } catch {
        if (!cancelled) {
          // Fallback: línea recta si Directions API falla
          routeLineRef.current = new google.maps.Polyline({
            path: [businessLocation, clientPos],
            geodesic: true,
            strokeColor: "#DC2626",
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map: gmap.current,
          });
        }
      }

      // Ajustar bounds
      if (!cancelled && gmap.current) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(businessLocation as any);
        bounds.extend(clientPos as any);
        gmap.current.fitBounds(bounds, {
          top: 80,
          right: 80,
          bottom: 80,
          left: 80,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [
    mapsReady,
    businessLocation,
    order?.deliveryLatitude,
    order?.deliveryLongitude,
    order?.status,
  ]);

  // ── Marcador del negocio ── se actualiza cuando llega businessLocation
  useEffect(() => {
    if (!gmap.current || !businessLocation) return;
    const google = (window as any).google;
    if (businessMarkerRef.current) {
      businessMarkerRef.current.setPosition(businessLocation);
    } else {
      businessMarkerRef.current = new google.maps.Marker({
        position: businessLocation,
        map: gmap.current,
        title: order?.businessName || "Negocio",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#FF6B35" stroke="white" stroke-width="3"/><path d="M13 16h14M15 16v-2a1 1 0 011-1h8a1 1 0 011 1v2M13 20h14l-1 8H14l-1-8z" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><polygon points="14,38 26,38 20,48" fill="#FF6B35"/></svg>')}`,
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48),
        },
        zIndex: 100,
      });
    }
    if (!order?.deliveryLatitude) gmap.current.setCenter(businessLocation);
  }, [businessLocation]);

  // ── useEffect principal de rutas y repartidor ──
  useEffect(() => {
    if (!mapsReady || !gmap.current || !order) return;
    const google = (window as any).google;
    // ── Repartidor en camino: polling GPS cada 10s con ruta verde ──
    if (order.status !== "on_the_way") return;

    // Limpiar ruta roja previa
    if (routeLineRef.current) {
      if (typeof routeLineRef.current.setMap === "function")
        routeLineRef.current.setMap(null);
      else if (typeof routeLineRef.current.setDirections === "function")
        routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }

    const updateDriver = async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/delivery/location/${orderId}`,
        );
        const data = await res.json();
        if (!data.location?.latitude || !data.location?.longitude) return;

        const driverPos = {
          lat: parseFloat(data.location.latitude),
          lng: parseFloat(data.location.longitude),
        };

        // Crear o mover marcador del repartidor con foto de perfil
        const driverIconSvg = driverPhoto
          ? `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="72"><defs><clipPath id="c"><circle cx="28" cy="28" r="24"/></clipPath></defs><circle cx="28" cy="28" r="27" fill="#10B981" stroke="white" stroke-width="3"/><circle cx="28" cy="28" r="27" fill="#10B981" opacity="0.3" stroke="none"/><image href="${driverPhoto}" x="4" y="4" width="48" height="48" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/><polygon points="20,55 36,55 28,68" fill="#10B981"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72"><circle cx="28" cy="28" r="27" fill="#10B981" stroke="white" stroke-width="3"/><path d="M18 32c0-2 1-4 3-5l5-2 4 2c2 1 3 3 3 5M21 34a3 3 0 106 0M35 34a3 3 0 106 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22 27l3-6h6l2 4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><polygon points="20,55 36,55 28,68" fill="#10B981"/></svg>`;

        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(driverPos);
          // Actualizar icono si ya existe (por si la foto cargó después)
          driverMarkerRef.current.setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(driverIconSvg)}`,
            scaledSize: new google.maps.Size(64, 72),
            anchor: new google.maps.Point(28, 72),
          });
        } else {
          driverMarkerRef.current = new google.maps.Marker({
            position: driverPos,
            map: gmap.current,
            title: order.deliveryPersonName || "Repartidor",
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(driverIconSvg)}`,
              scaledSize: new google.maps.Size(64, 72),
              anchor: new google.maps.Point(28, 72),
            },
            zIndex: 999,
            animation: google.maps.Animation.DROP,
          });
        }

        if (order.deliveryLatitude && order.deliveryLongitude) {
          const clientPos = {
            lat: parseFloat(order.deliveryLatitude),
            lng: parseFloat(order.deliveryLongitude),
          };
          if (driverRouteLineRef.current) {
            driverRouteLineRef.current.setMap(null);
            driverRouteLineRef.current = null;
          }
          driverRouteLineRef.current = new google.maps.Polyline({
            path: [driverPos, clientPos],
            geodesic: true,
            strokeColor: "#10B981",
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: gmap.current,
          });

          // Ajustar bounds: repartidor + cliente
          const b = new google.maps.LatLngBounds();
          b.extend(driverPos);
          b.extend(clientPos);
          if (businessLocation) b.extend(businessLocation);
          gmap.current.fitBounds(b, {
            top: 60,
            right: 60,
            bottom: 60,
            left: 60,
          });
        }
      } catch {}
    };

    updateDriver();
    const interval = setInterval(updateDriver, 10000);
    return () => clearInterval(interval);
  }, [mapsReady, order, businessLocation]);

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : 0;
  const statusInfo = STATUS_LABELS[order?.status] || {
    label: "Procesando...",
    color: "#888",
    icon: "clock",
  };

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[s.webContainer, { backgroundColor: theme.backgroundRoot }]}>
        {/* IZQUIERDA: Mapa fijo a pantalla completa */}
        <View style={s.mapSection}>
          <div
            ref={mapRef}
            style={{ width: "100%", height: "100%", minHeight: "100vh" } as any}
          />
          {(!mapsReady || loading) && (
            <View style={s.mapLoading}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <ThemedText
                type="body"
                style={{ marginTop: Spacing.md, color: "#666" }}
              >
                Cargando mapa...
              </ThemedText>
            </View>
          )}

          {/* Overlay de estado en el mapa */}
          {order && mapsReady && !loading && (
            <View style={s.mapOverlay}>
              <View
                style={[s.statusBadge, { backgroundColor: statusInfo.color }]}
              >
                <Feather name={statusInfo.icon as any} size={16} color="#FFF" />
                <ThemedText
                  type="small"
                  style={{
                    color: "#FFF",
                    marginLeft: Spacing.xs,
                    fontWeight: "600",
                  }}
                >
                  {statusInfo.label}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* DERECHA: Panel de información scrolleable */}
        <View
          style={[
            s.infoSection,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header con botón atrás */}
            <View style={s.panelHeader}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={[s.backBtn, { backgroundColor: theme.card }]}
              >
                <Feather name="arrow-left" size={20} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">Seguimiento en vivo</ThemedText>
              <View style={{ width: 40 }} />
            </View>

            {/* Card del negocio con imagen */}
            {order && (
              <View style={[s.businessCard, { backgroundColor: theme.card }]}>
                <View style={s.businessRow}>
                  <Image
                    source={
                      order.businessImage
                        ? { uri: order.businessImage }
                        : require("../../assets/images/delivery-hero.png")
                    }
                    style={s.businessImage}
                    contentFit="cover"
                  />
                  <View style={s.businessInfo}>
                    <ThemedText type="h4">
                      {order.businessName || "Restaurante"}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary }}
                    >
                      Pedido #{orderId?.slice(-6)}
                    </ThemedText>
                  </View>
                  {dynamicETA ? (
                    <View style={s.etaBox}>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary, fontSize: 11 }}
                      >
                        LLEGA EN
                      </ThemedText>
                      <ThemedText
                        type="h3"
                        style={{
                          color: PRIMARY,
                          fontSize: 24,
                          fontWeight: "800",
                        }}
                      >
                        {dynamicETA.minutes} min
                      </ThemedText>
                    </View>
                  ) : order.status === "delivered" ? (
                    <View style={s.etaBox}>
                      <Feather name="check-circle" size={28} color="#4CAF50" />
                      <ThemedText
                        type="caption"
                        style={{ color: "#4CAF50", marginTop: 4, fontSize: 11 }}
                      >
                        ENTREGADO
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Estado actual */}
            <View
              style={[
                s.statusCard,
                {
                  backgroundColor: statusInfo.color + "15",
                  borderColor: statusInfo.color + "40",
                },
              ]}
            >
              <View
                style={[s.statusIcon, { backgroundColor: statusInfo.color }]}
              >
                <Feather name={statusInfo.icon as any} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="h4" style={{ color: statusInfo.color }}>
                  {statusInfo.label}
                </ThemedText>
                {eta !== null && order?.status === "on_the_way" && (
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    Llega en aproximadamente {eta} minutos
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Barra de progreso */}
            <View style={s.progressRow}>
              {STATUS_STEPS.slice(0, 5).map((step, i) => (
                <View
                  key={step}
                  style={[
                    s.progressStep,
                    {
                      backgroundColor:
                        i <= currentStep ? statusInfo.color : theme.border,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Detalles del pedido */}
            {order && (
              <View style={[s.detailCard, { backgroundColor: theme.card }]}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                  Detalles del pedido
                </ThemedText>

                {/* Items del pedido */}
                {order.items && Array.isArray(order.items)
                  ? (typeof order.items === "string"
                      ? JSON.parse(order.items)
                      : order.items
                    ).map((item: any, index: number) => {
                      const itemName =
                        item.product?.name || item.name || "Producto";
                      let itemPrice = item.product?.price || item.price || 0;
                      if (itemPrice > 1000) itemPrice = itemPrice / 100;
                      const itemQty = item.quantity || 1;
                      return (
                        <View
                          key={item.id || `item-${index}`}
                          style={s.detailRow}
                        >
                          <ThemedText type="body" style={{ flex: 1 }}>
                            {itemQty}x {itemName}
                          </ThemedText>
                          <ThemedText type="body" style={{ fontWeight: "600" }}>
                            €{(itemPrice * itemQty).toFixed(2)}
                          </ThemedText>
                        </View>
                      );
                    })
                  : null}

                {/* Totales */}
                <View
                  style={[
                    s.totalSection,
                    {
                      borderTopColor: theme.border,
                      marginTop: Spacing.md,
                      paddingTop: Spacing.md,
                    },
                  ]}
                >
                  <View style={s.detailRow}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Subtotal
                    </ThemedText>
                    <ThemedText type="small">
                      €{((order.subtotal || 0) / 100).toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={s.detailRow}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Envío
                    </ThemedText>
                    <ThemedText type="small">
                      €{((order.deliveryFee || 0) / 100).toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={[s.detailRow, { marginTop: Spacing.sm }]}>
                    <ThemedText type="h4">Total</ThemedText>
                    <ThemedText
                      type="h4"
                      style={{ color: PRIMARY, fontWeight: "800" }}
                    >
                      €{((order.total || 0) / 100).toFixed(2)}
                    </ThemedText>
                  </View>
                </View>

                {/* Método de pago */}
                <View style={[s.paymentRow, { marginTop: Spacing.md }]}>
                  <Feather
                    name="credit-card"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    {order.paymentMethod === "card"
                      ? "Tarjeta"
                      : order.paymentMethod === "cash"
                        ? "Efectivo"
                        : order.paymentMethod === "bizum"
                          ? "Bizum"
                          : order.paymentMethod === "paypal"
                            ? "PayPal"
                            : "Pago digital"}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Información del repartidor */}
            {order?.deliveryPersonId &&
              order.status !== "pending" &&
              order.status !== "confirmed" &&
              order.status !== "preparing" && (
                <View style={[s.driverCard, { backgroundColor: theme.card }]}>
                  <View style={s.driverHeader}>
                    <Feather name="truck" size={20} color={PRIMARY} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Tu repartidor
                    </ThemedText>
                  </View>

                  <View style={s.driverRow}>
                    <Image
                      source={
                        driverPhoto
                          ? { uri: driverPhoto }
                          : require("../../assets/images/delivery-hero.png")
                      }
                      style={s.driverPhoto}
                      contentFit="cover"
                    />
                    <View style={s.driverInfo}>
                      <ThemedText type="h4">
                        {order.deliveryPersonName || "Repartidor"}
                      </ThemedText>
                      {order.deliveryPersonPhone && (
                        <ThemedText
                          type="caption"
                          style={{ color: theme.textSecondary }}
                        >
                          {order.deliveryPersonPhone}
                        </ThemedText>
                      )}
                    </View>

                    {/* Botones de contacto */}
                    <View style={s.contactButtons}>
                      {order.deliveryPersonPhone && (
                        <Pressable
                          onPress={() =>
                            window.open(
                              `tel:${order.deliveryPersonPhone}`,
                              "_self",
                            )
                          }
                          style={[s.contactBtn, { backgroundColor: PRIMARY }]}
                        >
                          <Feather name="phone" size={18} color="#FFF" />
                        </Pressable>
                      )}
                      {order.deliveryPersonPhone && (
                        <Pressable
                          onPress={() => {
                            const cleanPhone =
                              order.deliveryPersonPhone.replace(/\D/g, "");
                            window.open(
                              `https://wa.me/${cleanPhone}`,
                              "_blank",
                            );
                          }}
                          style={[
                            s.contactBtn,
                            {
                              backgroundColor: "#25D366",
                              marginLeft: Spacing.sm,
                            },
                          ]}
                        >
                          <Feather
                            name="message-circle"
                            size={18}
                            color="#FFF"
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )}

            {/* Dirección de entrega */}
            {order?.deliveryAddress && (
              <View style={[s.addressCard, { backgroundColor: theme.card }]}>
                <View style={s.addressHeader}>
                  <Feather name="map-pin" size={20} color={PRIMARY} />
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    Dirección de entrega
                  </ThemedText>
                </View>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
                >
                  {typeof order.deliveryAddress === "string"
                    ? order.deliveryAddress
                    : JSON.stringify(order.deliveryAddress)}
                </ThemedText>
              </View>
            )}

            {/* Sistema de propinas - Solo si está entregado y hay repartidor */}
            {order?.status === "delivered" &&
              order?.deliveryPersonId &&
              !tipSent &&
              user?.role === "customer" && (
                <View style={[s.tipCard, { backgroundColor: theme.card }]}>
                  <View style={s.tipHeader}>
                    <Feather name="heart" size={20} color={PRIMARY} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Agregar propina
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: theme.textSecondary,
                      marginBottom: Spacing.md,
                    }}
                  >
                    Agradece a tu repartidor por su excelente servicio
                  </ThemedText>

                  {/* Opciones de propina */}
                  <View style={s.tipOptions}>
                    {tipOptions.map((tip) => (
                      <Pressable
                        key={tip}
                        onPress={() => setSelectedTip(tip)}
                        style={[
                          s.tipOption,
                          {
                            backgroundColor:
                              selectedTip === tip
                                ? PRIMARY
                                : theme.backgroundSecondary,
                            borderColor:
                              selectedTip === tip ? PRIMARY : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{
                            color: selectedTip === tip ? "#FFF" : theme.text,
                            fontWeight: "600",
                          }}
                        >
                          €{(tip / 100).toFixed(2)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>

                  {/* Botón enviar propina */}
                  <Pressable
                    onPress={async () => {
                      if (!selectedTip || sendingTip) return;
                      setSendingTip(true);
                      try {
                        await apiRequest("POST", `/api/orders/${orderId}/tip`, {
                          amount: selectedTip,
                          deliveryPersonId: order.deliveryPersonId,
                        });
                        setTipSent(true);
                      } catch (error) {
                        console.error("Error sending tip:", error);
                      } finally {
                        setSendingTip(false);
                      }
                    }}
                    disabled={!selectedTip || sendingTip}
                    style={[
                      s.tipButton,
                      {
                        backgroundColor: selectedTip
                          ? PRIMARY
                          : theme.backgroundSecondary,
                        opacity: selectedTip && !sendingTip ? 1 : 0.5,
                      },
                    ]}
                  >
                    {sendingTip ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Feather name="gift" size={18} color="#FFF" />
                        <ThemedText
                          type="body"
                          style={{
                            color: "#FFF",
                            marginLeft: Spacing.sm,
                            fontWeight: "600",
                          }}
                        >
                          Enviar propina
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

            {/* Confirmación de propina enviada */}
            {tipSent && (
              <View style={[s.tipCard, { backgroundColor: "#E8F5E9" }]}>
                <View style={s.tipHeader}>
                  <Feather name="check-circle" size={20} color="#4CAF50" />
                  <ThemedText
                    type="h4"
                    style={{ marginLeft: Spacing.sm, color: "#2E7D32" }}
                  >
                    ¡Propina enviada!
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ color: "#4CAF50" }}>
                  Tu repartidor recibirá €
                  {((selectedTip || 0) / 100).toFixed(2)}
                </ThemedText>
              </View>
            )}

            {/* Botón confirmar entrega */}
            {order?.status === "delivered" &&
              !(order as any).confirmedByCustomer &&
              user?.role === "customer" && (
                <Pressable
                  onPress={async () => {
                    if (window.confirm("¿Recibiste tu pedido correctamente?")) {
                      try {
                        const res = await apiRequest(
                          "POST",
                          `/api/fund-release/confirm-delivery`,
                          { orderId: order.id },
                        );
                        const data = await res.json();
                        if (data.success) {
                          alert(
                            "✅ Entrega confirmada. ¡Gracias por tu pedido!",
                          );
                          navigation.navigate(
                            "Review" as never,
                            {
                              orderId: order.id,
                              businessId: order.businessId,
                              businessName: order.businessName,
                              deliveryPersonId: order.deliveryPersonId,
                            } as never,
                          );
                        } else {
                          alert(
                            "Error: " +
                              (data.error || "No se pudo confirmar la entrega"),
                          );
                        }
                      } catch (error: any) {
                        alert(
                          "Error: " +
                            (error.message ||
                              "No se pudo confirmar la entrega"),
                        );
                      }
                    }
                  }}
                  style={[s.confirmButton, { backgroundColor: "#4CAF50" }]}
                >
                  <Feather name="check-circle" size={20} color="#FFF" />
                  <ThemedText
                    type="body"
                    style={{
                      color: "#FFF",
                      marginLeft: Spacing.sm,
                      fontWeight: "600",
                    }}
                  >
                    Confirmar que recibí mi pedido
                  </ThemedText>
                </Pressable>
              )}

            {/* Entrega ya confirmada */}
            {order?.status === "delivered" &&
              (order as any).confirmedByCustomer &&
              user?.role === "customer" && (
                <View style={[s.confirmButton, { backgroundColor: "#E8F5E9" }]}>
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
              )}

            {/* Botón reportar problema */}
            {order?.status !== "cancelled" && (
              <Pressable
                onPress={() => {
                  if (user?.role === "delivery_driver") {
                    navigation.navigate("Support" as never);
                  } else {
                    navigation.navigate(
                      "ReportIssue" as never,
                      {
                        orderId: order.id,
                        orderNumber: order.id.slice(-6),
                      } as never,
                    );
                  }
                }}
                style={[s.reportButton, { borderColor: theme.border }]}
              >
                <Feather name="alert-circle" size={18} color="#F59E0B" />
                <ThemedText
                  type="body"
                  style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}
                >
                  Reportar un problema
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "column" },
  webContainer: {
    flex: 1,
    flexDirection: "row",
  },

  // IZQUIERDA: Mapa fijo
  mapSection: {
    flex: 1,
    position: "relative",
    height: "100%",
  } as any,
  mapLoading: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    zIndex: 10,
  } as any,
  mapOverlay: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "center",
    zIndex: 5,
  } as any,
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 24,
    ...Platform.select({ web: { boxShadow: "0 4px 16px rgba(0,0,0,0.25)" } }),
  },

  // DERECHA: Panel de info
  infoSection: {
    flex: 1,
    height: "100%",
  } as any,
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing["4xl"],
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }),
  },

  businessCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }),
  },
  businessRow: { flexDirection: "row", alignItems: "center" },
  businessImage: { width: 64, height: 64, borderRadius: 32 },
  businessInfo: { flex: 1, marginLeft: Spacing.lg },
  etaBox: { alignItems: "center", paddingHorizontal: Spacing.lg },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } }),
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  progressRow: { flexDirection: "row", gap: 6, marginBottom: Spacing.xl },
  progressStep: { flex: 1, height: 8, borderRadius: 4 },

  detailCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }),
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  totalSection: { borderTopWidth: 1.5 },
  paymentRow: { flexDirection: "row", alignItems: "center" },

  driverCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }),
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  driverRow: { flexDirection: "row", alignItems: "center" },
  driverPhoto: { width: 64, height: 64, borderRadius: 32 },
  driverInfo: { flex: 1, marginLeft: Spacing.lg },
  contactButtons: { flexDirection: "row" },
  contactBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.2)" } }),
  },

  addressCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }),
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },

  tipCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }),
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tipOptions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tipOption: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
    transition: "all 0.2s ease" as any,
  },
  tipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    cursor: "pointer" as any,
    ...Platform.select({
      web: { boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)" },
    }),
  },

  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    cursor: "pointer" as any,
    ...Platform.select({
      web: { boxShadow: "0 6px 16px rgba(76, 175, 80, 0.35)" },
    }),
  },

  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.xl,
    cursor: "pointer" as any,
    transition: "all 0.2s ease" as any,
  },
});
