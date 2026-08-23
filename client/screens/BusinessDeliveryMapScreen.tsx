import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { fetchRouteDirections, distanceMeters } from "@/utils/directions";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { BusinessPin as BusinessBubblePin } from "@/components/map/BusinessPin";
import { DriverPin } from "@/components/map/DriverPin";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Esperando", color: "#F59E0B", icon: "clock" },
  accepted: { label: "Aceptado", color: "#3B82F6", icon: "check" },
  preparing: { label: "Preparando", color: "#8B5CF6", icon: "package" },
  ready: { label: "Listo", color: "#10B981", icon: "check-circle" },
  on_the_way: { label: "En camino", color: "#DC2626", icon: "truck" },
};

interface Delivery {
  orderId: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  minutesActive: number;
  businessName: string;
  customer: {
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    address: string | null;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    vehicleType: string;
    rating: string | null;
  } | null;
}

interface Stats {
  totalActive: number;
  pending: number;
  preparing: number;
  onTheWay: number;
  avgMinutes: number;
  pendingRevenue: number;
}

const DEFAULT_REGION = {
  latitude: 41.7636, // Soria
  longitude: -2.4677,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function BusinessDeliveryMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  // Rutas reales por calles (vía proxy) para pedidos en camino
  const [realRoutes, setRealRoutes] = useState<
    Record<string, { latitude: number; longitude: number }[]>
  >({});
  const lastRoutePointRef = useRef<Record<string, { lat: number; lng: number }>>(
    {},
  );
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Business locations for markers
  const [businessLocations, setBusinessLocations] = useState<
    { id: string; name: string; type?: string; lat: number; lng: number }[]
  >([]);

  const bg = isDark ? "#111" : "#f5f5f5";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const bord = isDark ? "#333" : "#e0e0e0";

  // Fetch active deliveries
  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/business/active-deliveries");
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
        setStats(data.stats || null);
        setLastUpdated(new Date());

        // Extract business locations from the API response
        if (data.businesses && data.businesses.length > 0) {
          const locations = data.businesses
            .filter((b: any) => b.latitude && b.longitude)
            .map((b: any) => ({
              id: b.id,
              name: b.name,
              type: b.type,
              lat: parseFloat(b.latitude),
              lng: parseFloat(b.longitude),
            }));
          setBusinessLocations(locations);
        }
      }
    } catch (e) {
      console.error("Error fetching deliveries:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 15000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  // Rutas reales por calles para pedidos en camino (proxy con threshold
  // de 100 m para proteger la cuota de Google)
  useEffect(() => {
    deliveries.forEach((d) => {
      if (
        d.status !== "on_the_way" ||
        !d.driver?.lat ||
        !d.driver?.lng ||
        !d.customer.lat ||
        !d.customer.lng
      )
        return;
      const last = lastRoutePointRef.current[d.orderId];
      const moved =
        !last ||
        distanceMeters(
          { latitude: last.lat, longitude: last.lng },
          { latitude: d.driver.lat, longitude: d.driver.lng },
        ) > 100;
      if (!moved) return;
      lastRoutePointRef.current[d.orderId] = {
        lat: d.driver.lat,
        lng: d.driver.lng,
      };
      fetchRouteDirections(
        { latitude: d.driver.lat, longitude: d.driver.lng },
        { latitude: d.customer.lat, longitude: d.customer.lng },
      )
        .then((route) => {
          if (route && route.coordinates.length >= 2) {
            setRealRoutes((prev) => ({
              ...prev,
              [d.orderId]: route.coordinates,
            }));
          }
        })
        .catch(() => {});
    });
  }, [deliveries]);

  // Focus on selected delivery
  const focusDelivery = useCallback((d: Delivery) => {
    setSelected(d);
    const lat = d.driver?.lat || d.customer.lat;
    const lng = d.driver?.lng || d.customer.lng;
    if (lat && lng && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500,
      );
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: card, paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h4" style={{ color: text }}>
            Supervisión GPS
          </ThemedText>
          {lastUpdated && (
            <ThemedText type="caption" style={{ color: sub }}>
              Actualizado{" "}
              {lastUpdated.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
          )}
        </View>
        <Pressable
          onPress={fetchDeliveries}
          style={[
            styles.refreshBtn,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name="refresh-cw" size={16} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton
        >
          {/* Business location markers - show all businesses of the owner */}
          {businessLocations.map((biz) => {
            const meta = businessMarkerMeta(biz.type);
            return (
              <SmartMarker
                key={`business_${biz.id}`}
                coordinate={{ latitude: biz.lat!, longitude: biz.lng! }}
                title={biz.name}
                description="Tu negocio"
                anchor={{ x: 0.5, y: 1 }}
                trackKey={`biz_${biz.id}`}
              >
                <BusinessBubblePin
                  icon={meta.icon}
                  color={meta.color}
                  title={biz.name}
                  compact
                />
              </SmartMarker>
            );
          })}

          {/* Customer markers — casa azul con estado */}
          {deliveries.map((d) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;

            if (d.customer.lat && d.customer.lng) {
              return (
                <SmartMarker
                  key={`customer_${d.orderId}`}
                  coordinate={{
                    latitude: d.customer.lat,
                    longitude: d.customer.lng,
                  }}
                  title={`Cliente: ${d.customer.name}`}
                  description={d.customer.address || "Sin dirección"}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => focusDelivery(d)}
                  trackKey={`cust_${d.orderId}_${d.status}`}
                >
                  <MapPin
                    icon={CUSTOMER_MARKER.icon}
                    color={cfg.color}
                  />
                </SmartMarker>
              );
            }
            return null;
          })}

          {/* Driver markers — vehículo del repartidor */}
          {deliveries.map((d) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
            const vehicle = vehicleMarkerMeta(d.driver?.vehicleType);

            if (d.driver?.lat && d.driver?.lng) {
              return (
                <SmartMarker
                  key={`driver_${d.orderId}`}
                  coordinate={{
                    latitude: d.driver.lat,
                    longitude: d.driver.lng,
                  }}
                  title={`Repartidor: ${d.driver.name}`}
                  description={vehicle.label}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => focusDelivery(d)}
                  trackKey={`drv_${d.orderId}_${d.driver.vehicleType}`}
                >
                  <DriverPin
                    vehicleIcon={vehicle.icon}
                    label={cfg.label}
                  />
                </SmartMarker>
              );
            }
            return null;
          })}

          {/* Route lines - separate iteration */}
          {deliveries.map((d) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;

            if (
              d.driver?.lat &&
              d.driver?.lng &&
              d.customer.lat &&
              d.customer.lng
            ) {
              const real = realRoutes[d.orderId];
              return (
                <Polyline
                  key={`line_${d.orderId}`}
                  coordinates={
                    real && real.length >= 2
                      ? real
                      : [
                          { latitude: d.driver.lat, longitude: d.driver.lng },
                          { latitude: d.customer.lat, longitude: d.customer.lng },
                        ]
                  }
                  strokeColor={cfg.color}
                  strokeWidth={3}
                />
              );
            }
            return null;
          })}
        </MapView>

        {/* Loading overlay */}
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: card }]}>
            <ActivityIndicator size="large" color={ComeYaColors.primary} />
            <ThemedText type="body" style={{ marginTop: 12, color: sub }}>
              Cargando entregas...
            </ThemedText>
          </View>
        )}

        {/* Stats bar */}
        {stats && !loading && (
          <View
            style={[
              styles.statsBar,
              { backgroundColor: card, borderColor: bord },
            ]}
          >
            <View style={styles.statItem}>
              <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                {stats.totalActive}
              </ThemedText>
              <ThemedText type="caption" style={{ color: sub }}>
                Activos
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="h4" style={{ color: "#F59E0B" }}>
                {stats.pending}
              </ThemedText>
              <ThemedText type="caption" style={{ color: sub }}>
                Esperando
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="h4" style={{ color: "#DC2626" }}>
                {stats.onTheWay}
              </ThemedText>
              <ThemedText type="caption" style={{ color: sub }}>
                En camino
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="h4" style={{ color: "#8B5CF6" }}>
                {stats.avgMinutes}m
              </ThemedText>
              <ThemedText type="caption" style={{ color: sub }}>
                Tiempo med
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      {/* Deliveries list */}
      <View
        style={[
          styles.listContainer,
          { backgroundColor: bg, borderTopColor: bord },
        ]}
      >
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <ActivityIndicator color={ComeYaColors.primary} />
            </View>
          ) : deliveries.length === 0 ? (
            <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
              <Feather name="check-circle" size={40} color="#10B981" />
              <ThemedText
                type="body"
                style={{ color: sub, textAlign: "center" }}
              >
                No hay entregas activas ahora mismo
              </ThemedText>
            </View>
          ) : (
            deliveries.map((d) => {
              const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
              const isSelected = selected?.orderId === d.orderId;
              return (
                <Pressable
                  key={d.orderId}
                  onPress={() => focusDelivery(d)}
                  style={[
                    styles.deliveryCard,
                    {
                      backgroundColor: card,
                      borderColor: bord,
                      borderLeftColor: cfg.color,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: text, fontWeight: "700" }}
                      >
                        #{d.orderId.slice(-6).toUpperCase()}
                      </ThemedText>
                      <View
                        style={[
                          styles.timeBadge,
                          {
                            backgroundColor:
                              d.minutesActive > 30 ? "#EF444420" : "#10B98120",
                          },
                        ]}
                      >
                        <Feather
                          name="clock"
                          size={10}
                          color={d.minutesActive > 30 ? "#EF4444" : "#10B981"}
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color: d.minutesActive > 30 ? "#EF4444" : "#10B981",
                            marginLeft: 3,
                          }}
                        >
                          {d.minutesActive}m
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText
                      type="caption"
                      style={{ color: sub, marginTop: 2 }}
                    >
                      👤 {d.customer.name}
                    </ThemedText>

                    {d.driver ? (
                      <ThemedText
                        type="caption"
                        style={{ color: cfg.color, marginTop: 2 }}
                      >
                        🛵 {d.driver.name}
                      </ThemedText>
                    ) : (
                      <ThemedText
                        type="caption"
                        style={{ color: "#F59E0B", marginTop: 2 }}
                      >
                        ⚠️ Sin repartidor
                      </ThemedText>
                    )}

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 4,
                      }}
                    >
                      <View
                        style={[
                          styles.statusChip,
                          { backgroundColor: cfg.color + "20" },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: cfg.color, fontWeight: "700" }}
                        >
                          {cfg.label}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="caption"
                        style={{ color: text, fontWeight: "700" }}
                      >
                        {(d.total / 100).toFixed(2)} €
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.9,
  },
  statsBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: { flex: 1, alignItems: "center" },
  listContainer: {
    flex: 0.4,
    borderTopWidth: 1,
    padding: 12,
  },
  deliveryCard: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
});
