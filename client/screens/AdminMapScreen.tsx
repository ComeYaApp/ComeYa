import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function AdminMapScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "orders" | "drivers">("all");

  const load = async () => {
    try {
      const [ordersRes, driversRes] = await Promise.all([
        apiRequest("GET", "/api/admin/dashboard/active-orders"),
        apiRequest("GET", "/api/admin/dashboard/online-drivers"),
      ]);

      const [ordersData, driversData] = await Promise.all([
        ordersRes.json(),
        driversRes.json(),
      ]);

      if (ordersData.orders) setActiveOrders(ordersData.orders);
      if (driversData.drivers) setDrivers(driversData.drivers);
    } catch (error) {
      console.error("Error loading map data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // Actualizar cada 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 7.7695,
          longitude: -72.2254,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Pedidos activos */}
        {(filter === "all" || filter === "orders") &&
          activeOrders.map((order) => {
            if (!order.deliveryAddress?.latitude) return null;
            return (
              <Marker
                key={order.id}
                coordinate={{
                  latitude: parseFloat(order.deliveryAddress.latitude),
                  longitude: parseFloat(order.deliveryAddress.longitude),
                }}
                title={`Pedido #${order.id.slice(-6)}`}
                description={`${order.customer?.name || "Cliente"} - ${order.status}`}
              >
                <View style={[s.marker, { backgroundColor: ComeYaColors.primary }]}>
                  <Feather name="shopping-bag" size={16} color="#FFF" />
                </View>
              </Marker>
            );
          })}

        {/* Repartidores online */}
        {(filter === "all" || filter === "drivers") &&
          drivers.map((driver) => {
            if (!driver.location?.latitude) return null;
            return (
              <Marker
                key={driver.id}
                coordinate={{
                  latitude: parseFloat(driver.location.latitude),
                  longitude: parseFloat(driver.location.longitude),
                }}
                title={driver.name}
                description={driver.isOnline ? "En línea" : "Offline"}
              >
                <View
                  style={[
                    s.marker,
                    {
                      backgroundColor: driver.isOnline
                        ? ComeYaColors.success
                        : ComeYaColors.textSecondary,
                    },
                  ]}
                >
                  <Feather name="truck" size={16} color="#FFF" />
                </View>
              </Marker>
            );
          })}
      </MapView>

      {/* Filter buttons */}
      <View style={[s.filterBar, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[
            s.filterBtn,
            filter === "all" && { backgroundColor: ComeYaColors.primary },
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              s.filterText,
              { color: filter === "all" ? "#FFF" : theme.text },
            ]}
          >
            Todo ({activeOrders.length + drivers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.filterBtn,
            filter === "orders" && { backgroundColor: ComeYaColors.primary },
          ]}
          onPress={() => setFilter("orders")}
        >
          <Feather
            name="shopping-bag"
            size={16}
            color={filter === "orders" ? "#FFF" : theme.text}
          />
          <Text
            style={[
              s.filterText,
              { color: filter === "orders" ? "#FFF" : theme.text },
            ]}
          >
            Pedidos ({activeOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.filterBtn,
            filter === "drivers" && { backgroundColor: ComeYaColors.primary },
          ]}
          onPress={() => setFilter("drivers")}
        >
          <Feather
            name="truck"
            size={16}
            color={filter === "drivers" ? "#FFF" : theme.text}
          />
          <Text
            style={[
              s.filterText,
              { color: filter === "drivers" ? "#FFF" : theme.text },
            ]}
          >
            Repartidores ({drivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats overlay */}
      <View style={[s.statsOverlay, { backgroundColor: theme.card }]}>
        <View style={s.statItem}>
          <Feather name="activity" size={20} color={ComeYaColors.primary} />
          <Text style={[s.statValue, { color: theme.text }]}>
            {activeOrders.length}
          </Text>
          <Text style={[s.statLabel, { color: theme.textSecondary }]}>
            Activos
          </Text>
        </View>
        <View style={s.statItem}>
          <Feather name="truck" size={20} color={ComeYaColors.success} />
          <Text style={[s.statValue, { color: theme.text }]}>
            {drivers.filter((d) => d.isOnline).length}
          </Text>
          <Text style={[s.statLabel, { color: theme.textSecondary }]}>
            Online
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  filterBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 10,
    borderRadius: 8,
  },
  filterText: { fontSize: 12, fontWeight: "600" },
  statsOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: { alignItems: "center", gap: 4 },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 11 },
});
