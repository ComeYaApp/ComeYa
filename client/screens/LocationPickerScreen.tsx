import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AUTLAN_CENTER, isInCoverageArea } from "@/utils/coverage";
import {
  useOptimizedGeocoding,
  usePerformanceMonitor,
} from "@/hooks/usePerformance";

// Conditional import for MapView - only works on native platforms
let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
  } catch (error) {
    console.log("react-native-maps not available");
  }
}

// Web fallback component
const WebMapFallback = ({ onPress, location }: any) => (
  <View style={[styles.map, styles.webFallback]}>
    <Text style={styles.webFallbackTitle}>Selector de Ubicación</Text>
    <Text style={styles.webFallbackText}>
      En la versión web, usa los botones de abajo para establecer tu ubicación.
    </Text>
    {location && (
      <View style={styles.coordinatesBox}>
        <Text style={styles.coordinatesText}>
          📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </Text>
      </View>
    )}
  </View>
);

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { reverseGeocode, isLoading: isGeocoding } = useOptimizedGeocoding();
  usePerformanceMonitor("LocationPickerScreen");

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status, canAskAgain } =
      await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      getCurrentLocation();
      return;
    }

    const message = canAskAgain
      ? "Necesitamos acceso al GPS para autocompletar tu dirección."
      : "Activa el GPS desde ajustes para autocompletar tu dirección.";
    Alert.alert("GPS requerido", message);
    setLocation(AUTLAN_CENTER);
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(coords);
      await handleReverseGeocode(coords);
    } catch (error) {
      console.error("Error getting location:", error);
      setLocation(AUTLAN_CENTER);
    } finally {
      setLoading(false);
    }
  };

  const handleReverseGeocode = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      const result = await reverseGeocode(coords);
      if (result?.formattedAddress) {
        setAddress(result.formattedAddress);
      }
    },
    [reverseGeocode],
  );

  const handleMapPress = useCallback(
    async (event: any) => {
      const coords = event.nativeEvent.coordinate;
      setLocation(coords);
      await handleReverseGeocode(coords);
    },
    [handleReverseGeocode],
  );

  const handleConfirm = () => {
    if (!location) {
      Alert.alert("Error", "Por favor selecciona una ubicación");
      return;
    }

    if (!isInCoverageArea(location.latitude, location.longitude)) {
      Alert.alert(
        "Fuera de cobertura",
        "Esta ubicación está fuera de nuestra zona de servicio en Soria. Por favor selecciona una dirección dentro de la ciudad.",
        [{ text: "OK" }],
      );
      return;
    }

    // Pasar coordenadas de vuelta a AddAddressScreen
    if (route.params?.onLocationSelected) {
      route.params.onLocationSelected(location, address);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <WebMapFallback location={location} />
      ) : MapView ? (
        <MapView
          style={styles.map}
          initialRegion={{
            ...AUTLAN_CENTER,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          region={
            location
              ? {
                  ...location,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
              : undefined
          }
          onPress={handleMapPress}
        >
          {location && Marker && (
            <Marker
              coordinate={location}
              draggable
              onDragEnd={handleMapPress}
            />
          )}
        </MapView>
      ) : (
        <WebMapFallback location={location} />
      )}

      {address && (
        <View
          style={styles.addressBox}
          accessibilityLabel={`Dirección seleccionada: ${address}`}
          accessibilityRole="text"
        >
          <Text style={styles.addressText}>{address}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
          disabled={loading}
          accessibilityLabel="Usar mi ubicación actual"
          accessibilityHint="Obtiene tu ubicación actual usando GPS"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.currentLocationText}>📍 Usar mi ubicación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, !location && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={!location}
          accessibilityLabel="Confirmar ubicación seleccionada"
          accessibilityHint={
            location
              ? "Guarda la ubicación seleccionada"
              : "Selecciona una ubicación primero"
          }
          accessibilityRole="button"
        >
          <Text style={styles.confirmButtonText}>Confirmar Ubicación</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  webFallback: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  webFallbackTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  webFallbackText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  coordinatesBox: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  coordinatesText: {
    fontSize: 14,
    color: "#333",
    fontFamily: "monospace",
  },
  addressBox: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addressText: {
    fontSize: 14,
    color: "#333",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  currentLocationButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  currentLocationText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
