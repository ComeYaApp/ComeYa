import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Animated,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";

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
  isPickup?: boolean; // Nuevo: indica si es pedido pickup
}

const { width } = Dimensions.get("window");
const MAP_HEIGHT = 300;

const isValidLocation = (location?: Location): location is Location => {
  if (!location) return false;
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && location.latitude !== 0 && location.longitude !== 0;
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pending:       { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  accepted:      { label: "Pedido aceptado",        color: "#3B82F6", icon: "check" },
  preparing:     { label: "Preparando tu pedido",   color: "#8B5CF6", icon: "package" },
  ready:         { label: "Listo para recoger",     color: "#10B981", icon: "check-circle" },
  on_the_way:    { label: "En camino",              color: "#10B981", icon: "navigation" },
  in_transit:    { label: "En camino",              color: "#10B981", icon: "navigation" },
  arriving:      { label: "Llegando",               color: "#10B981", icon: "map-pin" },
  delivered:     { label: "Entregado",              color: "#10B981", icon: "check-circle" },
  cancelled:     { label: "Cancelado",              color: "#EF4444", icon: "x-circle" },
};

const STATUS_LABELS_PICKUP: Record<string, { label: string; color: string; icon: string }> = {
  pending:       { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  accepted:      { label: "Pedido aceptado",        color: "#3B82F6", icon: "check" },
  preparing:     { label: "Preparando tu pedido",   color: "#8B5CF6", icon: "package" },
  ready:         { label: "¡Listo! Puedes recogerlo", color: "#10B981", icon: "shopping-bag" },
  delivered:     { label: "Recogido",               color: "#10B981", icon: "check-circle" },
  cancelled:     { label: "Cancelado",              color: "#EF4444", icon: "x-circle" },
};

function DriverMarker({ color }: { color: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.pulsingWrapper}>
      <Animated.View
        style={[
          styles.pulsingRing,
          { borderColor: color, transform: [{ scale: pulseAnim }] },
        ]}
      />
      <View style={[styles.markerOuter, { backgroundColor: "#FFFFFF" }]}>
        <View style={[styles.markerInner, { backgroundColor: color }]}>
          <Feather name="navigation" size={14} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
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
  const [mapAvailable, setMapAvailable] = useState(false);

  const statusInfo = isPickup 
    ? (STATUS_LABELS_PICKUP[status] ?? STATUS_LABELS_PICKUP.preparing)
    : (STATUS_LABELS[status] ?? STATUS_LABELS.preparing);
  const hasDriver = !isPickup && (!!deliveryPersonLocation || !!driverName);

  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      const maps = require("react-native-maps");
      MapView = maps.default;
      Marker = maps.Marker;
      Polyline = maps.Polyline;
      PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
      setMapAvailable(true);
    } catch {
      setMapAvailable(false);
    }
  }, []);

  const getInitialRegion = () => {
    // Para pickup: solo mostrar negocio y cliente
    const locations = isPickup 
      ? [businessLocation, customerLocation].filter(isValidLocation)
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(isValidLocation);
    
    if (locations.length === 0) {
      return customerLocation && isValidLocation(customerLocation)
        ? { latitude: customerLocation.latitude, longitude: customerLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        : { latitude: 41.7636, longitude: -2.4677, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    const lats = locations.map((l) => l.latitude);
    const lngs = locations.map((l) => l.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.015, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.015, (maxLng - minLng) * 1.6),
    };
  };

  const routeCoords = isPickup
    ? [customerLocation, businessLocation].filter(isValidLocation)
    : [businessLocation, deliveryPersonLocation, customerLocation].filter(isValidLocation);
  const hasAnyLocation = routeCoords.length > 0;

  return (
    <View style={styles.wrapper}>
      {/* MAP */}
      <View style={styles.mapContainer}>
        {mapAvailable && hasAnyLocation ? (
          <MapView
            style={styles.map}
            initialRegion={getInitialRegion()}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsTraffic={false}
            mapType="standard"
            customMapStyle={isDark ? darkMapStyle : []}
          >
            {/* Business marker */}
            {isValidLocation(businessLocation) && (
              <Marker coordinate={businessLocation} title="Negocio" anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.markerOuter, { backgroundColor: "#FFFFFF" }]}>
                  <View style={[styles.markerInner, { backgroundColor: ComeYaColors.primary }]}>
                    <Feather name="shopping-bag" size={14} color="#FFFFFF" />
                  </View>
                </View>
              </Marker>
            )}

            {/* Driver marker — pulsing (SOLO DELIVERY) */}
            {!isPickup && isValidLocation(deliveryPersonLocation) && (
              <Marker coordinate={deliveryPersonLocation} title="Repartidor" anchor={{ x: 0.5, y: 0.5 }}>
                <DriverMarker color={ComeYaColors.success} />
              </Marker>
            )}

            {/* Customer marker */}
            {isValidLocation(customerLocation) && (
              <Marker coordinate={customerLocation} title="Tu ubicación" anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.markerOuter, { backgroundColor: "#FFFFFF" }]}>
                  <View style={[styles.markerInner, { backgroundColor: "#3B82F6" }]}>
                    <Feather name="home" size={14} color="#FFFFFF" />
                  </View>
                </View>
              </Marker>
            )}

            {/* Route line */}
            {routeCoords.length >= 2 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor={ComeYaColors.primary}
                strokeWidth={4}
              />
            )}
          </MapView>
        ) : (
          <View style={[styles.mapFallback, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="map-pin" size={40} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              {!mapAvailable ? "Mapa no disponible" : "Esperando ubicación del pedido..."}
            </ThemedText>
          </View>
        )}

        {/* Status pill — top overlay */}
        <View style={[styles.statusPill, { backgroundColor: statusInfo.color }]}>
          <Feather name={statusInfo.icon as any} size={13} color="#FFFFFF" />
          <ThemedText type="caption" style={styles.statusPillText}>
            {statusInfo.label}
          </ThemedText>
        </View>

        {/* ETA pill — top right */}
        {eta && (
          <View style={[styles.etaPill, { backgroundColor: theme.card }]}>
            <Feather name="clock" size={13} color={ComeYaColors.primary} />
            <ThemedText type="caption" style={[styles.etaPillText, { color: ComeYaColors.primary }]}>
              {eta}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Driver card — bottom overlay (SOLO DELIVERY) */}
      {hasDriver && (
        <View style={[styles.driverCard, { backgroundColor: theme.card }, Shadows.lg]}>
          <View style={styles.driverLeft}>
            {driverPhoto ? (
              <Image
                source={{ uri: driverPhoto }}
                style={styles.driverAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.driverAvatar, { backgroundColor: ComeYaColors.primary + "20" }]}>
                <Feather name="user" size={22} color={ComeYaColors.primary} />
              </View>
            )}
            <View style={styles.driverInfo}>
              <ThemedText type="h4" numberOfLines={1}>{driverName ?? "Repartidor"}</ThemedText>
              <View style={styles.driverBadge}>
                <View style={[styles.onlineDot, { backgroundColor: ComeYaColors.success }]} />
                <ThemedText type="caption" style={{ color: ComeYaColors.success }}>
                  En camino
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.driverActions}>
            {onCallDriver && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCallDriver(); }}
                style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="phone" size={18} color={ComeYaColors.primary} />
              </Pressable>
            )}
            {onChatDriver && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChatDriver(); }}
                style={[styles.actionBtn, { backgroundColor: ComeYaColors.primary }]}
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const url = Platform.select({
              ios: `maps://app?daddr=${businessLocation.latitude},${businessLocation.longitude}`,
              android: `google.navigation:q=${businessLocation.latitude},${businessLocation.longitude}`,
              default: `https://www.google.com/maps/dir/?api=1&destination=${businessLocation.latitude},${businessLocation.longitude}`,
            });
            Linking.openURL(url!);
          }}
          style={[styles.navigateButton, { backgroundColor: ComeYaColors.primary }, Shadows.lg]}
        >
          <Feather name="navigation" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
            Abrir en Google Maps
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  },
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
    ...Shadows.sm,
  },
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
  // Markers
  pulsingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
  },
  pulsingRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    opacity: 0.4,
  },
  markerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    ...Shadows.md,
  },
  markerInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
