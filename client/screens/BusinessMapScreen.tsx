import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  Image as RNImage,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// San Cristóbal, Táchira, Venezuela
const DEFAULT_REGION = {
  latitude: 7.7708,
  longitude: -72.2251,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

interface BusinessPin {
  id: string;
  name: string;
  type: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  isOpen: boolean;
  latitude: number;
  longitude: number;
  address: string;
  categories: string[];
}

export default function BusinessMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { theme, isDark } = useTheme();

  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // Cargar react-native-maps dinámicamente (no disponible en web)
  useEffect(() => {
    if (Platform.OS !== "web") {
      import("react-native-maps").then((mod) => {
        setMapView(() => mod.default);
        setMarker(() => mod.Marker);
      });
    }
  }, []);

  // Pedir permiso de ubicación y centrar mapa cuando llegue
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        // Centrar el mapa en el usuario apenas llegue el GPS
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600);
      }
    })();
  }, []);

  // Cargar negocios
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/businesses");
        const data = await res.json();
        const raw = data.businesses || [];
        const pins: BusinessPin[] = raw
          .filter((b: any) => b.latitude && b.longitude)
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            type: b.type || "restaurant",
            image: b.image || "",
            rating: (b.rating || 0) / 100,
            deliveryTime: b.delivery_time || "30-45 min",
            deliveryFee: (b.delivery_fee || 0) / 100,
            isOpen: b.isOpen ?? b.is_open ?? false,
            latitude: parseFloat(b.latitude),
            longitude: parseFloat(b.longitude),
            address: b.address || "San Cristóbal, Táchira, Venezuela",
            categories: b.categories ? b.categories.split(",") : [],
          }));
        setBusinesses(pins);
      } catch (e) {
        console.error("Error loading businesses for map:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handlePinPress = useCallback((business: BusinessPin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(business);
    mapRef.current?.animateToRegion(
      { latitude: business.latitude - 0.008, longitude: business.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      400
    );
  }, []);

  const handleDirections = useCallback((business: BusinessPin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = Platform.select({
      ios: `maps://app?daddr=${business.latitude},${business.longitude}`,
      android: `google.navigation:q=${business.latitude},${business.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`,
    });
    Linking.openURL(url!);
  }, []);

  const handleCenterUser = useCallback(() => {
    if (!userLocation) return;
    Haptics.selectionAsync();
    mapRef.current?.animateToRegion(
      { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400
    );
  }, [userLocation]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Mapa de Negocios</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.webFallback}>
          <Feather name="map" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            El mapa solo está disponible en la app móvil
          </ThemedText>
        </View>
      </View>
    );
  }

  if (isLoading || !MapView) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Cargando mapa...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={isDark ? "dark" : "light"}
      >
        {Marker && businesses.map((b) => (
          <Marker
            key={b.id}
            coordinate={{ latitude: b.latitude, longitude: b.longitude }}
            onPress={() => handlePinPress(b)}
          >
            {/* Pin personalizado */}
            <View style={[styles.pin, { borderColor: b.isOpen ? ComeYaColors.primary : "#9E9E9E" }]}>
              <View style={[styles.pinInner, { backgroundColor: b.isOpen ? ComeYaColors.primary : "#9E9E9E" }]}>
                <Feather
                  name={b.type === "market" ? "shopping-bag" : "coffee"}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={[styles.pinTail, { borderTopColor: b.isOpen ? ComeYaColors.primary : "#9E9E9E" }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header flotante */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[styles.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>
            {businesses.length} negocios
          </ThemedText>
        </View>
        <Pressable
          onPress={handleCenterUser}
          style={[styles.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="navigation" size={22} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Leyenda */}
      <View style={[styles.legend, { backgroundColor: theme.card, bottom: selected ? 280 : insets.bottom + Spacing.lg }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ComeYaColors.primary }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Abierto</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#9E9E9E" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cerrado</ThemedText>
        </View>
      </View>

      {/* Card del negocio seleccionado */}
      {selected ? (
        <Pressable
          style={[styles.card, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.md }, Shadows.lg]}
          onPress={() => setSelected(null)}
        >
          {/* Tap para cerrar */}
          <View style={styles.cardHandle} />

          <View style={styles.cardContent}>
            {/* Imagen */}
            <Image
              source={selected.image ? { uri: selected.image } : require("../../assets/images/delivery-hero.png")}
              style={styles.cardImage}
              contentFit="cover"
            />

            {/* Info */}
            <View style={styles.cardInfo}>
              <View style={styles.cardNameRow}>
                <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
                  {selected.name}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: selected.isOpen ? ComeYaColors.primary + "20" : "#9E9E9E20" }]}>
                  <ThemedText type="caption" style={{ color: selected.isOpen ? ComeYaColors.primary : "#9E9E9E", fontWeight: "700" }}>
                    {selected.isOpen ? "Abierto" : "Cerrado"}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
                {selected.address}
              </ThemedText>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Feather name="star" size={12} color="#FFB800" />
                  <ThemedText type="caption" style={{ marginLeft: 3 }}>{selected.rating.toFixed(1)}</ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="clock" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ marginLeft: 3, color: theme.textSecondary }}>{selected.deliveryTime}</ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ marginLeft: 3, color: theme.textSecondary }}>${selected.deliveryFee.toFixed(0)}</ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Botones */}
          <View style={styles.cardButtons}>
            <Pressable
              onPress={() => handleDirections(selected)}
              style={[styles.btnDirections, { borderColor: ComeYaColors.primary }]}
            >
              <Feather name="navigation" size={16} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: "700", marginLeft: Spacing.xs }}>
                Cómo llegar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelected(null);
                navigation.getParent()?.navigate("BusinessDetail", { businessId: selected.id });
              }}
              style={styles.btnMenu}
            >
              <Feather name="book-open" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: Spacing.xs }}>
                Ver menú
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  webFallback: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },

  // Header flotante
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Pin personalizado
  pin: {
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderColor: ComeYaColors.primary,
  },
  pinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: ComeYaColors.primary,
    marginTop: -1,
  },

  // Leyenda
  legend: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },

  // Card negocio
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  cardContent: { flexDirection: "row", marginBottom: Spacing.md },
  cardImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  cardMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center" },

  // Botones
  cardButtons: { flexDirection: "row", gap: Spacing.md },
  btnDirections: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  btnMenu: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: ComeYaColors.primary,
  },
});
