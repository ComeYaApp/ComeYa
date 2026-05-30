import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";

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
  isPickup?: boolean;
}

const { width } = Dimensions.get("window");
const MAP_HEIGHT = 400;

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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
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
  isPickup = false,
}: CollapsibleMapProps) {
  const { theme, isDark } = useTheme();
  const [mapsReady, setMapsReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const businessMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  const statusInfo = isPickup
    ? (STATUS_LABELS_PICKUP[status] ?? STATUS_LABELS_PICKUP.preparing)
    : (STATUS_LABELS[status] ?? STATUS_LABELS.preparing);
  const hasDriver = !isPickup && (!!deliveryPersonLocation || !!driverName);

  // Cargar Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    // Calcular centro y zoom
    const locations = isPickup
      ? [businessLocation, customerLocation].filter(isValidLocation)
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(
          isValidLocation,
        );

    let center = { lat: 41.7636, lng: -2.4677 }; // Soria por defecto
    if (locations.length > 0) {
      const lats = locations.map((l) => l.latitude);
      const lngs = locations.map((l) => l.longitude);
      center = {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }

    gmap.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: isDark ? DARK_MAP_STYLE : [],
      gestureHandling: "greedy",
    });

    // Ajustar vista para mostrar todos los marcadores
    if (locations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach((loc) =>
        bounds.extend({ lat: loc.latitude, lng: loc.longitude }),
      );
      gmap.current.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
    }
  }, [mapsReady, isDark, isPickup]);

  // Actualizar marcador del negocio
  useEffect(() => {
    if (!mapsReady || !gmap.current || !isValidLocation(businessLocation))
      return;
    const google = (window as any).google;

    if (businessMarkerRef.current) {
      businessMarkerRef.current.setPosition({
        lat: businessLocation.latitude,
        lng: businessLocation.longitude,
      });
    } else {
      businessMarkerRef.current = new google.maps.Marker({
        position: {
          lat: businessLocation.latitude,
          lng: businessLocation.longitude,
        },
        map: gmap.current,
        title: businessLocation.title || "Negocio",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#FF6B35" stroke="white" stroke-width="3"/><path d="M13 16h14M15 16v-2a1 1 0 011-1h8a1 1 0 011 1v2M13 20h14l-1 8H14l-1-8z" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><polygon points="14,38 26,38 20,48" fill="#FF6B35"/></svg>')}`,
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48),
        },
        zIndex: 100,
      });
    }
  }, [mapsReady, businessLocation, isPickup]);

  // Actualizar marcador del cliente
  useEffect(() => {
    if (!mapsReady || !gmap.current || !isValidLocation(customerLocation))
      return;
    const google = (window as any).google;

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setPosition({
        lat: customerLocation.latitude,
        lng: customerLocation.longitude,
      });
    } else {
      customerMarkerRef.current = new google.maps.Marker({
        position: {
          lat: customerLocation.latitude,
          lng: customerLocation.longitude,
        },
        map: gmap.current,
        title: "Tu ubicación",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#3B82F6" stroke="white" stroke-width="3"/><path d="M10 20l10-8 10 8M12 20v8h6v-5h4v5h6v-8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polygon points="14,38 26,38 20,48" fill="#3B82F6"/></svg>')}`,
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48),
        },
        zIndex: 100,
      });
    }
  }, [mapsReady, customerLocation]);

  // Actualizar marcador del repartidor (SOLO DELIVERY)
  useEffect(() => {
    if (isPickup || !mapsReady || !gmap.current) return;
    const google = (window as any).google;

    if (!isValidLocation(deliveryPersonLocation)) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      return;
    }

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition({
        lat: deliveryPersonLocation.latitude,
        lng: deliveryPersonLocation.longitude,
      });
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: {
          lat: deliveryPersonLocation.latitude,
          lng: deliveryPersonLocation.longitude,
        },
        map: gmap.current,
        title: driverName || "Repartidor",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><circle cx="28" cy="28" r="26" fill="#10B981" stroke="white" stroke-width="4"/><circle cx="28" cy="28" r="22" fill="#10B981" opacity="0.3"/><path d="M18 32c0-2 1-4 3-5l5-2 4 2c2 1 3 3 3 5M21 34a3 3 0 106 0M35 34a3 3 0 106 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22 27l3-6h6l2 4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>')}`,
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        zIndex: 999,
        animation: google.maps.Animation.DROP,
      });
    }
  }, [mapsReady, deliveryPersonLocation, driverName, isPickup]);

  // Actualizar ruta (polyline)
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    const routeCoords = isPickup
      ? [customerLocation, businessLocation].filter(isValidLocation)
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(
          isValidLocation,
        );

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (routeCoords.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: routeCoords.map((loc) => ({
          lat: loc.latitude,
          lng: loc.longitude,
        })),
        geodesic: true,
        strokeColor: ComeYaColors.primary,
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: gmap.current,
      });
    }
  }, [
    mapsReady,
    businessLocation,
    deliveryPersonLocation,
    customerLocation,
    isPickup,
  ]);

  // Ajustar bounds cuando cambian las ubicaciones
  useEffect(() => {
    if (!mapsReady || !gmap.current) return;
    const google = (window as any).google;

    const locations = isPickup
      ? [businessLocation, customerLocation].filter(isValidLocation)
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(
          isValidLocation,
        );

    if (locations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach((loc) =>
        bounds.extend({ lat: loc.latitude, lng: loc.longitude }),
      );
      gmap.current.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
    }
  }, [
    mapsReady,
    businessLocation,
    deliveryPersonLocation,
    customerLocation,
    isPickup,
  ]);

  const hasAnyLocation =
    isValidLocation(businessLocation) ||
    isValidLocation(customerLocation) ||
    isValidLocation(deliveryPersonLocation);

  return (
    <View style={styles.wrapper}>
      {/* MAP */}
      <View style={styles.mapContainer}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

        {(!mapsReady || !hasAnyLocation) && (
          <View
            style={[
              styles.mapFallback,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="map-pin" size={40} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.sm,
                textAlign: "center",
              }}
            >
              {!mapsReady
                ? "Cargando mapa..."
                : "Esperando ubicación del pedido..."}
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

      {/* Driver card — bottom overlay (SOLO DELIVERY) */}
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
                <ThemedText
                  type="caption"
                  style={{ color: ComeYaColors.success }}
                >
                  En camino
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.driverActions}>
            {onCallDriver && (
              <Pressable
                onPress={onCallDriver}
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="phone" size={18} color={ComeYaColors.primary} />
              </Pressable>
            )}
            {onChatDriver && (
              <Pressable
                onPress={onChatDriver}
                style={[
                  styles.actionBtn,
                  { backgroundColor: ComeYaColors.primary },
                ]}
              >
                <Feather name="message-circle" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Botón Abrir en Google Maps (SOLO PICKUP) */}
      {isPickup && isValidLocation(businessLocation) && (
        <Pressable
          onPress={() => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${businessLocation.latitude},${businessLocation.longitude}`;
            window.open(url, "_blank");
          }}
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
            Abrir en Google Maps
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const DARK_MAP_STYLE = [
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
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Platform.select({ web: { boxShadow: "0 8px 24px rgba(0,0,0,0.12)" } }),
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: "relative",
  },
  mapFallback: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  } as any,
  // Status pill
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
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.2)" } }),
  } as any,
  statusPillText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // ETA pill
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
    ...Platform.select({ web: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" } }),
  } as any,
  etaPillText: {
    fontWeight: "700",
  },
  // Driver card
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
