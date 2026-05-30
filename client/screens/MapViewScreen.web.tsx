import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

const SORIA = { lat: 41.7636, lng: -2.4677 };
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

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

export default function MapViewScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);

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

    // GPS usuario
    navigator.geolocation?.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gmap.current?.panTo(loc);
      new google.maps.Marker({
        position: loc,
        map: gmap.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: ComeYaColors.primary,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
      });
    });
  }, [mapsReady]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation?.goBack()}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
          <ThemedText
            type="body"
            style={{ fontWeight: "700", marginLeft: Spacing.xs }}
          >
            Mapa
          </ThemedText>
        </View>
        <View style={{ width: 44 }} />
      </View>
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
});
