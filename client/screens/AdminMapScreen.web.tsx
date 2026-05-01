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

    const BIZ_SVG = (color: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="' + color + '" stroke="white" stroke-width="2"/><path d="M11 14h14M13 14v-2a1 1 0 011-1h8a1 1 0 011 1v2M11 18h14l-1 7H12l-1-7z" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}` ;
    const DRIVER_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#10B981" stroke="white" stroke-width="2"/><path d="M10 20c0-2 1-3 2-4l4-2 3 2c2 1 3 2 3 4M13 22a2 2 0 104 0M21 22a2 2 0 104 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13 18l2-4h5l2 3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}` ;

    const loadData = () => {
      // Negocios
      apiRequest("GET", "/api/business").then(r => r.json()).then(data => {
        const businesses = (data.businesses || []).filter((b: any) => b.latitude && b.longitude);
        setStats(s => ({ ...s, businesses: businesses.length }));
        businesses.forEach((b: any) => {
          const color = (b.isOpen ?? b.is_open) ? ComeYaColors.primary : "#9E9E9E";
          new google.maps.Marker({
            position: { lat: parseFloat(b.latitude), lng: parseFloat(b.longitude) },
            map: gmap.current,
            title: b.name,
            icon: { url: BIZ_SVG(color), scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
          });
        });
      }).catch(console.error);

      // Repartidores con ubicación en tiempo real
      apiRequest("GET", "/api/admin/drivers").then(r => r.json()).then(data => {
        const drivers = (data.drivers || []);
        const online = drivers.filter((d: any) => d.currentLatitude && d.currentLongitude);
        setStats(s => ({ ...s, drivers: online.length }));
        online.forEach((d: any) => {
          new google.maps.Marker({
            position: { lat: parseFloat(d.currentLatitude), lng: parseFloat(d.currentLongitude) },
            map: gmap.current,
            title: d.name || "Repartidor",
            icon: { url: DRIVER_SVG, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
            zIndex: 999,
          });
        });
      }).catch(console.error);

      // Pedidos activos
      apiRequest("GET", "/api/admin/orders").then(r => r.json()).then(data => {
        const active = (data.orders || []).filter((o: any) => ["pending","preparing","on_the_way"].includes(o.status));
        setStats(s => ({ ...s, orders: active.length }));
      }).catch(console.error);
    };

    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
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
