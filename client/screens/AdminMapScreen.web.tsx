import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
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

export default function AdminMapScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [stats, setStats] = useState({ businesses: 0, drivers: 0, orders: 0 });

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA, zoom: 14,
      disableDefaultUI: true, zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
    });

    // Cargar negocios
    apiRequest("GET", "/api/businesses").then(r => r.json()).then(data => {
      const businesses = (data.businesses || []).filter((b: any) => b.latitude && b.longitude);
      setStats(s => ({ ...s, businesses: businesses.length }));
      businesses.forEach((b: any) => {
        new google.maps.Marker({
          position: { lat: parseFloat(b.latitude), lng: parseFloat(b.longitude) },
          map: gmap.current,
          title: b.name,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="${b.isOpen ?? b.is_open ? ComeYaColors.primary : '#9E9E9E'}" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-size="16">🏪</text></svg>`)}`,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          },
        });
      });
    }).catch(console.error);

    // Cargar repartidores activos
    apiRequest("GET", "/api/admin/drivers").then(r => r.json()).then(data => {
      const drivers = (data.drivers || []).filter((d: any) => d.isOnline);
      setStats(s => ({ ...s, drivers: drivers.length }));
    }).catch(console.error);

    // Cargar pedidos activos
    apiRequest("GET", "/api/admin/orders").then(r => r.json()).then(data => {
      const active = (data.orders || []).filter((o: any) => ["pending","preparing","on_the_way"].includes(o.status));
      setStats(s => ({ ...s, orders: active.length }));
    }).catch(console.error);
  }, [mapsReady]);

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      {/* Stats flotantes */}
      <View style={[s.statsRow, { top: Spacing.xl }]}>
        <View style={[s.statChip, { backgroundColor: theme.card }]}>
          <Feather name="briefcase" size={14} color={ComeYaColors.primary} />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.businesses} negocios</ThemedText>
        </View>
        <View style={[s.statChip, { backgroundColor: theme.card }]}>
          <Feather name="truck" size={14} color="#4CAF50" />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.drivers} online</ThemedText>
        </View>
        <View style={[s.statChip, { backgroundColor: theme.card }]}>
          <Feather name="package" size={14} color="#F59E0B" />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.orders} activos</ThemedText>
        </View>
      </View>
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
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" } as any,
  statsRow: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", gap: Spacing.sm, zIndex: 10,
  },
  statChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
});
