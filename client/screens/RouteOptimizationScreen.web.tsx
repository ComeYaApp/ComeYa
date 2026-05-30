import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=directions`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function RouteOptimizationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
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

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: gmap.current,
      polylineOptions: { strokeColor: ComeYaColors.primary, strokeWeight: 4 },
      suppressMarkers: false,
    });

    // Obtener ubicación del repartidor y pedido activo
    const buildRoute = async (driverLat: number, driverLng: number) => {
      try {
        const res = await apiRequest("GET", "/api/delivery/active-order");
        const data = await res.json();
        if (!data.order) return;
        setActiveOrder(data.order);

        const dest =
          data.order.deliveryLatitude && data.order.deliveryLongitude
            ? {
                lat: parseFloat(data.order.deliveryLatitude),
                lng: parseFloat(data.order.deliveryLongitude),
              }
            : SORIA;

        directionsService.route(
          {
            origin: { lat: driverLat, lng: driverLng },
            destination: dest,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === "OK") {
              directionsRenderer.setDirections(result);
              const leg = result.routes[0]?.legs[0];
              if (leg) {
                setDistance(leg.distance?.text || null);
                setDuration(leg.duration?.text || null);
              }
            }
          },
        );
      } catch {}
    };

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        buildRoute(pos.coords.latitude, pos.coords.longitude);
      },
      () => buildRoute(SORIA.lat, SORIA.lng),
    );
  }, [mapsReady]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation?.goBack()}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="navigation" size={16} color={ComeYaColors.primary} />
          <ThemedText
            type="body"
            style={{ fontWeight: "700", marginLeft: Spacing.xs }}
          >
            Ruta Optimizada
          </ThemedText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Info de ruta */}
      {(distance || duration) && (
        <View
          style={[
            s.routeInfo,
            { backgroundColor: theme.card, bottom: insets.bottom + Spacing.lg },
          ]}
        >
          {duration && (
            <View style={s.routeStat}>
              <Feather name="clock" size={16} color={ComeYaColors.primary} />
              <ThemedText
                type="body"
                style={{ fontWeight: "700", marginLeft: Spacing.xs }}
              >
                {duration}
              </ThemedText>
            </View>
          )}
          {distance && (
            <View style={s.routeStat}>
              <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
              <ThemedText
                type="body"
                style={{ fontWeight: "700", marginLeft: Spacing.xs }}
              >
                {distance}
              </ThemedText>
            </View>
          )}
          {activeOrder && (
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
              numberOfLines={1}
            >
              → {activeOrder.deliveryAddress}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  container: { flex: 1 },
  loading: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  } as any,
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
  routeInfo: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  routeStat: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
});
