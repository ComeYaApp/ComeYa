import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";

const SORIA = { lat: 41.7636, lng: -2.4677 };

type ViewMode = "all" | "businesses" | "drivers" | "deliveries";

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
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export default function AdminMapScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("deliveries");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ businesses: 0, drivers: 0, orders: 0 });

  const bg = theme.backgroundRoot;
  const card = theme.card;
  const text = theme.text;
  const sub = theme.textSecondary;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
  }, []);

  const createIcons = useCallback(() => {
    const google = (window as any).google;
    if (!google) return null;

    return {
      BIZ_ICON: (color: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="' + color + '" stroke="white" stroke-width="2"/><path d="M11 14h14M13 14v-2a1 1 0 011-1h8a1 1 0 011 1v2M11 18h14l-1 7H12l-1-7z" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}`,
      DRIVER_ICON: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#10B981" stroke="white" stroke-width="2"/><path d="M10 20c0-2 1-3 2-4l4-2 3 2c2 1 3 2 3 4M13 22a2 2 0 104 0M21 22a2 2 0 104 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13 18l2-4h5l2 3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}`,
      BUSINESS_MARKER: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#DC2626"/><circle cx="12" cy="12" r="5" fill="white"/></svg>')}`,
      CUSTOMER_MARKER: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#3B82F6"/><circle cx="12" cy="12" r="5" fill="white"/></svg>')}`,
    };
  }, []);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(err => {
        console.error("Google Maps load error:", err);
        setError("Error cargando mapas");
      });
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;

    const google = (window as any).google;
    if (!google) {
      setError("Google Maps no disponible");
      return;
    }

    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
    });

    setLoading(false);
  }, [mapsReady, isDark]);

  const loadMapData = useCallback(async () => {
    if (!gmap.current || !mapsReady) return;

    const google = (window as any).google;
    if (!google) return;

    clearMarkers();
    const icons = createIcons();
    if (!icons) return;

    let businessCount = 0;
    let driverCount = 0;
    let orderCount = 0;

    try {
      const [bizRes, driversRes, trackingRes] = await Promise.all([
        apiRequest("GET", "/api/admin/businesses"),
        apiRequest("GET", "/api/admin/drivers"),
        apiRequest("GET", "/api/admin/tracking/global").catch(e => ({ ok: false, json: () => Promise.resolve({ success: false, orders: [] }) })),
      ]);

      const bizData = await bizRes.json();
      const driversData = await driversRes.json();
      const trackingData = await trackingRes.json();

      console.log("AdminMap - businesses:", bizData);
      console.log("AdminMap - drivers:", driversData);
      console.log("AdminMap - tracking:", trackingData);

      const businesses = (bizData.businesses || []).filter((b: any) => b.latitude && b.longitude);
      const drivers = (driversData.drivers || []).filter((d: any) => d.currentLatitude && d.currentLongitude);
      const activeOrders = trackingData.orders || [];

      businessCount = businesses.length;
      driverCount = drivers.length;
      orderCount = activeOrders.length;

      setStats({ businesses: businessCount, drivers: driverCount, orders: orderCount });

      if (viewMode === "all" || viewMode === "businesses") {
        businesses.forEach((b: any) => {
          const lat = parseFloat(b.latitude);
          const lng = parseFloat(b.longitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const color = (b.isOpen ?? b.is_open) ? ComeYaColors.primary : "#9E9E9E";
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: gmap.current,
            title: b.name,
            icon: { url: icons.BIZ_ICON(color), scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
          });
          markersRef.current.push(marker);
        });
      }

      if (viewMode === "all" || viewMode === "drivers") {
        drivers.forEach((d: any) => {
          const lat = parseFloat(d.currentLatitude);
          const lng = parseFloat(d.currentLongitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: gmap.current,
            title: d.name || "Repartidor",
            icon: { url: icons.DRIVER_ICON, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
          });
          markersRef.current.push(marker);
        });
      }

      if (viewMode === "all" || viewMode === "deliveries") {
        activeOrders.forEach((o: any) => {
          const statusColor = o.status === "on_the_way" ? "#10B981" : o.status === "preparing" ? "#F59E0B" : "#3B82F6";

          if (o.business?.lat && o.business?.lng) {
            const bizMarker = new google.maps.Marker({
              position: { lat: o.business.lat, lng: o.business.lng },
              map: gmap.current,
              title: o.business.name,
              icon: { url: icons.BUSINESS_MARKER, scaledSize: new google.maps.Size(24, 36), anchor: new google.maps.Point(12, 36) },
            });
            markersRef.current.push(bizMarker);
          }

          if (o.delivery?.lat && o.delivery?.lng) {
            const custMarker = new google.maps.Marker({
              position: { lat: o.delivery.lat, lng: o.delivery.lng },
              map: gmap.current,
              title: `Entrega: ${o.orderNumber}`,
              icon: { url: icons.CUSTOMER_MARKER, scaledSize: new google.maps.Size(24, 36), anchor: new google.maps.Point(12, 36) },
            });
            markersRef.current.push(custMarker);
          }

          if (o.driver?.lat && o.driver?.lng) {
            const driverMarker = new google.maps.Marker({
              position: { lat: o.driver.lat, lng: o.driver.lng },
              map: gmap.current,
              title: `Repartidor: ${o.driver.name}`,
              icon: { url: icons.DRIVER_ICON, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
            });
            markersRef.current.push(driverMarker);
          }

          if (o.business?.lat && o.delivery?.lat) {
            const routePath = new google.maps.Polyline({
              path: [
                { lat: o.business.lat, lng: o.business.lng },
                { lat: o.delivery.lat, lng: o.delivery.lng },
              ],
              geodesic: true,
              strokeColor: statusColor,
              strokeOpacity: 0.7,
              strokeWeight: 3,
            });
            routePath.setMap(gmap.current);
            markersRef.current.push(routePath);
          }
        });
      }

      if (businessCount === 0 && driverCount === 0 && orderCount === 0) {
        console.log("AdminMap - No data found for current view mode");
      }

    } catch (err) {
      console.error("AdminMap - Error loading data:", err);
    }
  }, [mapsReady, viewMode, clearMarkers, createIcons]);

  useEffect(() => {
    if (!mapsReady) return;

    loadMapData();
    const interval = setInterval(loadMapData, 20000);
    return () => clearInterval(interval);
  }, [mapsReady, loadMapData]);

  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
    { id: "deliveries", label: "Entregas", icon: "package" },
    { id: "drivers", label: "Repartidores", icon: "truck" },
    { id: "businesses", label: "Negocios", icon: "briefcase" },
    { id: "all", label: "Todo", icon: "layers" },
  ];

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {(loading || !mapsReady) && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <Text style={{ marginTop: 8, color: sub }}>Cargando mapa...</Text>
        </View>
      )}

      {error && (
        <View style={[s.error, { top: Spacing.xl }]}>
          <Text style={{ color: "#EF4444" }}>{error}</Text>
        </View>
      )}

      <View style={[s.controls, { top: Spacing.xl, left: Spacing.lg }]}>
        <View style={[s.viewToggle, { backgroundColor: card }]}>
          {VIEW_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setViewMode(opt.id)}
              style={[
                s.toggleBtn,
                viewMode === opt.id && { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <Feather name={opt.icon as any} size={14} color={viewMode === opt.id ? "#fff" : sub} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[s.statsRow, { top: Spacing.xl, right: Spacing.lg }]}>
        <View style={[s.statChip, { backgroundColor: card }]}>
          <Feather name="briefcase" size={14} color={ComeYaColors.primary} />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.businesses}</ThemedText>
        </View>
        <View style={[s.statChip, { backgroundColor: card }]}>
          <Feather name="truck" size={14} color="#4CAF50" />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.drivers}</ThemedText>
        </View>
        <View style={[s.statChip, { backgroundColor: card }]}>
          <Feather name="package" size={14} color="#F59E0B" />
          <ThemedText type="caption" style={{ marginLeft: 4, fontWeight: "700" }}>{stats.orders}</ThemedText>
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
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" } as any,
  error: { position: "absolute", left: Spacing.lg, zIndex: 10, padding: 12, backgroundColor: "#FEF2F2", borderRadius: 8 },
  controls: { position: "absolute", zIndex: 10 },
  viewToggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  toggleBtn: { padding: 10 },
  statsRow: { position: "absolute", right: Spacing.lg, flexDirection: "column", gap: Spacing.sm, zIndex: 10, alignItems: "flex-end" },
  statChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
});