import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { fetchRouteDirections } from "@/utils/directions";
import { loadGoogleMaps } from "@/utils/googleMapsWeb";

const SORIA = { lat: 41.7636, lng: -2.4677 };

export default function RouteOptimizationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    const buildRoute = async (driverLat: number, driverLng: number) => {
      try {
        const res = await apiRequest("GET", "/api/delivery/active-order");
        const data = await res.json();
        if (!data.order) return;
        setActiveOrder(data.order);

        const dest =
          data.order.deliveryLatitude && data.order.deliveryLongitude
            ? { lat: parseFloat(data.order.deliveryLatitude), lng: parseFloat(data.order.deliveryLongitude) }
            : SORIA;

        // Limpiar ruta anterior
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }

        // Ruta real por calles vía proxy del servidor (caché 30 min + rate
        // limit; la cuota de Google no se quema desde el navegador)
        const route = await fetchRouteDirections(
          { latitude: driverLat, longitude: driverLng },
          { latitude: dest.lat, longitude: dest.lng },
        );
        if (route?.distanceText) setDistance(route.distanceText);
        if (route?.durationText) setDuration(route.durationText);

        // SOLO geometría real por calles — sin ruta no se dibuja nada
        if (route && route.coordinates.length >= 2 && !route.fallback) {
          polylineRef.current = new google.maps.Polyline({
            path: route.coordinates.map((c) => ({
              lat: c.latitude,
              lng: c.longitude,
            })),
            geodesic: true,
            strokeColor: ComeYaColors.primary,
            strokeWeight: 4,
            map: gmap.current,
          });

          // Ajustar bounds
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(driverLat, driverLng));
          bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
          gmap.current.fitBounds(bounds, 50);
        }
      } catch {}
    };

    navigator.geolocation?.getCurrentPosition(
      (pos) => buildRoute(pos.coords.latitude, pos.coords.longitude),
      () => buildRoute(SORIA.lat, SORIA.lng),
    );
  }, [mapsReady]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
      {!mapsReady && <View style={s.loading}><ActivityIndicator size="large" color={ComeYaColors.primary} /></View>}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation?.goBack()} style={[s.floatBtn, { backgroundColor: theme.card }]}><Feather name="arrow-left" size={22} color={theme.text} /></Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="navigation" size={16} color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>Ruta Optimizada</ThemedText>
        </View><View style={{ width: 44 }} />
      </View>
      {(distance || duration) && (
        <View style={[s.routeInfo, { backgroundColor: theme.card, bottom: insets.bottom + Spacing.lg }]}>
          {duration && <View style={s.routeStat}><Feather name="clock" size={16} color={ComeYaColors.primary} /><ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>{duration}</ThemedText></View>}
          {distance && <View style={s.routeStat}><Feather name="map-pin" size={16} color={ComeYaColors.primary} /><ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>{distance}</ThemedText></View>}
          {activeOrder && <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }} numberOfLines={1}>→ {activeOrder.deliveryAddress}</ThemedText>}
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
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", zIndex: 20 } as any,
  header: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, zIndex: 10 },
  floatBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  headerTitle: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  routeInfo: { position: "absolute", left: Spacing.lg, right: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8, zIndex: 10 },
  routeStat: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
});