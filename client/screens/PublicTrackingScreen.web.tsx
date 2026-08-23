import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { pinIcon, circleIcon, asGoogleIcon } from "@/utils/webMarkerSvg";

const SORIA = { lat: 41.7636, lng: -2.4677 };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pedido recibido", color: "#F59E0B" },
  accepted: { label: "Aceptado por el negocio", color: "#3B82F6" },
  preparing: { label: "Preparando tu pedido", color: "#8B5CF6" },
  ready: { label: "Listo para recoger", color: "#10B981" },
  assigned: { label: "Repartidor asignado", color: "#6366F1" },
  picked_up: { label: "Pedido recogido", color: "#0EA5E9" },
  on_the_way: { label: "Repartidor en camino", color: "#DC2626" },
  in_transit: { label: "En camino", color: "#DC2626" },
  arriving: { label: "Llegando", color: "#DC2626" },
  delivered: { label: "Entregado 🎉", color: "#10B981" },
  cancelled: { label: "Cancelado", color: "#6B7280" },
};

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

export default function PublicTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { token } = route.params;

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/gps/track/${token}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
        setDriverLocation(data.driverLocation);
        setError(null);
      } else {
        setError(data.error || "Enlace no válido");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }, [token]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // Cargar mapa
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;
    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA,
      zoom: 13,
      disableDefaultUI: true,
      styles: isDark
        ? [
            { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
          ]
        : [],
    });
  }, [mapsReady]);

  const customerCoord =
    order?.deliveryLatitude && order?.deliveryLongitude
      ? {
          lat: parseFloat(order.deliveryLatitude),
          lng: parseFloat(order.deliveryLongitude),
        }
      : null;

  const driverCoord = driverLocation
    ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
    : null;

  // Pins y línea
  useEffect(() => {
    if (!gmap.current) return;
    const google = (window as any).google;

    if (customerCoord && !customerMarkerRef.current) {
      customerMarkerRef.current = new google.maps.Marker({
        position: customerCoord,
        map: gmap.current,
        title: "Entrega",
        icon: asGoogleIcon(google, pinIcon("#2563EB", "home")),
      });
    }
    if (driverCoord) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setPosition(driverCoord);
      } else {
        driverMarkerRef.current = new google.maps.Marker({
          position: driverCoord,
          map: gmap.current,
          title: "Repartidor",
          icon: asGoogleIcon(
            google,
            circleIcon("#10B981", "navigation", 36),
          ),
          zIndex: 10,
        });
      }
      if (customerCoord) {
        if (lineRef.current) lineRef.current.setMap(null);
        lineRef.current = new google.maps.Polyline({
          path: [driverCoord, customerCoord],
          geodesic: true,
          strokeColor: "#10B981",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: gmap.current,
        });
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(driverCoord);
        bounds.extend(customerCoord);
        gmap.current.fitBounds(bounds, 60);
      }
    }
  }, [driverLocation, customerCoord?.lat, customerCoord?.lng]);

  const statusInfo = order
    ? STATUS_LABELS[order.status] || { label: order.status, color: "#888" }
    : null;

  return (
    <View
      style={[
        s.root,
        { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">Seguimiento del pedido</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      {error ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={44} color="#F59E0B" />
          <ThemedText style={{ marginTop: Spacing.md }} type="body">
            {error}
          </ThemedText>
        </View>
      ) : !order ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      ) : (
        <View style={s.content}>
          <div ref={mapRef} style={{ width: "100%", height: 380, borderRadius: 16, overflow: "hidden" }} />
          <View style={[s.panel, { backgroundColor: theme.card }]}>
            <View
              style={[
                s.statusBadge,
                { backgroundColor: statusInfo?.color || "#888" },
              ]}
            >
              <Text style={s.statusText}>{statusInfo?.label}</Text>
            </View>
            <ThemedText type="h3" style={{ marginTop: Spacing.md }}>
              {order.businessName || "Tu pedido"}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
            >
              {order.deliveryAddress
                ? typeof order.deliveryAddress === "string"
                  ? order.deliveryAddress
                  : `${order.deliveryAddress.street || ""} ${order.deliveryAddress.city || ""}`.trim()
                : ""}
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  iconBtn: { padding: 6 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: { flex: 1, paddingHorizontal: Spacing.md },
  panel: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  statusText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
});
