import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";

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

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: "Esperando confirmación", color: "#F59E0B", icon: "clock" },
  confirmed:  { label: "Pedido confirmado",       color: "#3B82F6", icon: "check-circle" },
  preparing:  { label: "Preparando tu pedido",    color: "#8B5CF6", icon: "package" },
  ready:      { label: "Listo para recoger",      color: "#10B981", icon: "check-square" },
  on_the_way: { label: "En camino 🛵",            color: ComeYaColors.success, icon: "truck" },
  delivered:  { label: "Entregado ✓",             color: "#4CAF50", icon: "check-circle" },
};

const STATUS_STEPS = ["pending", "confirmed", "preparing", "ready", "on_the_way", "delivered"];

export default function OrderTrackingScreen() {
  const route = useRoute() as any;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const orderId = route.params?.orderId;

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  // Cargar pedido
  useEffect(() => {
    if (!orderId) return;
    const fetch = async () => {
      try {
        const res = await apiRequest("GET", `/api/orders/${orderId}`);
        const data = await res.json();
        setOrder(data.order || data);
        if (data.order?.estimatedDelivery) {
          setEta(Math.max(0, Math.round((new Date(data.order.estimatedDelivery).getTime() - Date.now()) / 60000)));
        }
      } catch {} finally { setLoading(false); }
    };
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Inicializar mapa cuando esté listo el pedido
  useEffect(() => {
    if (!mapsReady || !mapRef.current || !order || gmap.current) return;
    const google = (window as any).google;

    const center = order.deliveryLatitude && order.deliveryLongitude
      ? { lat: parseFloat(order.deliveryLatitude), lng: parseFloat(order.deliveryLongitude) }
      : { lat: 41.7636, lng: -2.4677 };

    gmap.current = new google.maps.Map(mapRef.current, {
      center, zoom: 14,
      disableDefaultUI: true, zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    // Pin destino (cliente)
    if (order.deliveryLatitude && order.deliveryLongitude) {
      new google.maps.Marker({
        position: { lat: parseFloat(order.deliveryLatitude), lng: parseFloat(order.deliveryLongitude) },
        map: gmap.current,
        title: "Tu dirección",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><rect x="2" y="2" width="36" height="36" rx="18" fill="${ComeYaColors.primary}" stroke="white" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="20">🏠</text><polygon points="14,38 26,38 20,48" fill="${ComeYaColors.primary}"/></svg>`)}`,
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48),
        },
      });
    }

    // Actualizar posición del repartidor cada 10s
    const updateDriver = async () => {
      try {
        const res = await apiRequest("GET", `/api/delivery/location/${orderId}`);
        const data = await res.json();
        if (data.location?.latitude && data.location?.longitude) {
          const pos = { lat: parseFloat(data.location.latitude), lng: parseFloat(data.location.longitude) };
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setPosition(pos);
          } else {
            driverMarkerRef.current = new google.maps.Marker({
              position: pos,
              map: gmap.current,
              title: "Repartidor",
              icon: {
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="22" fill="#4CAF50" stroke="white" stroke-width="3"/><text x="24" y="30" text-anchor="middle" font-size="22">🛵</text></svg>`)}`,
                scaledSize: new google.maps.Size(48, 48),
                anchor: new google.maps.Point(24, 24),
              },
              zIndex: 999,
            });
          }
        }
      } catch {}
    };

    if (order.status === "on_the_way") {
      updateDriver();
      const interval = setInterval(updateDriver, 10000);
      return () => clearInterval(interval);
    }
  }, [mapsReady, order]);

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : 0;
  const statusInfo = STATUS_LABELS[order?.status] || { label: "Procesando...", color: "#888", icon: "clock" };

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>

      {/* Mapa ocupa la mitad superior */}
      <View style={s.mapContainer}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {(!mapsReady || loading) && (
          <View style={s.mapLoading}>
            <ActivityIndicator size="large" color={ComeYaColors.primary} />
          </View>
        )}
      </View>

      {/* Panel inferior con info */}
      <ScrollView style={[s.panel, { backgroundColor: theme.backgroundRoot }]} contentContainerStyle={{ padding: Spacing.lg }}>

        {/* Header */}
        <View style={s.panelHeader}>
          <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.card }]}>
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Seguimiento</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Estado actual */}
        <View style={[s.statusCard, { backgroundColor: statusInfo.color + "15", borderColor: statusInfo.color + "40" }]}>
          <View style={[s.statusIcon, { backgroundColor: statusInfo.color }]}>
            <Feather name={statusInfo.icon as any} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="h4" style={{ color: statusInfo.color }}>{statusInfo.label}</ThemedText>
            {eta !== null && order?.status === "on_the_way" && (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                Llega en aproximadamente {eta} minutos
              </ThemedText>
            )}
          </View>
        </View>

        {/* Barra de progreso */}
        <View style={s.progressRow}>
          {STATUS_STEPS.slice(0, 5).map((step, i) => (
            <View key={step} style={[s.progressStep, { backgroundColor: i <= currentStep ? statusInfo.color : theme.border }]} />
          ))}
        </View>

        {/* Detalles del pedido */}
        {order && (
          <View style={[s.detailCard, { backgroundColor: theme.card }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: Spacing.sm }}>
              DETALLES DEL PEDIDO
            </ThemedText>
            <View style={s.detailRow}>
              <Feather name="hash" size={14} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>Pedido #{orderId?.slice(-6)}</ThemedText>
            </View>
            {order.businessName && (
              <View style={s.detailRow}>
                <Feather name="briefcase" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{order.businessName}</ThemedText>
              </View>
            )}
            {order.total && (
              <View style={s.detailRow}>
                <Feather name="credit-card" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>€{(order.total / 100).toFixed(2)}</ThemedText>
              </View>
            )}
            {order.deliveryAddress && (
              <View style={s.detailRow}>
                <Feather name="map-pin" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }} numberOfLines={2}>{order.deliveryAddress}</ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  mapContainer: { height: "45%", position: "relative" } as any,
  mapLoading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.8)", zIndex: 10 } as any,
  panel: { flex: 1 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  statusCard: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  progressRow: { flexDirection: "row", gap: 4, marginBottom: Spacing.lg },
  progressStep: { flex: 1, height: 6, borderRadius: 3 },
  detailCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
});
