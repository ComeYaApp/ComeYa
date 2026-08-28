import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useDriverLocationSocket } from "@/hooks/useDriverLocationSocket";
import { fetchRouteDirections, distanceMeters } from "@/utils/directions";
import { clusterPoints, clusterSvg } from "@/utils/webClustering";
import {
  pinIcon,
  driverIcon,
  businessLabelIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GOOGLE_MAPS_API_KEY = "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

interface BusinessPin {
  id: string;
  name: string;
  type: string;
  categories?: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  isOpen: boolean;
  latitude: number;
  longitude: number;
  address: string;
}

interface ActiveOrder {
  id: string;
  businessName: string;
  status: string;
  eta?: number;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  deliveryPersonPhoto?: string;
  vehicleType?: string;
  deliveryLatitude?: string;
  deliveryLongitude?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Esperando confirmación", color: "#F59E0B" },
  confirmed: { label: "Pedido confirmado", color: "#3B82F6" },
  preparing: { label: "Preparando", color: "#8B5CF6" },
  ready: { label: "Listo para recoger", color: "#10B981" },
  on_the_way: { label: "En camino 🛵", color: ComeYaColors.success },
};

const CATEGORIES = [
  { key: "all", label: "Todos", icon: "grid" },
  { key: "restaurant", label: "Comida", icon: "coffee" },
  { key: "market", label: "Mercado", icon: "shopping-bag" },
  { key: "pharmacy", label: "Farmacia", icon: "plus-circle" },
];

// Inyectar Google Maps script una sola vez
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
    const script = document.createElement("script");
    script.id = "gmap-script";
    const k = await fetch(
      (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api/config/maps-key",
    )
      .then((r) => r.json())
      .then((d) => d.key)
      .catch(() => GOOGLE_MAPS_API_KEY);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${k}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function BusinessMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const homeMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const lastDriverRoutePointRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const driverRouteCoordsRef = useRef<{ lat: number; lng: number }[] | null>(
    null,
  );

  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [showDriverPanel, setShowDriverPanel] = useState(false);
  const [zoom, setZoom] = useState(14);

  // Cargar Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => console.error("Error cargando Google Maps"));
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    // Actualizar zoom para recalcular clusters
    gmap.current.addListener("zoom_changed", () => {
      setZoom(gmap.current?.getZoom() || 14);
    });
  }, [mapsReady, isDark]);

  // GPS del usuario
  useEffect(() => {
    if (!mapsReady) return;
    navigator.geolocation?.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      gmap.current?.panTo(loc);

      const google = (window as any).google;
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);
      userMarkerRef.current = new google.maps.Marker({
        position: loc,
        map: gmap.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: ComeYaColors.primary,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
        title: "Tu ubicación",
        zIndex: 999,
      });
    });
  }, [mapsReady]);

  // Cargar negocios
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/business");
        const data = await res.json();
        const raw = data.businesses || [];
        const pins: BusinessPin[] = raw
          .filter((b: any) => b.latitude && b.longitude)
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            type: b.type || "restaurant",
            categories: b.categories || undefined,
            image: b.image || "",
            rating: (b.rating || 0) / 100,
            deliveryTime: b.delivery_time || b.deliveryTime || "30-45 min",
            deliveryFee: (b.delivery_fee || 0) / 100,
            isOpen: b.isOpen ?? b.is_open ?? false,
            latitude: parseFloat(b.latitude),
            longitude: parseFloat(b.longitude),
            address: b.address || "Soria, España",
          }));
        setBusinesses(pins);
      } catch (e) {
        console.error("Error cargando negocios:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Cargar pedidos activos
  useEffect(() => {
    if (user?.role !== "customer") return;
    const fetch = async () => {
      try {
        const res = await apiRequest("GET", "/api/orders");
        if (!res.ok) return; // silenciar 429 y otros errores
        const data = await res.json();
        const allOrders = data.orders || [];
        const active = allOrders
          .filter((o: any) =>
            [
              "pending",
              "confirmed",
              "preparing",
              "ready",
              "on_the_way",
            ].includes(o.order?.status || o.status),
          )
          .map((o: any) => ({
            id: o.order?.id || o.id,
            businessName: o.order?.businessName || o.businessName || "Negocio",
            status: o.order?.status || o.status,
            deliveryPersonId: o.order?.deliveryPersonId || o.deliveryPersonId,
            deliveryPersonName:
              o.order?.deliveryPersonName || o.deliveryPersonName,
            deliveryPersonPhone:
              o.order?.deliveryPersonPhone || o.deliveryPersonPhone,
            vehicleType: o.order?.vehicleType || o.vehicleType,
            deliveryLatitude: o.order?.deliveryLatitude || o.deliveryLatitude,
            deliveryLongitude:
              o.order?.deliveryLongitude || o.deliveryLongitude,
            eta:
              o.order?.estimatedDelivery || o.estimatedDelivery
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(
                        o.order?.estimatedDelivery || o.estimatedDelivery,
                      ).getTime() -
                        Date.now()) /
                        60000,
                    ),
                  )
                : undefined,
          }));
        setActiveOrders(active);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 30000); // 30s en vez de 15s
    return () => clearInterval(interval);
  }, [user]);

  // Posición del repartidor en vivo: WebSocket con fallback a polling
  const onTheWayOrder =
    activeOrders.find((o) => o.status === "on_the_way") || null;
  const { location: socketLocation } = useDriverLocationSocket(
    onTheWayOrder?.id ?? null,
    { fallbackIntervalMs: 5000 },
  );

  // Pin de casa + limpieza cuando no hay pedido en camino
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const order = activeOrders.find((o) => o.status === "on_the_way");
    if (!order) {
      // Limpiar markers de repartidor si no hay pedido en camino
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.setMap(null);
        routeLineRef.current = null;
      }
      lastDriverRoutePointRef.current = null;
      driverRouteCoordsRef.current = null;
      return;
    }

    // Mostrar pin de casa (destino)
    if (
      order.deliveryLatitude &&
      order.deliveryLongitude &&
      !homeMarkerRef.current
    ) {
      const google = (window as any).google;
      const homePos = {
        lat: parseFloat(order.deliveryLatitude),
        lng: parseFloat(order.deliveryLongitude),
      };
      homeMarkerRef.current = new google.maps.Marker({
        position: homePos,
        map: gmap.current,
        title: "Tu dirección",
        icon: asGoogleIcon(
          google,
          pinIcon(CUSTOMER_MARKER.color, CUSTOMER_MARKER.icon),
        ),
        zIndex: 90,
      });
    }
  }, [mapsReady, activeOrders]);

  // Repartidor en camino: marcador + ruta verde vía proxy (threshold >100 m)
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const order = activeOrders.find((o) => o.status === "on_the_way");
    if (
      !order ||
      !socketLocation?.latitude ||
      !socketLocation?.longitude
    )
      return;
    const google = (window as any).google;
    const driverPos = {
      lat: socketLocation.latitude,
      lng: socketLocation.longitude,
    };

    const vehicle = vehicleMarkerMeta(order.vehicleType);

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(driverPos);
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
      });
      driverMarkerRef.current.addListener("click", () =>
        setShowDriverPanel(true),
      );
    }

    // Ruta verde repartidor → casa vía proxy (caché + rate limit en servidor)
    if (order.deliveryLatitude && order.deliveryLongitude) {
      const destPos = {
        lat: parseFloat(order.deliveryLatitude),
        lng: parseFloat(order.deliveryLongitude),
      };

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
          { latitude: destPos.lat, longitude: destPos.lng },
        )
          .then((route) => {
            if (route && route.coordinates.length >= 2) {
              driverRouteCoordsRef.current = route.coordinates.map((c) => ({
                lat: c.latitude,
                lng: c.longitude,
              }));
            } else {
              driverRouteCoordsRef.current = null;
            }
            if (routeLineRef.current) {
              routeLineRef.current.setMap(null);
              routeLineRef.current = null;
            }
            // SOLO geometría real por calles — sin ruta no se dibuja nada
            // (nada de líneas rectas inventadas)
            if (driverRouteCoordsRef.current) {
              routeLineRef.current = new google.maps.Polyline({
                path: driverRouteCoordsRef.current,
                geodesic: true,
                strokeColor: "#10B981",
                strokeOpacity: 0.9,
                strokeWeight: 5,
                map: gmap.current,
              });
            }
          })
          .catch(() => {});
      }

      // Ajustar bounds
      const b = new google.maps.LatLngBounds();
      b.extend(driverPos);
      b.extend(destPos);
      gmap.current.fitBounds(b, {
        top: 80,
        right: 80,
        bottom: 200,
        left: 80,
      });
    }
    setShowDriverPanel(true);
  }, [mapsReady, activeOrders, socketLocation]);

  // Renderizar pins en el mapa (con clustering según zoom)
  useEffect(() => {
    if (!mapsReady || !gmap.current || businesses.length === 0) return;
    const google = (window as any).google;

    // Limpiar markers anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const filtered =
      categoryFilter === "all"
        ? businesses
        : businesses.filter((b) => b.type === categoryFilter);

    const clusters = clusterPoints(
      filtered.map((b) => ({
        id: b.id,
        lat: b.latitude,
        lng: b.longitude,
        data: b,
      })),
      zoom,
    );

    clusters.forEach((cluster) => {
      if (cluster.count === 1) {
        const b = cluster.items[0].data;
        const meta = businessMarkerMeta(b.type, b.categories);
        const marker = new google.maps.Marker({
          position: { lat: cluster.lat, lng: cluster.lng },
          map: gmap.current,
          title: b.name,
          icon: asGoogleIcon(
            google,
            businessLabelIcon({
              iconKey: meta.icon,
              color: meta.color,
              title: b.name,
              subtitle: b.isOpen ? b.deliveryTime : "Cerrado",
            }),
          ),
          zIndex: b.isOpen ? 10 : 1,
        });
        marker.addListener("click", () => {
          setSelected(b);
          gmap.current?.panTo({ lat: b.latitude - 0.005, lng: b.longitude });
        });
        markersRef.current.push(marker);
      } else {
        // Cluster con contador: al pulsar, hace zoom para expandirlo
        const marker = new google.maps.Marker({
          position: { lat: cluster.lat, lng: cluster.lng },
          map: gmap.current,
          title: `${cluster.count} negocios`,
          icon: {
            url: clusterSvg(cluster.count),
            scaledSize: new google.maps.Size(44, 44),
          },
          zIndex: 50,
        });
        marker.addListener("click", () => {
          gmap.current?.panTo({ lat: cluster.lat, lng: cluster.lng });
          gmap.current?.setZoom(Math.min(20, (gmap.current.getZoom() || zoom) + 2));
        });
        markersRef.current.push(marker);
      }
    });
  }, [mapsReady, businesses, categoryFilter, zoom]);

  const handleCenterUser = useCallback(() => {
    if (!userLocation) return;
    gmap.current?.panTo(userLocation);
    gmap.current?.setZoom(15);
  }, [userLocation]);

  const handleDirections = useCallback((b: BusinessPin) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`,
      "_blank",
    );
  }, []);

  const visibleCount =
    categoryFilter === "all"
      ? businesses.length
      : businesses.filter((b) => b.type === categoryFilter).length;

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Mapa Google Maps */}
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {/* Loading */}
      {(isLoading || !mapsReady) && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText
            type="body"
            style={{ marginTop: Spacing.md, color: theme.textSecondary }}
          >
            Cargando mapa...
          </ThemedText>
        </View>
      )}

      {/* Header flotante */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
          <ThemedText
            type="body"
            style={{ fontWeight: "700", marginLeft: Spacing.xs }}
          >
            {visibleCount} negocios
          </ThemedText>
        </View>
        <Pressable
          onPress={handleCenterUser}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="navigation" size={22} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Filtros */}
      <View style={[s.filtersRow, { top: insets.top + 58 }]}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => setCategoryFilter(cat.key)}
            style={[
              s.filterChip,
              {
                backgroundColor:
                  categoryFilter === cat.key
                    ? ComeYaColors.primary
                    : theme.card,
              },
            ]}
          >
            <Feather
              name={cat.icon as any}
              size={13}
              color={categoryFilter === cat.key ? "#fff" : theme.text}
            />
            <ThemedText
              type="caption"
              style={{
                marginLeft: 4,
                color: categoryFilter === cat.key ? "#fff" : theme.text,
                fontWeight: "600",
              }}
            >
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Leyenda */}
      <View
        style={[
          s.legend,
          {
            backgroundColor: theme.card,
            bottom: selected ? 300 : insets.bottom + Spacing.lg,
          },
        ]}
      >
        <View style={s.legendItem}>
          <View
            style={[s.legendDot, { backgroundColor: ComeYaColors.primary }]}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Abierto
          </ThemedText>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: "#9E9E9E" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Cerrado
          </ThemedText>
        </View>
      </View>

      {/* Card negocio seleccionado */}
      {selected && (
        <Pressable
          style={[
            s.card,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + Spacing.md,
            },
            Shadows.lg,
          ]}
          onPress={() => setSelected(null)}
        >
          <View style={s.cardHandle} />
          <View style={s.cardContent}>
            <Image
              source={
                selected.image
                  ? { uri: selected.image }
                  : require("../../assets/images/delivery-hero.png")
              }
              style={s.cardImage}
              contentFit="cover"
            />
            <View style={s.cardInfo}>
              <View style={s.cardNameRow}>
                <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
                  {selected.name}
                </ThemedText>
                <View
                  style={[
                    s.statusBadge,
                    {
                      backgroundColor: selected.isOpen
                        ? ComeYaColors.primary + "20"
                        : "#9E9E9E20",
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color: selected.isOpen ? ComeYaColors.primary : "#9E9E9E",
                      fontWeight: "700",
                    }}
                  >
                    {selected.isOpen ? "Abierto" : "Cerrado"}
                  </ThemedText>
                </View>
              </View>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
                numberOfLines={1}
              >
                {selected.address}
              </ThemedText>
              <View style={s.cardMeta}>
                <View style={s.metaItem}>
                  <Feather name="star" size={12} color="#FFB800" />
                  <ThemedText type="caption" style={{ marginLeft: 3 }}>
                    {selected.rating.toFixed(1)}
                  </ThemedText>
                </View>
                <View style={s.metaItem}>
                  <Feather name="clock" size={12} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ marginLeft: 3, color: theme.textSecondary }}
                  >
                    {selected.deliveryTime}
                  </ThemedText>
                </View>
                <View style={s.metaItem}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ marginLeft: 3, color: theme.textSecondary }}
                  >
                    {selected.deliveryFee.toFixed(0)} €
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
          <View style={s.cardButtons}>
            <Pressable
              onPress={() => handleDirections(selected)}
              style={[s.btnDirections, { borderColor: ComeYaColors.primary }]}
            >
              <Feather
                name="navigation"
                size={16}
                color={ComeYaColors.primary}
              />
              <ThemedText
                type="small"
                style={{
                  color: ComeYaColors.primary,
                  fontWeight: "700",
                  marginLeft: Spacing.xs,
                }}
              >
                Cómo llegar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setSelected(null);
                navigation
                  .getParent()
                  ?.navigate("BusinessDetail", { businessId: selected.id });
              }}
              style={s.btnMenu}
            >
              <Feather name="book-open" size={16} color="#fff" />
              <ThemedText
                type="small"
                style={{
                  color: "#fff",
                  fontWeight: "700",
                  marginLeft: Spacing.xs,
                }}
              >
                Ver menú
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Panel repartidor en camino */}
      {showDriverPanel &&
        activeOrders.find((o) => o.status === "on_the_way") &&
        (() => {
          const order = activeOrders.find((o) => o.status === "on_the_way")!;
          const vehicleLabel =
            order.vehicleType === "car"
              ? "Coche 🚗"
              : order.vehicleType === "bike"
                ? "Bicicleta 🚲"
                : "Moto 🛵";
          return (
            <View
              style={[
                s.driverPanel,
                { backgroundColor: theme.card, bottom: insets.bottom + 16 },
              ]}
            >
              <View style={s.driverPanelHeader}>
                <View
                  style={[s.driverPanelDot, { backgroundColor: "#10B981" }]}
                />
                <ThemedText
                  type="small"
                  style={{ color: "#10B981", fontWeight: "700", flex: 1 }}
                >
                  En camino 🛵
                </ThemedText>
                <Pressable
                  onPress={() => setShowDriverPanel(false)}
                  style={s.driverPanelClose}
                >
                  <Feather name="x" size={16} color={theme.textSecondary} />
                </Pressable>
              </View>
              <View style={s.driverRow}>
                {order.deliveryPersonPhoto ? (
                  <Image
                    source={{ uri: order.deliveryPersonPhoto }}
                    style={s.driverPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      s.driverPhotoPlaceholder,
                      { backgroundColor: "#10B98120" },
                    ]}
                  >
                    <Feather name="user" size={22} color="#10B981" />
                  </View>
                )}
                <View style={s.driverInfo}>
                  <ThemedText type="body" style={{ fontWeight: "700" }}>
                    {order.deliveryPersonName || "Repartidor"}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {vehicleLabel}
                  </ThemedText>
                  {order.eta !== undefined && (
                    <ThemedText
                      type="caption"
                      style={{ color: "#10B981", fontWeight: "600" }}
                    >
                      Llega en ~{order.eta} min
                    </ThemedText>
                  )}
                </View>
                <View style={s.driverActions}>
                  {order.deliveryPersonPhone && (
                    <Pressable
                      onPress={() =>
                        (window as any).open(
                          `tel:${order.deliveryPersonPhone}`,
                          "_self",
                        )
                      }
                      style={[s.driverBtn, { backgroundColor: "#DC2626" }]}
                    >
                      <Feather name="phone" size={16} color="#fff" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      navigation.navigate("OrderTracking", {
                        orderId: order.id,
                      })
                    }
                    style={[
                      s.driverBtn,
                      { backgroundColor: "#10B981", marginTop: 6 },
                    ]}
                  >
                    <Feather name="map" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })()}

      {/* Banner pedido activo */}
      {activeOrders.length > 0 && !selected && (
        <Pressable
          onPress={() =>
            navigation.navigate("OrderTracking", {
              orderId: activeOrders[0].id,
            })
          }
          style={[
            s.orderBanner,
            { backgroundColor: theme.card, bottom: insets.bottom + 16 },
          ]}
        >
          <View
            style={[
              s.orderBannerDot,
              {
                backgroundColor:
                  STATUS_LABELS[activeOrders[0].status]?.color ||
                  ComeYaColors.primary,
              },
            ]}
          />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText
              type="caption"
              style={{
                fontWeight: "700",
                color:
                  STATUS_LABELS[activeOrders[0].status]?.color ||
                  ComeYaColors.primary,
              }}
            >
              {STATUS_LABELS[activeOrders[0].status]?.label || "Pedido activo"}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {activeOrders[0].businessName}
              {activeOrders[0].eta !== undefined
                ? ` · ${activeOrders[0].eta} min`
                : ""}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

// Estilo oscuro para Google Maps
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
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
];

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 20,
  } as any,
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  filtersRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    zIndex: 9,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  legend: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 10,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  cardContent: { flexDirection: "row", marginBottom: Spacing.md },
  cardImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  cardMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center" },
  cardButtons: { flexDirection: "row", gap: Spacing.md },
  btnDirections: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  btnMenu: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: ComeYaColors.primary,
  },
  orderBanner: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  orderBannerDot: { width: 10, height: 10, borderRadius: 5 },
  driverPanel: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10,
  },
  driverPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  driverPanelDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  driverPanelClose: { padding: 4 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  driverPhoto: { width: 52, height: 52, borderRadius: 26 },
  driverPhotoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInfo: { flex: 1, gap: 2 },
  driverActions: { alignItems: "center" },
  driverBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
