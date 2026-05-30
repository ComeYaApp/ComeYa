import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

const SORIA = { lat: 41.7636, lng: -2.4677 };
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

const BIZ_ICONS: Record<string, { color: string; icon: string }> = {
  restaurant: { color: "#DC2626", icon: "coffee" },
  market: { color: "#10B981", icon: "shopping-bag" },
  store: { color: "#3B82F6", icon: "shopping-cart" },
  default: { color: "#6B7280", icon: "home" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  accepted: "#3B82F6",
  preparing: "#8B5CF6",
  on_the_way: "#10B981",
  arrived: "#EC4899",
};

const createMarkerIcon = (emoji: string, bgColor: string, size = 40) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${bgColor}" stroke="white" stroke-width="2"/>
    <text x="${size / 2}" y="${size / 2 + 6}" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function AdminMapScreen() {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("deliveries");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ businesses: 0, drivers: 0, orders: 0 });
  const [locationStats, setLocationStats] = useState({
    withCoords: 0,
    withoutCoords: 0,
  });

  const bg = theme.backgroundRoot;
  const card = theme.card;
  const sub = theme.textSecondary;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: true,
      styles: isDark ? DARK_STYLE : [],
    });

    setLoading(false);
  }, [mapsReady, isDark]);

  const loadMapData = useCallback(async () => {
    if (!gmap.current || !mapsReady) return;
    const google = (window as any).google;
    if (!google) return;

    clearMarkers();

    try {
      const [bizRes, driversRes, trackingRes] = await Promise.all([
        apiRequest("GET", "/api/admin/businesses"),
        apiRequest("GET", "/api/admin/drivers"),
        apiRequest("GET", "/api/admin/tracking/global").catch(() => ({
          ok: false,
          json: () => Promise.resolve({ success: false, orders: [] }),
        })),
      ]);

      const bizData = await bizRes.json();
      const driversData = await driversRes.json();
      const trackingData = await trackingRes.json();

      const businesses = bizData.businesses || [];
      const drivers = (driversData.drivers || []).filter(
        (d: any) => d.currentLatitude && d.currentLongitude,
      );
      const activeOrders = trackingData.orders || [];

      let withCoords = 0;
      let withoutCoords = 0;
      businesses.forEach((b: any) => {
        if (b.latitude && b.longitude) withCoords++;
        else withoutCoords++;
      });

      setStats({
        businesses: businesses.length,
        drivers: drivers.length,
        orders: activeOrders.length,
      });
      setLocationStats({ withCoords, withoutCoords });

      // Mostrar businesses
      if (viewMode === "all" || viewMode === "businesses") {
        businesses.forEach((b: any) => {
          const lat = parseFloat(b.latitude);
          const lng = parseFloat(b.longitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const typeInfo = BIZ_ICONS[b.type] || BIZ_ICONS.default;
          const iconUrl = createMarkerIcon(
            typeInfo.icon === "coffee"
              ? "🍽️"
              : typeInfo.icon === "shopping-bag"
                ? "🛒"
                : typeInfo.icon === "shopping-cart"
                  ? "🛍️"
                  : "🏠",
            typeInfo.color,
          );

          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: gmap.current,
            title: `${b.name}\n📍 ${b.address || "Sin dirección"}`,
            icon: {
              url: iconUrl,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            },
          });

          const info = new google.maps.InfoWindow({
            content: `<div style="padding:10px;max-width:200px;">
              <strong style="font-size:14px;color:#111;">${b.name}</strong>
              <p style="margin:4px 0;font-size:12px;color:#666;">📍 ${b.address || "Sin dirección"}</p>
              <p style="margin:4px 0;font-size:11px;color:${b.isOpen ? "#10B981" : "#EF4444"};">
                ${b.isOpen ? "✅ Abierto" : "❌ Cerrado"}
              </p>
            </div>`,
          });
          marker.addListener("click", () => info.open(gmap.current, marker));
          markersRef.current.push(marker);
        });
      }

      // Mostrar drivers
      if (viewMode === "all" || viewMode === "drivers") {
        drivers.forEach((d: any) => {
          const lat = parseFloat(d.currentLatitude);
          const lng = parseFloat(d.currentLongitude);
          if (isNaN(lat) || isNaN(lng)) return;

          const iconUrl = createMarkerIcon("🛵", "#10B981");
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: gmap.current,
            title: `${d.name || "Repartidor"}\n📱 ${d.phone || "Sin teléfono"}`,
            icon: {
              url: iconUrl,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            },
          });

          const info = new google.maps.InfoWindow({
            content: `<div style="padding:10px;max-width:200px;">
              <strong style="font-size:14px;color:#111;">${d.name || "Repartidor"}</strong>
              <p style="margin:4px 0;font-size:12px;color:#666;">📱 ${d.phone || "Sin teléfono"}</p>
              <p style="margin:4px 0;font-size:11px;color:#10B981;">✅ ${d.isOnline ? "En línea" : "Desconectado"}</p>
            </div>`,
          });
          marker.addListener("click", () => info.open(gmap.current, marker));
          markersRef.current.push(marker);
        });
      }

      // Mostrar pedidos/deliveries
      if (viewMode === "all" || viewMode === "deliveries") {
        activeOrders.forEach((o: any) => {
          const statusColor = STATUS_COLORS[o.status] || "#6B7280";

          // Negocio
          if (o.business?.lat && o.business?.lng) {
            const bizIcon = createMarkerIcon("🏪", "#DC2626", 36);
            const bizMarker = new google.maps.Marker({
              position: { lat: o.business.lat, lng: o.business.lng },
              map: gmap.current,
              title: `🏪 ${o.business.name} - Pedido ${o.orderNumber}`,
              icon: {
                url: bizIcon,
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 36),
              },
              zIndex: 100,
            });

            const bizInfo = new google.maps.InfoWindow({
              content: `<div style="padding:10px;max-width:220px;">
                <strong>🏪 ${o.business.name}</strong><br/>
                <span>📦 pedido: ${o.orderNumber}</span><br/>
                <span style="color:${statusColor}">● ${o.status}</span>
              </div>`,
            });
            bizMarker.addListener("click", () =>
              bizInfo.open(gmap.current, bizMarker),
            );
            markersRef.current.push(bizMarker);
          }

          // Cliente/Destino
          if (o.delivery?.lat && o.delivery?.lng) {
            const custIcon = createMarkerIcon("🏠", "#3B82F6", 36);
            const custMarker = new google.maps.Marker({
              position: { lat: o.delivery.lat, lng: o.delivery.lng },
              map: gmap.current,
              title: `🏠 Entrega - ${o.orderNumber}`,
              icon: {
                url: custIcon,
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 36),
              },
              zIndex: 50,
            });

            const custInfo = new google.maps.InfoWindow({
              content: `<div style="padding:10px;max-width:220px;">
                <strong>🏠 Cliente</strong><br/>
                <span>📦 pedido: ${o.orderNumber}</span>
              </div>`,
            });
            custMarker.addListener("click", () =>
              custInfo.open(gmap.current, custMarker),
            );
            markersRef.current.push(custMarker);
          }

          // Repartidor
          if (o.driver?.lat && o.driver?.lng) {
            const driverIcon = createMarkerIcon("🛵", "#10B981", 40);
            const driverMarker = new google.maps.Marker({
              position: { lat: o.driver.lat, lng: o.driver.lng },
              map: gmap.current,
              title: `🛵 ${o.driver.name} - ${o.orderNumber}`,
              icon: {
                url: driverIcon,
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20),
              },
              zIndex: 200,
            });

            const driverInfo = new google.maps.InfoWindow({
              content: `<div style="padding:10px;max-width:200px;">
                <strong>🛵 ${o.driver.name}</strong><br/>
                <span>📦 pedido: ${o.orderNumber}</span><br/>
                <span style="color:${statusColor}">● ${o.status}</span>
              </div>`,
            });
            driverMarker.addListener("click", () =>
              driverInfo.open(gmap.current, driverMarker),
            );
            markersRef.current.push(driverMarker);
          }

          // Ruta del negocio al cliente
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
              icons: [{ offset: "0", repeat: "15px" }],
            });
            routePath.setMap(gmap.current);
            markersRef.current.push(routePath);
          }
        });
      }
    } catch (err) {
      console.error("Error loading map data:", err);
    }
  }, [mapsReady, viewMode, clearMarkers]);

  useEffect(() => {
    if (!mapsReady) return;
    loadMapData();
    const interval = setInterval(loadMapData, 15000);
    return () => clearInterval(interval);
  }, [mapsReady, loadMapData]);

  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
    { id: "deliveries", label: "Entregas", icon: "package" },
    { id: "drivers", label: "Repartidores", icon: "truck" },
    { id: "businesses", label: "Negocios", icon: "home" },
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

      {/* View toggles */}
      <View style={[s.controls, { top: Spacing.xl, left: Spacing.lg }]}>
        <View style={[s.viewToggle, { backgroundColor: card }]}>
          {VIEW_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => {
                setViewMode(opt.id);
                setTimeout(loadMapData, 100);
              }}
              style={[
                s.toggleBtn,
                viewMode === opt.id && {
                  backgroundColor: ComeYaColors.primary,
                },
              ]}
            >
              <Feather
                name={opt.icon as any}
                size={16}
                color={viewMode === opt.id ? "#fff" : sub}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[s.viewLabel, { color: card }]}>
          {VIEW_OPTIONS.find((v) => v.id === viewMode)?.label}
        </Text>
      </View>

      {/* Stats panel */}
      <View style={[s.statsPanel, { top: Spacing.xl, right: Spacing.lg }]}>
        <View style={[s.statCard, s.statBorderBlue]}>
          <Text style={s.statEmoji}>🏪</Text>
          <View>
            <Text style={s.statValue}>{stats.businesses}</Text>
            <Text style={s.statLabel}>Negocios</Text>
          </View>
        </View>

        <View style={[s.statCard, s.statBorderGreen]}>
          <Text style={s.statEmoji}>🛵</Text>
          <View>
            <Text style={s.statValue}>{stats.drivers}</Text>
            <Text style={s.statLabel}>Drivers</Text>
          </View>
        </View>

        <View style={[s.statCard, s.statBorderYellow]}>
          <Text style={s.statEmoji}>📦</Text>
          <View>
            <Text style={s.statValue}>{stats.orders}</Text>
            <Text style={s.statLabel}>Pedidos</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={[s.legend, { bottom: Spacing.xl, left: Spacing.lg }]}>
        <View style={s.legendItem}>
          <Text>🏪</Text>
          <Text style={s.legendText}>Negocio</Text>
        </View>
        <View style={s.legendItem}>
          <Text>🏠</Text>
          <Text style={s.legendText}>Cliente</Text>
        </View>
        <View style={s.legendItem}>
          <Text>🛵</Text>
          <Text style={s.legendText}>Repartidor</Text>
        </View>
        <View style={s.legendItem}>
          <Text style={{ color: "#10B981" }}>───</Text>
          <Text style={s.legendText}>Ruta</Text>
        </View>
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
    zIndex: 100,
  } as any,
  controls: { position: "absolute", zIndex: 10 },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toggleBtn: { padding: 12 },
  viewLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  statsPanel: { position: "absolute", right: Spacing.lg, zIndex: 10, gap: 8 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  statBorderBlue: { borderLeftWidth: 3, borderLeftColor: "#DC2626" },
  statBorderGreen: { borderLeftWidth: 3, borderLeftColor: "#10B981" },
  statBorderYellow: { borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 10, color: "#9CA3AF" },
  legend: {
    position: "absolute",
    zIndex: 10,
    flexDirection: "row",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontSize: 11, fontWeight: "600", color: "#4B5563" },
});
