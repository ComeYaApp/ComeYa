import React, { useState, useEffect, useCallback } from "react";
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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

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

  const driverCoord = driverLocation
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      }
    : null;

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
                <Marker coordinate={customerCoord} title="Entrega" pinColor="#2563EB" />
              )}
              {driverCoord && (
                <Marker
                  coordinate={driverCoord}
                  title="Repartidor"
                  pinColor="#10B981"
                />
              )}
              {driverCoord && customerCoord && (
                <Polyline
                  coordinates={[driverCoord, customerCoord]}
                  strokeColor="#10B981"
                  strokeWidth={3}
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
