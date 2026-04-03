import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function CashSettlementScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadPendingOrders = async () => {
    try {
      const response = await apiRequest("GET", "/api/cash-settlement/pending");
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
        
        // Calcular total correcto: business + platform por cada orden
        let totalAmount = 0;
        for (const order of data.orders || []) {
          const subtotal = order.subtotal;
          const platformFee = Math.round(subtotal * 0.15);
          const businessShare = subtotal;
          totalAmount += businessShare + platformFee;
        }
        setTotal(totalAmount);
      }
    } catch (error) {
      console.error("Error loading pending settlements:", error);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingOrders();
    setRefreshing(false);
  };

  const handleSettle = async (orderId: string, amount: number) => {
    try {
      console.log('🔵 Settling order:', orderId);
      const response = await apiRequest("POST", `/api/cash-settlement/settle/${orderId}`);
      console.log('🔵 Response status:', response.status);
      const data = await response.json();
      console.log('🔵 Settle response:', data);
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Liquidación registrada", "success");
        await loadPendingOrders();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch (error: any) {
      console.error('🔴 Settle error:', error);
      showToast(error.message || "Error", "error");
    }
  };

  const renderOrder = ({ item }: { item: any }) => {
    const items = typeof item.items === "string" ? JSON.parse(item.items) : item.items;
    
    // Calcular comisiones correctamente
    const subtotal = item.subtotal;
    const platformFee = Math.round(subtotal * 0.15); // 15% del subtotal
    const businessShare = subtotal; // 100% del subtotal
    const totalToReceive = businessShare + platformFee; // Lo que el negocio debe recibir del repartidor

    return (
      <View style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4">Pedido #{item.id.slice(-6)}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {new Date(item.deliveredAt).toLocaleDateString("es-VE")} -{" "}
              {new Date(item.deliveredAt).toLocaleTimeString("es-VE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
          </View>
          <Badge text="💵 Efectivo" variant="warning" />
        </View>

        <View style={styles.itemsList}>
          {Array.isArray(items) && items.slice(0, 2).map((orderItem: any, index: number) => (
            <ThemedText key={index} type="small" style={{ color: theme.textSecondary }}>
              {orderItem.quantity}x {orderItem.name || orderItem.product?.name}
            </ThemedText>
          ))}
          {items.length > 2 && (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              +{items.length - 2} más...
            </ThemedText>
          )}
        </View>

        <View style={styles.amounts}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Subtotal productos
            </ThemedText>
            <ThemedText type="body">${(item.subtotal / 100).toFixed(2)}</ThemedText>
          </View>
          <View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Comisión plataforma (15%)
            </ThemedText>
            <ThemedText type="body">${(platformFee / 100).toFixed(2)}</ThemedText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Total a recibir
            </ThemedText>
            <ThemedText type="h4" style={{ color: ComeYaColors.success }}>
              ${(totalToReceive / 100).toFixed(2)}
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={() => handleSettle(item.id, totalToReceive)}
          style={[styles.settleButton, { backgroundColor: ComeYaColors.success }]}
        >
          <Feather name="check-circle" size={18} color="#FFF" />
          <ThemedText type="small" style={{ color: "#FFF", marginLeft: Spacing.xs }}>
            Marcar como Recibido
          </ThemedText>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h2">Liquidaciones de Efectivo</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Registra cuando el repartidor te entregue el efectivo
        </ThemedText>
      </View>

      <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.md]}>
        <View style={{ flex: 1 }}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Total pendiente de recibir
          </ThemedText>
          <ThemedText type="h1" style={{ color: ComeYaColors.primary }}>
            ${(total / 100).toFixed(2)}
          </ThemedText>
        </View>
        <View style={[styles.countBadge, { backgroundColor: ComeYaColors.warning + "20" }]}>
          <ThemedText type="h3" style={{ color: ComeYaColors.warning }}>
            {orders.length}
          </ThemedText>
          <ThemedText type="caption" style={{ color: ComeYaColors.warning }}>
            pedidos
          </ThemedText>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item: any) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={64} color={ComeYaColors.success} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              ¡Todo liquidado!
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
            >
              No hay efectivo pendiente de recibir
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  countBadge: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    minWidth: 80,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  orderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  itemsList: {
    marginBottom: Spacing.md,
  },
  amounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: Spacing.sm,
  },
  settleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
});
