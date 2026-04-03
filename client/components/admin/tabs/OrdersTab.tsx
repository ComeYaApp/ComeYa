import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { ComeYaColors } from "../../../constants/theme";
import { AdminOrder } from "../types/admin.types";

interface OrdersTabProps {
  orders: AdminOrder[];
  onOrderPress: (order: AdminOrder) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ orders, onOrderPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "confirmed":
        return "#3b82f6";
      case "preparing":
        return "#8b5cf6";
      case "ready":
        return "#10b981";
      case "picked_up":
        return "#06b6d4";
      case "delivered":
        return "#22c55e";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo",
      picked_up: "En camino",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  return (
    <ScrollView style={styles.container}>
      {orders.map((order) => (
        <TouchableOpacity
          key={order.id}
          style={styles.card}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOrderPress(order);
          }}
        >
          <View style={styles.orderHeader}>
            <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(order.status) },
              ]}
            >
              <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
            </View>
          </View>
          <Text style={styles.businessName}>{order.businessName}</Text>
          <Text style={styles.customerName}>Cliente: {order.customerName}</Text>
          <Text style={styles.orderTotal}>
            Total: ${(order.total / 100).toFixed(2)}
          </Text>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleString("es-VE")}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  businessName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: ComeYaColors.primary,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: "#666666",
  },
});
