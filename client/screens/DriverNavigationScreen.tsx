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
import { decodePolyline, distanceMeters, toCoord } from "@/utils/directions";
import { snapToRoute } from "@/utils/snapToRoute";
import { gpsService } from "@/services/gpsService";
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

/** Rumbo (grados desde el norte) del vector from → to. */
function bearingBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Diferencia angular mínima (−180…180) entre dos rumbos. */
function angleDeltaDeg(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

// El rumbo solo se actualiza en MOVIMIENTO real (≥1,5 m/s ≈ 5,4 km/h):
// parado o a paso de humano el course del GPS es ruido (semáforos, rotondas).
const MIN_SPEED_MS = 1.5;
// Suavizado angular: el rumbo gira el 35% hacia el nuevo en cada fix
// (arco corto) — sin barridos bruscos ni saltos de aguja.
const HEADING_SMOOTH = 0.35;

export default function DriverNavigationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DriverNavigationRouteProp>();
  const mapRef = useRef<MapView>(null);

  const { destLat, destLng, destAddress, travelMode } = route.params;
  const routeTravelMode: "driving" | "walking" =
    travelMode === "walking" ? "walking" : "driving";

  // Coordenadas del destino validadas: un NaN/null en el Marker provoca un
  // CRASH NATIVO de react-native-maps en iOS (no una excepción de JS)
  const destinationCoordSafe = toCoord(destLat, destLng);

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
  /** La cámara sigue al conductor (se desactiva al arrastrar el mapa). */
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  const headingRef = useRef<number | null>(null);
  const lastDisplayRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Fix CRUDO anterior (con timestamp). NUNCA se usa el punto snapeado como
  // "posición previa": el vector snap→GPS es el offset perpendicular a la
  // calle y ponía la flecha DE LADO (bug de la prueba en auto).
  const prevRawRef = useRef<{
    latitude: number;
    longitude: number;
    at: number;
  } | null>(null);
  // Última animación de cámara (throttle: la animación de 1 s debe poder
  // terminar antes de lanzar la siguiente — antes se relanzaba cada fix y
  // nunca asentaba: tirones y "no se centra").
  const lastCameraRef = useRef<{
    latitude: number;
    longitude: number;
    heading: number | null;
    at: number;
  } | null>(null);
  // Reactivación automática del follow 6 s después de soltar el mapa (Uber).
  const recenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ventana en la que la cámara de navegación no compite con el
  // fitToCoordinates de la ruta inicial (visión global breve al entrar).
  const suppressCameraUntilRef = useRef(0);
  const routeLoadedOnceRef = useRef(false);
  // Progreso sobre la ruta (metros): base del snap progresivo (evita
  // proyectar al carril paralelo o a un tramo ya pasado).
  const progressRef = useRef<number | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const routeCoordsRef = useRef<{ latitude: number; longitude: number }[]>([]);
  const lastRerouteAtRef = useRef<number>(0);
  const lastSpokenStepRef = useRef<string>("");

  const destinationCoord = destinationCoordSafe;

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

  // Rumbo efectivo (grados desde el norte, suavizado). El heading del GPS
  // solo se acepta en movimiento (≥1,5 m/s); si no viene, se calcula el
  // rumbo de desplazamiento entre fixes CRUDOS consecutivos. Parado o sin
  // datos: se conserva el último rumbo (como Google Maps).
  const resolveHeading = (
    rawHeading: number | null | undefined,
    coords: { latitude: number; longitude: number },
    speedMs?: number,
    fixAt: number = Date.now(),
  ): number | null => {
    let candidate: number | null = null;
    const prevRaw = prevRawRef.current;
    const dtS = prevRaw ? Math.max(0, (fixAt - prevRaw.at) / 1000) : 0;

    if (
      typeof rawHeading === "number" &&
      rawHeading >= 0 &&
      // Solo con movimiento real; si el dispositivo no reporta velocidad,
      // se confía en el heading que dé el GPS (como en gpsService)
      (typeof speedMs !== "number" || speedMs >= MIN_SPEED_MS)
    ) {
      candidate = rawHeading;
    } else if (prevRaw && dtS > 0 && dtS <= 10) {
      // Desplazamiento real fix crudo → fix crudo (con la velocidad media
      // implícita como filtro anti-deriva GPS)
      const moved = distanceMeters(prevRaw, coords);
      if (moved >= 4 && moved / dtS >= MIN_SPEED_MS) {
        candidate = bearingBetween(prevRaw, coords);
      }
    }

    if (candidate === null) return headingRef.current;

    const last = headingRef.current;
    if (last === null) return candidate;
    // Suavizado de arco corto: gira una fracción hacia el nuevo rumbo
    return (last + angleDeltaDeg(last, candidate) * HEADING_SMOOTH + 360) % 360;
  };

  /** Aplica un fix GPS: snap a la ruta, rumbo, cámara que sigue (Uber 3D). */
  const applyFix = (
    coords: { latitude: number; longitude: number },
    rawHeading?: number | null,
    speedMs?: number,
    fixAtMs?: number,
  ) => {
    const fixAt = fixAtMs ?? Date.now();
    // Snap-to-route progresivo: el pin se desliza POR la calle aunque el GPS
    // derive, sin saltar al carril paralelo ni retroceder de tramo
    const snap = snapToRoute(
      coords,
      routeCoordsRef.current,
      30,
      progressRef.current ?? undefined,
    );
    const display = snap?.snapped ? snap.coordinate : coords;
    if (snap) progressRef.current = snap.progressMeters;

    // El rumbo se resuelve ANTES de actualizar prevRawRef (el fix previo
    // debe ser el anterior, no el actual — otro bug de la flecha de lado)
    const h = resolveHeading(rawHeading, coords, speedMs, fixAt);
    headingRef.current = h;
    prevRawRef.current = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      at: fixAt,
    };

    setDriverLocation(display);
    lastDisplayRef.current = display;

    // Cámara que sigue (Uber 3D): el mapa rota para que ARRIBA sea la
    // dirección de marcha; la flecha del pin apunta siempre arriba (sin
    // doble rotación). Con throttle para no relanzar la animación cada fix.
    if (followRef.current) {
      const now = Date.now();
      const lastCam = lastCameraRef.current;
      const movedM = lastCam ? distanceMeters(lastCam, display) : Infinity;
      const headingDelta =
        lastCam && h !== null && lastCam.heading !== null
          ? Math.abs(angleDeltaDeg(lastCam.heading, h))
          : Infinity;
      const due = !lastCam || now - lastCam.at >= 2000;
      if (
        now >= suppressCameraUntilRef.current &&
        (movedM >= 8 || headingDelta >= 8 || due)
      ) {
        const camera: any = {
          center: {
            latitude: display.latitude,
            longitude: display.longitude,
          },
          pitch: 45,
          zoom: 17,
        };
        if (h !== null) camera.heading = h;
        mapRef.current?.animateCamera(camera, { duration: 1000 });
        lastCameraRef.current = {
          latitude: display.latitude,
          longitude: display.longitude,
          heading: h,
          at: now,
        };
      }
    }
  };

  // Inicializar GPS y obtener ruta (1 sola llamada a Directions API)
  useEffect(() => {
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      applyFix(
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        loc.coords.heading,
        loc.coords.speed ?? undefined,
        loc.timestamp,
      );
      setLoading(false);

      // Obtener ruta real por calles
      fetchRoute(loc.coords.latitude, loc.coords.longitude);

      // Seguimiento continuo (nivel Uber/Glovo): 1 fix/s o cada 5 m CON
      // rumbo. El envío al servidor lo centraliza gpsService.postFix
      // (throttle 2 s / 10 m) → el cliente y el negocio ven el movimiento
      // en vivo mientras navegas.
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (l) => {
          // Fix impreciso (túnel, batería ahorrada): no mover el marcador
          if (typeof l.coords.accuracy === "number" && l.coords.accuracy > 50) {
            return;
          }
          const coords = {
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
          };
          applyFix(
            coords,
            l.coords.heading,
            l.coords.speed ?? undefined,
            l.timestamp,
          );

          gpsService.postFix({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: l.coords.accuracy ?? undefined,
            // Rumbo SUAVIZADO de la navegación (no el crudo del GPS, que
            // hace temblar el pin del cliente), solo con movimiento real
            heading:
              (typeof l.coords.speed !== "number" || l.coords.speed >= 1.5)
                ? headingRef.current ?? undefined
                : undefined,
            speed: l.coords.speed ?? undefined,
            timestamp: l.timestamp,
          });

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
      if (recenterTimerRef.current) {
        clearTimeout(recenterTimerRef.current);
        recenterTimerRef.current = null;
      }
      import("expo-speech")
        .then((Speech) => Speech.stop())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRoute = async (originLat: number, originLng: number) => {
    setRouteLoading(true);
    try {
      // Usar proxy del servidor (API key nunca se expone al cliente)
      // El servidor tiene cache + rate limiting para ahorrar costos
      const response = await apiRequest(
        "GET",
        `/api/gps/directions?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}&mode=${routeTravelMode}`,
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

        // Ajustar mapa a la ruta completa: solo la PRIMERA vez (visión
        // global breve al entrar) o con el follow desactivado. Durante el
        // seguimiento la cámara de navegación manda — fitToCoordinates en
        // cada reroute peleaba con ella y producía saltos de zoom.
        if (mapRef.current && decoded.length > 0) {
          const isFirstRoute = !routeLoadedOnceRef.current;
          if (isFirstRoute || !followRef.current) {
            mapRef.current.fitToCoordinates(
              [{ latitude: originLat, longitude: originLng }, ...decoded],
              {
                edgePadding: { top: 100, right: 50, bottom: 310, left: 50 },
                animated: true,
              },
            );
            if (isFirstRoute) {
              routeLoadedOnceRef.current = true;
              // Dejar ver la ruta completa ~3,5 s antes de que la cámara de
              // navegación enganche al conductor
              suppressCameraUntilRef.current = Date.now() + 3500;
              lastCameraRef.current = null;
            }
          }
        }
      } else if (data.success && data.fallback) {
        // Google y OSRM caídos: SIN geometría — nunca una línea recta. Se
        // conservan distancia/ETA estimadas para los textos.
        routeCoordsRef.current = [];
        setRouteCoords([]);
        setTotalDistance(data.distance?.text || "");
        setTotalDuration(data.duration?.text || "");
        setSteps([]);
      }
    } catch (err) {
      console.error("Error fetching directions:", err);
    }
    setRouteLoading(false);
  };

  /** Reactiva el seguimiento y orienta la cámara (3D, rumbo arriba). */
  const reenableFollow = () => {
    if (recenterTimerRef.current) {
      clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = null;
    }
    followRef.current = true;
    setFollow(true);
    suppressCameraUntilRef.current = 0;
    // Forzar la próxima animación aunque la última fuera reciente
    lastCameraRef.current = null;
    const loc = lastDisplayRef.current;
    if (loc) {
      const camera: any = {
        center: { latitude: loc.latitude, longitude: loc.longitude },
        pitch: 45,
        zoom: 17,
      };
      if (headingRef.current !== null) camera.heading = headingRef.current;
      mapRef.current?.animateCamera(camera, { duration: 500 });
    }
  };

  const handleRecenter = reenableFollow;

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
    : destinationCoordSafe
      ? { ...destinationCoordSafe, latitudeDelta: 0.05, longitudeDelta: 0.05 }
      : { latitude: 41.7636, longitude: -2.4677, latitudeDelta: 0.05, longitudeDelta: 0.05 };

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
        onPanDrag={() => {
          // El usuario arrastra el mapa → dejar de seguir (como Uber)…
          if (followRef.current) {
            followRef.current = false;
            setFollow(false);
          }
          // …pero con reactivación automática 6 s después del último gesto:
          // un bache o roce en auto ya no deja la cámara muerta para siempre
          if (recenterTimerRef.current) {
            clearTimeout(recenterTimerRef.current);
          }
          recenterTimerRef.current = setTimeout(() => {
            recenterTimerRef.current = null;
            if (!followRef.current) reenableFollow();
          }, 6000);
        }}
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
              // Sin rotación propia: la cámara follow rota el mapa para que
              // ARRIBA sea la dirección de marcha (rotar además el pin era
              // la doble rotación que dejaba la flecha DE LADO)
              heading={0}
            />
          </SmartMarker>
        )}

        {/* Marcador del destino (solo con coordenadas válidas) */}
        {destinationCoord && (
          <SmartMarker
            coordinate={destinationCoord}
            anchor={{ x: 0.5, y: 1 }}
            trackKey="dest"
          >
            <MapPin icon="map-marker" color="#DC2626" size={38} />
          </SmartMarker>
        )}

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
        <Feather
          name={follow ? "crosshair" : "navigation-2"}
          size={20}
          color={follow ? ComeYaColors.primary : theme.textSecondary}
        />
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