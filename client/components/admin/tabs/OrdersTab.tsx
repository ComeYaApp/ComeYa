import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { AdminOrder } from "../types/admin.types";
import { useTheme } from "@/hooks/useTheme";

interface OrdersTabProps {
  orders: AdminOrder[];
  onOrderPress: (order: AdminOrder) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  onOrderPress,
}) => {
  const { theme } = useTheme();
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
      accepted: "Aceptado",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo",
      assigned_driver: "Repartidor asignado",
      picked_up: "Recogido",
      on_the_way: "En camino",
      in_transit: "En tránsito",
      arriving: "Llegando",
      delivered: "Entregado",
      cancelled: "Cancelado",
      refunded: "Reembolsado",
    };
    return labels[status] || status;
  };

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      stripe_card: "💳 Tarjeta",
      stripe_bizum: "📱 Bizum",
      bizum: "📱 Bizum",
      transferencia: "🏦 Transferencia",
      paypal: "🅿️ PayPal",
      cash: "💵 Efectivo",
    };
    return labels[method] || method || "—";
  };

  return (
    <ScrollView style={styles.container}>
      {orders.map((order) => (
        <TouchableOpacity
          key={order.id}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOrderPress(order);
          }}
        >
          <View style={styles.orderHeader}>
            <Text style={[styles.orderId, { color: theme.text }]}>
              #{order.id.slice(0, 8)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(order.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(order.status)}
              </Text>
            </View>
          </View>
          <Text style={[styles.businessName, { color: theme.text }]}>
            {order.businessName}
          </Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>
            Cliente: {order.customerName} · {getPaymentLabel(order.paymentMethod)}
          </Text>
          <Text style={styles.orderTotal}>
            Total: {(order.total / 100).toFixed(2)} €
          </Text>
          <Text style={[styles.orderDate, { color: theme.textSecondary }]}>
            {new Date(order.createdAt).toLocaleString("es-ES")}
          </Text>
          <View style={styles.tapHint}>
            <Feather name="edit-3" size={12} color={ComeYaColors.primary} />
            <Text style={[styles.tapHintText, { color: ComeYaColors.primary }]}>
              Toca para ver el detalle y actualizar el estado
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderId: { fontSize: 16, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  businessName: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  customerName: { fontSize: 14, marginBottom: 4 },
  orderTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: ComeYaColors.primary,
    marginBottom: 4,
  },
  orderDate: { fontSize: 12 },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  tapHintText: { fontSize: 11, fontWeight: "500" },
});
