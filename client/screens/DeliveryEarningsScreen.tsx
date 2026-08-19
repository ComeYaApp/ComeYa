import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";

interface EarningsData {
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
    tips: number;
  };
  stats: {
    totalDeliveries: number;
    averageRating?: number;
    rating?: number;
    completionRate: number;
    avgDeliveryTime: number;
    todayEarnings?: number;
    weekEarnings?: number;
    monthEarnings?: number;
    totalEarnings?: number;
  };
}

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
}

interface Transaction {
  id: string;
  type: "earning" | "withdrawal" | "tip" | "delivery_income";
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

type Period = "today" | "week" | "month";

function StatCard({
  icon,
  label,
  value,
  color = ComeYaColors.primary,
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  delay?: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <ThemedText type="h3">{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

export default function DeliveryEarningsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [depositInfoModalVisible, setDepositInfoModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery<EarningsData>({
    queryKey: ["/api/delivery/stats"],
    enabled: !!user?.id,
  });

  const { data: walletData, refetch: refetchWallet } = useQuery<{
    success: boolean;
    wallet: {
      balance: number;
      cashOwed: number;
      pendingBalance: number;
      totalEarned: number;
      availableBalance: number;
    };
  }>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user?.id,
  });

  // DEBUG: Log wallet data
  console.log("🔍 Wallet Data:", walletData);
  console.log("👤 User ID:", user?.id);

  const { data: transactionsData, refetch: refetchTransactions } = useQuery<{
    success: boolean;
    transactions: Transaction[];
  }>({
    queryKey: ["/api/wallet/transactions"],
    enabled: !!user?.id,
  });

  // DEBUG: Log transactions
  console.log("💳 Transactions:", transactionsData);

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/wallet/withdraw", {
        amount: Math.round(amount * 100),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        Alert.alert(
          "Solicitud Enviada",
          "Tu solicitud de retiro ha sido enviada. Recibirás el pago en 1-3 días hábiles.",
        );
        setWithdrawModalVisible(false);
        setWithdrawAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/wallet/transactions"],
        });
      } else {
        Alert.alert("Error", data.error || "No se pudo procesar el retiro");
      }
    },
    onError: () => {
      Alert.alert("Error", "No se pudo procesar el retiro");
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async (data: { proofUrl: string }) => {
      const response = await apiRequest(
        "POST",
        "/api/weekly-settlement/driver/submit-proof",
        { settlementId: "manual", ...data },
      );
      return response.json();
    },
    onSuccess: () => {
      Alert.alert(
        "Comprobante Enviado",
        "Tu comprobante está en revisión. Te notificaremos cuando sea aprobado.",
      );
      setDepositInfoModalVisible(false);
      setProofUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    },
    onError: () => {
      Alert.alert("Error", "No se pudo enviar el comprobante");
    },
  });

  const earnings = {
    today: (data?.stats?.todayEarnings || 0) / 100,
    week: (data?.stats?.weekEarnings || 0) / 100,
    month: (data?.stats?.monthEarnings || 0) / 100,
    total: (data?.stats?.totalEarnings || 0) / 100,
    tips: 0,
  };

  const stats = {
    totalDeliveries: data?.stats?.totalDeliveries || 0,
    averageRating: data?.stats?.rating || 0,
    completionRate: data?.stats?.completionRate || 100,
    avgDeliveryTime: data?.stats?.avgDeliveryTime || 0,
  };

  const wallet: WalletData & { cashOwed: number; canWithdraw: number } = {
    balance: (walletData?.wallet?.balance ?? 0) / 100,
    cashOwed: (walletData?.wallet?.cashOwed ?? 0) / 100,
    canWithdraw:
      Math.max(
        0,
        (walletData?.wallet?.balance ?? 0) -
          (walletData?.wallet?.cashOwed ?? 0),
      ) / 100,
    pendingBalance: (walletData?.wallet?.pendingBalance ?? 0) / 100,
    totalEarned: (walletData?.wallet?.totalEarned ?? 0) / 100,
  };

  const transactions = transactionsData?.transactions || [];

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const getEarningsForPeriod = () => {
    switch (selectedPeriod) {
      case "today":
        return earnings.today;
      case "week":
        return earnings.week;
      case "month":
        return earnings.month;
      default:
        return 0;
    }
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Ingresa un monto válido");
      return;
    }
    if (amount > wallet.canWithdraw) {
      Alert.alert(
        "Error",
        "No tienes suficiente saldo disponible. Debes liquidar tu deuda en efectivo primero.",
      );
      return;
    }
    if (amount < 50) {
      Alert.alert("Error", "El monto mínimo de retiro es 50 €");
      return;
    }
    withdrawMutation.mutate(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-VE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
      case "delivery_income":
        return "dollar-sign";
      case "cash_collected":
        return "briefcase";
      case "cash_debt_business":
        return "home";
      case "cash_debt_ComeYa":
      case "cash_debt":
        return "alert-circle";
      case "cash_income":
      case "cash_delivery":
        return "dollar-sign";
      case "withdrawal":
        return "arrow-up-circle";
      case "tip":
        return "gift";
      default:
        return "activity";
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income":
      case "delivery_income":
      case "cash_income":
      case "cash_delivery":
        return ComeYaColors.success;
      case "cash_collected":
        return "#2196F3";
      case "cash_debt_business":
        return "#FF9800";
      case "cash_debt_ComeYa":
      case "cash_debt":
        return ComeYaColors.error;
      case "withdrawal":
        return ComeYaColors.warning;
      case "tip":
        return "#9C27B0";
      default:
        return theme.textSecondary;
    }
  };

  const handleRefresh = () => {
    refetch();
    refetchWallet();
    refetchTransactions();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="h2">💰 Mi Wallet</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        <>
          <Animated.View
            entering={FadeInDown.springify()}
            style={[
              styles.walletCard,
              {
                backgroundColor:
                  wallet.cashOwed > 0
                    ? ComeYaColors.error
                    : ComeYaColors.success,
              },
              Shadows.lg,
            ]}
          >
            <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
              {wallet.cashOwed > 0
                ? "🚨 Debes Depositar"
                : "✅ Disponible para Retirar"}
            </ThemedText>
            <ThemedText
              type="h1"
              style={{
                color: "#FFFFFF",
                fontSize: 42,
                marginVertical: Spacing.sm,
              }}
            >
              €
              {wallet.cashOwed > 0
                ? wallet.cashOwed.toFixed(2)
                : wallet.canWithdraw.toFixed(2)}
            </ThemedText>

            {wallet.cashOwed > 0 ? (
              <View style={styles.deadlineRow}>
                <Feather name="clock" size={16} color="rgba(255,255,255,0.9)" />
                <ThemedText
                  type="caption"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    marginLeft: 4,
                    fontWeight: "600",
                  }}
                >
                  Fecha límite: Domingo 11:59 PM (o serás bloqueado el lunes)
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.balanceBreakdown}>
              <View style={styles.breakdownRow}>
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
                >
                  📱 Balance digital (tarjeta):
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,1)", fontWeight: "700" }}
                >
                  {wallet.balance.toFixed(2)} €
                </ThemedText>
              </View>
              <View
                style={[
                  styles.breakdownRow,
                  {
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.3)",
                    paddingTop: 8,
                    marginTop: 8,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
                >
                  💵 Efectivo cobrado (en tu bolsillo):
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,1)", fontWeight: "700" }}
                >
                  €
                  {(
                    transactions
                      .filter((t) => t.type === "delivery_income")
                      .reduce((sum, t) => sum + t.amount, 0) / 100
                  ).toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.breakdownRow}>
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
                >
                  🏦 Debes depositar a ComeYa:
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: "rgba(255,255,255,1)", fontWeight: "700" }}
                >
                  -{wallet.cashOwed.toFixed(2)} €
                </ThemedText>
              </View>
              {wallet.canWithdraw > 0 ? (
                <View
                  style={[
                    styles.breakdownRow,
                    {
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.3)",
                      paddingTop: 8,
                      marginTop: 8,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    Disponible para retirar:
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontWeight: "600",
                    }}
                  >
                    {wallet.canWithdraw.toFixed(2)} €
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() =>
                wallet.canWithdraw > 0
                  ? setWithdrawModalVisible(true)
                  : setDepositInfoModalVisible(true)
              }
              style={[styles.withdrawButton]}
            >
              <Feather
                name={wallet.canWithdraw > 0 ? "arrow-up-circle" : "info"}
                size={20}
                color={wallet.cashOwed > 0 ? "#FFF" : ComeYaColors.success}
              />
              <ThemedText
                type="body"
                style={{
                  color: wallet.cashOwed > 0 ? "#FFF" : ComeYaColors.success,
                  marginLeft: Spacing.xs,
                  fontWeight: "600",
                }}
              >
                {wallet.canWithdraw > 0
                  ? "Solicitar Retiro"
                  : "Ver datos de depósito"}
              </ThemedText>
            </Pressable>
          </Animated.View>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.backgroundSecondary,
                marginTop: Spacing.md,
              },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={20}
              color={theme.textSecondary}
            />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                ¿Cómo leemos este saldo?
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 4 }}
              >
                Balance digital = pagos con tarjeta listos para retiro. Efectivo
                cobrado = dinero que tienes en mano.
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 4 }}
              >
                Si cobraste en efectivo, la comisión de ComeYa aparece como
                "Debes depositar". Hasta saldarla, los retiros quedan retenidos.
              </ThemedText>
            </View>
          </View>

          <View
            style={[
              styles.totalCard,
              { backgroundColor: theme.card },
              Shadows.md,
            ]}
          >
            <View style={styles.totalRow}>
              <View>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  Total ganado histórico
                </ThemedText>
                <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
                  {wallet.totalEarned.toFixed(2)} €
                </ThemedText>
              </View>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: ComeYaColors.primary + "20" },
                ]}
              >
                <Feather name="award" size={24} color={ComeYaColors.primary} />
              </View>
            </View>
          </View>

          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
          >
            Historial de Transacciones
          </ThemedText>

          {wallet.cashOwed > 0 ? (
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  marginBottom: Spacing.md,
                },
              ]}
            >
              <Feather name="info" size={20} color={ComeYaColors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  ¿Por qué debo depositar?
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  Cobraste efectivo al cliente. Los €
                  {wallet.cashOwed.toFixed(2)} son la comisión de ComeYa (15% de
                  productos) que debes entregar. Hasta que deposites, tus
                  retiros quedan retenidos.
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  Deposita antes del viernes y sube tu comprobante: al aprobarlo
                  liberamos tu saldo digital y desaparece esta deuda.
                </ThemedText>
              </View>
            </View>
          ) : null}

          {transactions.length > 0 ? (
            transactions.slice(0, 10).map((tx, index) => (
              <Animated.View
                key={tx.id}
                entering={FadeInRight.delay(index * 50).springify()}
                style={[
                  styles.transactionItem,
                  { backgroundColor: theme.card },
                  Shadows.sm,
                ]}
              >
                <View
                  style={[
                    styles.txIcon,
                    { backgroundColor: getTransactionColor(tx.type) + "20" },
                  ]}
                >
                  <Feather
                    name={getTransactionIcon(tx.type) as any}
                    size={20}
                    color={getTransactionColor(tx.type)}
                  />
                </View>
                <View style={styles.txInfo}>
                  <ThemedText type="body">{tx.description}</ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {formatDate(tx.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText
                  type="body"
                  style={{
                    color:
                      tx.amount < 0 ? ComeYaColors.error : ComeYaColors.success,
                    fontWeight: "600",
                  }}
                >
                  {tx.amount < 0 ? "-" : "+"}€
                  {(Math.abs(tx.amount) / 100).toFixed(2)}
                </ThemedText>
              </Animated.View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginTop: Spacing.md }}
              >
                No hay transacciones aún
              </ThemedText>
            </View>
          )}

          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}
          >
            📊 Ganancias por Período
          </ThemedText>

          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={[
              styles.earningsCard,
              { backgroundColor: ComeYaColors.primary },
              Shadows.lg,
            ]}
          >
            <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
              {periodLabels[selectedPeriod]}
            </ThemedText>
            <ThemedText
              type="h1"
              style={{
                color: "#FFFFFF",
                fontSize: 42,
                marginVertical: Spacing.sm,
              }}
            >
              {getEarningsForPeriod().toFixed(2)} €
            </ThemedText>
            <View style={styles.tipsRow}>
              <Feather name="gift" size={16} color="rgba(255,255,255,0.8)" />
              <ThemedText
                type="caption"
                style={{ color: "rgba(255,255,255,0.8)", marginLeft: 4 }}
              >
                +{earnings.tips.toFixed(2)} € en propinas
              </ThemedText>
            </View>

            <View style={styles.periodSelector}>
              {(["today", "week", "month"] as Period[]).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => {
                    setSelectedPeriod(period);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
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
                    type="caption"
                    style={{
                      color:
                        selectedPeriod === period
                          ? ComeYaColors.primary
                          : "#FFFFFF",
                      fontWeight: "600",
                    }}
                  >
                    {periodLabels[period]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          <ThemedText
            type="h3"
            style={{ marginBottom: Spacing.md, marginTop: Spacing.lg }}
          >
            📈 Estadísticas
          </ThemedText>

          <View style={styles.statsGrid}>
            <StatCard
              icon="truck"
              label="Entregas totales"
              value={stats.totalDeliveries}
              color="#4CAF50"
              delay={200}
            />
            <StatCard
              icon="star"
              label="Calificación"
              value={stats.averageRating.toFixed(1)}
              color="#FF9800"
              delay={250}
            />
            <StatCard
              icon="check-circle"
              label="Completadas"
              value={`${stats.completionRate}%`}
              color="#2196F3"
              delay={300}
            />
            <StatCard
              icon="clock"
              label="Tiempo prom."
              value={`${stats.avgDeliveryTime}m`}
              color="#9C27B0"
              delay={350}
            />
          </View>
        </>
      </ScrollView>

      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Solicitar Retiro</ThemedText>
              <Pressable onPress={() => setWithdrawModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
            >
              Disponible para retirar: {wallet.canWithdraw.toFixed(2)} €
            </ThemedText>

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText type="h3" style={{ marginRight: Spacing.xs }}>
                $
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
            >
              Mínimo 50 €. El retiro se procesa en 1-3 días hábiles.
            </ThemedText>

            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
              style={[
                styles.confirmButton,
                {
                  backgroundColor: ComeYaColors.primary,
                  opacity: withdrawMutation.isPending ? 0.5 : 1,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFF", fontWeight: "600" }}
              >
                {withdrawMutation.isPending
                  ? "Procesando..."
                  : "Confirmar Retiro"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={depositInfoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDepositInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">💰 Depositar Efectivo</ThemedText>
              <Pressable onPress={() => setDepositInfoModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}
            >
              Deposita {wallet.cashOwed.toFixed(2)} € a la siguiente cuenta:
            </ThemedText>

            {/* Datos bancarios removidos - usar sección wallet */}
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}
            >
              Contacta al administrador para obtener los datos de depósito.
            </ThemedText>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.border,
                paddingTop: Spacing.lg,
              }}
            >
              <ThemedText
                type="body"
                style={{ fontWeight: "600", marginBottom: Spacing.sm }}
              >
                ¿Ya depositaste? Sube tu comprobante
              </ThemedText>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                    marginBottom: Spacing.md,
                  },
                ]}
              >
                <Feather
                  name="image"
                  size={20}
                  color={theme.textSecondary}
                  style={{ marginRight: Spacing.xs }}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="URL del comprobante"
                  placeholderTextColor={theme.textSecondary}
                  value={proofUrl}
                  onChangeText={setProofUrl}
                />
              </View>

              <Pressable
                onPress={() => {
                  if (!proofUrl.trim()) {
                    Alert.alert("Error", "Ingresa la URL del comprobante");
                    return;
                  }
                  submitProofMutation.mutate({ proofUrl: proofUrl.trim() });
                }}
                disabled={submitProofMutation.isPending}
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: ComeYaColors.success,
                    opacity: submitProofMutation.isPending ? 0.5 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "600" }}
                >
                  {submitProofMutation.isPending
                    ? "Enviando..."
                    : "Enviar Comprobante"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },

  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  earningsCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  walletCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  tipsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  debtRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  balanceBreakdown: {
    width: "100%",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  totalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: Spacing.xl,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: "600",
  },
  confirmButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
