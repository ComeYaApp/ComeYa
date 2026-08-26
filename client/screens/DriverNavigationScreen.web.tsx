import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { fetchRouteDirections, distanceMeters } from "@/utils/directions";
import { apiRequest } from "@/lib/query-client";
import {
  pinIcon,
  circleIcon,
  asGoogleIcon,
} from "@/utils/webMarkerSvg";

type DriverNavigationRouteProp = RouteProp<
  RootStackParamList,
  "DriverNavigation"
>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

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

/** Distancia mínima en metros desde un punto hasta una polyline de ruta. */
function distanceToRouteMeters(
  point: { lat: number; lng: number },
  coords: { latitude: number; longitude: number }[],
): number {
  let min = Infinity;
  for (const c of coords) {
    const d = distanceMeters(
      { latitude: point.lat, longitude: point.lng },
      c,
    );
    if (d < min) min = d;
  }
  return min;
}

export default function DriverNavigationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DriverNavigationRouteProp>();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const { destLat, destLng, destAddress, travelMode } = route.params;
  const routeTravelMode: "driving" | "walking" =
    travelMode === "walking" ? "walking" : "driving";

  const [mapsReady, setMapsReady] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [steps, setSteps] = useState<
    { instruction: string; distance: string; duration: string }[]
  >([]);
  const [totalDistance, setTotalDistance] = useState("");
  const [totalDuration, setTotalDuration] = useState("");
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);

  const destinationCoord = { lat: destLat, lng: destLng };

  // Refs para el re-route automático
  const routeCoordsRef = useRef<{ latitude: number; longitude: number }[]>([]);
  const lastRerouteAtRef = useRef<number>(0);
  const REROUTE_MIN_INTERVAL_MS = 30_000;
  const REROUTE_DEVIATION_M = 150;

  const fetchRoute = useCallback(
    async (originLat: number, originLng: number) => {
      setRouteLoading(true);
      const google = (window as any).google;
      if (!gmap.current) {
        setRouteLoading(false);
        return;
      }

      // Limpiar polyline anterior
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      // Ruta real por calles vía el proxy del servidor (caché + rate limit)
      const routeResult = await fetchRouteDirections(
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng },
        routeTravelMode,
      );

      if (routeResult) {
        routeCoordsRef.current = routeResult.coordinates;
        setRouteCoords(routeResult.coordinates);
        setTotalDistance(routeResult.distanceText || "");
        setTotalDuration(routeResult.durationText || "");

        if (routeResult.steps?.length) {
          setSteps(
            routeResult.steps.map((s) => ({
              instruction: s.instruction,
              distance: s.distance?.text || "",
              duration: s.duration?.text || "",
            })),
          );
        } else {
          setSteps([
            {
              instruction: `Dirígete hacia ${destAddress || "el destino"}`,
              distance: routeResult.distanceText || "",
              duration: routeResult.durationText || "",
            },
          ]);
        }

        polylineRef.current = new google.maps.Polyline({
          path: routeResult.coordinates.map((c) => ({
            lat: c.latitude,
            lng: c.longitude,
          })),
          geodesic: true,
          strokeColor: ComeYaColors.primary,
          strokeOpacity: 0.8,
          strokeWeight: 5,
          map: gmap.current,
        });

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(originLat, originLng));
        bounds.extend(new google.maps.LatLng(destLat, destLng));
        gmap.current.fitBounds(bounds, 50);
      }
      setRouteLoading(false);
    },
    [destLat, destLng, destAddress],
  );

  // Inicializar GPS y mapa
  useEffect(() => {
    const setup = async () => {
      try {
        await loadGoogleMaps();
        setMapsReady(true);
      } catch {}

      // Obtener ubicación GPS
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setDriverLocation(coords);
            setLoading(false);
            fetchRoute(coords.latitude, coords.longitude);
          },
          () => {
            setLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );

        // Seguimiento continuo: mueve el marcador, recalcula si se desvía y
        // SUBE la posición al servidor (throttle 5s) para que cliente y
        // negocio vean el movimiento en vivo durante la navegación
        let lastPostAt = 0;
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setDriverLocation(coords);

            const now = Date.now();
            if (now - lastPostAt >= 5000) {
              lastPostAt = now;
              apiRequest("POST", "/api/delivery/location", {
                latitude: coords.latitude,
                longitude: coords.longitude,
              }).catch(() => {});
            }

            const coordsLen = routeCoordsRef.current.length;
            if (
              coordsLen > 2 &&
              now - lastRerouteAtRef.current >= REROUTE_MIN_INTERVAL_MS
            ) {
              const dev = distanceToRouteMeters(
                { lat: coords.latitude, lng: coords.longitude },
                routeCoordsRef.current,
              );
              if (dev > REROUTE_DEVIATION_M) {
                lastRerouteAtRef.current = now;
                fetchRoute(coords.latitude, coords.longitude);
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 },
        );
      } else {
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [fetchRoute]);

  // Inicializar mapa Google
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    const center = driverLocation
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : destinationCoord;

    gmap.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: true,
      styles: [
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
      ],
    });

    // Capa de tráfico en vivo (estilo Uber)
    try {
      new google.maps.TrafficLayer().setMap(gmap.current);
    } catch {}

    // Marcador de destino — chincheta roja
    destMarkerRef.current = new google.maps.Marker({
      position: destinationCoord,
      map: gmap.current,
      title: destAddress || "Destino",
      icon: asGoogleIcon(google, pinIcon("#DC2626", "map-marker")),
      animation: google.maps.Animation.DROP,
    });
  }, [mapsReady]);

  // Actualizar marcador del driver
  useEffect(() => {
    if (!gmap.current || !driverLocation) return;
    const google = (window as any).google;
    if (!google) return;

    const position = new google.maps.LatLng(driverLocation.latitude, driverLocation.longitude);

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(position);
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position,
        map: gmap.current,
        title: "Tu ubicación",
        icon: asGoogleIcon(
          google,
          circleIcon(ComeYaColors.primary, "navigation", 40),
        ),
        zIndex: 100,
      });
    }
  }, [driverLocation]);

  const handleRecenter = () => {
    if (gmap.current && driverLocation) {
      gmap.current.setCenter({
        lat: driverLocation.latitude,
        lng: driverLocation.longitude,
      });
      gmap.current.setZoom(16);
    }
  };

  const handleRefreshRoute = () => {
    if (driverLocation) {
      fetchRoute(driverLocation.latitude, driverLocation.longitude);
    }
  };

  if (loading && !driverLocation) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <ThemedText
          style={{ marginTop: Spacing.md, color: theme.textSecondary }}
        >
          Obteniendo ubicación GPS...
        </ThemedText>
      </View>
    );
  }

  const stepsVisible = steps.length > 0;

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.card,
            paddingTop: insets.top + Spacing.sm,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText type="h4" numberOfLines={1}>
            {destAddress || "Destino"}
          </ThemedText>
          {totalDistance || totalDuration ? (
            <View style={styles.etaRow}>
              {totalDuration ? (
                <View
                  style={[
                    styles.etaChip,
                    { backgroundColor: ComeYaColors.primary + "20" },
                  ]}
                >
                  <Feather
                    name="clock"
                    size={11}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: 3,
                      fontWeight: "700",
                    }}
                  >
                    {totalDuration}
                  </ThemedText>
                </View>
              ) : null}
              {totalDistance ? (
                <View
                  style={[
                    styles.etaChip,
                    { backgroundColor: theme.textSecondary + "15" },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={11}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginLeft: 3 }}
                  >
                    {totalDistance}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={handleRefreshRoute}
          style={styles.iconButton}
          disabled={routeLoading}
        >
          {routeLoading ? (
            <ActivityIndicator size="small" color={ComeYaColors.primary} />
          ) : (
            <Feather name="refresh-cw" size={18} color={ComeYaColors.primary} />
          )}
        </Pressable>
      </View>

      {/* Botón recentrar */}
      <Pressable
        onPress={handleRecenter}
        style={[
          styles.recenterBtn,
          {
            backgroundColor: theme.card,
            bottom: stepsVisible ? 290 : 40,
          },
          Shadows.md,
        ]}
      >
        <Feather name="crosshair" size={20} color={ComeYaColors.primary} />
      </Pressable>

      {/* Panel inferior */}
      {stepsVisible && (
        <View
          style={[
            styles.stepsPanel,
            { backgroundColor: theme.card },
            Shadows.lg,
          ]}
        >
          {/* Instrucción actual */}
          <View style={styles.currentStepRow}>
            <View
              style={[
                styles.stepIconCircle,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <Feather name="navigation" size={18} color="#FFF" />
            </View>
            <ThemedText
              type="body"
              style={{
                flex: 1,
                marginLeft: Spacing.md,
                fontWeight: "700",
              }}
              numberOfLines={2}
            >
              {steps[0].instruction}
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginLeft: Spacing.sm,
                minWidth: 42,
                textAlign: "right",
              }}
            >
              {steps[0].distance}
            </ThemedText>
          </View>

          {steps.length > 1 && (
            <ScrollView
              style={styles.nextStepsList}
              showsVerticalScrollIndicator={false}
            >
              {steps.slice(1).map((step, i) => (
                <View key={i} style={[styles.nextStepRow, { borderTopColor: theme.border }]}>
                  <View style={[styles.nextStepDot, { borderColor: theme.border }]} />
                  <ThemedText
                    type="small"
                    style={{
                      flex: 1,
                      color: theme.textSecondary,
                      marginLeft: Spacing.sm,
                    }}
                    numberOfLines={2}
                  >
                    {step.instruction}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginLeft: 4 }}
                  >
                    {step.distance}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  iconButton: {
    padding: 8,
    borderRadius: 22,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  etaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  etaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },

  // Recenter button
  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },

  // Steps panel
  stepsPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: 290,
  },
  currentStepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stepIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  nextStepsList: {
    maxHeight: 170,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    flexShrink: 0,
  },
});