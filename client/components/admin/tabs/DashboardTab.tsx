import React from "react";
import { View, Text, ScrollView, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { DashboardMetrics, ActiveOrder, OnlineDriver, AdminStats } from "../types/admin.types";

interface DashboardTabProps {
  metrics: DashboardMetrics | null;
  activeOrders: ActiveOrder[];
  onlineDrivers: OnlineDriver[];
  stats?: AdminStats | null;
  onOrderPress?: (order: ActiveOrder) => void;
  onDriverPress?: (driver: OnlineDriver) => void;
  navigation?: any;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  metrics,
  activeOrders,
  onlineDrivers,
  stats,
  onOrderPress,
  onDriverPress,
  navigation,
}) => {
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "pendiente":
        return ComeYaColors.warning;
      case "confirmed":
      case "confirmado":
        return "#3498DB";
      case "preparing":
      case "preparando":
        return ComeYaColors.primary;
      case "ready":
      case "listo":
        return ComeYaColors.success;
      case "in_transit":
      case "en camino":
        return "#9B59B6";
      case "delivered":
      case "entregado":
        return ComeYaColors.success;
      default:
        return "#666";
    }
  };

  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo",
      in_transit: "En camino",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return statusMap[status?.toLowerCase()] || status;
  };

  const isDriverAvailable = (driver: OnlineDriver) => driver.activeOrder === null;
  const [showAllOrders, setShowAllOrders] = React.useState(false);
  const displayedOrders = showAllOrders ? activeOrders : activeOrders.slice(0, 5);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Métricas en Tiempo Real</Text>
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: theme.card }]}>
          <Text style={styles.metricValue}>{metrics?.ordersToday || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pedidos hoy</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.metricValue, { color: ComeYaColors.error }]}>
            {metrics?.cancelledToday || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Cancelados</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card }]}>
          <Text style={styles.metricValue}>{metrics?.avgDeliveryTime || 35}m</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Tiempo prom.</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.metricValue, { color: ComeYaColors.success }]}>
            {metrics?.driversOnline || 0}/{metrics?.totalDrivers || 1}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Repartidores</Text>
        </View>
      </View>

      <View style={styles.secondaryMetricsGrid}>
        <View style={[styles.metricCard, styles.secondaryMetric, { backgroundColor: theme.card }]}>
          <Feather name="package" size={20} color={ComeYaColors.primary} />
          <Text style={[styles.secondaryValue, { color: theme.text }]}>{activeOrders.length}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pedidos activos</Text>
        </View>
        <View style={[styles.metricCard, styles.secondaryMetric, { backgroundColor: theme.card }]}>
          <Feather name="pause-circle" size={20} color={ComeYaColors.warning} />
          <Text style={[styles.secondaryValue, { color: theme.text }]}>{metrics?.pausedBusinesses || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pausados</Text>
        </View>
      </View>

      <View style={styles.mapSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Mapa en tiempo real</Text>
        <TouchableOpacity 
          style={[styles.mapPlaceholder, { backgroundColor: theme.card }]}
          onPress={() => navigation?.navigate?.("MapView")}
          activeOpacity={0.7}
        >
          <Feather name="map" size={48} color={ComeYaColors.primary} />
          <Text style={[styles.mapText, { color: theme.text, fontWeight: "600" }]}>
            Ver mapa de negocios
          </Text>
          <Text style={[styles.mapSubtext, { color: theme.textSecondary }]}>
            {onlineDrivers.length} repartidores | {activeOrders.length} pedidos activos
          </Text>
        </TouchableOpacity>
      </View>

      {stats ? (
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Resumen General</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="users" size={24} color={ComeYaColors.primary} />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalUsers}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Usuarios</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="shopping-bag" size={24} color="#3498DB" />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalOrders}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pedidos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="dollar-sign" size={24} color={ComeYaColors.success} />
              <Text style={[styles.statValue, { color: theme.text }]}>€{(stats.totalRevenue / 100).toFixed(0)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ingresos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Feather name="clock" size={24} color={ComeYaColors.warning} />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.pendingOrders}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pendientes</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: Spacing.lg, color: theme.text }]}>Usuarios por rol</Text>
          <View style={styles.rolesGrid}>
            <View key="customers" style={[styles.roleCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>Clientes</Text>
              <Text style={styles.roleValue}>{stats.usersByRole.customers}</Text>
            </View>
            <View key="businesses" style={[styles.roleCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>Negocios</Text>
              <Text style={styles.roleValue}>{stats.usersByRole.businesses}</Text>
            </View>
            <View key="delivery" style={[styles.roleCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>Repartidores</Text>
              <Text style={styles.roleValue}>{stats.usersByRole.delivery}</Text>
            </View>
            <View key="admins" style={[styles.roleCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>Admins</Text>
              <Text style={styles.roleValue}>{stats.usersByRole.admins}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Pedidos activos hoy ({activeOrders.length})</Text>
          {activeOrders.length > 5 ? (
            <TouchableOpacity onPress={() => setShowAllOrders((prev) => !prev)}>
              <Text style={styles.linkText}>{showAllOrders ? "Ver menos" : "Ver todos"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {activeOrders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Feather name="inbox" size={32} color="#ccc" />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay pedidos activos</Text>
          </View>
        ) : (
          displayedOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderCard, { backgroundColor: theme.card }]}
              activeOpacity={0.8}
              onPress={() => onOrderPress?.(order)}
            >
              <View style={styles.orderHeader}>
                <View style={styles.orderInfo}>
                  <Text style={[styles.orderCustomer, { color: theme.text }]}>{order.customer?.name || "Cliente"}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + "20" }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                      {translateStatus(order.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderTotal}>€{((order.total || 0) / 100).toFixed(2)}</Text>
              </View>
              <Text style={[styles.orderAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                {order.deliveryAddress?.address || "Sin dirección"}
              </Text>
              <Text style={styles.orderDriver}>
                {order.driver?.name || "Sin asignar"}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Repartidores Online ({onlineDrivers.length})</Text>
        {onlineDrivers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Feather name="truck" size={32} color="#ccc" />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay repartidores online</Text>
          </View>
        ) : (
          onlineDrivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              style={[styles.driverCard, { backgroundColor: theme.card }]}
              activeOpacity={0.8}
              onPress={() => onDriverPress?.(driver)}
            >
              <View style={styles.driverInfo}>
                <View style={[styles.driverAvatar, { backgroundColor: ComeYaColors.primaryLight }]}>
                  <Feather name="user" size={16} color={ComeYaColors.primary} />
                </View>
                <Text style={[styles.driverName, { color: theme.text }]}>{driver.name}</Text>
              </View>
              <View style={[
                styles.availabilityBadge, 
                { backgroundColor: isDriverAvailable(driver) ? ComeYaColors.success + "20" : ComeYaColors.warning + "20" }
              ]}>
                <View style={[
                  styles.availabilityDot,
                  { backgroundColor: isDriverAvailable(driver) ? ComeYaColors.success : ComeYaColors.warning }
                ]} />
                <Text style={[
                  styles.availabilityText,
                  { color: isDriverAvailable(driver) ? ComeYaColors.success : ComeYaColors.warning }
                ]}>
                  {isDriverAvailable(driver) ? "Disponible" : "Ocupado"}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  linkText: {
    color: ComeYaColors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "22%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: ComeYaColors.primary,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  secondaryMetricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  secondaryMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  mapSection: {
    marginBottom: 16,
  },
  mapPlaceholder: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  mapText: {
    fontSize: 14,
    marginTop: 12,
  },
  mapSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  statsSection: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "22%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
  },
  rolesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleCard: {
    flex: 1,
    minWidth: "22%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  roleLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  roleValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: ComeYaColors.primary,
  },
  section: {
    marginBottom: 16,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  orderCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  orderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderCustomer: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: ComeYaColors.primary,
  },
  orderAddress: {
    fontSize: 12,
    marginBottom: 4,
  },
  orderDriver: {
    fontSize: 12,
    color: ComeYaColors.primary,
    fontWeight: "500",
  },
  driverCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
