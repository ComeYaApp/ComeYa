import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
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

type DriverNavigationRouteProp = RouteProp<
  RootStackParamList,
  "DriverNavigation"
>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

// La API key NUNCA se expone al cliente — se usa proxy del servidor
// El servidor tiene cache + rate limiting para ahorrar costos
import { apiRequest } from "@/lib/query-client";
import { decodePolyline, distanceMeters } from "@/utils/directions";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { DriverPin } from "@/components/map/DriverPin";

/** Distancia mínima en metros desde un punto hasta la polyline de la ruta. */
function distanceToRouteMeters(
  point: { latitude: number; longitude: number },
  coords: { latitude: number; longitude: number }[],
): number {
  let min = Infinity;
  for (const c of coords) {
    const d = distanceMeters(point, c);
    if (d < min) min = d;
  }
  return min;
}

export default function DriverNavigationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DriverNavigationRouteProp>();
  const mapRef = useRef<MapView>(null);

  const { destLat, destLng, destAddress } = route.params;

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const routeCoordsRef = useRef<{ latitude: number; longitude: number }[]>([]);
  const lastRerouteAtRef = useRef<number>(0);
  const lastSpokenStepRef = useRef<string>("");

  const destinationCoord = { latitude: destLat, longitude: destLng };

  const REROUTE_MIN_INTERVAL_MS = 30_000;
  const REROUTE_DEVIATION_M = 150;

  // Voz turn-by-turn: habla la instrucción actual cuando cambia
  useEffect(() => {
    if (!voiceEnabled || !steps.length) return;
    const instruction = steps[0].instruction;
    if (!instruction || instruction === lastSpokenStepRef.current) return;
    lastSpokenStepRef.current = instruction;
    import("expo-speech")
      .then((Speech) => {
        Speech.stop();
        Speech.speak(instruction, { language: "es-ES", rate: 0.95 });
      })
      .catch(() => {});
  }, [steps, voiceEnabled]);

  // Inicializar GPS y obtener ruta (1 sola llamada a Directions API)
  useEffect(() => {
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setDriverLocation(coords);
      setLoading(false);

      // Obtener ruta real por calles
      fetchRoute(coords.latitude, coords.longitude);

      // Seguimiento continuo: mueve el marcador y recalcula la ruta
      // automáticamente si el repartidor se desvía >150 m de la ruta
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 20,
        },
        (l) => {
          const coords = {
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
          };
          setDriverLocation(coords);

          const now = Date.now();
          if (
            routeCoordsRef.current.length > 2 &&
            now - lastRerouteAtRef.current >= REROUTE_MIN_INTERVAL_MS
          ) {
            const deviation = distanceToRouteMeters(
              coords,
              routeCoordsRef.current,
            );
            if (deviation > REROUTE_DEVIATION_M) {
              lastRerouteAtRef.current = now;
              fetchRoute(coords.latitude, coords.longitude);
            }
          }
        },
      );
    };

    start();

    return () => {
      locationSubRef.current?.remove();
      import("expo-speech")
        .then((Speech) => Speech.stop())
        .catch(() => {});
    };
  }, []);

  const fetchRoute = async (originLat: number, originLng: number) => {
    setRouteLoading(true);
    try {
      // Usar proxy del servidor (API key nunca se expone al cliente)
      // El servidor tiene cache + rate limiting para ahorrar costos
      const response = await apiRequest(
        "GET",
        `/api/gps/directions?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`,
      );
      const data = await response.json();

      if (data.success && data.polyline) {
        const decoded = decodePolyline(data.polyline);
        routeCoordsRef.current = decoded;

        setRouteCoords(decoded);
        setTotalDistance(data.distance?.text || "");
        setTotalDuration(data.duration?.text || "");
        setSteps(
          (data.steps || []).map((s: any) => ({
            instruction: s.instruction || "",
            distance: s.distance?.text || "",
            duration: s.duration?.text || "",
          })),
        );

        // Ajustar mapa para mostrar la ruta completa
        if (mapRef.current && decoded.length > 0) {
          mapRef.current.fitToCoordinates(
            [{ latitude: originLat, longitude: originLng }, ...decoded],
            {
              edgePadding: { top: 100, right: 50, bottom: 310, left: 50 },
              animated: true,
            },
          );
        }
      } else if (data.success && data.fallback) {
        // Fallback: ruta en línea recta con distancia estimada
        const coords = [
          { latitude: originLat, longitude: originLng },
          { latitude: destLat, longitude: destLng },
        ];
        routeCoordsRef.current = coords;
        setRouteCoords(coords);
        setTotalDistance(data.distance?.text || "");
        setTotalDuration(data.duration?.text || "");
        setSteps([]);
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 310, left: 50 },
            animated: true,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching directions:", err);
    }
    setRouteLoading(false);
  };

  const handleRecenter = () => {
    if (mapRef.current && driverLocation) {
      mapRef.current.animateToRegion(
        {
          ...driverLocation,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        400,
      );
    }
  };

  const handleRefreshRoute = () => {
    if (driverLocation) {
      fetchRoute(driverLocation.latitude, driverLocation.longitude);
    }
  };

  if (loading) {
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

  const initialRegion = driverLocation
    ? { ...driverLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: destLat, longitude: destLng, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const stepsVisible = steps.length > 0;

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={true}
      >
        {/* Marcador de posición actual (repartidor o cliente navegando) */}
        {driverLocation && (
          <SmartMarker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            trackKey="me"
          >
            <DriverPin
              vehicleIcon="navigation"
              color={ComeYaColors.primary}
              size={38}
              showBadge={false}
            />
          </SmartMarker>
        )}

        {/* Marcador del destino */}
        <SmartMarker coordinate={destinationCoord} anchor={{ x: 0.5, y: 1 }} trackKey="dest">
          <MapPin icon="map-marker" color="#DC2626" size={38} />
        </SmartMarker>

        {/* Polilínea de la ruta real de Google Directions */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={ComeYaColors.primary}
            strokeWidth={5}
          />
        )}
      </MapView>

      {/* Header con botón volver, dirección y tiempos */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: theme.card },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText type="h4" numberOfLines={1} style={{ fontWeight: "700" }}>
            {destAddress}
          </ThemedText>
          {(totalDuration || totalDistance) ? (
            <View style={styles.etaRow}>
              {totalDuration ? (
                <View
                  style={[
                    styles.etaChip,
                    { backgroundColor: ComeYaColors.primary + "18" },
                  ]}
                >
                  <Feather
                    name="clock"
                    size={12}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: 4,
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
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={12}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginLeft: 4 }}
                  >
                    {totalDistance}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row" }}>
          <Pressable
            onPress={() => {
              if (voiceEnabled) {
                import("expo-speech").then((S) => S.stop()).catch(() => {});
              }
              setVoiceEnabled(!voiceEnabled);
            }}
            style={styles.iconButton}
          >
            <Feather
              name={voiceEnabled ? "volume-2" : "volume-x"}
              size={18}
              color={voiceEnabled ? ComeYaColors.primary : theme.textSecondary}
            />
          </Pressable>
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

      {/* Panel inferior: instrucciones giro a giro */}
      {stepsVisible && (
        <View
          style={[styles.stepsPanel, { backgroundColor: theme.card }, Shadows.lg]}
        >
          {/* Instrucción actual (primera) */}
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

          {/* Resto de instrucciones */}
          {steps.length > 1 && (
            <ScrollView
              style={styles.nextStepsList}
              showsVerticalScrollIndicator={false}
            >
              {steps.slice(1).map((step, i) => (
                <View key={i} style={[styles.nextStepRow, { borderTopColor: theme.border }]}>
                  <View
                    style={[styles.nextStepDot, { borderColor: theme.border }]}
                  />
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
  map: { flex: 1 },

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