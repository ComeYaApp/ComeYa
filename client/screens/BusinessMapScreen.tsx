import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  Image as RNImage,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Soria, España
const DEFAULT_REGION = {
  latitude: 41.7636,
  longitude: -2.4677,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

interface ActiveOrder {
  id: string;
  businessName: string;
  status: string;
  business: { latitude: number; longitude: number };
  customer: { latitude: number; longitude: number };
  driver?: { latitude: number; longitude: number; name: string };
  eta?: number;
}

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
  categories: string[];
}

export default function BusinessMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const [businesses, setBusinesses] = useState<BusinessPin[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [Circle, setCircle] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const mapRef = useRef<any>(null);

  const CATEGORIES = [
    { key: "all", label: "Todos", icon: "grid" },
    { key: "restaurant", label: "Comida", icon: "coffee" },
    { key: "market", label: "Mercado", icon: "shopping-bag" },
    { key: "pharmacy", label: "Farmacia", icon: "plus-circle" },
  ];

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: "Esperando confirmación", color: "#F59E0B" },
    confirmed: { label: "Pedido confirmado", color: "#3B82F6" },
    preparing: { label: "Preparando", color: "#8B5CF6" },
    ready: { label: "Listo para recoger", color: "#10B981" },
    on_the_way: { label: "En camino 🛵", color: ComeYaColors.success },
  };

  // Cargar react-native-maps dinámicamente (no disponible en web)
  useEffect(() => {
    if (Platform.OS !== "web") {
      import("react-native-maps").then((mod) => {
        setMapView(() => mod.default);
        setMarker(() => mod.Marker);
        setPolyline(() => mod.Polyline);
        setCircle(() => mod.Circle);
      });
    }
  }, []);

  // Cargar pedidos activos del cliente
  useEffect(() => {
    if (user?.role !== "customer") return;
    const fetchOrders = async () => {
      try {
        const res = await apiRequest("GET", "/api/orders?status=active");
        const data = await res.json();
        const orders = data.orders || [];

        const mapped: ActiveOrder[] = await Promise.all(
          orders.map(async (o: any) => {
            let driverLoc = undefined;
            if (o.deliveryPersonId) {
              try {
                const dRes = await apiRequest(
                  "GET",
                  `/api/delivery/location/${o.id}`,
                );
                const dData = await dRes.json();
                if (dData.location) {
                  driverLoc = {
                    latitude: parseFloat(dData.location.latitude),
                    longitude: parseFloat(dData.location.longitude),
                    name: o.deliveryPersonName || "Repartidor",
                  };
                }
              } catch {}
            }

            // Cargar ubicación del negocio
            let bizLat = 0,
              bizLng = 0;
            try {
              const bRes = await apiRequest(
                "GET",
                `/api/business/${o.businessId}`,
              );
              const bData = await bRes.json();
              bizLat = parseFloat(bData.business?.latitude || 0);
              bizLng = parseFloat(bData.business?.longitude || 0);
            } catch {}

            // Parsear dirección de entrega
            let custLat = userLocation?.latitude || 0;
            let custLng = userLocation?.longitude || 0;
            if (o.deliveryAddress) {
              try {
                const addr =
                  typeof o.deliveryAddress === "string"
                    ? JSON.parse(o.deliveryAddress)
                    : o.deliveryAddress;
                if (addr.latitude && addr.longitude) {
                  custLat = parseFloat(addr.latitude);
                  custLng = parseFloat(addr.longitude);
                }
              } catch {}
            }
            // Usar coordenadas directas si están disponibles
            if (o.deliveryLatitude && o.deliveryLongitude) {
              custLat = parseFloat(o.deliveryLatitude);
              custLng = parseFloat(o.deliveryLongitude);
            }

            return {
              id: o.id,
              businessName: o.businessName || "Negocio",
              status: o.status,
              business: { latitude: bizLat, longitude: bizLng },
              customer: { latitude: custLat, longitude: custLng },
              driver: driverLoc,
              eta: o.estimatedDelivery
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(o.estimatedDelivery).getTime() - Date.now()) /
                        60000,
                    ),
                  )
                : undefined,
            };
          }),
        );

        // Filtrar pedidos con coordenadas válidas
        const validOrders = mapped.filter(
          (o) =>
            o.business.latitude !== 0 &&
            o.business.longitude !== 0 &&
            o.customer.latitude !== 0 &&
            o.customer.longitude !== 0,
        );

        setActiveOrders(validOrders);
        console.log(
          "🗺️ Active orders loaded:",
          validOrders.length,
          validOrders,
        );
      } catch (e) {
        console.error("Error loading active orders:", e);
      }
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [user, userLocation]);

  // Pedir permiso de ubicación y centrar mapa cuando llegue
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coords);
        // Centrar el mapa en el usuario apenas llegue el GPS
        mapRef.current?.animateToRegion(
          { ...coords, latitudeDelta: 0.04, longitudeDelta: 0.04 },
          600,
        );
      }
    })();
  }, []);

  // Cargar negocios
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/businesses");
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
            categories: b.categories ? b.categories.split(",") : [],
          }));
        setBusinesses(pins);
      } catch (e) {
        console.error("Error loading businesses for map:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handlePinPress = useCallback((business: BusinessPin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(business);
    mapRef.current?.animateToRegion(
      {
        latitude: business.latitude - 0.008,
        longitude: business.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      400,
    );
  }, []);

  const handleDirections = useCallback((business: BusinessPin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = Platform.select({
      ios: `maps://app?daddr=${business.latitude},${business.longitude}`,
      android: `google.navigation:q=${business.latitude},${business.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`,
    });
    Linking.openURL(url!);
  }, []);

  const handleCenterUser = useCallback(() => {
    if (!userLocation) return;
    Haptics.selectionAsync();
    mapRef.current?.animateToRegion(
      { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400,
    );
  }, [userLocation]);

  if (Platform.OS === "web") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Mapa de Negocios</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.webFallback}>
          <Feather name="map" size={48} color={theme.textSecondary} />
          <ThemedText
            type="h4"
            style={{ marginTop: Spacing.md, textAlign: "center" }}
          >
            El mapa solo está disponible en la app móvil
          </ThemedText>
        </View>
      </View>
    );
  }

  if (isLoading || !MapView) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <ThemedText
          type="body"
          style={{ marginTop: Spacing.md, color: theme.textSecondary }}
        >
          Cargando mapa...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={isDark ? "dark" : "light"}
      >
        {/* Radio de cobertura */}
        {Circle && userLocation && (
          <Circle
            center={userLocation}
            radius={3000}
            strokeColor={ComeYaColors.primary + "60"}
            fillColor={ComeYaColors.primary + "10"}
            strokeWidth={1.5}
          />
        )}

        {Marker &&
          businesses
            .filter(
              (b) => categoryFilter === "all" || b.type === categoryFilter,
            )
            .map((b) => (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.latitude, longitude: b.longitude }}
                onPress={() => handlePinPress(b)}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.businessPinWrapper}>
                  {/* Bubble con imagen y nombre */}
                  <View
                    style={[
                      styles.businessBubble,
                      {
                        backgroundColor: b.isOpen ? "#fff" : "#f0f0f0",
                        borderColor: b.isOpen ? ComeYaColors.primary : "#ccc",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.businessBubbleIcon,
                        {
                          backgroundColor: b.isOpen
                            ? ComeYaColors.primary + "15"
                            : "#e0e0e0",
                        },
                      ]}
                    >
                      <Feather
                        name={
                          b.type === "market"
                            ? "shopping-bag"
                            : b.type === "pharmacy"
                              ? "plus-circle"
                              : "coffee"
                        }
                        size={18}
                        color={b.isOpen ? ComeYaColors.primary : "#9E9E9E"}
                      />
                    </View>
                    <View style={styles.businessBubbleInfo}>
                      <ThemedText
                        type="caption"
                        style={{
                          fontWeight: "700",
                          fontSize: 11,
                          color: b.isOpen ? "#1a1a1a" : "#9E9E9E",
                        }}
                        numberOfLines={1}
                      >
                        {b.name}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{
                          fontSize: 10,
                          color: b.isOpen ? ComeYaColors.primary : "#9E9E9E",
                          fontWeight: "600",
                        }}
                      >
                        {b.isOpen
                          ? typeof b.deliveryTime === "string" &&
                            b.deliveryTime.includes("min")
                            ? b.deliveryTime
                            : "30-45 min"
                          : "Cerrado"}
                      </ThemedText>
                    </View>
                  </View>
                  {/* Tail del pin */}
                  <View
                    style={[
                      styles.businessPinTail,
                      {
                        borderTopColor: b.isOpen
                          ? ComeYaColors.primary
                          : "#ccc",
                      },
                    ]}
                  />
                </View>
              </Marker>
            ))}

        {/* Pedidos activos del cliente */}
        {Marker &&
          Polyline &&
          activeOrders.map((order) => (
            <React.Fragment key={order.id}>
              {/* Ruta negocio → cliente (o negocio → driver → cliente si hay driver) */}
              <Polyline
                coordinates={[
                  {
                    latitude: order.business.latitude,
                    longitude: order.business.longitude,
                  },
                  ...(order.driver
                    ? [
                        {
                          latitude: order.driver.latitude,
                          longitude: order.driver.longitude,
                        },
                      ]
                    : []),
                  {
                    latitude: order.customer.latitude,
                    longitude: order.customer.longitude,
                  },
                ]}
                strokeColor={
                  STATUS_LABELS[order.status]?.color || ComeYaColors.primary
                }
                strokeWidth={3}
                lineDashPattern={
                  order.status === "on_the_way" ? undefined : [10, 5]
                }
              />

              {/* Marcador repartidor */}
              {order.driver && (
                <Marker
                  coordinate={{
                    latitude: order.driver.latitude,
                    longitude: order.driver.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() =>
                    navigation.navigate("OrderTracking", { orderId: order.id })
                  }
                >
                  <View style={styles.driverPin}>
                    <View style={styles.driverPinInner}>
                      <ThemedText style={{ fontSize: 20 }}>🛵</ThemedText>
                    </View>
                    {order.eta !== undefined && (
                      <View style={styles.driverPinLabel}>
                        <ThemedText
                          type="caption"
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: "#fff",
                          }}
                        >
                          {order.eta} min
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </Marker>
              )}

              {/* Marcador destino cliente */}
              <Marker
                coordinate={{
                  latitude: order.customer.latitude,
                  longitude: order.customer.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() =>
                  navigation.navigate("OrderTracking", { orderId: order.id })
                }
              >
                <View style={styles.customerPinWrapper}>
                  <View style={styles.customerBubble}>
                    <Feather name="home" size={16} color="#fff" />
                    {order.eta !== undefined && (
                      <ThemedText
                        type="caption"
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: "700",
                          marginLeft: 4,
                        }}
                      >
                        {order.eta}'
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.customerPinTail} />
                </View>
              </Marker>
            </React.Fragment>
          ))}
      </MapView>

      {/* Header flotante */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={[styles.headerTitle, { backgroundColor: theme.card }]}>
          <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
          <ThemedText
            type="body"
            style={{ fontWeight: "700", marginLeft: Spacing.xs }}
          >
            {categoryFilter === "all"
              ? businesses.length
              : businesses.filter((b) => b.type === categoryFilter).length}{" "}
            negocios
          </ThemedText>
        </View>
        <Pressable
          onPress={handleCenterUser}
          style={[styles.floatBtn, { backgroundColor: theme.card }]}
        >
          <Feather name="navigation" size={22} color={ComeYaColors.primary} />
        </Pressable>
      </View>

      {/* Filtros de categoría */}
      <View style={[styles.filtersRow, { top: insets.top + 58 }]}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => {
              setCategoryFilter(cat.key);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  categoryFilter === cat.key
                    ? ComeYaColors.primary
                    : theme.card,
              },
            ]}
          >
            <Feather
              name={cat.icon as any}
              size={13}
              color={categoryFilter === cat.key ? "#fff" : theme.text}
            />
            <ThemedText
              type="caption"
              style={{
                marginLeft: 4,
                color: categoryFilter === cat.key ? "#fff" : theme.text,
                fontWeight: "600",
              }}
            >
              {cat.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Leyenda */}
      <View
        style={[
          styles.legend,
          {
            backgroundColor: theme.card,
            bottom: selected ? 280 : insets.bottom + Spacing.lg,
          },
        ]}
      >
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: ComeYaColors.primary },
            ]}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Abierto
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#9E9E9E" }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Cerrado
          </ThemedText>
        </View>
      </View>

      {/* Card del negocio seleccionado */}
      {selected ? (
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + Spacing.md,
            },
            Shadows.lg,
          ]}
          onPress={() => setSelected(null)}
        >
          {/* Tap para cerrar */}
          <View style={styles.cardHandle} />

          <View style={styles.cardContent}>
            {/* Imagen */}
            <Image
              source={
                selected.image
                  ? { uri: selected.image }
                  : require("../../assets/images/delivery-hero.png")
              }
              style={styles.cardImage}
              contentFit="cover"
            />

            {/* Info */}
            <View style={styles.cardInfo}>
              <View style={styles.cardNameRow}>
                <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
                  {selected.name}
                </ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: selected.isOpen
                        ? ComeYaColors.primary + "20"
                        : "#9E9E9E20",
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color: selected.isOpen ? ComeYaColors.primary : "#9E9E9E",
                      fontWeight: "700",
                    }}
                  >
                    {selected.isOpen ? "Abierto" : "Cerrado"}
                  </ThemedText>
                </View>
              </View>

              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
                numberOfLines={1}
              >
                {selected.address}
              </ThemedText>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Feather name="star" size={12} color="#FFB800" />
                  <ThemedText type="caption" style={{ marginLeft: 3 }}>
                    {selected.rating.toFixed(1)}
                  </ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="clock" size={12} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ marginLeft: 3, color: theme.textSecondary }}
                  >
                    {selected.deliveryTime}
                  </ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ marginLeft: 3, color: theme.textSecondary }}
                  >
                    {selected.deliveryFee.toFixed(0)} €
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Botones */}
          <View style={styles.cardButtons}>
            <Pressable
              onPress={() => handleDirections(selected)}
              style={[
                styles.btnDirections,
                { borderColor: ComeYaColors.primary },
              ]}
            >
              <Feather
                name="navigation"
                size={16}
                color={ComeYaColors.primary}
              />
              <ThemedText
                type="small"
                style={{
                  color: ComeYaColors.primary,
                  fontWeight: "700",
                  marginLeft: Spacing.xs,
                }}
              >
                Cómo llegar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelected(null);
                navigation
                  .getParent()
                  ?.navigate("BusinessDetail", { businessId: selected.id });
              }}
              style={styles.btnMenu}
            >
              <Feather name="book-open" size={16} color="#FFFFFF" />
              <ThemedText
                type="small"
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  marginLeft: Spacing.xs,
                }}
              >
                Ver menú
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* Banner pedidos activos */}
      {activeOrders.length > 0 && !selected && (
        <Pressable
          onPress={() =>
            navigation.navigate("OrderTracking", {
              orderId: activeOrders[0].id,
            })
          }
          style={[
            styles.orderBanner,
            { backgroundColor: theme.card, bottom: insets.bottom + 16 },
          ]}
        >
          <View
            style={[
              styles.orderBannerDot,
              {
                backgroundColor:
                  STATUS_LABELS[activeOrders[0].status]?.color ||
                  ComeYaColors.primary,
              },
            ]}
          />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText
              type="caption"
              style={{
                fontWeight: "700",
                color:
                  STATUS_LABELS[activeOrders[0].status]?.color ||
                  ComeYaColors.primary,
              }}
            >
              {STATUS_LABELS[activeOrders[0].status]?.label || "Pedido activo"}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {activeOrders[0].businessName}
              {activeOrders[0].eta !== undefined
                ? ` · ${activeOrders[0].eta} min`
                : ""}
            </ThemedText>
          </View>
          {activeOrders.length > 1 && (
            <View
              style={[
                styles.orderCountBadge,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <ThemedText
                type="caption"
                style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}
              >
                {activeOrders.length}
              </ThemedText>
            </View>
          )}
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },

  // Header flotante
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Pins profesionales estilo Rappi/Uber
  businessPinWrapper: { alignItems: "center" },
  businessBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    maxWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    gap: 6,
  },
  businessBubbleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  businessBubbleInfo: { flex: 1 },
  businessPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  driverPin: {
    alignItems: "center",
  },
  driverPinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  driverPinLabel: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  customerBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  customerPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: ComeYaColors.primary,
    marginTop: -1,
  },

  // Leyenda
  legend: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },

  // Card negocio
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  cardContent: { flexDirection: "row", marginBottom: Spacing.md },
  cardImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  cardMeta: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center" },

  // Botones
  cardButtons: { flexDirection: "row", gap: Spacing.md },
  btnDirections: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  btnMenu: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: ComeYaColors.primary,
  },
  filtersRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    zIndex: 9,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryTimeBubble: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
  },
  orderBanner: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  orderBannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  orderCountBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
});
