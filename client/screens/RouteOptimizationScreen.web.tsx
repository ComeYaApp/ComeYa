import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const SORIA = { lat: 41.7636, lng: -2.4677 };

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
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function decodePolyline(
  encoded: string,
): { latitude: number; longitude: number }[] {
  const poly: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

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

        // Ruta real por calles (Directions API - 1 sola llamada)
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: new google.maps.LatLng(driverLat, driverLng),
            destination: new google.maps.LatLng(dest.lat, dest.lng),
            travelMode: google.maps.TravelMode.DRIVING,
            language: "es",
          },
          (response: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && response) {
              const leg = response.routes[0].legs[0];
              setDistance(leg.distance?.text || "");
              setDuration(leg.duration?.text || "");

              // Dibujar ruta en el mapa
              polylineRef.current = new google.maps.DirectionsRenderer({
                map: gmap.current,
                directions: response,
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: ComeYaColors.primary,
                  strokeWeight: 4,
                },
              });

              // Ajustar bounds
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(new google.maps.LatLng(driverLat, driverLng));
              bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
              gmap.current.fitBounds(bounds, 50);
            } else {
              // Fallback a línea recta
              polylineRef.current = new google.maps.Polyline({
                path: [{ lat: driverLat, lng: driverLng }, dest],
                geodesic: true,
                strokeColor: ComeYaColors.primary,
                strokeWeight: 4,
                map: gmap.current,
              });
              const R = 6371;
              const dLat = ((dest.lat - driverLat) * Math.PI) / 180;
              const dLng = ((dest.lng - driverLng) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos((driverLat * Math.PI) / 180) *
                  Math.cos((dest.lat * Math.PI) / 180) *
                  Math.sin(dLng / 2) ** 2;
              const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const mins = Math.round((km / 30) * 60);
              setDistance(`${km.toFixed(1)} km`);
              setDuration(`~${mins} min`);
            }
          },
        );
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