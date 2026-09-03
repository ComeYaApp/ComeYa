import React, { useState, useEffect, useRef, useMemo } from "react";
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

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

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
import { routePhaseForStatus } from "@/utils/routePhase";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { BusinessPin } from "@/components/map/BusinessPin";
import { DriverPin } from "@/components/map/DriverPin";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";
import { mapStyleForTheme } from "@/utils/mapStyle";
import { snapToRoute, formatRemaining } from "@/utils/snapToRoute";

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
  /** Vehículo del repartidor (vehicle_type): bike/bicycle/motorcycle/car… */
  driverVehicle?: string;
  /** Nombre del negocio (para la burbuja del mapa) */
  businessName?: string;
  /** Tipo de negocio (restaurant/market/…) para el icono */
  businessType?: string;
  /** Categorías del negocio ("pizza, burgers, …") para el icono */
  businessCategories?: string;
  eta?: string;
  status?: string;
  onCallDriver?: () => void;
  onNavigateInApp?: (travelMode?: "driving" | "walking") => void; // navegación interna (pickup), sin apps externas
  isPickup?: boolean; // Nuevo: indica si es pedido pickup
  /** Rumbo del repartidor (grados 0-360) para rotar su pin. */
  driverHeading?: number;
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

export function CollapsibleMap({
  businessLocation,
  deliveryPersonLocation,
  customerLocation,
  isLoading = false,
  driverName,
  driverPhoto,
  driverVehicle,
  businessName,
  businessType,
  businessCategories,
  eta,
  status = "preparing",
  onCallDriver,
  onNavigateInApp,
  isPickup = false,
  driverHeading,
}: CollapsibleMapProps) {
  const { theme, isDark } = useTheme();
  const [mapAvailable, setMapAvailable] = useState(false);
  const mapRef = useRef<any>(null);
  // Rumbo efectivo del repartidor: si el WS deja de mandarlo (repartidor
  // parado), se conserva el último — la flecha se queda quieta, no se borra
  const [latchedHeading, setLatchedHeading] = useState<number | undefined>(
    driverHeading,
  );
  useEffect(() => {
    if (typeof driverHeading === "number" && Number.isFinite(driverHeading)) {
      setLatchedHeading(driverHeading);
    }
  }, [driverHeading]);
  const effectiveHeading = latchedHeading;
  // Modo de desplazamiento del cliente en recogida propia (coche o a pie)
  const [pickupMode, setPickupMode] = useState<"driving" | "walking">("driving");
  // Ruta real por calles (Google Directions vía /api/gps/directions)
  const [routePath, setRoutePath] = useState<RouteCoordinate[]>([]);
  // Info de la ruta real (distancia y duración de Google) para la tarjeta
  const [routeInfo, setRouteInfo] = useState<{
    distanceText?: string;
    durationText?: string;
  } | null>(null);
  const lastRouteRef = useRef<{
    origin: RouteCoordinate;
    destination: RouteCoordinate;
    mode: "driving" | "walking";
  } | null>(null);
  const routeLoadingRef = useRef(false);

  // Ruta real por calles según la FASE del pedido (misma lógica en los 4 roles):
  //  - recogida (accepted/preparing/ready): repartidor → NEGOCIO
  //  - entrega (picked_up/on_the_way/in_transit/arriving): repartidor → CLIENTE
  //  - sin repartidor todavía: ruta prevista negocio → cliente
  // Pickup: ruta del CLIENTE a la TIENDA (va él a buscar su pedido).
  useEffect(() => {
    const phase = routePhaseForStatus(status);
    let origin: Location | null = null;
    let destination: Location | null = null;

    if (isPickup) {
      origin = isValidLocation(customerLocation) ? customerLocation : null;
      destination = isValidLocation(businessLocation) ? businessLocation : null;
    } else if (isValidLocation(deliveryPersonLocation) && phase !== "none") {
      origin = deliveryPersonLocation;
      destination =
        phase === "to_business"
          ? isValidLocation(businessLocation)
            ? businessLocation
            : null
          : isValidLocation(customerLocation)
            ? customerLocation
            : null;
    } else if (
      phase !== "none" ||
      ["pending", "confirmed"].includes(String(status).toLowerCase())
    ) {
      // Aún sin posición del repartidor: ruta prevista del local al cliente
      origin = isValidLocation(businessLocation) ? businessLocation : null;
      destination = isValidLocation(customerLocation)
        ? customerLocation
        : null;
    }

    if (!origin || !destination) {
      setRoutePath([]);
      setRouteInfo(null);
      lastRouteRef.current = null;
      return;
    }

    const last = lastRouteRef.current;
    if (
      last &&
      last.mode === (isPickup ? pickupMode : "driving") &&
      distanceMeters(last.origin, origin) < 150 &&
      distanceMeters(last.destination, destination) < 20
    ) {
      return; // aún válida
    }

    if (routeLoadingRef.current) return;
    routeLoadingRef.current = true;
    // En pickup se usa el modo elegido por el cliente (coche/a pie)
    const routeMode: "driving" | "walking" = isPickup ? pickupMode : "driving";
    fetchRouteDirections(origin, destination, routeMode)
      .then((result) => {
        lastRouteRef.current = { origin, destination, mode: routeMode };
        if (result && result.coordinates.length >= 2) {
          setRoutePath(result.coordinates);
          setRouteInfo({
            distanceText: result.distanceText,
            durationText: result.durationText,
          });
        }
      })
      .finally(() => {
        routeLoadingRef.current = false;
      });
  }, [
    isPickup,
    pickupMode,
    status,
    deliveryPersonLocation?.latitude,
    deliveryPersonLocation?.longitude,
    businessLocation?.latitude,
    businessLocation?.longitude,
    customerLocation?.latitude,
    customerLocation?.longitude,
  ]);

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
      : [businessLocation, deliveryPersonLocation, customerLocation].filter(
          isValidLocation,
        );

    if (locations.length === 0) {
      return customerLocation && isValidLocation(customerLocation)
        ? {
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
        : {
            latitude: 41.7636,
            longitude: -2.4677,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
    }
    const lats = locations.map((l) => l.latitude);
    const lngs = locations.map((l) => l.longitude);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.015, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.015, (maxLng - minLng) * 1.6),
    };
  };

  // Solo rutas reales por calles: sin geometría descargada no se dibuja NADA
  // (nada de líneas rectas o triángulos inventados).
  const routeCoords = routePath;

  // Snap-to-route del repartidor: el pin se desliza POR la calle aunque el
  // GPS derive (túneles, cañones de edificios, GPS urbano). Si el fix se
  // aleja >30 m de la ruta se muestra crudo — nunca se inventa posición.
  const driverDisplay =
    deliveryPersonLocation && isValidLocation(deliveryPersonLocation)
      ? (() => {
          const snap =
            routeCoords.length >= 2
              ? snapToRoute(deliveryPersonLocation, routeCoords, 30)
              : null;
          return snap?.snapped ? snap.coordinate : deliveryPersonLocation;
        })()
      : null;

  // Recentrar: en delivery sigue al REPARTIDOR; en pickup centra al cliente
  const handleRecenter = () => {
    const target: any = !isPickup ? driverDisplay : customerLocation;
    const t = isValidLocation(target)
      ? target
      : isValidLocation(businessLocation)
        ? businessLocation
        : null;
    if (t && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: t.latitude,
          longitude: t.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        400,
      );
    }
  };

  // Recogida A PIE: distancia/ETA RESTANTES sobre la ruta peatonal según la
  // posición real del cliente (se actualiza al caminar, estilo Glovo).
  const remainingText = useMemo(() => {
    if (
      !isPickup ||
      pickupMode !== "walking" ||
      !customerLocation ||
      !isValidLocation(customerLocation) ||
      routeCoords.length < 2
    )
      return null;
    const snap = snapToRoute(customerLocation, routeCoords, 40);
    if (!snap) return null;
    return formatRemaining(snap.remainingMeters, "walking");
  }, [isPickup, pickupMode, customerLocation, routeCoords]);
  const hasAnyLocation = [
    businessLocation,
    deliveryPersonLocation,
    customerLocation,
  ].some(isValidLocation);

  return (
    <View style={styles.wrapper}>
      {/* MAP */}
      <View style={styles.mapContainer}>
        {mapAvailable && hasAnyLocation ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={getInitialRegion()}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsTraffic={false}
            mapType="standard"
            customMapStyle={mapStyleForTheme(isDark)}
          >
            {/* Business marker — burbuja con icono del tipo de negocio */}
            {isValidLocation(businessLocation) && (
              <SmartMarker
                coordinate={businessLocation}
                title={businessName || "Negocio"}
                anchor={{ x: 0.5, y: 1 }}
                trackKey={`biz-${businessType ?? ""}-${businessCategories ?? ""}-${businessName ?? ""}`}
              >
                <BusinessPin
                  icon={businessMarkerMeta(businessType, businessCategories).icon}
                  color={businessMarkerMeta(businessType, businessCategories).color}
                  title={businessName || (isPickup ? "Recogida" : "Negocio")}
                />
              </SmartMarker>
            )}

            {/* Driver marker — foto/vehículo con anillo pulsante (SOLO DELIVERY) */}
            {!isPickup && driverDisplay && (
              <SmartMarker
                coordinate={driverDisplay}
                title={driverName || "Repartidor"}
                anchor={{ x: 0.5, y: 0.5 }}
                // El heading va en el trackKey (redondeado a 3°): si no, la
                // vista del marcador queda congelada en Android y la flecha
                // "no gira nunca"
                trackKey={`drv-${driverVehicle ?? ""}-${driverPhoto ?? ""}-${effectiveHeading != null ? Math.round(effectiveHeading / 3) : "no"}`}
              >
                <DriverPin
                  vehicleIcon={vehicleMarkerMeta(driverVehicle).icon}
                  photo={driverPhoto}
                  label={eta}
                  heading={effectiveHeading}
                />
              </SmartMarker>
            )}

            {/* Customer marker — casa azul */}
            {isValidLocation(customerLocation) && (
              <SmartMarker
                coordinate={customerLocation}
                title="Tu ubicación"
                anchor={{ x: 0.5, y: 1 }}
                trackKey="customer"
              >
                <MapPin
                  icon={CUSTOMER_MARKER.icon}
                  color={CUSTOMER_MARKER.color}
                />
              </SmartMarker>
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
              {!mapAvailable
                ? "El mapa solo está disponible en la app móvil"
                : "Ubicación GPS no disponible aún"}
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

        {/* Botón seguir/recentrar — bottom right del mapa */}
        <Pressable
          onPress={handleRecenter}
          style={[styles.recenterBtn, { backgroundColor: theme.card }]}
        >
          <Feather
            name="crosshair"
            size={17}
            color={ComeYaColors.primary}
          />
        </Pressable>
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onCallDriver();
                }}
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

      {/* Tarjeta de destino + botón CÓMO LLEGAR (SOLO PICKUP) — estilo Uber */}
      {isPickup && onNavigateInApp && (
        <View style={styles.pickupCardWrap}>
          <View
            style={[
              styles.driverCard,
              { backgroundColor: theme.card },
              Shadows.lg,
            ]}
          >
            <View style={styles.driverLeft}>
              <View
                style={[
                  styles.driverAvatar,
                  {
                    backgroundColor:
                      businessMarkerMeta(businessType, businessCategories)
                        .color + "20",
                  },
                ]}
              >
                <Feather
                  name="shopping-bag"
                  size={22}
                  color={
                    businessMarkerMeta(businessType, businessCategories).color
                  }
                />
              </View>
              <View style={styles.driverInfo}>
                <ThemedText type="h4" numberOfLines={1}>
                  {businessName || "Recogida en el local"}
                </ThemedText>
                {remainingText ? (
                  <ThemedText
                    type="caption"
                    style={{ color: "#10B981", fontWeight: "700" }}
                    numberOfLines={1}
                  >
                    Te quedan {remainingText}
                  </ThemedText>
                ) : routeInfo?.distanceText && routeInfo?.durationText ? (
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                    numberOfLines={1}
                  >
                    A {routeInfo.distanceText} · {routeInfo.durationText}{" "}
                    {pickupMode === "walking" ? "a pie" : "en coche"}
                  </ThemedText>
                ) : (
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                    numberOfLines={1}
                  >
                    {isValidLocation(businessLocation)
                      ? "Sigue la ruta hasta el local"
                      : "Trazando la ruta hasta el local…"}
                  </ThemedText>
                )}
                {/* Selector de modo de desplazamiento: coche o a pie */}
                <View style={styles.pickupModeRow}>
                  {(
                    [
                      ["driving", "car", "En coche"],
                      ["walking", "map-pin", "A pie"],
                    ] as const
                  ).map(([mode, icon, label]) => (
                    <Pressable
                      key={mode}
                      onPress={() => setPickupMode(mode)}
                      style={[
                        styles.pickupModeBtn,
                        {
                          backgroundColor:
                            pickupMode === mode
                              ? ComeYaColors.primary
                              : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <Feather
                        name={icon as any}
                        size={12}
                        color={pickupMode === mode ? "#FFF" : theme.textSecondary}
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
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onNavigateInApp(pickupMode);
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
              Cómo llegar
            </ThemedText>
          </Pressable>
        </View>
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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  recenterBtn: {
    position: "absolute",
    right: Spacing.md,
    bottom: Spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
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
  pickupModeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pickupModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
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
  pickupCardWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
});
