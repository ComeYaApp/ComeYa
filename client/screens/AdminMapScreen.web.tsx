import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
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
  const [debug, setDebug] = useState<any>(null);
  const [stats, setStats] = useState({ businesses: 0, drivers: 0, orders: 0, businessesWithCoords: 0 });

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
      BIZ_OPEN: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#DC2626" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">B</text></svg>')}`,
      BIZ_CLOSED: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#9E9E9E" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">B</text></svg>')}`,
      DRIVER: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#10B981" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">D</text></svg>')}`,
      CUSTOMER: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#3B82F6" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">C</text></svg>')}`,
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
      setLoading(false);
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

    try {
      setDebug({ loading: true });

      const [bizRes, driversRes, trackingRes] = await Promise.all([
        apiRequest("GET", "/api/admin/businesses"),
        apiRequest("GET", "/api/admin/drivers"),
        apiRequest("GET", "/api/admin/tracking/global").catch(() => ({ ok: false, json: () => Promise.resolve({ success: false, orders: [] }) })),
      ]);

      const bizData = await bizRes.json();
      const driversData = await driversRes.json();
      const trackingData = await trackingRes.json();

      setDebug({ bizStatus: bizRes.status, bizCount: bizData.businesses?.length || 0, driversStatus: driversRes.status, driversCount: driversData.drivers?.length || 0, trackingStatus: trackingRes.status, trackingCount: trackingData.orders?.length || 0 });

      const businesses = (bizData.businesses || []).filter((b: any) => b.latitude && b.longitude);
      const drivers = (driversData.drivers || []).filter((d: any) => d.currentLatitude && d.currentLongitude);
      const activeOrders = trackingData.orders || [];

      const bizWithCoords = businesses.filter((b: any) => b.latitude && b.longitude).length;

      setStats({ 
        businesses: bizData.businesses?.length || 0, 
        drivers: driversData.drivers?.length || 0, 
        orders: activeOrders.length,
        businessesWithCoords: bizWithCoords 
      });

      console.log("[AdminMap] Businesses:", bizData.businesses?.length, "with coords:", bizWithCoords);
      console.log("[AdminMap] Drivers:", driversData.drivers?.length);
      console.log("[AdminMap] Orders:", activeOrders.length);

      if (viewMode === "all" || viewMode === "businesses") {
        businesses.forEach((b: any) => {
          const lat = parseFloat(b.latitude);
          const lng = parseFloat(b.longitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const color = (b.isOpen || b.is_open) ? icons.BIZ_OPEN : icons.BIZ_CLOSED;
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: gmap.current,
            title: b.name || "Negocio",
            icon: { url: color, scaledSize: new google.maps.Size(40, 40), anchor: new google.maps.Point(20, 20) },
            zIndex: 100,
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
            icon: { url: icons.DRIVER, scaledSize: new google.maps.Size(40, 40), anchor: new google.maps.Point(20, 20) },
            zIndex: 200,
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
              title: (o.business.name || "Negocio") + " - " + o.orderNumber,
              icon: { url: icons.BIZ_OPEN, scaledSize: new google.maps.Size(30, 30), anchor: new google.maps.Point(15, 30) },
            });
            markersRef.current.push(bizMarker);
          }

          if (o.delivery?.lat && o.delivery?.lng) {
            const custMarker = new google.maps.Marker({
              position: { lat: o.delivery.lat, lng: o.delivery.lng },
              map: gmap.current,
              title: `Entrega: ${o.orderNumber}`,
              icon: { url: icons.CUSTOMER, scaledSize: new google.maps.Size(30, 30), anchor: new google.maps.Point(15, 30) },
            });
            markersRef.current.push(custMarker);
          }

          if (o.business?.lat && o.delivery?.lat) {
            const routePath = new google.maps.Polyline({
              path: [
                { lat: o.business.lat, lng: o.business.lng },
                { lat: o.delivery.lat, lng: o.delivery.lng },
              ],
              geodesic: true,
              strokeColor: statusColor,
              strokeOpacity: 0.8,
              strokeWeight: 4,
            });
            routePath.setMap(gmap.current);
            markersRef.current.push(routePath);
          }
        });
      }

      setDebug((d: any) => ({ ...d, loading: false, markers: markersRef.current.length }));

    } catch (err: any) {
      console.error("[AdminMap] Error:", err);
      setDebug({ error: err.message });
    }
  }, [mapsReady, viewMode, clearMarkers, createIcons]);

  useEffect(() => {
    if (!mapsReady) return;
    loadMapData();
    const interval = setInterval(loadMapData, 15000);
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

      {loading && (
        <View style={[s.loading, { backgroundColor: bg }]}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <Text style={{ marginTop: 12, color: sub }}>Cargando mapa...</Text>
        </View>
      )}

      {error && (
        <View style={[s.debugPanel, { backgroundColor: card, top: 150 }]}>
          <Text style={{ color: "#EF4444", fontWeight: "700" }}>{error}</Text>
        </View>
      )}

      <View style={[s.controls, { top: Spacing.xl, left: Spacing.lg }]}>
        <View style={[s.viewToggle, { backgroundColor: card }]}>
          {VIEW_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => { setViewMode(opt.id); setTimeout(loadMapData, 100); }}
              style={[s.toggleBtn, viewMode === opt.id && { backgroundColor: ComeYaColors.primary }]}
            >
              <Feather name={opt.icon as any} size={16} color={viewMode === opt.id ? "#fff" : sub} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[s.statsPanel, { top: Spacing.xl, right: Spacing.lg }]}>
        <View style={[s.statRow, { backgroundColor: card }]}>
          <Feather name="briefcase" size={16} color="#DC2626" />
          <Text style={s.statText}>{stats.businesses}</Text>
          <Text style={s.statLabel}>({stats.businessesWithCoords} c/coords)</Text>
        </View>
        <View style={[s.statRow, { backgroundColor: card }]}>
          <Feather name="truck" size={16} color="#10B981" />
          <Text style={s.statText}>{stats.drivers}</Text>
        </View>
        <View style={[s.statRow, { backgroundColor: card }]}>
          <Feather name="package" size={16} color="#F59E0B" />
          <Text style={s.statText}>{stats.orders}</Text>
        </View>
      </View>

      {debug && (
        <View style={[s.debugPanel, { bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg }]}>
          <Text style={{ color: text, fontSize: 11, fontFamily: "monospace" }}>
            API Status:{JSON.stringify(debug)}
          </Text>
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
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", zIndex: 100 } as any,
  debugPanel: { position: "absolute", zIndex: 50, padding: 12, borderRadius: 8 },
  controls: { position: "absolute", zIndex: 10 },
  viewToggle: { flexDirection: "row", borderRadius: 10, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  toggleBtn: { padding: 12 },
  statsPanel: { position: "absolute", right: Spacing.lg, zIndex: 10, gap: 8 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 25 },
  statText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "#9E9E9E" },
});