import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

// ---------------------------------------------------------------------------
// Mapa nativo (solo plataformas nativas)
// ---------------------------------------------------------------------------
let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
  } catch {
    // react-native-maps no está disponible (ej. web)
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface NominatimSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
  mainText?: string;
  secondaryText?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

interface BusinessAddressMapPickerProps {
  initialAddress?: string;
  initialLatitude?: number | string | null;
  initialLongitude?: number | string | null;
  onAddressChange: (data: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  }) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export function BusinessAddressMapPicker({
  initialAddress = "",
  initialLatitude,
  initialLongitude,
  onAddressChange,
}: BusinessAddressMapPickerProps) {
  const { theme } = useTheme();

  // Convertir coordenadas iniciales a número si vienen como string
  const parseCoord = (val?: number | string | null): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? null : num;
  };

  const [addressText, setAddressText] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number | null>(
    parseCoord(initialLatitude),
  );
  const [longitude, setLongitude] = useState<number | null>(
    parseCoord(initialLongitude),
  );
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<any>(null);

  // ---------------------------------------------------------------------------
  // Notificar cambios al padre cuando cambien dirección o coordenadas
  // ---------------------------------------------------------------------------
  const prevRef = useRef({ address: initialAddress, lat: latitude, lng: longitude });
  useEffect(() => {
    const prev = prevRef.current;
    if (
      addressText !== prev.address ||
      latitude !== prev.lat ||
      longitude !== prev.lng
    ) {
      prevRef.current = { address: addressText, lat: latitude, lng: longitude };
      onAddressChange({ address: addressText, latitude, longitude });
    }
  }, [addressText, latitude, longitude, onAddressChange]);

  // ---------------------------------------------------------------------------
  // Búsqueda de direcciones con Google Places vía proxy del servidor
  // (debounce 400ms + caché/rate limits en el backend; Nominatim solo queda
  // para reverse geocoding de pin y GPS)
  // ---------------------------------------------------------------------------
  const searchAddress = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    try {
      const response = await apiRequest(
        "GET",
        `/api/gps/places-autocomplete?input=${encodeURIComponent(query)}`,
      );
      const data = await response.json();

      const mapped: NominatimSuggestion[] = (data.predictions || []).map(
        (p: any) => ({
          displayName: p.description,
          mainText: p.mainText,
          secondaryText: p.secondaryText,
          latitude: 0,
          longitude: 0,
        }),
      );

      setSuggestions(mapped);
      setShowSuggestions(mapped.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddressChange = (text: string) => {
    setAddressText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(text), 400);
  };

  const handleSelectSuggestion = async (suggestion: NominatimSuggestion) => {
    setAddressText(suggestion.displayName);
    setShowSuggestions(false);
    setSuggestions([]);

    // Geocodificar la sugerencia vía el proxy del servidor (caché 24h)
    try {
      const response = await apiRequest("POST", "/api/gps/geocode", {
        address: suggestion.displayName,
      });
      const data = await response.json();
      if (data.success && data.lat != null && data.lng != null) {
        setLatitude(data.lat);
        setLongitude(data.lng);

        // Animar el mapa a la nueva posición
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion?.({
              latitude: data.lat,
              longitude: data.lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
        }, 100);
        return;
      }
    } catch {
      // si falla el geocoding, al menos guardamos el texto
    }
  };

  // ---------------------------------------------------------------------------
  // Botón "Usar mi ubicación actual" (GPS)
  // ---------------------------------------------------------------------------
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Se necesita permiso de ubicación para usar el GPS.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      setLatitude(lat);
      setLongitude(lng);

      // Reverse geocode para obtener dirección
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`,
          { headers: { "User-Agent": "ComeYaApp/1.0" } },
        );
        const data = await res.json();
        if (data.display_name) {
          setAddressText(data.display_name);
        }
      } catch {
        setAddressText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch {
      alert("No se pudo obtener la ubicación. Intenta de nuevo.");
    } finally {
      setIsLocating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toque en el mapa para reposicionar el pin (solo nativo)
  // ---------------------------------------------------------------------------
  const handleMapPress = useCallback(
    async (event: any) => {
      const coords = event.nativeEvent.coordinate;
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);

      // Reverse geocode
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=es`,
          { headers: { "User-Agent": "ComeYaApp/1.0" } },
        );
        const data = await res.json();
        if (data.display_name) {
          setAddressText(data.display_name);
        }
      } catch {
        // falla silenciosamente
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Coordenada del centro de Soria por defecto
  // ---------------------------------------------------------------------------
  const fallbackRegion = {
    latitude: 41.7639,
    longitude: -2.4645,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const mapRegion = latitude && longitude
    ? {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : fallbackRegion;

  const hasLocation = latitude !== null && longitude !== null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <View style={[styles.mapPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="map" size={32} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            El mapa interactivo no está disponible en la versión web.{'\n'}
            Usa la búsqueda o el botón GPS para establecer la ubicación.
          </ThemedText>
        </View>
      );
    }

    if (!MapView) {
      return (
        <View style={[styles.mapPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
          <ActivityIndicator size="small" color={ComeYaColors.primary} />
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {hasLocation && Marker && (
          <Marker
            coordinate={{ latitude: latitude!, longitude: longitude! }}
            title="Tu negocio"
            description="Arrastra para mover"
            draggable
            onDragEnd={handleMapPress}
          />
        )}
      </MapView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Campo de búsqueda */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
        >
          <Feather
            name="search"
            size={18}
            color={theme.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar dirección del negocio..."
            placeholderTextColor={theme.textSecondary}
            value={addressText}
            onChangeText={handleAddressChange}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
          />
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={ComeYaColors.primary}
              style={styles.searchLoader}
            />
          )}
        </View>
      </View>

      {/* Sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <ScrollView
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {suggestions.map((s, idx) => (
            <Pressable
              key={idx}
              style={[
                styles.suggestionItem,
                { borderBottomColor: theme.border },
              ]}
              onPress={() => handleSelectSuggestion(s)}
            >
              <Feather
                name="map-pin"
                size={16}
                color={ComeYaColors.primary}
                style={styles.suggestionIcon}
              />
              <View style={styles.suggestionTextContainer}>
                <ThemedText type="small" numberOfLines={2}>
                  {s.displayName}
                </ThemedText>
                {s.street && (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {s.street}, {s.city || "Soria"}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Botón GPS + botón abrir mapa */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={ComeYaColors.primary} />
          ) : (
            <Feather name="navigation" size={18} color={ComeYaColors.primary} />
          )}
          <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: ComeYaColors.primary, fontWeight: "600" }}>
            {isLocating ? "Obteniendo..." : "Usar GPS"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          onPress={() => setShowMapModal(true)}
        >
          <Feather name="map" size={18} color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: ComeYaColors.primary, fontWeight: "600" }}>
            Abrir mapa
          </ThemedText>
        </Pressable>
      </View>

      {/* Preview del mapa pequeño */}
      {hasLocation && (
        <View style={[styles.selectedInfo, { backgroundColor: ComeYaColors.success + "15", borderColor: ComeYaColors.success + "40" }]}>
          <Feather name="check-circle" size={18} color={ComeYaColors.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="small" style={{ color: ComeYaColors.success, fontWeight: "600" }}>
              Ubicación seleccionada
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Modal con mapa grande (nativo) */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowMapModal(false)} style={styles.modalClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Selecciona la ubicación</ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.modalMapContainer}>{renderMap()}</View>
          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.modalConfirmButton, { backgroundColor: ComeYaColors.primary }]}
              onPress={() => setShowMapModal(false)}
            >
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
                {hasLocation ? "Confirmar ubicación" : "Cancelar"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.md,
  },
  searchLoader: {
    marginLeft: Spacing.sm,
  },
  suggestionsContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  selectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  mapPlaceholder: {
    height: 150,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  map: {
    height: 150,
    width: "100%",
    borderRadius: BorderRadius.md,
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.xl + Spacing.xl,
  },
  modalClose: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalMapContainer: {
    flex: 1,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalFooter: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  modalConfirmButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
});