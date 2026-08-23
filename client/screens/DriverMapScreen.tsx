import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE, Callout } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { decodePolyline } from "@/utils/directions";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { BusinessPin as BusinessBubblePin } from "@/components/map/BusinessPin";
import { DriverPin } from "@/components/map/DriverPin";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface ActiveOrder {
  id: string;
  status: string;
  businessName: string;
  businessAddress: string;
  businessLatitude: string | null;
  businessLongitude: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLatitude: string | null;
  deliveryLongitude: string | null;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
}

interface NearbyBusiness {
  id: string;
  name: string;
  image: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  categories: string | null;
  distanceKm: number;
  isOpen: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ready: "#00BCD4",
  accepted: "#2196F3",
  picked_up: "#FF9800",
  on_the_way: "#4CAF50",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ir a recoger",
  accepted: "Ir a recoger",
  picked_up: "En camino al cliente",
  on_the_way: "En camino al cliente",
};

export default function DriverMapScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const mapRef = useRef<MapView>(null);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  // Ruta real desde el servidor (con cache + rate limiting)
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Negocios cercanos en el mapa
  const [nearbyBusinesses, setNearbyBusinesses] = useState<NearbyBusiness[]>([]);
  const [showNearbyBusinesses, setShowNearbyBusinesses] = useState(false);

  // Vehículo del repartidor (icono del mapa)
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  useEffect(() => {
    apiRequest("GET", "/api/users/profile/full")
      .then((r) => r.json())
      .then((d) => {
        if (d.vehicleType) setVehicleType(d.vehicleType);
      })
      .catch(() => {});
  }, []);

  // Cargar pedido activo del driver
  const loadActiveOrder = async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery/my-orders");
      const data = await res.json();
      if (data.success && data.orders?.length > 0) {
        const active = data.orders.find((o: any) =>
          [
            "accepted",
            "preparing",
            "ready",
            "picked_up",
            "on_the_way",
            "in_transit",
            "arriving",
          ].includes(o.status),
        );
        setActiveOrder(active || null);
      } else {
        setActiveOrder(null);
      }
    } catch {}
  };

  const loadStatus = async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery/status");
      const data = await res.json();
      if (data.success) setIsOnline(data.isOnline);
    } catch {}
  };

  // Cargar negocios cercanos
  const loadNearbyBusinesses = useCallback(async () => {
    if (!driverLocation) return;
    try {
      const res = await apiRequest(
        "GET",
        `/api/map/nearby-businesses?lat=${driverLocation.latitude}&lng=${driverLocation.longitude}&radiusKm=5`,
      );
      const data = await res.json();
      if (data.success) {
        setNearbyBusinesses(data.businesses || []);
      }
    } catch (err) {
      console.error("Error loading nearby businesses:", err);
    }
  }, [driverLocation]);

  // Cargar ruta real desde el servidor
  const loadRouteFromServer = useCallback(async () => {
    if (!driverLocation || !activeOrder) return;

    const isPickingUp = ["accepted", "preparing", "ready"].includes(
      activeOrder.status,
    );
    const destLat = isPickingUp ? activeOrder.businessLatitude : activeOrder.deliveryLatitude;
    const destLng = isPickingUp ? activeOrder.businessLongitude : activeOrder.deliveryLongitude;

    if (!destLat || !destLng) return;

    setRouteLoading(true);
    try {
      // Usar el endpoint GPS compartido (ya desplegado en Render)
      const res = await apiRequest(
        "GET",
        `/api/gps/directions?originLat=${driverLocation.latitude}&originLng=${driverLocation.longitude}&destLat=${destLat}&destLng=${destLng}`,
      );
      const data = await res.json();

      if (data.success && data.polyline) {
        // Decodificar polyline manualmente
        const decoded = decodePolyline(data.polyline);
        if (decoded.length > 0) {
          setRouteCoords(decoded);
        }
      } else if (data.success && data.fallback) {
        // Fallback: línea recta
        setRouteCoords([
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: parseFloat(destLat), longitude: parseFloat(destLng) },
        ]);
      }
    } catch {
      // Silencioso — el polyline por defecto usa línea recta entre marcadores
    }
    setRouteLoading(false);
  }, [driverLocation, activeOrder]);

  // GPS en tiempo real
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("GPS requerido", "Activa el GPS para usar el mapa de entregas.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setDriverLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLoading(false);

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (l) => {
          const coords = {
            latitude: l.coords.latitude,
            longitude: l.coords.longitude,
          };
          setDriverLocation(coords);
          // Enviar ubicación al servidor
          apiRequest("POST", "/api/delivery/location", {
            deliveryPersonId: user?.id,
            latitude: l.coords.latitude.toString(),
            longitude: l.coords.longitude.toString(),
            isOnline: true,
          }).catch(() => {});
        },
      );
    };

    start();
    loadStatus();
    loadActiveOrder();

    const interval = setInterval(loadActiveOrder, 10000);
    return () => {
      sub?.remove();
      clearInterval(interval);
    };
  }, []);

  // Cargar negocios cuando tengamos ubicación
  useEffect(() => {
    if (driverLocation) {
      loadNearbyBusinesses();
    }
  }, [driverLocation, showNearbyBusinesses, loadNearbyBusinesses]);

  // Cargar ruta del servidor cuando cambie pedido activo o ubicación
  useEffect(() => {
    loadRouteFromServer();
  }, [activeOrder, loadRouteFromServer]);

  // Centrar mapa en la ruta activa
  const fitToRoute = () => {
    if (!mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [];
    if (driverLocation) coords.push(driverLocation);
    if (activeOrder?.businessLatitude && activeOrder?.businessLongitude) {
      coords.push({
        latitude: parseFloat(activeOrder.businessLatitude),
        longitude: parseFloat(activeOrder.businessLongitude),
      });
    }
    if (activeOrder?.deliveryLatitude && activeOrder?.deliveryLongitude) {
      coords.push({
        latitude: parseFloat(activeOrder.deliveryLatitude),
        longitude: parseFloat(activeOrder.deliveryLongitude),
      });
    }
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }
  };

  const openNavigation = (lat: string, lng: string, address: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("DriverNavigation", {
      destLat: parseFloat(lat),
      destLng: parseFloat(lng),
      destAddress: address,
    });
  };

  const callCustomer = () => {
    if (activeOrder?.customerPhone) {
      const { Linking } = require("react-native");
      Linking.openURL(`tel:${activeOrder.customerPhone}`);
    }
  };

  const businessCoords =
    activeOrder?.businessLatitude && activeOrder?.businessLongitude
      ? {
          latitude: parseFloat(activeOrder.businessLatitude),
          longitude: parseFloat(activeOrder.businessLongitude),
        }
      : null;

  const customerCoords =
    activeOrder?.deliveryLatitude && activeOrder?.deliveryLongitude
      ? {
          latitude: parseFloat(activeOrder.deliveryLatitude),
          longitude: parseFloat(activeOrder.deliveryLongitude),
        }
      : null;

  const isPickingUp = activeOrder?.status === "ready" || activeOrder?.status === "accepted";
  const destination = isPickingUp ? businessCoords : customerCoords;
  const destinationAddress = isPickingUp
    ? activeOrder?.businessAddress
    : activeOrder?.deliveryAddress;

  const initialRegion = driverLocation
    ? { ...driverLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : {
        latitude: 41.7636,
        longitude: -2.4677,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Obteniendo ubicación GPS...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={fitToRoute}
      >
        {/* Marcador del driver — su vehículo */}
        {driverLocation && (
          <SmartMarker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            trackKey={`me_${vehicleType ?? ""}_${(user as any)?.profilePicture ?? ""}`}
          >
            <DriverPin
              vehicleIcon={vehicleMarkerMeta(vehicleType).icon}
              photo={(user as any)?.profilePicture}
              color={ComeYaColors.primary}
            />
          </SmartMarker>
        )}

        {/* Marcador del negocio de recogida */}
        {businessCoords && (
          <SmartMarker
            coordinate={businessCoords}
            anchor={{ x: 0.5, y: 1 }}
            trackKey="pickup"
          >
            <BusinessBubblePin
              icon={businessMarkerMeta().icon}
              color={businessMarkerMeta().color}
              title={activeOrder?.businessName || "Recogida"}
              compact
            />
          </SmartMarker>
        )}

        {/* Marcador del cliente */}
        {customerCoords && (
          <SmartMarker coordinate={customerCoords} anchor={{ x: 0.5, y: 1 }} trackKey="dropoff">
            <MapPin
              icon={CUSTOMER_MARKER.icon}
              color={CUSTOMER_MARKER.color}
            />
          </SmartMarker>
        )}

        {/* Ruta real desde el servidor (con cache + rate limiting) */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={isPickingUp ? "#FF9800" : "#4CAF50"}
            strokeWidth={4}
          />
        )}

        {/* Negocios cercanos en el mapa */}
        {showNearbyBusinesses && nearbyBusinesses.map((biz) => {
          const meta = businessMarkerMeta("restaurant", biz.categories ?? undefined);
          return (
            <SmartMarker
              key={biz.id}
              coordinate={{ latitude: biz.latitude, longitude: biz.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              trackKey={`nb_${biz.id}_${biz.isOpen ? "open" : "closed"}`}
            >
              <MapPin
                icon={meta.icon}
                color={biz.isOpen ? "#10B981" : "#6B7280"}
                size={26}
                iconSize={14}
              />
              <Callout>
                <View style={styles.calloutView}>
                  <ThemedText type="small" style={{ fontWeight: "700" }}>
                    {biz.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: biz.isOpen ? "#4CAF50" : "#F44336" }}>
                    {biz.isOpen ? "Abierto" : "Cerrado"}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: "#666" }}>
                    {biz.distanceKm} km
                  </ThemedText>
                </View>
              </Callout>
            </SmartMarker>
          );
        })}
      </MapView>

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: theme.card },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: isOnline ? ComeYaColors.success : "#F44336" },
            ]}
          />
          <ThemedText type="h4" style={{ marginLeft: 6 }}>
            {isOnline ? "En línea" : "Desconectado"}
          </ThemedText>
        </View>
        <ThemedText type="h3">Mi Mapa</ThemedText>
        <View style={styles.headerRight}>
          {/* Ruta múltiple (multi-pedido) */}
          <Pressable
            onPress={() => navigation.navigate("RouteOptimization")}
            style={styles.headerBtn}
          >
            <Feather name="layers" size={18} color={ComeYaColors.primary} />
          </Pressable>
          {/* Toggle negocios cercanos */}
          <Pressable
            onPress={() => setShowNearbyBusinesses(!showNearbyBusinesses)}
            style={[
              styles.headerBtn,
              {
                backgroundColor: showNearbyBusinesses
                  ? ComeYaColors.primary + "20"
                  : "transparent",
              },
            ]}
          >
            <Feather
              name="coffee"
              size={18}
              color={showNearbyBusinesses ? ComeYaColors.primary : theme.textSecondary}
            />
          </Pressable>
          <Pressable onPress={fitToRoute} style={styles.headerBtn}>
            <Feather name="maximize-2" size={18} color={ComeYaColors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Panel inferior — pedido activo */}
      {activeOrder ? (
        <View
          style={[styles.orderPanel, { backgroundColor: theme.card }, Shadows.lg]}
        >
          {/* Estado */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  (STATUS_COLORS[activeOrder.status] || ComeYaColors.primary) + "20",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    STATUS_COLORS[activeOrder.status] || ComeYaColors.primary,
                },
              ]}
            />
            <ThemedText
              type="small"
              style={{
                color: STATUS_COLORS[activeOrder.status] || ComeYaColors.primary,
                fontWeight: "700",
              }}
            >
              {STATUS_LABELS[activeOrder.status] || activeOrder.status}
            </ThemedText>
            {routeLoading && (
              <ActivityIndicator
                size="small"
                color={STATUS_COLORS[activeOrder.status]}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          {/* Destino actual */}
          <View style={styles.destinationRow}>
            <View
              style={[
                styles.destIcon,
                { backgroundColor: isPickingUp ? "#FF9800" : "#9C27B0" },
              ]}
            >
              <Feather
                name={isPickingUp ? "shopping-bag" : "home"}
                size={16}
                color="#FFF"
              />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {isPickingUp ? "Recoger en" : "Entregar en"}
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                {isPickingUp ? activeOrder.businessName : activeOrder.customerName}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {destinationAddress}
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              {(activeOrder.deliveryFee / 100).toFixed(2)} €
            </ThemedText>
          </View>

          {/* Botones de acción */}
          <View style={styles.actionRow}>
            {destination && (
              <Pressable
                onPress={() =>
                  openNavigation(
                    destination.latitude.toString(),
                    destination.longitude.toString(),
                    destinationAddress || "",
                  )
                }
                style={[styles.navButton, { backgroundColor: ComeYaColors.primary }]}
              >
                <Feather name="navigation" size={16} color="#FFF" />
                <ThemedText type="small" style={{ color: "#FFF", marginLeft: 6, fontWeight: "700" }}>
                  Navegar
                </ThemedText>
              </Pressable>
            )}
            {!isPickingUp && activeOrder.customerPhone && (
              <Pressable
                onPress={callCustomer}
                style={[styles.callButton, { backgroundColor: "#4CAF50" }]}
              >
                <Feather name="phone" size={16} color="#FFF" />
                <ThemedText type="small" style={{ color: "#FFF", marginLeft: 6, fontWeight: "700" }}>
                  Llamar
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* Pago */}
          <View
            style={[styles.paymentRow, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather
              name={activeOrder.paymentMethod === "cash" ? "dollar-sign" : "credit-card"}
              size={14}
              color={activeOrder.paymentMethod === "cash" ? "#FF9800" : "#4CAF50"}
            />
            <ThemedText type="small" style={{ marginLeft: 6, color: theme.textSecondary }}>
              {activeOrder.paymentMethod === "cash"
                ? `Cobrar ${(activeOrder.total / 100).toFixed(2)} € en efectivo`
                : "Pagado digitalmente"}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={[styles.noOrderPanel, { backgroundColor: theme.card }, Shadows.md]}>
          <Feather name="map-pin" size={32} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}
          >
            {isOnline
              ? "Esperando pedidos... Activa los negocios cercanos para ver dónde hay demanda"
              : "Actívate para recibir pedidos"}
          </ThemedText>
        </View>
      )}

      {/* Leyenda */}
      <View style={[styles.legend, { backgroundColor: theme.card + "EE" }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ComeYaColors.primary }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Tú</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#FF9800" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Negocio</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#9C27B0" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cliente</ThemedText>
        </View>
        {showNearbyBusinesses && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Abierto</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#9E9E9E" }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cerrado</ThemedText>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  map: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: {
    padding: 8,
    borderRadius: 20,
  },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  calloutView: {
    padding: 8,
    minWidth: 120,
  },
  orderPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  destIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  noOrderPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.xl,
    alignItems: "center",
  },
  legend: {
    position: "absolute",
    top: 100,
    right: 12,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});