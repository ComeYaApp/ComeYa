import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
} from "react-native";
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
import {
  fetchRouteDirections,
  distanceMeters,
  RouteCoordinate,
} from "@/utils/directions";

interface Location {
  latitude: number;
  longitude: number;
  title?: string;
}

interface CollapsibleMapProps {
  businessLocation?: Location;
  deliveryPersonLocation?: Location;
  customerLocation?: Location;
  isLoading?: boolean;
  driverName?: string;
  driverPhoto?: string;
  eta?: string;
  status?: string;
  onCallDriver?: () => void;
  onChatDriver?: () => void;
  onNavigateInApp?: () => void; // navegación interna (pickup), sin apps externas
  isPickup?: boolean;
}

const { width } = Dimensions.get("window");
const MAP_HEIGHT = 300;

const isValidLocation = (location?: Location): location is Location => {
  if (!location) return false;
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude !== 0 &&
    location.longitude !== 0
  );
};

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  accepted: { label: "Pedido aceptado", color: "#3B82F6", icon: "check" },
  preparing: {
    label: "Preparando tu pedido",
    color: "#8B5CF6",
    icon: "package",
  },
  ready: {
    label: "Listo para recoger",
    color: "#10B981",
    icon: "check-circle",
  },
  on_the_way: { label: "En camino", color: "#10B981", icon: "navigation" },
  in_transit: { label: "En camino", color: "#10B981", icon: "navigation" },
  arriving: { label: "Llegando", color: "#10B981", icon: "map-pin" },
  delivered: { label: "Entregado", color: "#10B981", icon: "check-circle" },
  cancelled: { label: "Cancelado", color: "#EF4444", icon: "x-circle" },
};

const STATUS_LABELS_PICKUP: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  accepted: { label: "Pedido aceptado", color: "#3B82F6", icon: "check" },
  preparing: {
    label: "Preparando tu pedido",
    color: "#8B5CF6",
    icon: "package",
  },
  ready: {
    label: "¡Listo! Puedes recogerlo",
    color: "#10B981",
    icon: "shopping-bag",
  },
  delivered: { label: "Recogido", color: "#10B981", icon: "check-circle" },
  cancelled: { label: "Cancelado", color: "#EF4444", icon: "x-circle" },
};

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
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function createPinIcon(color: string, icon: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
    <path d="M20 0C8.95 0 0 8.95 0 20c0 14 20 30 20 30s20-16 20-30C40 8.95 31.05 0 20 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="20" y="24" text-anchor="middle" fill="white" font-size="16" font-family="Arial">${icon}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function CollapsibleMap({
  businessLocation,
  deliveryPersonLocation,
  customerLocation,
  isLoading = false,
  driverName,
  driverPhoto,
  eta,
  status = "preparing",
  onCallDriver,
  onChatDriver,
  onNavigateInApp,
  isPickup = false,
}: CollapsibleMapProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  // Ruta real por calles (Google Directions vía /api/gps/directions)
  const [routePath, setRoutePath] = useState<RouteCoordinate[]>([]);
  const lastRouteRef = useRef<{
    origin: RouteCoordinate;
    destination: RouteCoordinate;
  } | null>(null);
  const routeLoadingRef = useRef(false);

  const statusInfo = isPickup
    ? (STATUS_LABELS_PICKUP[status] ?? STATUS_LABELS_PICKUP.preparing)
    : (STATUS_LABELS[status] ?? STATUS_LABELS.preparing);
  const hasDriver = !isPickup && (!!deliveryPersonLocation || !!driverName);

  // Recalcular ruta real cuando el repartidor avanza (>150 m) o cambia el destino
  useEffect(() => {
    if (isPickup) return;
    const driver = isValidLocation(deliveryPersonLocation)
      ? deliveryPersonLocation
      : null;
    const destination = isValidLocation(customerLocation)
      ? customerLocation
      : null;
    const origin =
      driver ??
      (isValidLocation(businessLocation) ? businessLocation : null);
    if (!origin || !destination) {
      setRoutePath([]);
      lastRouteRef.current = null;
      return;
    }

    const last = lastRouteRef.current;
    if (
      last &&
      distanceMeters(last.origin, origin) < 150 &&
      distanceMeters(last.destination, destination) < 20
    ) {
      return;
    }

    if (routeLoadingRef.current) return;
    routeLoadingRef.current = true;
    fetchRouteDirections(origin, destination)
      .then((result) => {
        lastRouteRef.current = { origin, destination };
        if (result && result.coordinates.length >= 2) {
          setRoutePath(result.coordinates);
        }
      })
      .finally(() => {
        routeLoadingRef.current = false;
      });
  }, [
    isPickup,
    deliveryPersonLocation?.latitude,
    deliveryPersonLocation?.longitude,
    businessLocation?.latitude,
    businessLocation?.longitude,
    customerLocation?.latitude,
    customerLocation?.longitude,
  ]);

  const routeCoords = isPickup
    ? [customerLocation, businessLocation].filter(isValidLocation)
    : routePath.length >= 2
      ? routePath
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(
          isValidLocation,
        );
  const hasAnyLocation = routeCoords.length > 0;

  // Cargar Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => setMapError(true));
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    const bounds = new google.maps.LatLngBounds();

    gmap.current = new google.maps.Map(mapRef.current, {
      center: { lat: businessLocation?.latitude || 41.7636, lng: businessLocation?.longitude || -2.4677 },
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      styles: isDark
        ? [
            { elementType: "geometry", stylers: [{ color: "#212121" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ]
        : [],
    });

    return () => {
      if (gmap.current) {
        // Limpiar markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
      }
    };
  }, [mapsReady]);

  // Actualizar markers y polyline
  useEffect(() => {
    if (!gmap.current) return;
    const google = (window as any).google;
    if (!google) return;

    // Limpiar markers anteriores
    markersRef.current.forEach((m) => m?.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();

    // Negocio
    if (isValidLocation(businessLocation)) {
      const marker = new google.maps.Marker({
        position: { lat: businessLocation!.latitude, lng: businessLocation!.longitude },
        map: gmap.current,
        title: businessLocation!.title || "Negocio",
        icon: createPinIcon("#FF6B35", "\uD83C\uDFEA"),
        animation: google.maps.Animation.DROP,
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    }

    // Repartidor
    if (!isPickup && isValidLocation(deliveryPersonLocation)) {
      const marker = new google.maps.Marker({
        position: { lat: deliveryPersonLocation!.latitude, lng: deliveryPersonLocation!.longitude },
        map: gmap.current,
        title: driverName || "Repartidor",
        icon: createPinIcon("#10B981", "\uD83D\uDE97"),
        animation: google.maps.Animation.DROP,
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    }

    // Cliente
    if (isValidLocation(customerLocation)) {
      const marker = new google.maps.Marker({
        position: { lat: customerLocation!.latitude, lng: customerLocation!.longitude },
        map: gmap.current,
        title: customerLocation!.title || "Tu ubicación",
        icon: createPinIcon("#3B82F6", "\uD83C\uDFE0"),
        animation: google.maps.Animation.DROP,
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    }

    // Ruta entre puntos
    const coords = routeCoords;
    if (coords.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: coords.map((c) => ({ lat: c.latitude, lng: c.longitude })),
        geodesic: true,
        strokeColor: ComeYaColors.primary,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: gmap.current,
      });
    }

    // Ajustar mapa
    if (!bounds.isEmpty()) {
      gmap.current.fitBounds(bounds, 40);
    } else if (isValidLocation(customerLocation)) {
      gmap.current.setCenter({ lat: customerLocation!.latitude, lng: customerLocation!.longitude });
      gmap.current.setZoom(15);
    }
  }, [
    businessLocation,
    deliveryPersonLocation,
    customerLocation,
    routeCoords,
    driverName,
    isPickup,
  ]);

  return (
    <View style={styles.wrapper}>
      {/* MAP */}
      <View style={styles.mapContainer}>
        {mapError ? (
          <View
            style={[
              styles.mapFallback,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <View
              style={[
                styles.mapFallbackIcon,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Feather name="map-pin" size={32} color={ComeYaColors.primary} />
            </View>
            <ThemedText
              type="h4"
              style={{ marginTop: Spacing.md, color: theme.text }}
            >
              {statusInfo.label}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
                paddingHorizontal: Spacing.xl,
              }}
            >
              Mapa no disponible en este momento
            </ThemedText>
          </View>
        ) : (
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: MAP_HEIGHT,
              borderRadius: BorderRadius.xl,
            }}
          />
        )}

        {!mapsReady && !mapError && (
          <View style={[styles.mapFallback, { backgroundColor: theme.backgroundSecondary, position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }]}>
            <View
              style={[
                styles.mapFallbackIcon,
                { backgroundColor: ComeYaColors.primary + "15" },
              ]}
            >
              <Feather name="map-pin" size={32} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
              Cargando mapa...
            </ThemedText>
          </View>
        )}

        {/* Status pill — top overlay */}
        <View
          style={[styles.statusPill, { backgroundColor: statusInfo.color }]}
        >
          <Feather name={statusInfo.icon as any} size={13} color="#FFFFFF" />
          <ThemedText type="caption" style={styles.statusPillText}>
            {statusInfo.label}
          </ThemedText>
        </View>

        {/* ETA pill — top right */}
        {eta && (
          <View style={[styles.etaPill, { backgroundColor: theme.card }]}>
            <Feather name="clock" size={13} color={ComeYaColors.primary} />
            <ThemedText
              type="caption"
              style={[styles.etaPillText, { color: ComeYaColors.primary }]}
            >
              {eta}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Driver card — bottom overlay */}
      {hasDriver && (
        <View
          style={[
            styles.driverCard,
            { backgroundColor: theme.card },
            Shadows.lg,
          ]}
        >
          <View style={styles.driverLeft}>
            {driverPhoto ? (
              <Image
                source={{ uri: driverPhoto }}
                style={styles.driverAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.driverAvatar,
                  { backgroundColor: ComeYaColors.primary + "20" },
                ]}
              >
                <Feather name="user" size={22} color={ComeYaColors.primary} />
              </View>
            )}
            <View style={styles.driverInfo}>
              <ThemedText type="h4" numberOfLines={1}>
                {driverName ?? "Repartidor"}
              </ThemedText>
              <View style={styles.driverBadge}>
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: ComeYaColors.success },
                  ]}
                />
                <ThemedText type="caption" style={{ color: ComeYaColors.success }}>
                  En camino
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.driverActions}>
            {onCallDriver && (
              <Pressable
                onPress={() => onCallDriver()}
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="phone" size={18} color={ComeYaColors.primary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Cómo llegar — navegación DENTRO de la app */}
      {isPickup && isValidLocation(businessLocation) && onNavigateInApp && (
        <Pressable
          onPress={() => onNavigateInApp()}
          style={[
            styles.navigateButton,
            { backgroundColor: ComeYaColors.primary },
            Shadows.lg,
          ]}
        >
          <Feather name="navigation" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{
              color: "#FFFFFF",
              marginLeft: Spacing.sm,
              fontWeight: "600",
            }}
          >
            Cómo llegar
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Shadows.lg,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: "relative",
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  mapFallbackIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  statusPill: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 5,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  etaPill: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 5,
    ...Shadows.sm,
  },
  etaPillText: {
    fontWeight: "700",
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  driverLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  driverBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  driverActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});