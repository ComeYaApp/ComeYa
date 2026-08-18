import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Period = "week" | "month" | "all";

interface Transaction {
  id: string;
  orderId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  paymentMethod: string | null;
  deliveryAddress: { street?: string; reference?: string } | null;
  notes: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
}

interface Payout {
  id: string;
  orderId: string;
  amount: number;
  method: string | null;
  status: "pending" | "paid" | "stripe_auto" | "cancelled";
  createdAt: string;
  paidAt?: string;
  notes?: string | null;
  proofUrl?: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pago_movil: "📱 Bizum",
  binance_pay: "🏦 Transferencia (SEPA)",
  zinli: "🅿️ PayPal",
  zelle: "💳 Tarjeta",
  cash: "💵 Efectivo",
  bizum: "📱 Bizum",
  transferencia: "🏦 Transferencia (SEPA)",
  paypal: "🅿️ PayPal",
  bank_transfer: "🏦 Transferencia (SEPA)",
  stripe: "💳 Stripe (automático)",
  stripe_card: "💳 Tarjeta",
  stripe_bizum: "📱 Bizum",
  manual: "👤 Pago manual del admin",
  stripe_failed_manual: "💳 Stripe fallido → manual",
};

const PAYOUT_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "Pendiente de pago", color: ComeYaColors.warning },
  paid: { text: "Pagado", color: ComeYaColors.success },
  stripe_auto: { text: "Pagado (Stripe)", color: ComeYaColors.success },
  cancelled: { text: "Cancelado", color: ComeYaColors.error },
};

export default function BusinessFinancesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { selectedBusiness } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    pendingAmount: 0,
    completedAmount: 0,
    transactionCount: 0,
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const loadFinances = async () => {
    try {
      const bId = selectedBusiness?.id;
      const url = bId
        ? `/api/business/finances?businessId=${bId}&period=${selectedPeriod}`
        : `/api/business/finances?period=${selectedPeriod}`;
      const payoutsUrl = bId
        ? `/api/business/payouts?businessId=${bId}`
        : `/api/business/payouts`;

      const [finRes, payRes] = await Promise.all([
        apiRequest("GET", url),
        apiRequest("GET", payoutsUrl),
      ]);
      const [finData, payData] = await Promise.all([
        finRes.json(),
        payRes.json(),
      ]);

      if (finData.success) {
        setTransactions(finData.transactions || []);
        setSummary(
          finData.summary || {
            totalEarnings: 0,
            pendingAmount: 0,
            completedAmount: 0,
            transactionCount: 0,
          },
        );
      }
      if (payData.success) setPayouts(payData.payouts || []);
    } catch (error) {
      console.error("Error loading finances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, [selectedBusiness?.id, selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFinances();
    setRefreshing(false);
  };

  const periodLabels: Record<Period, string> = {
    week: "Esta semana",
    month: "Este mes",
    all: "Todo el tiempo",
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return ComeYaColors.success;
      case "pending":
      case "accepted":
      case "preparing":
      case "on_the_way":
        return ComeYaColors.warning;
      case "cancelled":
        return ComeYaColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      accepted: "Aceptado",
      preparing: "Preparando",
      on_the_way: "En camino",
      delivered: "Completado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const formatAddress = (addr: Transaction["deliveryAddress"]) => {
    if (!addr) return null;
    const parts = [addr.street, addr.reference].filter(Boolean);
    return parts.join(" · ") || null;
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[
          theme.gradientStart || "#FFFFFF",
          theme.gradientEnd || "#F5F5F5",
        ]}
        style={styles.container}
      >
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md }}>
            Cargando finanzas...
          </ThemedText>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText type="h2">Finanzas</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {selectedBusiness?.name || "Panel financiero"}
          </ThemedText>
        </View>

        {/* Resumen Financiero */}
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.summaryCard,
            { backgroundColor: "#4CAF50" },
            Shadows.lg,
          ]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            Ganancias Totales
          </ThemedText>
          <ThemedText
            type="h1"
            style={{
              color: "#FFFFFF",
              fontSize: 38,
              marginVertical: Spacing.sm,
            }}
          >
            {summary.totalEarnings.toFixed(2)} €
          </ThemedText>

          <View style={styles.periodSelector}>
            {(["week", "month", "all"] as Period[]).map((period) => (
              <Pressable
                key={period}
                onPress={() => setSelectedPeriod(period)}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor:
                      selectedPeriod === period
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: selectedPeriod === period ? "#4CAF50" : "#FFFFFF",
                    fontWeight: "600",
                  }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryItem}>
              <ThemedText
                type="small"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Completados
              </ThemedText>
              <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                {summary.completedAmount.toFixed(2)} €
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText
                type="small"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Pendientes
              </ThemedText>
              <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                {summary.pendingAmount.toFixed(2)} €
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Sistema de Pagos */}
        <View
          style={[styles.infoCard, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.infoHeader}>
            <Feather name="info" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Sistema de Pagos
            </ThemedText>
          </View>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            • Recibes el 100% del precio base de tus productos
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • ComeYa agrega un 15% de markup al precio final del cliente
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • Métodos: Bizum, Transferencia (SEPA), PayPal, Tarjeta
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            • El admin transfiere tus ganancias a tu cuenta de pago
          </ThemedText>
        </View>

        {/* Pagos (ventas) */}
        {payouts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3">Mis pagos</ThemedText>
              <Badge
                text={`${payouts.filter((p) => p.status === "pending").length} pendientes`}
                variant="warning"
              />
            </View>
            {payouts.map((payout, index) => {
              const statusInfo =
                PAYOUT_STATUS_LABELS[payout.status] ||
                PAYOUT_STATUS_LABELS.pending;
              const isWithdrawal = (payout.orderId || "").startsWith("wdr-");
              return (
                <Animated.View
                  key={payout.id}
                  entering={FadeInDown.delay(index * 40).springify()}
                  style={[
                    styles.transactionCard,
                    { backgroundColor: theme.card },
                    Shadows.sm,
                  ]}
                >
                  <View style={styles.transactionHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {isWithdrawal
                          ? "Retiro de saldo"
                          : `Pedido #${payout.orderId.slice(-6)}`}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {PAYMENT_METHOD_LABELS[payout.method || ""] ||
                          "Sin método registrado"}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {new Date(payout.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {payout.paidAt
                          ? ` · Pagado ${new Date(payout.paidAt).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                            })}`
                          : ""}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <ThemedText
                        type="h4"
                        style={{
                          color:
                            payout.status === "pending"
                              ? ComeYaColors.warning
                              : ComeYaColors.success,
                        }}
                      >
                        {(payout.amount / 100).toFixed(2)} €
                      </ThemedText>
                      <Badge
                        text={statusInfo.text}
                        variant={
                          payout.status === "pending" ? "warning" : "success"
                        }
                      />
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </>
        )}

        {/* Historial de Transacciones */}
        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Historial de Transacciones</ThemedText>
          <Badge text={`${summary.transactionCount}`} variant="primary" />
        </View>

        {transactions.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md }}
            >
              No hay transacciones en este período
            </ThemedText>
          </View>
        ) : (
          transactions.map((transaction, index) => (
            <Animated.View
              key={transaction.id}
              entering={FadeInDown.delay(index * 50).springify()}
              style={[
                styles.transactionCard,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              {/* Fila superior: pedido + monto */}
              <View style={styles.transactionHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Pedido #{transaction.orderId.slice(-6)}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {new Date(transaction.createdAt).toLocaleDateString(
                      "es-VE",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </ThemedText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <ThemedText
                    type="h4"
                    style={{ color: getStatusColor(transaction.status) }}
                  >
                    {transaction.subtotal.toFixed(2)} €
                  </ThemedText>
                  <Badge
                    text={getStatusLabel(transaction.status)}
                    variant={
                      transaction.status === "delivered"
                        ? "success"
                        : transaction.status === "cancelled"
                          ? "error"
                          : "warning"
                    }
                  />
                </View>
              </View>

              {/* Detalles adicionales */}
              <View style={styles.transactionDetails}>
                {transaction.customerName ? (
                  <View style={styles.detailRow}>
                    <Feather
                      name="user"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginLeft: 4 }}
                    >
                      {transaction.customerName}
                      {transaction.customerPhone
                        ? ` · ${transaction.customerPhone}`
                        : ""}
                    </ThemedText>
                  </View>
                ) : null}
                {transaction.paymentMethod ? (
                  <View style={styles.detailRow}>
                    <Feather
                      name="credit-card"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginLeft: 4 }}
                    >
                      {PAYMENT_METHOD_LABELS[transaction.paymentMethod] ||
                        transaction.paymentMethod}
                    </ThemedText>
                  </View>
                ) : null}
                {formatAddress(transaction.deliveryAddress) ? (
                  <View style={styles.detailRow}>
                    <Feather
                      name="map-pin"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="caption"
                      style={{
                        color: theme.textSecondary,
                        marginLeft: 4,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {formatAddress(transaction.deliveryAddress)}
                    </ThemedText>
                  </View>
                ) : null}
                {transaction.deliveryFee > 0 ? (
                  <View style={styles.detailRow}>
                    <Feather
                      name="truck"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginLeft: 4 }}
                    >
                      Envío: {transaction.deliveryFee.toFixed(2)} €
                      {" · "}
                      Total: {transaction.total.toFixed(2)} €
                    </ThemedText>
                  </View>
                ) : null}
                {transaction.notes ? (
                  <View style={styles.detailRow}>
                    <Feather
                      name="message-square"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="caption"
                      style={{
                        color: theme.textSecondary,
                        marginLeft: 4,
                        flex: 1,
                      }}
                      numberOfLines={2}
                    >
                      {transaction.notes}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  periodSelector: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  summaryDetails: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  summaryItem: {
    alignItems: "center",
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  transactionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  transactionDetails: {
    marginTop: Spacing.sm,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
