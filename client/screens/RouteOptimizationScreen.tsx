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
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SmartMarker } from "@/components/map/SmartMarker";
import { DriverPin } from "@/components/map/DriverPin";
import { NumberPin } from "@/components/map/NumberPin";
import { apiRequest } from "@/lib/query-client";

interface AvailableOrder {
  id: string;
  businessName: string;
  address: string;
  fee: number;
  paymentMethod: string;
  itemsCount: number;
  businessLatitude: number;
  businessLongitude: number;
}

interface RouteNode {
  id: string;
  kind: "start" | "pickup" | "drop";
  orderId?: string;
  lat: number;
  lng: number;
  label: string;
  fee: number;
  paymentMethod: string | null;
  address?: string;
}

interface OptimizedRoute {
  nodes: RouteNode[];
  legs: {
    from: string;
    to: string;
    distanceMeters: number;
    durationMinutes: number;
  }[];
  totalDistanceKm: string;
  totalDurationMinutes: number;
  totalEarnings: number;
}

export default function RouteOptimizationScreen({ navigation }: any) {
  const { user } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "route" | "settings">(
    "orders",
  );

  // Settings (máximo de pedidos por ruta)
  const [maxOrders, setMaxOrders] = useState(4);

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
      const response = await apiRequest(
        "GET",
        "/api/delivery/available-orders",
      );
      const data = await response.json();
      const orders: AvailableOrder[] = (data.orders || []).map((o: any) => {
        let address = o.businessAddress || o.businessName || "";
        try {
          const parsed =
            typeof o.deliveryAddress === "string"
              ? JSON.parse(o.deliveryAddress)
              : o.deliveryAddress;
          if (parsed?.street) {
            address = `${parsed.street}${
              parsed.city ? `, ${parsed.city}` : ""
            }`;
          }
        } catch {}
        let itemsCount = 0;
        try {
          const items =
            typeof o.items === "string" ? JSON.parse(o.items) : o.items;
          itemsCount = Array.isArray(items) ? items.length : 0;
        } catch {}
        return {
          id: o.id,
          businessName: o.businessName || "Negocio",
          address,
          fee: Number(o.deliveryFee) || 0,
          paymentMethod: o.paymentMethod || "digital",
          itemsCount,
          businessLatitude: o.businessLatitude
            ? parseFloat(o.businessLatitude)
            : 0,
          businessLongitude: o.businessLongitude
            ? parseFloat(o.businessLongitude)
            : 0,
        };
      });
      setAvailableOrders(orders);
    } catch (error) {
      console.error("Error loading orders:", error);
      Alert.alert("Error", "No se pudieron cargar los pedidos disponibles");
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
    setOptimizing(true);
    try {
      const response = await apiRequest("POST", "/api/driver/route/optimize", {
        orderIds: selectedOrders,
      });
      const data = await response.json();
      if (data.success && data.route) {
        setOptimizedRoute(data.route);
        setActiveTab("route");
      } else {
        throw new Error(data.error || "Error optimizando ruta");
      }
    } catch (error: any) {
      console.error("Error optimizing route:", error);
      Alert.alert(
        "Error",
        error?.message || "No se pudo optimizar la ruta",
      );
    } finally {
      setOptimizing(false);
    }
  };

  const acceptOptimizedRoute = async () => {
    if (!optimizedRoute) return;
    setAccepting(true);
    try {
      const orderIds = optimizedRoute.nodes
        .filter((n) => n.orderId)
        .map((n) => n.orderId!);
      const response = await apiRequest("POST", "/api/driver/accept-route", {
        orderIds,
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert(
          "Ruta aceptada 🎉",
          `${data.assigned?.length ?? orderIds.length} pedidos asignados a tu ruta. Ve a "Mi Mapa" para empezar las recogidas.`,
          [
            {
              text: "Ir a Mi Mapa",
              onPress: () => navigation?.goBack?.(),
            },
          ],
        );
        setSelectedOrders([]);
        setOptimizedRoute(null);
        setActiveTab("orders");
        loadAvailableOrders();
      } else {
        throw new Error(data.error || "Error aceptando ruta");
      }
    } catch (error: any) {
      console.error("Error accepting route:", error);
      Alert.alert(
        "Error",
        error?.message || "No se pudo aceptar la ruta",
      );
    } finally {
      setAccepting(false);
    }
  };

  const formatEuro = (amount: number) => {
    // deliveryFee viene en centavos desde la API
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format((Number(amount) || 0) / 100);
  };

  const routeCoordinates = optimizedRoute
    ? optimizedRoute.nodes.map((n) => ({ latitude: n.lat, longitude: n.lng }))
    : [];

  const renderOrders = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Pedidos Disponibles ({availableOrders.length})
        </Text>
        <Text style={styles.sectionSubtitle}>
          Selecciona hasta {maxOrders} pedidos para optimizar tu ruta
        </Text>

        {availableOrders.length === 0 && (
          <Text style={styles.noRouteText}>
            No hay pedidos listos para recoger ahora mismo
          </Text>
        )}

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
                <Text style={styles.customerName}>{order.businessName}</Text>
                <Text style={styles.orderAddress}>{order.address}</Text>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderValue}>{formatEuro(order.fee)}</Text>
                <View style={[styles.priorityBadge, styles.priorityHigh]}>
                  <Text style={styles.priorityText}>
                    {order.itemsCount} prod.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.orderDetails}>
              <Text style={styles.orderDetailText}>🏪 Recoger en local</Text>
              <Text style={styles.orderDetailText}>
                💰 {formatEuro(order.fee)} ganancia
              </Text>
              <Text style={styles.orderDetailText}>
                💳{" "}
                {order.paymentMethod === "cash"
                  ? "Cobrar en efectivo"
                  : "Pagado digitalmente"}
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
              (selectedOrders.length === 0 || optimizing) &&
                styles.optimizeButtonDisabled,
            ]}
            onPress={optimizeRoute}
            disabled={selectedOrders.length === 0 || optimizing}
          >
            <Text style={styles.optimizeButtonText}>
              {optimizing ? "Optimizando..." : "Optimizar Ruta"}
            </Text>
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
                {optimizedRoute.totalDistanceKm} km
              </Text>
              <Text style={styles.statLabel}>Distancia Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Math.round(optimizedRoute.totalDurationMinutes)} min
              </Text>
              <Text style={styles.statLabel}>Tiempo Estimado</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatEuro(optimizedRoute.totalEarnings)}
              </Text>
              <Text style={styles.statLabel}>Ganancias</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {optimizedRoute.nodes.filter((n) => n.orderId).length}
              </Text>
              <Text style={styles.statLabel}>Pedidos</Text>
            </View>
          </View>

          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: optimizedRoute.nodes[0]?.lat ?? 41.7636,
                longitude: optimizedRoute.nodes[0]?.lng ?? -2.4677,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <SmartMarker
                coordinate={driverLocation}
                title="Tu ubicación"
                anchor={{ x: 0.5, y: 0.5 }}
                trackKey="me"
              >
                <DriverPin
                  vehicleIcon="navigation"
                  color={Colors.light.tint}
                  size={38}
                  showBadge={false}
                />
              </SmartMarker>

              {optimizedRoute.nodes
                .filter((n) => n.kind !== "start")
                .map((node, index) => {
                  const stopColor =
                    node.kind === "pickup" ? "#F59E0B" : "#DC2626";
                  return (
                    <SmartMarker
                      key={node.id}
                      coordinate={{ latitude: node.lat, longitude: node.lng }}
                      title={`${index + 1}. ${node.label}`}
                      anchor={{ x: 0.5, y: 1 }}
                      trackKey={`stop_${node.id}_${node.kind}`}
                    >
                      <NumberPin label={index + 1} color={stopColor} />
                    </SmartMarker>
                  );
                })}

              <Polyline
                coordinates={routeCoordinates}
                strokeColor={Colors.light.tint}
                strokeWidth={3}
              />
            </MapView>
          </View>

          <View style={styles.routeList}>
            <Text style={styles.routeListTitle}>Orden de la Ruta</Text>
            {optimizedRoute.nodes
              .filter((n) => n.kind !== "start")
              .map((node, index) => (
                <View key={node.id} style={styles.routeItem}>
                  <View style={styles.routeNumber}>
                    <Text style={styles.routeNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.routeItemInfo}>
                    <Text style={styles.routeItemName}>{node.label}</Text>
                    <Text style={styles.routeItemAddress}>
                      {node.kind === "pickup"
                        ? "Recogida en el negocio"
                        : node.address || "Entrega al cliente"}
                    </Text>
                    <Text style={styles.routeItemMeta}>
                      {formatEuro(node.fee || 0)} •{" "}
                      {node.paymentMethod === "cash"
                        ? "Efectivo"
                        : "Pagado digital"}
                    </Text>
                  </View>
                </View>
              ))}
          </View>

          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.optimizeButtonDisabled]}
            onPress={acceptOptimizedRoute}
            disabled={accepting}
          >
            <Text style={styles.acceptButtonText}>
              {accepting ? "Aceptando..." : "Aceptar Ruta y Comenzar"}
            </Text>
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

        <Text style={styles.sectionSubtitle}>
          La optimización usa distancias y tiempos reales por calles (Google
          Maps vía el servidor) y prioriza la ruta más corta respetando
          recoger antes de entregar cada pedido.
        </Text>
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
