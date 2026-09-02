import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useDriverLocationSocket } from "@/hooks/useDriverLocationSocket";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import {
  fetchRouteDirections,
  distanceMeters,
} from "@/utils/directions";
import { snapToRoute, formatRemaining } from "@/utils/snapToRoute";
import { animateMarkerTo } from "@/utils/smoothMarker";
import { printInvoiceWeb } from "@/utils/invoice";
import { useAuth } from "@/contexts/AuthContext";
import {
  pinIcon,
  driverIcon,
  businessLabelIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import { displayOrderNumber, orderNumberLabel } from "@/utils/orderNumber";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const PRIMARY = "#DC2626";

let deltaStripePromise: Promise<any> | null = null;
const getDeltaStripe = async () => {
  if (!deltaStripePromise) {
    try {
      const res = await apiRequest("GET", "/api/stripe/publishable-key");
      const data = await res.json();
      if (data.publishableKey) deltaStripePromise = loadStripe(data.publishableKey);
    } catch {}
  }
  return deltaStripePromise;
};

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

import { loadGoogleMaps } from "@/utils/googleMapsWeb";

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
  accepted: {
    label: "Pedido aceptado",
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
  picked_up: {
    label: "Pedido recogido",
    color: "#0EA5E9",
    icon: "package-check",
  },
  on_the_way: {
    label: "En camino 🛵",
    color: ComeYaColors.success,
    icon: "truck",
  },
  in_transit: {
    label: "En camino 🛵",
    color: ComeYaColors.success,
    icon: "truck",
  },
  arriving: {
    label: "Llegando a tu dirección 📍",
    color: "#EC4899",
    icon: "map-pin",
  },
  delivered: { label: "Entregado ✓", color: "#4CAF50", icon: "check-circle" },
};

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
  "in_transit",
  "arriving",
  "delivered",
];

// Estados en los que el repartidor está en movimiento y el ETA debe
// seguir actualizándose (antes solo on_the_way: al pasar a arriving el ETA
// quedaba congelado en "1 min" para siempre)
const ETA_STATUSES = [
  "picked_up",
  "on_the_way",
  "in_transit",
  "arriving",
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
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [deltaPayment, setDeltaPayment] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);
  const [dynamicETA, setDynamicETA] = useState<{
    minutes: number;
    confidence: number;
  } | null>(null);
  // Cuenta atrás de la política de aceptación (10 min) — hook incondicional
  const [policyNow, setPolicyNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setPolicyNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const acceptanceRemainingLabelWeb = useMemo(() => {
    if (!order?.createdAt) return "10:00";
    const deadline = new Date(order.createdAt).getTime() + 10 * 60 * 1000;
    const ms = Math.max(0, deadline - policyNow);
    return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(
      Math.floor((ms % 60000) / 1000),
    ).padStart(2, "0")}`;
  }, [order?.createdAt, policyNow]);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [driverVehicle, setDriverVehicle] = useState<string | null>(null);
  const [businessLocation, setBusinessLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [businessMeta, setBusinessMeta] = useState(
    businessMarkerMeta("restaurant"),
  );
  const { user } = useAuth();
  // La propina ya NO se ofrece durante el seguimiento: solo tras la entrega,
  // desde la pantalla de valoración del pedido.

  const businessMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const driverRouteLineRef = useRef<any>(null);
  const driverRouteCoordsRef = useRef<{ lat: number; lng: number }[] | null>(
    null,
  );
  const lastDriverRoutePointRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  // El fitBounds automático solo se hace UNA vez; luego, solo manual.
  const didInitialFitRef = useRef(false);

  /** Recentrar el mapa en el repartidor (o en la ruta completa). */
  const handleRecenter = useCallback(() => {
    const google = (window as any).google;
    if (!gmap.current || !google) return;
    const dp = driverMarkerRef.current?.getPosition();
    const cp = customerMarkerRef.current?.getPosition();
    if (dp && cp) {
      const b = new google.maps.LatLngBounds();
      b.extend(dp);
      b.extend(cp);
      gmap.current.fitBounds(b, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
    } else if (dp) {
      gmap.current.panTo(dp);
      gmap.current.setZoom(15);
    }
  }, []);

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
        if (Array.isArray(apiOrder.substitutions)) {
          setSubstitutions(apiOrder.substitutions);
        }

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
            setBusinessMeta(
              businessMarkerMeta(biz?.type, biz?.categories),
            );
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

        // Vehículo del repartidor (icono del mapa)
        if (apiOrder?.driverInfo?.vehicleType) {
          setDriverVehicle(apiOrder.driverInfo.vehicleType);
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
  }, [orderId, reloadKey]);

  // ── Sustituciones: aprobar/rechazar y pagar la diferencia (web) ───────
  const pendingSubs = substitutions.filter(
    (s: any) => s.status === "proposed" || s.status === "approved",
  );
  const pendingPositive = pendingSubs.filter(
    (s: any) => Number(s.priceDelta) > 0,
  );
  const batchPositiveTotal = pendingPositive.reduce(
    (sum: number, s: any) => sum + Number(s.priceDelta),
    0,
  );

  const rejectWebSub = async (sub: any) => {
    try {
      await apiRequest(
        "POST",
        `/api/orders/${orderId}/substitutions/${sub.id}/reject`,
        {},
      );
      setReloadKey((k) => k + 1);
    } catch {}
  };

  const approveWebSub = async (sub: any) => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/substitutions/${sub.id}/approve`,
        {},
      );
      const data = await res.json();
      if (data.needsPayment && data.clientSecret) {
        setDeltaPayment({
          clientSecret: data.clientSecret,
          amountEur: (Number(data.delta) / 100).toFixed(2),
          mode: "single",
          subId: sub.id,
          paymentIntentId: data.paymentIntentId,
        });
      } else {
        setReloadKey((k) => k + 1);
      }
    } catch {}
  };

  const startBatchPayment = async () => {
    try {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/substitutions/approve-batch`,
        {},
      );
      const data = await res.json();
      if (data.needsPayment && data.clientSecret) {
        setDeltaPayment({
          clientSecret: data.clientSecret,
          amountEur: (Number(data.delta) / 100).toFixed(2),
          mode: "batch",
          paymentIntentId: data.paymentIntentId,
        });
      } else if (data.error) {
        Alert.alert("Sustitución", data.error);
      }
    } catch {}
  };

  const onDeltaSuccess = async () => {
    const p = deltaPayment;
    setDeltaPayment(null);
    try {
      if (p?.mode === "batch") {
        await apiRequest(
          "POST",
          `/api/orders/${orderId}/substitutions/confirm-batch-payment`,
          { paymentIntentId: p.paymentIntentId },
        );
      } else if (p?.subId) {
        await apiRequest(
          "POST",
          `/api/orders/${orderId}/substitutions/${p.subId}/confirm-payment`,
          { paymentIntentId: p.paymentIntentId },
        );
      }
    } catch {}
    setReloadKey((k) => k + 1);
  };

  // Poll ETA dinámico cada 30s (mientras el repartidor está en movimiento —
  // antes solo con on_the_way: al pasar a arriving quedaba congelado)
  useEffect(() => {
    if (!orderId || !ETA_STATUSES.includes(order?.status ?? "")) return;
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
      icon: asGoogleIcon(
        google,
        pinIcon(CUSTOMER_MARKER.color, CUSTOMER_MARKER.icon),
      ),
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
      ETA_STATUSES.includes(order.status) ||
      order.status === "delivered" ||
      order.status === "cancelled"
    ) {
      // Si el repartidor ya va en camino, quitar la ruta roja estática
      if (routeLineRef.current) {
        if (typeof routeLineRef.current.setMap === "function") {
          routeLineRef.current.setMap(null);
        } else if (typeof routeLineRef.current.setDirections === "function") {
          routeLineRef.current.setMap(null);
        }
        routeLineRef.current = null;
      }
      return;
    }
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

    // Ruta real por calles vía el proxy del servidor (caché + rate limit;
    // la cuota de Directions nunca se gasta desde el navegador).
    // Sin geometría real NO se dibuja nada — nunca una línea recta.
    (async () => {
      let coords: { lat: number; lng: number }[] | null = null;
      try {
        const route = await fetchRouteDirections(
          {
            latitude: businessLocation.lat,
            longitude: businessLocation.lng,
          },
          { latitude: clientPos.lat, longitude: clientPos.lng },
        );
        if (route && route.coordinates.length >= 2) {
          coords = route.coordinates.map((c) => ({
            lat: c.latitude,
            lng: c.longitude,
          }));
        }
      } catch {
        // sin ruta — no se dibuja nada
      }

      if (!cancelled && coords) {
        routeLineRef.current = new google.maps.Polyline({
          path: coords,
          geodesic: true,
          strokeColor: "#DC2626",
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map: gmap.current,
        });
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
      businessMarkerRef.current.setIcon(
        asGoogleIcon(
          google,
          businessLabelIcon({
            iconKey: businessMeta.icon,
            color: businessMeta.color,
            title: order?.businessName || "Negocio",
          }),
        ),
      );
    } else {
      businessMarkerRef.current = new google.maps.Marker({
        position: businessLocation,
        map: gmap.current,
        title: order?.businessName || "Negocio",
        icon: asGoogleIcon(
          google,
          businessLabelIcon({
            iconKey: businessMeta.icon,
            color: businessMeta.color,
            title: order?.businessName || "Negocio",
          }),
        ),
        zIndex: 100,
      });
    }
    if (!order?.deliveryLatitude) gmap.current.setCenter(businessLocation);
  }, [businessLocation]);

  // ── Posición del repartidor en vivo: WebSocket con fallback a polling ──
  const { location: socketLocation } = useDriverLocationSocket(
    ETA_STATUSES.includes(order?.status ?? "") && order?.orderType !== "pickup"
      ? orderId
      : null,
    { fallbackIntervalMs: 5000 },
  );

  // ── RECOGIDA A PIE (pickup): posición propia + ruta hacia el local ──
  const isPickup = order?.orderType === "pickup";
  const [pickupMode, setPickupMode] = useState<"driving" | "walking">(
    "walking",
  );
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [pickupRemaining, setPickupRemaining] = useState<string | null>(null);
  const myMarkerRef = useRef<any>(null);
  const pickupLineRef = useRef<any>(null);
  const pickupRouteRef = useRef<{ lat: number; lng: number }[]>([]);
  const pickupDidFitRef = useRef(false);
  const lastPickupRouteRef = useRef<{
    lat: number;
    lng: number;
    mode: string;
  } | null>(null);

  // Watch de la posición propia del cliente a pie (recogida)
  useEffect(() => {
    if (!isPickup) return;
    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        if (
          typeof pos.coords.accuracy === "number" &&
          pos.coords.accuracy > 50
        )
          return;
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watchId)
        navigator.geolocation.clearWatch(watchId as unknown as number);
    };
  }, [isPickup]);

  // Ruta cliente→local + distancia restante (estilo Glovo)
  useEffect(() => {
    if (!isPickup || !mapsReady || !gmap.current || !myPos || !businessLocation)
      return;
    const google = (window as any).google;

    if (myMarkerRef.current) {
      myMarkerRef.current.setPosition(myPos);
    } else {
      myMarkerRef.current = new google.maps.Marker({
        position: myPos,
        map: gmap.current,
        title: "Tú",
        icon: asGoogleIcon(google, pinIcon(PRIMARY, "user")),
        zIndex: 120,
      });
    }

    const last = lastPickupRouteRef.current;
    const moved =
      !last ||
      distanceMeters(
        { latitude: last.lat, longitude: last.lng },
        { latitude: myPos.lat, longitude: myPos.lng },
      ) > 100 ||
      last.mode !== pickupMode;

    const drawPickupLine = () => {
      if (pickupLineRef.current) pickupLineRef.current.setMap(null);
      if (pickupRouteRef.current.length >= 2) {
        pickupLineRef.current = new google.maps.Polyline({
          path: pickupRouteRef.current,
          geodesic: true,
          strokeColor: ComeYaColors.primary,
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: gmap.current,
        });
      }
      if (!pickupDidFitRef.current) {
        pickupDidFitRef.current = true;
        const b = new google.maps.LatLngBounds();
        b.extend(myPos);
        b.extend(businessLocation);
        gmap.current.fitBounds(b, { top: 60, right: 60, bottom: 60, left: 60 });
      }
    };

    if (moved) {
      lastPickupRouteRef.current = {
        lat: myPos.lat,
        lng: myPos.lng,
        mode: pickupMode,
      };
      fetchRouteDirections(
        { latitude: myPos.lat, longitude: myPos.lng },
        { latitude: businessLocation.lat, longitude: businessLocation.lng },
        pickupMode,
      )
        .then((route) => {
          if (route && route.coordinates.length >= 2) {
            pickupRouteRef.current = route.coordinates.map((c) => ({
              lat: c.latitude,
              lng: c.longitude,
            }));
          }
          drawPickupLine();
        })
        .catch(() => {});
    } else {
      drawPickupLine();
    }

    // Distancia/ETA RESTANTES sobre la ruta (snap de mi posición)
    if (pickupRouteRef.current.length >= 2) {
      const snap = snapToRoute(
        { latitude: myPos.lat, longitude: myPos.lng },
        pickupRouteRef.current.map((c) => ({
          latitude: c.lat,
          longitude: c.lng,
        })),
        40,
      );
      if (snap) {
        setPickupRemaining(formatRemaining(snap.remainingMeters, pickupMode));
      }
    }
  }, [isPickup, mapsReady, myPos, businessLocation, pickupMode]);

  // ── useEffect principal de rutas y repartidor (socket + fallback) ──
  useEffect(() => {
    if (!mapsReady || !gmap.current || !order) return;
    if (!ETA_STATUSES.includes(order.status)) return;
    if (order.orderType === "pickup") return; // recogida: flujo propio
    if (!socketLocation?.latitude || !socketLocation?.longitude) return;
    const google = (window as any).google;

    const driverPos = {
      lat: socketLocation.latitude,
      lng: socketLocation.longitude,
    };

    // Crear o mover marcador del repartidor con su vehículo (movimiento
    // fluido: interpola entre fixes del websocket en vez de saltar)
    const vehicle = vehicleMarkerMeta(driverVehicle);
    if (driverMarkerRef.current) {
      animateMarkerTo(driverMarkerRef.current, driverPos);
      driverMarkerRef.current.setIcon(
        asGoogleIcon(google, driverIcon(vehicle.icon)),
      );
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverPos,
        map: gmap.current,
        title: order.deliveryPersonName || "Repartidor",
        icon: asGoogleIcon(google, driverIcon(vehicle.icon)),
        zIndex: 999,
        animation: google.maps.Animation.DROP,
      });
    }

    if (order.deliveryLatitude && order.deliveryLongitude) {
      const clientPos = {
        lat: parseFloat(order.deliveryLatitude),
        lng: parseFloat(order.deliveryLongitude),
      };
      // Ruta real por calles vía el proxy del servidor; solo se re-pide
      // si el repartidor se movió >100 m (protege la cuota de Google)
      const shouldRefetch =
        !lastDriverRoutePointRef.current ||
        !driverRouteCoordsRef.current ||
        distanceMeters(
          {
            latitude: lastDriverRoutePointRef.current.lat,
            longitude: lastDriverRoutePointRef.current.lng,
          },
          { latitude: driverPos.lat, longitude: driverPos.lng },
        ) > 100;
      if (shouldRefetch) {
        lastDriverRoutePointRef.current = driverPos;
        fetchRouteDirections(
          { latitude: driverPos.lat, longitude: driverPos.lng },
          { latitude: clientPos.lat, longitude: clientPos.lng },
        )
          .then((route) => {
            if (route && route.coordinates.length >= 2) {
              driverRouteCoordsRef.current = route.coordinates.map((c) => ({
                lat: c.latitude,
                lng: c.longitude,
              }));
              if (driverRouteLineRef.current) {
                driverRouteLineRef.current.setMap(null);
              }
              driverRouteLineRef.current = new google.maps.Polyline({
                path: driverRouteCoordsRef.current,
                geodesic: true,
                strokeColor: "#10B981", // verde: repartidor → cliente
                strokeOpacity: 0.9,
                strokeWeight: 5,
                map: gmap.current,
              });
            }
          })
          .catch(() => {});
      }

      // Ajustar bounds SOLO la primera vez (o manualmente con el botón
      // recentrar): re-ajustar en cada update pelea contra el usuario y
      // produce mareo/teletransportes visuales.
      if (!didInitialFitRef.current) {
        didInitialFitRef.current = true;
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
    }
  }, [mapsReady, order, businessLocation, socketLocation]);

  // Normaliza el estado a la barra de 5 pasos (pending→confirmed→preparing→
  // ready→on_the_way). Los estados avanzados (picked_up, in_transit, arriving,
  // delivered) cuentan como el último paso.
  const STEP_POSITION: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    accepted: 1,
    preparing: 2,
    ready: 3,
    picked_up: 3,
    on_the_way: 4,
    in_transit: 4,
    arriving: 4,
    delivered: 4,
  };
  const currentStep = order
    ? STEP_POSITION[order.status] ?? 0
    : 0;
  const statusInfo =
    order?.status === "pending" && order?.paidAt
      ? {
          ...STATUS_LABELS.pending,
          label: "Pago recibido — esperando aceptación",
        }
      : STATUS_LABELS[order?.status] || {
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

          {/* Botón recentrar (seguir repartidor) */}
          {mapsReady && (
            <TouchableOpacity
              onPress={handleRecenter}
              style={[s.recenterBtn, { backgroundColor: "#FFFFFF" }]}
            >
              <Feather name="crosshair" size={18} color={PRIMARY} />
            </TouchableOpacity>
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
                      Pedido {orderId ? displayOrderNumber(order) : ""}
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

            {/* Card RECOGIDA (pickup): ruta propia hasta el local */}
            {isPickup && (
              <View style={[s.pickupCard, { backgroundColor: theme.card }]}>
                <View style={s.pickupCardHeader}>
                  <Feather name="shopping-bag" size={16} color={PRIMARY} />
                  <ThemedText
                    type="body"
                    style={{ fontWeight: "700", marginLeft: 6, flex: 1 }}
                  >
                    Recoge tu pedido en el local
                  </ThemedText>
                </View>
                {pickupRemaining ? (
                  <ThemedText
                    type="h4"
                    style={{ color: "#10B981", marginTop: 4 }}
                  >
                    Te quedan {pickupRemaining}
                  </ThemedText>
                ) : (
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginTop: 4 }}
                  >
                    Activa tu ubicación para trazar la ruta hasta el local.
                  </ThemedText>
                )}
                <View style={s.pickupModeRow}>
                  {(
                    [
                      ["walking", "A pie"],
                      ["driving", "En coche"],
                    ] as const
                  ).map(([mode, label]) => (
                    <Pressable
                      key={mode}
                      onPress={() => setPickupMode(mode)}
                      style={[
                        s.pickupModeBtn,
                        {
                          backgroundColor:
                            pickupMode === mode
                              ? PRIMARY
                              : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <Feather
                        name={
                          (mode === "walking" ? "map-pin" : "car") as any
                        }
                        size={12}
                        color={
                          pickupMode === mode ? "#FFF" : theme.textSecondary
                        }
                      />
                      <ThemedText
                        type="caption"
                        style={{
                          color:
                            pickupMode === mode ? "#FFF" : theme.textSecondary,
                          marginLeft: 4,
                          fontWeight: "600",
                        }}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Política de aceptación: cuenta atrás de 10 min mientras el
                negocio no acepta (transparencia del reembolso automático) */}
            {order &&
              ((order.status === "pending" && !!order.paidAt) ||
                order.status === "payment_failed") && (
                <View style={s.acceptanceNotice}>
                  <Feather name="clock" size={16} color="#B45309" />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText
                      type="small"
                      style={{ color: "#B45309", fontWeight: "700" }}
                    >
                      El negocio tiene {acceptanceRemainingLabelWeb} para aceptar
                      tu pedido
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

            {/* Sustituciones propuestas por el negocio: aprobar (pagando la
                diferencia; varios productos = un solo pago) o rechazar */}
            {pendingSubs.length > 0 && (
              <View style={s.substitutionCard}>
                <ThemedText type="small" style={{ fontWeight: "700" }}>
                  🔄 El negocio propone{" "}
                  {pendingSubs.length > 1
                    ? `${pendingSubs.length} sustituciones`
                    : "una sustitución"}
                </ThemedText>
                {pendingSubs.map((sub: any) => (
                  <View key={sub.id} style={s.substitutionRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {sub.itemName} → {sub.substituteName}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{
                          fontWeight: "700",
                          color:
                            Number(sub.priceDelta) < 0
                              ? ComeYaColors.success
                              : Number(sub.priceDelta) > 0
                                ? ComeYaColors.error
                                : theme.textSecondary,
                        }}
                      >
                        {Number(sub.priceDelta) < 0
                          ? `Te devolvemos ${(Math.abs(Number(sub.priceDelta)) / 100).toFixed(2)} €`
                          : Number(sub.priceDelta) > 0
                            ? `+${(Number(sub.priceDelta) / 100).toFixed(2)} €`
                            : "Mismo precio"}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      {Number(sub.priceDelta) <= 0 && (
                        <Pressable
                          onPress={() => approveWebSub(sub)}
                          style={[
                            s.subMiniBtn,
                            { backgroundColor: ComeYaColors.success },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: "#FFF", fontWeight: "700" }}
                          >
                            Aprobar
                          </ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => rejectWebSub(sub)}
                        style={[
                          s.subMiniBtn,
                          { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: ComeYaColors.error, fontWeight: "700" }}
                        >
                          Rechazar
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {pendingPositive.length > 0 && (
                  <Pressable
                    onPress={startBatchPayment}
                    style={[s.subPayBtn, { backgroundColor: PRIMARY }]}
                  >
                    <ThemedText
                      type="body"
                      style={{ color: "#FFF", fontWeight: "700" }}
                    >
                      {pendingPositive.length > 1
                        ? `Aceptar y pagar la diferencia (+${(batchPositiveTotal / 100).toFixed(2)} €)`
                        : "Aprobar y pagar"}
                    </ThemedText>
                  </Pressable>
                )}
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
                            {(itemPrice * itemQty).toFixed(2)} €
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
                      {((order.subtotal || 0) / 100).toFixed(2)} €
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
                      {((order.deliveryFee || 0) / 100).toFixed(2)} €
                    </ThemedText>
                  </View>
                  <View style={[s.detailRow, { marginTop: Spacing.sm }]}>
                    <ThemedText type="h4">Total</ThemedText>
                    <ThemedText
                      type="h4"
                      style={{ color: PRIMARY, fontWeight: "800" }}
                    >
                      {((order.total || 0) / 100).toFixed(2)} €
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

                {/* Factura descargable (PDF) */}
                {["delivered", "completed", "cancelled", "refunded"].includes(
                  order.status,
                ) && (
                  <Pressable
                    onPress={() => printInvoiceWeb(order)}
                    style={[
                      s.invoiceButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <Feather name="file-text" size={15} color={PRIMARY} />
                    <ThemedText
                      type="small"
                      style={{
                        color: PRIMARY,
                        fontWeight: "600",
                        marginLeft: 6,
                      }}
                    >
                      Descargar factura (PDF)
                    </ThemedText>
                  </Pressable>
                )}
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

            {/* La propina se ofrece solo tras la entrega, en la valoración del pedido */}

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
                              allowTip: true,
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
                <View>
                  <View
                    style={[s.confirmButton, { backgroundColor: "#E8F5E9" }]}
                  >
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
                        s.confirmButton,
                        {
                          backgroundColor: "#FFD70022",
                          marginTop: Spacing.sm,
                        },
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
                      onPress={() =>
                        navigation.navigate(
                          "Review" as never,
                          {
                            orderId: order.id,
                            businessId: order.businessId,
                            businessName: order.businessName,
                            deliveryPersonId: order.deliveryPersonId,
                          } as never,
                        )
                      }
                      style={[
                        s.confirmButton,
                        {
                          backgroundColor: ComeYaColors.primary,
                          marginTop: Spacing.sm,
                        },
                      ]}
                    >
                      <Feather name="star" size={20} color="#FFF" />
                      <ThemedText
                        type="body"
                        style={{
                          color: "#FFF",
                          marginLeft: Spacing.sm,
                          fontWeight: "600",
                        }}
                      >
                        Valorar pedido
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}

            {/* Botón compartir seguimiento + reportar incidencia */}
            {order?.status !== "cancelled" && (
              <>
                <Pressable
                  onPress={async () => {
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
                      const nav = navigator as any;
                      if (nav.share) {
                        try {
                          await nav.share({
                            title: "Seguimiento de mi pedido",
                            url: data.trackingUrl,
                          });
                          return;
                        } catch {}
                      }
                      await nav.clipboard.writeText(data.trackingUrl);
                      Alert.alert(
                        "Enlace copiado",
                        "El enlace de seguimiento en vivo se copió al portapapeles",
                      );
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e?.message || "No se pudo compartir el seguimiento",
                      );
                    }
                  }}
                  style={[
                    s.reportButton,
                    { borderColor: theme.border, marginBottom: Spacing.sm },
                  ]}
                >
                  <Feather name="share-2" size={18} color={PRIMARY} />
                  <ThemedText
                    type="body"
                    style={{ marginLeft: Spacing.sm, color: theme.text }}
                  >
                    Compartir seguimiento en vivo
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (user?.role === "delivery_driver") {
                      navigation.navigate("Support" as never);
                    } else {
                      navigation.navigate(
                        "ReportIssue" as never,
                        {
                          orderId: order.id,
                          orderNumber: orderNumberLabel(order),
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
                    Reportar incidencia
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ScrollView>

          {/* Pago de la diferencia por sustitución (Payment Element) */}
          {deltaPayment && (
            <Elements stripe={getDeltaStripe()}>
              <DeltaPaymentModal
                payment={deltaPayment}
                onSuccess={onDeltaSuccess}
                onCancel={() => setDeltaPayment(null)}
              />
            </Elements>
          )}
        </View>
      </View>
    </View>
  );
}

// Modal de pago de la diferencia por sustitución (web): tarjeta con el
// clientSecret del PaymentIntent creado por el servidor
function DeltaPaymentModal({ payment, onSuccess, onCancel }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const { isDark } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements || !payment?.clientSecret) return;
    setSubmitting(true);
    setError(null);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");
      const result = await stripe.confirmCardPayment(payment.clientSecret, {
        payment_method: { card: cardElement },
      });
      if (result.error) {
        setError(result.error.message || "Error al procesar el pago");
        setSubmitting(false);
        return;
      }
      if (result.paymentIntent?.status === "succeeded") {
        onSuccess();
      } else {
        setError("El pago no se completó");
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || "Error al procesar el pago");
      setSubmitting(false);
    }
  };

  return (
    <View style={deltaS.overlay}>
      <View
        style={[
          deltaS.modal,
          { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
        ]}
      >
        <ThemedText type="h3" lightColor="#1a1a1a" darkColor="#ffffff">
          Pagar la diferencia
        </ThemedText>
        <ThemedText
          type="body"
          style={{ marginTop: Spacing.sm }}
          lightColor="#4B5563"
          darkColor="#aaaaaa"
        >
          Importe: {payment.amountEur} €
        </ThemedText>
        <View
          style={[
            deltaS.cardWrap,
            {
              borderColor: isDark ? "#333" : "#e5e7eb",
              backgroundColor: isDark ? "#2a2a2a" : "#f9fafb",
            },
          ]}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: isDark ? "#fff" : "#1a1a1a",
                  "::placeholder": { color: isDark ? "#666" : "#9ca3af" },
                },
              },
            }}
          />
        </View>
        {error && (
          <ThemedText
            type="caption"
            style={{ color: "#EF4444", marginTop: Spacing.sm }}
          >
            {error}
          </ThemedText>
        )}
        <Pressable
          onPress={handlePay}
          disabled={submitting}
          style={[deltaS.payBtn, { opacity: submitting ? 0.6 : 1 }]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="lock" size={16} color="#fff" />
          )}
          <ThemedText
            type="body"
            style={{ color: "#fff", fontWeight: "700", marginLeft: Spacing.xs }}
          >
            {submitting ? "Procesando..." : "Pagar"}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={{ marginTop: Spacing.md, alignSelf: "center" }}
        >
          <ThemedText type="small" style={{ color: "#6B7280" }}>
            Cancelar
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const deltaS = StyleSheet.create({
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  } as any,
  modal: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
  },
  cardWrap: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: Spacing.md,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: Spacing.lg,
  },
});

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
  recenterBtn: {
    position: "absolute",
    bottom: 28,
    right: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 8,
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
  acceptanceNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  substitutionCard: {
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderLeftWidth: 4,
    borderLeftColor: ComeYaColors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  substitutionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  subMiniBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.xs,
  },
  subPayBtn: {
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }),
  },

  pickupCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pickupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupModeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: Spacing.md,
  },
  pickupModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
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
  invoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
  },

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
