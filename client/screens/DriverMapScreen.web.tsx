import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("gmap-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function DriverMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA, zoom: 15,
      disableDefaultUI: true, zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    // GPS del repartidor
    navigator.geolocation?.watchPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      gmap.current?.panTo(loc);

      if (driverMarker.current) {
        driverMarker.current.setPosition(loc);
      } else {
        driverMarker.current = new google.maps.Marker({
          position: loc,
          map: gmap.current,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#4CAF50" stroke="white" stroke-width="3"/><text x="24" y="30" text-anchor="middle" font-size="22">🛵</text></svg>`)}`,
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 24),
          },
          zIndex: 999,
        });
      }

      // Actualizar ubicación en el servidor
      apiRequest("PUT", "/api/delivery/location", {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }).catch(() => {});
    }, undefined, { enableHighAccuracy: true, maximumAge: 5000 });

    // Cargar pedido activo
    apiRequest("GET", "/api/delivery/active-order").then(r => r.json()).then(data => {
      if (data.order) {
        setActiveOrder(data.order);
        // Mostrar destino en el mapa
        if (data.order.deliveryLatitude && data.order.deliveryLongitude) {
          new google.maps.Marker({
            position: { lat: parseFloat(data.order.deliveryLatitude), lng: parseFloat(data.order.deliveryLongitude) },
            map: gmap.current,
            title: "Destino de entrega",
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><rect x="2" y="2" width="36" height="36" rx="18" fill="${ComeYaColors.primary}" stroke="white" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="20">🏠</text><polygon points="14,38 26,38 20,48" fill="${ComeYaColors.primary}"/></svg>`)}`,
              scaledSize: new google.maps.Size(40, 48),
              anchor: new google.maps.Point(20, 48),
            },
          });
        }
      }
    }).catch(() => {});
  }, [mapsReady]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Cargando mapa...</ThemedText>
        </View>
      )}

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={[s.floatBtn, { backgroundColor: theme.card }]}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <View style={[s.dot, { backgroundColor: "#4CAF50" }]} />
          <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>Mi Mapa GPS</ThemedText>
        </View>
        <Pressable
          onPress={() => userLocation && gmap.current?.panTo(userLocation)}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="navigation" size={22} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Banner pedido activo */}
      {activeOrder && (
        <View style={[s.orderBanner, { backgroundColor: theme.card, bottom: insets.bottom + 16 }]}>
          <View style={[s.orderDot, { backgroundColor: ComeYaColors.primary }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="caption" style={{ fontWeight: "700", color: ComeYaColors.primary }}>Entrega activa</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {activeOrder.businessName} → {activeOrder.deliveryAddress}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </View>
      )}
    </View>
  );
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.85)", zIndex: 20 } as any,
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, zIndex: 10,
  },
  floatBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  headerTitle: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  orderBanner: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    zIndex: 10,
  },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
});
