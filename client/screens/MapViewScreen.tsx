import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { SmartMarker } from "@/components/map/SmartMarker";
import { MapPin } from "@/components/map/MapPin";
import { BusinessPin as BusinessBubblePin } from "@/components/map/BusinessPin";
import { DriverPin } from "@/components/map/DriverPin";
import {
  businessMarkerMeta,
  vehicleMarkerMeta,
  CUSTOMER_MARKER,
} from "@/utils/markerMeta";

interface Business {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  address?: string;
  category?: string;
  phone?: string;
}

interface OrderTracking {
  id: string;
  shortId: string;
  status: string;
  color: string;
  customer: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  business: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  driver?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    vehicleType?: string;
  };
  total: number;
  createdAt: string;
  estimatedTime?: number;
}

const ORDER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788",
  "#FF8FA3",
  "#6C5CE7",
];

const STATUS_FILTERS = [
  { key: "all", label: "Todos", icon: "list" },
  { key: "pending", label: "Pendientes", icon: "clock" },
  { key: "preparing", label: "Preparando", icon: "loader" },
  { key: "on_the_way", label: "En camino", icon: "truck" },
];

export default function MapViewScreen({ navigation }: any) {
  const { theme } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderTracking | null>(
    null,
  );
  const [showOrdersList, setShowOrdersList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [previousOrdersCount, setPreviousOrdersCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const sound = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    fetchData();
    loadSound();
    const interval = setInterval(fetchData, 5000);

    // Obtener ubicación del usuario para centrar el mapa
    if (Platform.OS !== "web") {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status === "granted") {
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
            .then((loc) => {
              setUserLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
            })
            .catch(() => {});
        }
      });
    }

    return () => {
      clearInterval(interval);
      unloadSound();
    };
  }, []);

  const loadSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.log("Error setting audio mode:", error);
    }
  };

  const unloadSound = async () => {
    if (sound.current) {
      await sound.current.unloadAsync();
    }
  };

  const playNotificationSound = async () => {
    if (soundEnabled) {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          {
            uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
          },
          { shouldPlay: true },
        );
        await newSound.playAsync();
        setTimeout(() => newSound.unloadAsync(), 2000);
      } catch (error) {
        console.log("Error playing sound:", error);
      }
    }
  };

  const handleNewOrderNotification = async (count: number) => {
    if (!notificationsEnabled) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await playNotificationSound();

    Alert.alert(
      "🔔 Nuevo Pedido",
      `${count} ${count === 1 ? "nuevo pedido ha" : "nuevos pedidos han"} llegado`,
      [
        { text: "Ver", onPress: () => setShowOrdersList(true) },
        { text: "OK", style: "cancel" },
      ],
    );
  };

  const fetchData = async () => {
    try {
      const [businessesRes, ordersRes] = await Promise.all([
        apiRequest<{ success: boolean; businesses: Business[] }>(
          "/admin/businesses",
          "GET",
        ),
        apiRequest<{ orders: any[] }>("/admin/dashboard/active-orders", "GET"),
      ]);

      setBusinesses(businessesRes.businesses);

      const ordersWithColors = ordersRes.orders.map(
        (order: any, index: number) => ({
          id: order.id,
          shortId: generateShortId(order.id),
          status: order.status,
          color: ORDER_COLORS[index % ORDER_COLORS.length],
          customer: {
            id: order.customer?.id || "",
            name: order.customer?.name || "Cliente",
            latitude: order.deliveryAddress?.latitude || 0,
            longitude: order.deliveryAddress?.longitude || 0,
          },
          business: {
            id: order.business?.id || "",
            name: order.business?.name || "Negocio",
            latitude: order.business?.latitude || 0,
            longitude: order.business?.longitude || 0,
          },
          driver: order.driver
            ? {
                id: order.driver.id,
                name: order.driver.name,
                latitude: order.driver.latitude ?? order.business?.latitude ?? 0,
                longitude:
                  order.driver.longitude ?? order.business?.longitude ?? 0,
                vehicleType: order.driver.vehicleType,
              }
            : undefined,
          total: order.total || 0,
          createdAt: order.createdAt,
          estimatedTime: calculateEstimatedTime(order.status),
        }),
      );

      setActiveOrders(ordersWithColors);

      if (
        previousOrdersCount > 0 &&
        ordersWithColors.length > previousOrdersCount
      ) {
        const newOrdersCount = ordersWithColors.length - previousOrdersCount;
        handleNewOrderNotification(newOrdersCount);
      }
      setPreviousOrdersCount(ordersWithColors.length);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateShortId = (id: string): string => {
    const hash = id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `#${hash.toString(36).toUpperCase().slice(0, 4)}`;
  };

  const calculateEstimatedTime = (status: string): number => {
    switch (status) {
      case "pending":
        return 25;
      case "confirmed":
        return 20;
      case "preparing":
        return 15;
      case "ready":
        return 10;
      case "on_the_way":
        return 5;
      default:
        return 0;
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: "Pago confirmado",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo para recoger",
      on_the_way: "En camino",
      delivered: "Entregado",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      pending: "clock",
      confirmed: "check-circle",
      preparing: "loader",
      ready: "package",
      on_the_way: "truck",
      delivered: "check",
    };
    return icons[status] || "circle";
  };

  const centerOnOrder = (order: OrderTracking) => {
    setSelectedOrder(order);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const coordinates = [
      {
        latitude: order.customer.latitude,
        longitude: order.customer.longitude,
      },
      {
        latitude: order.business.latitude,
        longitude: order.business.longitude,
      },
    ];

    if (order.driver) {
      coordinates.push({
        latitude: order.driver.latitude,
        longitude: order.driver.longitude,
      });
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
      animated: true,
    });
  };

  const renderOrderMarker = (
    order: OrderTracking,
    type: "customer" | "business" | "driver",
  ) => {
    const selected = selectedOrder?.id === order.id;

    if (type === "customer") {
      return (
        <SmartMarker
          key={`${order.id}-customer`}
          coordinate={{
            latitude: order.customer.latitude,
            longitude: order.customer.longitude,
          }}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => centerOnOrder(order)}
          trackKey={`${order.id}-cust-${selected}`}
        >
          <MapPin
            icon={CUSTOMER_MARKER.icon}
            color={order.color}
            size={selected ? 42 : 36}
          />
        </SmartMarker>
      );
    }

    if (type === "business") {
      return (
        <SmartMarker
          key={`${order.id}-business`}
          coordinate={{
            latitude: order.business.latitude,
            longitude: order.business.longitude,
          }}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => centerOnOrder(order)}
          trackKey={`${order.id}-biz-${selected}`}
        >
          <MapPin
            icon={businessMarkerMeta().icon}
            color={order.color}
            size={selected ? 42 : 36}
          />
        </SmartMarker>
      );
    }

    if (!order.driver) return null;
    return (
      <SmartMarker
        key={`${order.id}-driver`}
        coordinate={{
          latitude: order.driver.latitude,
          longitude: order.driver.longitude,
        }}
        anchor={{ x: 0.5, y: 0.5 }}
        onPress={() => centerOnOrder(order)}
        trackKey={`${order.id}-drv-${order.driver.vehicleType ?? ""}`}
      >
        <DriverPin
          vehicleIcon={vehicleMarkerMeta(order.driver.vehicleType).icon}
          color={order.color}
          size={selected ? 50 : 44}
        />
      </SmartMarker>
    );
  };

  const renderOrderRoute = (order: OrderTracking) => {
    const coordinates = [];

    coordinates.push(
      {
        latitude: order.customer.latitude,
        longitude: order.customer.longitude,
      },
      {
        latitude: order.business.latitude,
        longitude: order.business.longitude,
      },
    );

    if (order.driver && ["ready", "on_the_way"].includes(order.status)) {
      return (
        <>
          <Polyline
            coordinates={[
              {
                latitude: order.business.latitude,
                longitude: order.business.longitude,
              },
              {
                latitude: order.driver.latitude,
                longitude: order.driver.longitude,
              },
            ]}
            strokeColor={order.color}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
          <Polyline
            coordinates={[
              {
                latitude: order.driver.latitude,
                longitude: order.driver.longitude,
              },
              {
                latitude: order.customer.latitude,
                longitude: order.customer.longitude,
              },
            ]}
            strokeColor={order.color}
            strokeWidth={4}
          />
        </>
      );
    }

    return (
      <Polyline
        coordinates={coordinates}
        strokeColor={order.color}
        strokeWidth={2}
        lineDashPattern={order.status === "preparing" ? [5, 5] : undefined}
      />
    );
  };

  const filteredOrders =
    statusFilter === "all"
      ? activeOrders
      : activeOrders.filter((order) => order.status === statusFilter);

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Cargando mapa en tiempo real...
        </Text>
      </View>
    );
  }

  const initialRegion = (() => {
    // Prioridad: GPS usuario > primer negocio con coords válidas > Soria España
    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    const firstValid = activeOrders.find(
      (o) => o.business.latitude !== 0 && o.business.longitude !== 0,
    );
    if (firstValid) {
      return {
        latitude: firstValid.business.latitude,
        longitude: firstValid.business.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 41.7636,
      longitude: -2.4677,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  })();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Tracking en Tiempo Real
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {filteredOrders.length} de {activeOrders.length} pedidos
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setSoundEnabled(!soundEnabled);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.headerButton}
          >
            <Feather
              name={soundEnabled ? "volume-2" : "volume-x"}
              size={20}
              color={soundEnabled ? ComeYaColors.primary : theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setNotificationsEnabled(!notificationsEnabled);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.headerButton}
          >
            <Feather
              name={notificationsEnabled ? "bell" : "bell-off"}
              size={20}
              color={
                notificationsEnabled
                  ? ComeYaColors.primary
                  : theme.textSecondary
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowOrdersList(!showOrdersList);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.headerButton}
          >
            <Feather
              name={showOrdersList ? "eye-off" : "eye"}
              size={20}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {businesses
          .filter((b) => activeOrders.some((o) => o.business.id === b.id))
          .map((business) => {
            const meta = businessMarkerMeta(
              "restaurant",
              business.category,
            );
            return (
              <SmartMarker
                key={`business-${business.id}`}
                coordinate={{
                  latitude: business.latitude,
                  longitude: business.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
                trackKey={`bizmap-${business.id}-${business.isActive}`}
              >
                <BusinessBubblePin
                  icon={meta.icon}
                  color={meta.color}
                  title={business.name}
                  compact
                />
              </SmartMarker>
            );
          })}

        {activeOrders.map((order) => (
          <React.Fragment key={order.id}>
            {renderOrderRoute(order)}
            {renderOrderMarker(order, "customer")}
            {renderOrderMarker(order, "business")}
            {renderOrderMarker(order, "driver")}
          </React.Fragment>
        ))}
      </MapView>

      {showOrdersList && (
        <View style={[styles.ordersPanel, { backgroundColor: theme.card }]}>
          <View style={styles.ordersPanelHeader}>
            <Text style={[styles.ordersPanelTitle, { color: theme.text }]}>
              Pedidos Activos
            </Text>
            <View
              style={[
                styles.liveIndicator,
                { backgroundColor: ComeYaColors.error },
              ]}
            >
              <Text style={styles.liveText}>● LIVE</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersContainer}
          >
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      statusFilter === filter.key
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                    borderColor:
                      statusFilter === filter.key
                        ? ComeYaColors.primary
                        : theme.border,
                  },
                ]}
                onPress={() => {
                  setStatusFilter(filter.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather
                  name={filter.icon as any}
                  size={14}
                  color={statusFilter === filter.key ? "#fff" : theme.text}
                />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: statusFilter === filter.key ? "#fff" : theme.text,
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={[
                  styles.orderItem,
                  {
                    backgroundColor:
                      selectedOrder?.id === order.id
                        ? order.color + "20"
                        : theme.backgroundSecondary,
                    borderLeftColor: order.color,
                  },
                ]}
                onPress={() => centerOnOrder(order)}
              >
                <View style={styles.orderItemHeader}>
                  <View
                    style={[
                      styles.orderColorBadge,
                      { backgroundColor: order.color },
                    ]}
                  >
                    <Text style={styles.orderShortId}>{order.shortId}</Text>
                  </View>
                  <View style={styles.orderItemInfo}>
                    <Text
                      style={[styles.orderBusinessName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {order.business.name}
                    </Text>
                    <Text
                      style={[
                        styles.orderCustomerName,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {order.customer.name}
                    </Text>
                  </View>
                  <Text style={[styles.orderTotal, { color: order.color }]}>
                    {(order.total / 100).toFixed(0)} €
                  </Text>
                </View>

                <View style={styles.orderItemStatus}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: order.color + "30" },
                    ]}
                  >
                    <Feather
                      name={getStatusIcon(order.status) as any}
                      size={12}
                      color={order.color}
                    />
                    <Text style={[styles.statusText, { color: order.color }]}>
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                  {order.estimatedTime && order.estimatedTime > 0 && (
                    <View style={styles.timeEstimate}>
                      <Feather
                        name="clock"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.timeText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        ~{order.estimatedTime} min
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.flowIndicator}>
                  <View
                    style={[
                      styles.flowDot,
                      {
                        backgroundColor:
                          order.status === "pending" ? order.color : "#ccc",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flowLine,
                      {
                        backgroundColor: [
                          "confirmed",
                          "preparing",
                          "ready",
                          "on_the_way",
                        ].includes(order.status)
                          ? order.color
                          : "#ccc",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flowDot,
                      {
                        backgroundColor: [
                          "preparing",
                          "ready",
                          "on_the_way",
                        ].includes(order.status)
                          ? order.color
                          : "#ccc",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flowLine,
                      {
                        backgroundColor: ["ready", "on_the_way"].includes(
                          order.status,
                        )
                          ? order.color
                          : "#ccc",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.flowDot,
                      {
                        backgroundColor:
                          order.status === "on_the_way" ? order.color : "#ccc",
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))}

            {filteredOrders.length === 0 && (
              <View style={styles.emptyOrders}>
                <Feather name="inbox" size={48} color={theme.textSecondary} />
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  {statusFilter === "all"
                    ? "No hay pedidos activos"
                    : `No hay pedidos ${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label.toLowerCase()}`}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      <View style={[styles.legend, { backgroundColor: theme.card }]}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <Feather name="user" size={14} color={theme.textSecondary} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Cliente
            </Text>
          </View>
          <View style={styles.legendItem}>
            <Feather
              name="shopping-bag"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Negocio
            </Text>
          </View>
          <View style={styles.legendItem}>
            <Feather name="truck" size={14} color={theme.textSecondary} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Repartidor
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  map: {
    flex: 1,
  },
  ordersPanel: {
    position: "absolute",
    top: 80,
    left: 16,
    width: 320,
    maxHeight: "70%",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  ordersPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ordersPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  liveIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  filtersContainer: {
    marginBottom: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderItem: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  orderItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderColorBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  orderShortId: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  orderItemInfo: {
    flex: 1,
  },
  orderBusinessName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  orderCustomerName: {
    fontSize: 12,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: "700",
  },
  orderItemStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timeEstimate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  flowIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  emptyOrders: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  legend: {
    position: "absolute",
    bottom: 20,
    right: 16,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    fontSize: 11,
  },
});
