import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from "react-native";
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
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AdminMapScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("deliveries");
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ businesses: 0, drivers: 0, orders: 0 });

  const bg = theme.backgroundRoot;
  const card = theme.card;
  const text = theme.text;
  const sub = theme.textSecondary;

  const clearMarkers = () => {
    if (!gmap.current) return;
    if ((window as any).google?.maps) {
      const google = (window as any).google;
      gmap.current.setOptions({ styles: isDark ? DARK_STYLE : [] });
    }
  };

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;

    if (!gmap.current) {
      const google = (window as any).google;
      gmap.current = new google.maps.Map(mapRef.current, {
        center: SORIA, zoom: 14,
        disableDefaultUI: true, zoomControl: true,
        styles: isDark ? DARK_STYLE : [],
      });
    }

    const google = (window as any).google;

    const BIZ_ICON = (color: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="' + color + '" stroke="white" stroke-width="2"/><path d="M11 14h14M13 14v-2a1 1 0 011-1h8a1 1 0 011 1v2M11 18h14l-1 7H12l-1-7z" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}`;
    const DRIVER_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#10B981" stroke="white" stroke-width="2"/><path d="M10 20c0-2 1-3 2-4l4-2 3 2c2 1 3 2 3 4M13 22a2 2 0 104 0M21 22a2 2 0 104 0" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13 18l2-4h5l2 3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>')}`;
    const BUSINESS_MARKER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#DC2626"/><circle cx="12" cy="12" r="5" fill="white"/></svg>')}`;
    const CUSTOMER_MARKER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#3B82F6"/><circle cx="12" cy="12" r="5" fill="white"/></svg>')}`;

    const loadData = async () => {
      if (!gmap.current) return;

      const newMarkers: any[] = [];

      const addMarker = (lat: number, lng: number, title: string, icon: string, zIndex: number = 1) => {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: gmap.current,
          title,
          icon: { url: icon, scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
          zIndex,
        });
        newMarkers.push(marker);
        return marker;
      };

      const addInfoWindow = (marker: any, content: string) => {
        const info = new google.maps.InfoWindow({ content });
        info.open(gmap.current, marker);
      };

      try {
        const [bizRes, driversRes, trackingRes] = await Promise.all([
          apiRequest("GET", "/api/business"),
          apiRequest("GET", "/api/admin/drivers"),
          apiRequest("GET", "/api/admin/tracking/global"),
        ]);

        const bizData = await bizRes.json();
        const driversData = await driversRes.json();
        const trackingData = await trackingRes.json();

        const businesses = (bizData.businesses || []).filter((b: any) => b.latitude && b.longitude);
        const drivers = (driversData.drivers || []).filter((d: any) => d.currentLatitude && d.currentLongitude);
        const activeOrders = trackingData.orders || [];

        setStats({
          businesses: businesses.length,
          drivers: drivers.length,
          orders: activeOrders.length,
        });
        setOrders(activeOrders);

        if (viewMode === "all" || viewMode === "businesses") {
          businesses.forEach((b: any) => {
            const color = (b.isOpen ?? b.is_open) ? ComeYaColors.primary : "#9E9E9E";
            addMarker(parseFloat(b.latitude), parseFloat(b.longitude), b.name, BIZ_ICON(color), 1);
          });
        }

        if (viewMode === "all" || viewMode === "drivers") {
          drivers.forEach((d: any) => {
            addMarker(parseFloat(d.currentLatitude), parseFloat(d.currentLongitude), d.name || "Repartidor", DRIVER_ICON, 999);
          });
        }

        if (viewMode === "all" || viewMode === "deliveries") {
          activeOrders.forEach((o: any) => {
            const statusColor = o.status === "on_the_way" ? "#10B981" : o.status === "preparing" ? "#F59E0B" : "#3B82F6";

            if (o.business?.lat && o.business?.lng) {
              const bizMarker = addMarker(o.business.lat, o.business.lng, o.business.name, BUSINESS_MARKER, 10);
              addInfoWindow(bizMarker, `<div style="padding:8px;color:#111;"><strong>${o.business.name}</strong><br/>Pedido: ${o.orderNumber}<br/>Estado: ${o.status}</div>`);
            }

            if (o.delivery?.lat && o.delivery?.lng) {
              const custMarker = addMarker(o.delivery.lat, o.delivery.lng, `Entrega: ${o.orderNumber}`, CUSTOMER_MARKER, 5);
              addInfoWindow(custMarker, `<div style="padding:8px;color:#111;"><strong>Entrega</strong><br/>Pedido: ${o.orderNumber}</div>`);
            }

            if (o.driver?.lat && o.driver?.lng) {
              const driverMarker = addMarker(o.driver.lat, o.driver.lng, `Repartidor: ${o.driver.name}`, DRIVER_ICON, 100);
              addInfoWindow(driverMarker, `<div style="padding:8px;color:#111;"><strong>${o.driver.name}</strong><br/>Pedido: ${o.orderNumber}</div>`);
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
                icons: [{ offset: "0", repeat: "20px" }],
              });
              routePath.setMap(gmap.current);
              newMarkers.push(routePath);
            }
          });
        }

      } catch (err) {
        console.error("Error loading map data:", err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [mapsReady, viewMode]);

  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
    { id: "deliveries", label: "Entregas", icon: "package" },
    { id: "drivers", label: "Repartidores", icon: "truck" },
    { id: "businesses", label: "Negocios", icon: "briefcase" },
    { id: "all", label: "Todo", icon: "layers" },
  ];

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      <View style={[s.controls, { top: Spacing.xl, left: Spacing.lg }]}>
        <View style={[s.viewToggle, { backgroundColor: card }]}>
          {VIEW_OPTIONS.map((opt, i) => (
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
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center" } as any,
  controls: { position: "absolute", zIndex: 10 },
  viewToggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  toggleBtn: { padding: 10 },
  statsRow: { position: "absolute", right: Spacing.lg, flexDirection: "column", gap: Spacing.sm, zIndex: 10, alignItems: "flex-end" },
  statChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
});