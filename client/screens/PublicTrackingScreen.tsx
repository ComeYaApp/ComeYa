import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { DriverPin } from "@/components/map/DriverPin";
import { decodePolyline } from "@/utils/directions";
import { snapToRoute } from "@/utils/snapToRoute";
import { CUSTOMER_MARKER, vehicleMarkerMeta } from "@/utils/markerMeta";

type PublicTrackingRouteProp = RouteProp<
  RootStackParamList,
  "PublicTracking"
>;

const SORIA = { latitude: 41.7636, longitude: -2.4677 };

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

export default function PublicTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<PublicTrackingRouteProp>();
  const { token } = route.params;

  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Ruta REAL por calles (proxy del servidor; funciona sin sesión)
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const lastRouteFetchRef = useRef<{ lat: number; lng: number } | null>(null);

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

  // Ruta real repartidor → cliente (solo si se movió >100 m o es la primera)
  useEffect(() => {
    if (!driverLocation) return;
    const oLat = order?.deliveryLatitude;
    const oLng = order?.deliveryLongitude;
    if (!oLat || !oLng) return;
    const custLat = parseFloat(oLat);
    const custLng = parseFloat(oLng);
    if (!Number.isFinite(custLat) || !Number.isFinite(custLng)) return;
    const last = lastRouteFetchRef.current;
    const moved =
      !last ||
      Math.abs(last.lat - driverLocation.latitude) > 0.001 ||
      Math.abs(last.lng - driverLocation.longitude) > 0.001;
    if (!moved) return;
    lastRouteFetchRef.current = {
      lat: driverLocation.latitude,
      lng: driverLocation.longitude,
    };
    fetch(
      `${getApiUrl()}/api/gps/directions?originLat=${driverLocation.latitude}&originLng=${driverLocation.longitude}&destLat=${custLat}&destLng=${custLng}&mode=driving`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.polyline) {
          setRouteCoords(decodePolyline(data.polyline));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, order?.deliveryLatitude, order?.deliveryLongitude]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  const statusInfo = order
    ? STATUS_LABELS[order.status] || { label: order.status, color: "#888" }
    : null;

  const customerCoord =
    order?.deliveryLatitude && order?.deliveryLongitude
      ? {
          latitude: parseFloat(order.deliveryLatitude),
          longitude: parseFloat(order.deliveryLongitude),
        }
      : null;

  const driverRaw = driverLocation
    ? {
        latitude: Number(driverLocation.latitude),
        longitude: Number(driverLocation.longitude),
      }
    : null;
  const driverCoord =
    driverRaw && Number.isFinite(driverRaw.latitude) && Number.isFinite(driverRaw.longitude)
      ? driverRaw
      : null;

  // Snap-to-route del repartidor: el pin se desliza POR la calle aunque el
  // GPS derive; fuera de la ruta (>30 m) se muestra el fix crudo.
  const driverDisplay =
    driverCoord && routeCoords.length >= 2
      ? (() => {
          const snap = snapToRoute(driverCoord, routeCoords, 30);
          return snap?.snapped ? snap.coordinate : driverCoord;
        })()
      : driverCoord;

  return (
    <View
      style={[
        s.root,
        { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
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
          <ThemedText style={{ marginTop: Spacing.md }} type="body">
            Cargando pedido...
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View
            style={[s.mapWrap, { backgroundColor: theme.backgroundSecondary }]}
          >
            <MapView
              provider={PROVIDER_GOOGLE}
              style={s.map}
              initialRegion={{
                ...(driverCoord || customerCoord || SORIA),
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
            >
              {customerCoord && (
                <SmartMarker
                  coordinate={customerCoord}
                  title="Entrega"
                  anchor={{ x: 0.5, y: 1 }}
                  trackKey="customer"
                >
                  <MapPin
                    icon={CUSTOMER_MARKER.icon}
                    color={CUSTOMER_MARKER.color}
                  />
                </SmartMarker>
              )}
              {driverDisplay && (
                <SmartMarker
                  coordinate={driverDisplay}
                  title="Repartidor"
                  anchor={{ x: 0.5, y: 0.5 }}
                  trackKey="driver"
                >
                  <DriverPin
                    vehicleIcon={vehicleMarkerMeta(undefined).icon}
                    label="Repartidor"
                    heading={
                      typeof driverLocation?.heading === "number"
                        ? driverLocation.heading
                        : undefined
                    }
                  />
                </SmartMarker>
              )}
              {/* SOLO ruta real por calles — nunca una línea recta */}
              {routeCoords.length >= 2 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#10B981"
                  strokeWidth={4}
                />
              )}
            </MapView>
          </View>

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
            {driverLocation?.lastUpdate && (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
              >
                Actualizado{" "}
                {new Date(driverLocation.lastUpdate).toLocaleTimeString(
                  "es-ES",
                )}
              </ThemedText>
            )}
          </View>
        </ScrollView>
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
    paddingVertical: Spacing.sm,
  },
  iconBtn: { padding: 6 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  mapWrap: { height: 320, margin: Spacing.md, borderRadius: BorderRadius.lg, overflow: "hidden" },
  map: { flex: 1 },
  panel: {
    marginHorizontal: Spacing.md,
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
