import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";
import MapView, { Marker, Polyline } from "react-native-maps";

interface DeliveryOrder {
  id: string;
  customerName: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  estimatedTime: number;
  priority: "high" | "medium" | "low";
  value: number;
  distance: number;
  status: "pending" | "picked_up" | "delivered";
}

interface RouteOptimization {
  totalDistance: number;
  totalTime: number;
  estimatedEarnings: number;
  fuelCost: number;
  netProfit: number;
  orders: DeliveryOrder[];
  route: {
    latitude: number;
    longitude: number;
  }[];
}

export default function RouteOptimizationScreen() {
  const { user } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [optimizedRoute, setOptimizedRoute] =
    useState<RouteOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "route" | "settings">(
    "orders",
  );

  // Settings
  const [maxOrders, setMaxOrders] = useState(4);
  const [maxDistance, setMaxDistance] = useState(15);
  const [prioritizeEarnings, setPrioritizeEarnings] = useState(true);
  const [avoidTraffic, setAvoidTraffic] = useState(true);

  const driverLocation = {
    latitude: 41.7636,
    longitude: -2.4677,
  };

  useEffect(() => {
    loadAvailableOrders();
  }, []);

  const loadAvailableOrders = async () => {
    setLoading(true);
    try {
      const mockOrders: DeliveryOrder[] = [
        {
          id: "1",
          customerName: "Maria Garcia",
          address: "Calle Collado 12, Centro",
          coordinates: { latitude: 41.765, longitude: -2.465 },
          estimatedTime: 15,
          priority: "high",
          value: 1500,
          distance: 1.2,
          status: "pending",
        },
        {
          id: "2",
          customerName: "Carlos Lopez",
          address: "Av. Valladolid 45, Norte",
          coordinates: { latitude: 41.77, longitude: -2.46 },
          estimatedTime: 20,
          priority: "medium",
          value: 2200,
          distance: 2.1,
          status: "pending",
        },
        {
          id: "3",
          customerName: "Ana Martinez",
          address: "Calle Real 8, Sur",
          coordinates: { latitude: 41.758, longitude: -2.472 },
          estimatedTime: 18,
          priority: "high",
          value: 1800,
          distance: 1.8,
          status: "pending",
        },
      ];
      setAvailableOrders(mockOrders);
    } catch (error) {
      console.error("Error loading orders:", error);
      Alert.alert("Error", "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else if (prev.length < maxOrders) {
        return [...prev, orderId];
      } else {
        Alert.alert(
          "Límite alcanzado",
          `Solo puedes seleccionar ${maxOrders} pedidos máximo`,
        );
        return prev;
      }
    });
  };

  const optimizeRoute = async () => {
    if (selectedOrders.length === 0) {
      Alert.alert("Error", "Selecciona al menos un pedido");
      return;
    }

    try {
      const selectedOrdersData = availableOrders.filter((order) =>
        selectedOrders.includes(order.id),
      );

      // Simple optimization algorithm (in real app, use Google Maps API or similar)
      const optimized = optimizeDeliveryRoute(
        selectedOrdersData,
        driverLocation,
      );
      setOptimizedRoute(optimized);
      setActiveTab("route");
    } catch (error) {
      console.error("Error optimizing route:", error);
      Alert.alert("Error", "No se pudo optimizar la ruta");
    }
  };

  const optimizeDeliveryRoute = (
    orders: DeliveryOrder[],
    startLocation: any,
  ): RouteOptimization => {
    // Simple nearest neighbor algorithm
    let currentLocation = startLocation;
    let optimizedOrders: DeliveryOrder[] = [];
    let remainingOrders = [...orders];
    let totalDistance = 0;
    let totalTime = 0;
    let route = [startLocation];

    while (remainingOrders.length > 0) {
      // Find nearest order
      let nearestOrder = remainingOrders[0];
      let nearestDistance = calculateDistance(
        currentLocation,
        nearestOrder.coordinates,
      );
      let nearestIndex = 0;

      for (let i = 1; i < remainingOrders.length; i++) {
        const distance = calculateDistance(
          currentLocation,
          remainingOrders[i].coordinates,
        );
        if (distance < nearestDistance) {
          nearestOrder = remainingOrders[i];
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      optimizedOrders.push(nearestOrder);
      route.push(nearestOrder.coordinates);
      totalDistance += nearestDistance;
      totalTime += nearestOrder.estimatedTime + (nearestDistance / 30) * 60; // Assuming 30 km/h average speed
      currentLocation = nearestOrder.coordinates;
      remainingOrders.splice(nearestIndex, 1);
    }

    const estimatedEarnings = optimizedOrders.reduce(
      (sum, order) => sum + order.value * 0.15,
      0,
    );
    const fuelCost = totalDistance * 8; // $8 per km
    const netProfit = estimatedEarnings - fuelCost;

    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime: Math.round(totalTime),
      estimatedEarnings: Math.round(estimatedEarnings),
      fuelCost: Math.round(fuelCost),
      netProfit: Math.round(netProfit),
      orders: optimizedOrders,
      route,
    };
  };

  const calculateDistance = (point1: any, point2: any): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const acceptOptimizedRoute = async () => {
    if (!optimizedRoute) return;

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/driver/accept-route`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            orderIds: optimizedRoute.orders.map((o) => o.id),
            route: optimizedRoute.route,
          }),
        },
      );

      if (response.ok) {
        Alert.alert("Éxito", "Ruta aceptada. ¡Comienza las entregas!");
        // Navigate to delivery screen
      } else {
        throw new Error("Error accepting route");
      }
    } catch (error) {
      console.error("Error accepting route:", error);
      Alert.alert("Error", "No se pudo aceptar la ruta");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount / 100);
  };

  const renderOrders = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Pedidos Disponibles ({availableOrders.length})
        </Text>
        <Text style={styles.sectionSubtitle}>
          Selecciona hasta {maxOrders} pedidos para optimizar tu ruta
        </Text>

        {availableOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[
              styles.orderCard,
              selectedOrders.includes(order.id) && styles.selectedOrderCard,
            ]}
            onPress={() => toggleOrderSelection(order.id)}
          >
            <View style={styles.orderHeader}>
              <View style={styles.orderInfo}>
                <Text style={styles.customerName}>{order.customerName}</Text>
                <Text style={styles.orderAddress}>{order.address}</Text>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderValue}>
                  {formatCurrency(order.value)}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    styles[
                      `priority${order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}`
                    ],
                  ]}
                >
                  <Text style={styles.priorityText}>
                    {order.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.orderDetails}>
              <Text style={styles.orderDetailText}>📍 {order.distance} km</Text>
              <Text style={styles.orderDetailText}>
                ⏱️ {order.estimatedTime} min
              </Text>
              <Text style={styles.orderDetailText}>
                💰 {formatCurrency(order.value * 0.15)} ganancia
              </Text>
            </View>

            {selectedOrders.includes(order.id) && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedText}>✓ Seleccionado</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.selectionSummary}>
          <Text style={styles.summaryText}>
            {selectedOrders.length} de {maxOrders} pedidos seleccionados
          </Text>
          <TouchableOpacity
            style={[
              styles.optimizeButton,
              selectedOrders.length === 0 && styles.optimizeButtonDisabled,
            ]}
            onPress={optimizeRoute}
            disabled={selectedOrders.length === 0}
          >
            <Text style={styles.optimizeButtonText}>Optimizar Ruta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderRoute = () => (
    <ScrollView>
      {optimizedRoute ? (
        <>
          <View style={styles.routeStats}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {optimizedRoute.totalDistance} km
              </Text>
              <Text style={styles.statLabel}>Distancia Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Math.round(optimizedRoute.totalTime / 60)} h
              </Text>
              <Text style={styles.statLabel}>Tiempo Estimado</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatCurrency(optimizedRoute.estimatedEarnings)}
              </Text>
              <Text style={styles.statLabel}>Ganancias</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatCurrency(optimizedRoute.netProfit)}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: optimizedRoute.netProfit > 0 ? "green" : "red" },
                ]}
              >
                Ganancia Neta
              </Text>
            </View>
          </View>

          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker
                coordinate={driverLocation}
                title="Tu ubicación"
                pinColor="blue"
              />

              {optimizedRoute.orders.map((order, index) => (
                <Marker
                  key={order.id}
                  coordinate={order.coordinates}
                  title={`${index + 1}. ${order.customerName}`}
                  description={order.address}
                  pinColor={
                    order.priority === "high"
                      ? "red"
                      : order.priority === "medium"
                        ? "orange"
                        : "green"
                  }
                />
              ))}

              <Polyline
                coordinates={optimizedRoute.route}
                strokeColor={Colors.light.tint}
                strokeWidth={3}
              />
            </MapView>
          </View>

          <View style={styles.routeList}>
            <Text style={styles.routeListTitle}>Orden de Entregas</Text>
            {optimizedRoute.orders.map((order, index) => (
              <View key={order.id} style={styles.routeItem}>
                <View style={styles.routeNumber}>
                  <Text style={styles.routeNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.routeItemInfo}>
                  <Text style={styles.routeItemName}>{order.customerName}</Text>
                  <Text style={styles.routeItemAddress}>{order.address}</Text>
                  <Text style={styles.routeItemMeta}>
                    {order.distance} km • {order.estimatedTime} min •{" "}
                    {formatCurrency(order.value)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={acceptOptimizedRoute}
          >
            <Text style={styles.acceptButtonText}>Aceptar Ruta y Comenzar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.noRoute}>
          <Text style={styles.noRouteText}>No hay ruta optimizada</Text>
          <Text style={styles.noRouteSubtext}>
            Selecciona pedidos y optimiza tu ruta primero
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración de Rutas</Text>

        <View style={styles.settingCard}>
          <Text style={styles.settingTitle}>Máximo de Pedidos Simultáneos</Text>
          <View style={styles.settingOptions}>
            {[2, 3, 4, 5].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.settingOption,
                  maxOrders === num && styles.settingOptionActive,
                ]}
                onPress={() => setMaxOrders(num)}
              >
                <Text
                  style={[
                    styles.settingOptionText,
                    maxOrders === num && styles.settingOptionTextActive,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingCard}>
          <Text style={styles.settingTitle}>Distancia Máxima (km)</Text>
          <View style={styles.settingOptions}>
            {[10, 15, 20, 25].map((dist) => (
              <TouchableOpacity
                key={dist}
                style={[
                  styles.settingOption,
                  maxDistance === dist && styles.settingOptionActive,
                ]}
                onPress={() => setMaxDistance(dist)}
              >
                <Text
                  style={[
                    styles.settingOptionText,
                    maxDistance === dist && styles.settingOptionTextActive,
                  ]}
                >
                  {dist}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingToggle}>
            <Text style={styles.settingTitle}>Priorizar Ganancias</Text>
            <Switch
              value={prioritizeEarnings}
              onValueChange={setPrioritizeEarnings}
              trackColor={{
                false: Colors.light.tabIconDefault,
                true: Colors.light.tint,
              }}
            />
          </View>
          <Text style={styles.settingDescription}>
            Optimizar rutas basándose en las ganancias en lugar de la distancia
          </Text>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingToggle}>
            <Text style={styles.settingTitle}>Evitar Tráfico</Text>
            <Switch
              value={avoidTraffic}
              onValueChange={setAvoidTraffic}
              trackColor={{
                false: Colors.light.tabIconDefault,
                true: Colors.light.tint,
              }}
            />
          </View>
          <Text style={styles.settingDescription}>
            Usar datos de tráfico en tiempo real para optimizar rutas
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando pedidos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Optimización de Rutas</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "orders", label: "Pedidos" },
          { key: "route", label: "Ruta" },
          { key: "settings", label: "Config" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === "orders" && renderOrders()}
        {activeTab === "route" && renderRoute()}
        {activeTab === "settings" && renderSettings()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    textAlign: "center",
    paddingVertical: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    fontWeight: "500",
  },
  activeTabText: {
    color: "white",
    fontWeight: "600",
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 20,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedOrderCard: {
    borderColor: Colors.light.tint,
    backgroundColor: "#f8f9ff",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  orderAddress: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  orderMeta: {
    alignItems: "flex-end",
  },
  orderValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityHigh: {
    backgroundColor: "#ffebee",
  },
  priorityMedium: {
    backgroundColor: "#fff3e0",
  },
  priorityLow: {
    backgroundColor: "#e8f5e8",
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.text,
  },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderDetailText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  selectedIndicator: {
    marginTop: 8,
    alignItems: "center",
  },
  selectedText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  selectionSummary: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: "center",
  },
  summaryText: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 12,
  },
  optimizeButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  optimizeButtonDisabled: {
    backgroundColor: Colors.light.tabIconDefault,
  },
  optimizeButtonText: {
    color: "white",
    fontWeight: "600",
  },
  routeStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  routeList: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  routeListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  routeNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  routeNumberText: {
    color: "white",
    fontWeight: "bold",
  },
  routeItemInfo: {
    flex: 1,
  },
  routeItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  routeItemAddress: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  routeItemMeta: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  acceptButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  acceptButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  noRoute: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noRouteText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  noRouteSubtext: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  settingCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  settingOptions: {
    flexDirection: "row",
    gap: 8,
  },
  settingOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
  },
  settingOptionActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  settingOptionText: {
    color: Colors.light.text,
  },
  settingOptionTextActive: {
    color: "white",
  },
  settingToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
