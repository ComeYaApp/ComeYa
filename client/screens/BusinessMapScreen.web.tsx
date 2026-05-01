import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

interface BusinessPin {
  id: string;
  name: string;
  type: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  isOpen: boolean;
  latitude: number;
  longitude: number;
  address: string;
}

interface ActiveOrder {
  id: string;
  businessName: string;
  status: string;
  eta?: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Esperando confirmación", color: "#F59E0B" },
  confirmed:  { label: "Pedido confirmado",       color: "#3B82F6" },
  preparing:  { label: "Preparando",              color: "#8B5CF6" },
  ready:      { label: "Listo para recoger",      color: "#10B981" },
  on_the_way: { label: "En camino 🛵",            color: ComeYaColors.success },
};

const CATEGORIES = [
  { key: "all",        label: "Todos",    icon: "grid"        },
  { key: "restaurant", label: "Comida",   icon: "coffee"      },
  { key: "market",     label: "Mercado",  icon: "shopping-bag"},
  { key: "pharmacy",   label: "Farmacia", icon: "plus-circle" },
];

// Inyectar Google Maps script una sola vez
function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("gmap-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function BusinessMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Cargar Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => console.error("Error cargando Google Maps"));
  }, []);

  // Inicializar mapa
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
  }, [mapsReady, isDark]);

  // GPS del usuario
  useEffect(() => {
    if (!mapsReady) return;
    navigator.geolocation?.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      gmap.current?.panTo(loc);

      const google = (window as any).google;
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);
      userMarkerRef.current = new google.maps.Marker({
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
        title: "Tu ubicación",
        zIndex: 999,
      });
    });
  }, [mapsReady]);

  // Cargar negocios
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/business");
        const data = await res.json();
        const raw = data.businesses || [];
        const pins: BusinessPin[] = raw
          .filter((b: any) => b.latitude && b.longitude)
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            type: b.type || "restaurant",
            image: b.image || "",
            rating: (b.rating || 0) / 100,
            deliveryTime: b.delivery_time || b.deliveryTime || "30-45 min",
            deliveryFee: (b.delivery_fee || 0) / 100,
            isOpen: b.isOpen ?? b.is_open ?? false,
            latitude: parseFloat(b.latitude),
            longitude: parseFloat(b.longitude),
            address: b.address || "Soria, España",
          }));
        setBusinesses(pins);
      } catch (e) {
        console.error("Error cargando negocios:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Cargar pedidos activos
  useEffect(() => {
    if (user?.role !== "customer") return;
    const fetch = async () => {
      try {
        const res = await apiRequest("GET", "/api/orders");
        const data = await res.json();
        const allOrders = data.orders || [];
        const active = allOrders
          .filter((o: any) => ['pending','confirmed','preparing','ready','on_the_way'].includes(
            o.order?.status || o.status
          ))
          .map((o: any) => ({
            id: o.order?.id || o.id,
            businessName: o.order?.businessName || o.businessName || 'Negocio',
            status: o.order?.status || o.status,
            eta: (o.order?.estimatedDelivery || o.estimatedDelivery)
              ? Math.max(0, Math.round((new Date(o.order?.estimatedDelivery || o.estimatedDelivery).getTime() - Date.now()) / 60000))
              : undefined,
          }));
        setActiveOrders(active);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Renderizar pins en el mapa
  useEffect(() => {
    if (!mapsReady || !gmap.current || businesses.length === 0) return;
    const google = (window as any).google;

    // Limpiar markers anteriores
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const filtered = categoryFilter === "all"
      ? businesses
      : businesses.filter(b => b.type === categoryFilter);

    filtered.forEach((b) => {
      const color = b.isOpen ? ComeYaColors.primary : "#9E9E9E";
      const iconPath = b.type === "market"
        ? "M9 6h10l1 2H8L9 6zM7 8l1 10h8l1-10H7zm3 3v4m4-4v4"
        : b.type === "pharmacy"
        ? "M12 5v14M5 12h14"
        : "M8 10h8M10 10V8a1 1 0 011-1h2a1 1 0 011 1v2M8 14h8l-1 5H9l-1-5z";

      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="52"><rect x="2" y="2" width="136" height="38" rx="19" fill="${b.isOpen ? "#fff" : "#f0f0f0"}" stroke="${color}" stroke-width="2"/><circle cx="22" cy="21" r="11" fill="${color}"/><path d="${iconPath}" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" transform="translate(10,9)"/><text x="40" y="24" font-size="11" font-weight="bold" fill="${b.isOpen ? "#1a1a1a" : "#9E9E9E"}" font-family="Arial">${b.name.slice(0, 12)}${b.name.length > 12 ? "\u2026" : ""}</text><text x="40" y="36" font-size="9" fill="${color}" font-family="Arial">${b.isOpen ? b.deliveryTime : "Cerrado"}</text><polygon points="65,40 75,40 70,50" fill="${color}"/></svg>`;

      const marker = new google.maps.Marker({
        position: { lat: b.latitude, lng: b.longitude },
        map: gmap.current,
        title: b.name,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
          scaledSize: new google.maps.Size(140, 52),
          anchor: new google.maps.Point(70, 52),
        },
        zIndex: b.isOpen ? 10 : 1,
      });

      marker.addListener("click", () => {
        setSelected(b);
        gmap.current?.panTo({ lat: b.latitude - 0.005, lng: b.longitude });
      });

      markersRef.current.push(marker);
    });
  }, [mapsReady, businesses, categoryFilter]);

  const handleCenterUser = useCallback(() => {
    if (!userLocation) return;
    gmap.current?.panTo(userLocation);
    gmap.current?.setZoom(15);
  }, [userLocation]);

  const handleDirections = useCallback((b: BusinessPin) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`, "_blank");
  }, []);

  const visibleCount = categoryFilter === "all"
    ? businesses.length
    : businesses.filter(b => b.type === categoryFilter).length;

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>

      {/* Mapa Google Maps */}
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {/* Loading */}
      {(isLoading || !mapsReady) && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Cargando mapa...
          </ThemedText>
        </View>
      )}

      {/* Header flotante */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[s.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
          <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.xs }}>
            {visibleCount} negocios
          </ThemedText>
        </View>
        <Pressable
          onPress={handleCenterUser}
          style={[s.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="navigation" size={22} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Filtros */}
      <View style={[s.filtersRow, { top: insets.top + 58 }]}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            onPress={() => setCategoryFilter(cat.key)}
            style={[s.filterChip, { backgroundColor: categoryFilter === cat.key ? ComeYaColors.primary : theme.card }]}
          >
            <Feather name={cat.icon as any} size={13} color={categoryFilter === cat.key ? "#fff" : theme.text} />
            <ThemedText type="caption" style={{ marginLeft: 4, color: categoryFilter === cat.key ? "#fff" : theme.text, fontWeight: "600" }}>
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Leyenda */}
      <View style={[s.legend, { backgroundColor: theme.card, bottom: selected ? 300 : insets.bottom + Spacing.lg }]}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: ComeYaColors.primary }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Abierto</ThemedText>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: "#9E9E9E" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cerrado</ThemedText>
        </View>
      </View>

      {/* Card negocio seleccionado */}
      {selected && (
        <Pressable
          style={[s.card, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.md }, Shadows.lg]}
          onPress={() => setSelected(null)}
        >
          <View style={s.cardHandle} />
          <View style={s.cardContent}>
            <Image
              source={selected.image ? { uri: selected.image } : require("../../assets/images/delivery-hero.png")}
              style={s.cardImage}
              contentFit="cover"
            />
            <View style={s.cardInfo}>
              <View style={s.cardNameRow}>
                <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>{selected.name}</ThemedText>
                <View style={[s.statusBadge, { backgroundColor: selected.isOpen ? ComeYaColors.primary + "20" : "#9E9E9E20" }]}>
                  <ThemedText type="caption" style={{ color: selected.isOpen ? ComeYaColors.primary : "#9E9E9E", fontWeight: "700" }}>
                    {selected.isOpen ? "Abierto" : "Cerrado"}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
                {selected.address}
              </ThemedText>
              <View style={s.cardMeta}>
                <View style={s.metaItem}>
                  <Feather name="star" size={12} color="#FFB800" />
                  <ThemedText type="caption" style={{ marginLeft: 3 }}>{selected.rating.toFixed(1)}</ThemedText>
                </View>
                <View style={s.metaItem}>
                  <Feather name="clock" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ marginLeft: 3, color: theme.textSecondary }}>{selected.deliveryTime}</ThemedText>
                </View>
                <View style={s.metaItem}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ marginLeft: 3, color: theme.textSecondary }}>€{selected.deliveryFee.toFixed(0)}</ThemedText>
                </View>
              </View>
            </View>
          </View>
          <View style={s.cardButtons}>
            <Pressable onPress={() => handleDirections(selected)} style={[s.btnDirections, { borderColor: ComeYaColors.primary }]}>
              <Feather name="navigation" size={16} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: "700", marginLeft: Spacing.xs }}>
                Cómo llegar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setSelected(null);
                navigation.getParent()?.navigate("BusinessDetail", { businessId: selected.id });
              }}
              style={s.btnMenu}
            >
              <Feather name="book-open" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "700", marginLeft: Spacing.xs }}>
                Ver menú
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Banner pedido activo */}
      {activeOrders.length > 0 && !selected && (
        <Pressable
          onPress={() => navigation.navigate("OrderTracking", { orderId: activeOrders[0].id })}
          style={[s.orderBanner, { backgroundColor: theme.card, bottom: insets.bottom + 16 }]}
        >
          <View style={[s.orderBannerDot, { backgroundColor: STATUS_LABELS[activeOrders[0].status]?.color || ComeYaColors.primary }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="caption" style={{ fontWeight: "700", color: STATUS_LABELS[activeOrders[0].status]?.color || ComeYaColors.primary }}>
              {STATUS_LABELS[activeOrders[0].status]?.label || "Pedido activo"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {activeOrders[0].businessName}{activeOrders[0].eta !== undefined ? ` · ${activeOrders[0].eta} min` : ""}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

// Estilo oscuro para Google Maps
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    position: "absolute", inset: 0,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 20,
  } as any,
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  headerTitle: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  filtersRow: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", paddingHorizontal: Spacing.lg,
    gap: Spacing.sm, zIndex: 9,
  },
  filterChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  legend: {
    position: "absolute", right: Spacing.lg,
    flexDirection: "row", gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 12,
    zIndex: 10,
  },
  cardHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: Spacing.md,
  },
  cardContent: { flexDirection: "row", marginBottom: Spacing.md },
  cardImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  cardMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center" },
  cardButtons: { flexDirection: "row", gap: Spacing.md },
  btnDirections: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2,
  },
  btnMenu: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: ComeYaColors.primary,
  },
  orderBanner: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    zIndex: 10,
  },
  orderBannerDot: { width: 10, height: 10, borderRadius: 5 },
});
