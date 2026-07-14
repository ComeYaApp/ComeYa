import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
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

/** Haversine: calcula distancia en km entre dos coordenadas */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estima tiempo de viaje en minutos (~30 km/h velocidad media ciudad) */
function estimateTravelTime(distanceKm: number): number {
  return Math.ceil(distanceKm / 0.5);
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
  const [totalDistance, setTotalDistance] = useState("");
  const [totalDuration, setTotalDuration] = useState("");
  const [loading, setLoading] = useState(true);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const destinationCoord = { latitude: destLat, longitude: destLng };

  // Inicializar GPS y calcular ruta local (gratis, sin Directions API)
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

      // Calcular ruta local (Haversine + geodésica, GRATIS)
      calcLocalRoute(coords.latitude, coords.longitude);

      // Seguimiento continuo leve para actualizar marcador
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 20,
        },
        (l) => {
          setDriverLocation({
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
          });
        },
      );
    };

    start();

    return () => {
      locationSubRef.current?.remove();
    };
  }, []);

  const calcLocalRoute = (originLat: number, originLng: number) => {
    const distKm = haversineDistance(originLat, originLng, destLat, destLng);
    const timeMin = estimateTravelTime(distKm);

    setTotalDistance(
      distKm < 1
        ? `${Math.round(distKm * 1000)} m`
        : `${distKm.toFixed(1)} km`,
    );
    setTotalDuration(`${timeMin} min`);

    // Polyline geodésica directa (línea recta en el mapa, gratis)
    setRouteCoords([
      { latitude: originLat, longitude: originLng },
      { latitude: destLat, longitude: destLng },
    ]);

    // Ajustar mapa para mostrar ambos puntos
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: originLat, longitude: originLng },
          { latitude: destLat, longitude: destLng },
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 60, left: 50 },
          animated: true,
        },
      );
    }
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
      calcLocalRoute(driverLocation.latitude, driverLocation.longitude);
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
        {/* Marcador del driver (posición actual) */}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Feather name="navigation" size={18} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Marcador del destino */}
        <Marker coordinate={destinationCoord} anchor={{ x: 0.5, y: 1 }}>
          <View style={[styles.destMarker, { backgroundColor: "#9C27B0" }]}>
            <Feather name="map-pin" size={16} color="#FFF" />
          </View>
        </Marker>

        {/* Polilínea de la ruta (línea geodésica directa, gratis) */}
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

        <Pressable
          onPress={handleRefreshRoute}
          style={styles.iconButton}
        >
          <Feather name="refresh-cw" size={18} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Botón recentrar */}
      <Pressable
        onPress={handleRecenter}
        style={[
          styles.recenterBtn,
          {
            backgroundColor: theme.card,
            bottom: 40,
          },
          Shadows.md,
        ]}
      >
        <Feather name="crosshair" size={20} color={ComeYaColors.primary} />
      </Pressable>
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

  // Driver marker
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ComeYaColors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },

  // Destination marker
  destMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
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
});