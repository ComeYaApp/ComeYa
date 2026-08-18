import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
  Linking,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { API_CONFIG } from "../constants/config";

const formatEuros = (cents: number | null | undefined): string =>
  `${((cents ?? 0) / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  cashOwed: number;
  availableForWithdrawal: number;
}

interface ConnectStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  canReceivePayments: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

interface UniversalWalletProps {
  showWithdrawals?: boolean;
  showConnectSetup?: boolean;
}

const CAN_WITHDRAW_ROLES = ["delivery_driver", "business_owner"];

export default function UniversalWallet({
  showWithdrawals = true,
  showConnectSetup = true,
}: UniversalWalletProps) {
  const { user, token } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Estado para mostrar historial
  const [showHistory, setShowHistory] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal de retiro
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isEligible = CAN_WITHDRAW_ROLES.includes(user?.role || "");

  const fetchTransactions = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory) fetchTransactions();
  }, [showHistory]);

  const fetchData = async () => {
    try {
      const walletResponse = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setWallet(walletData.wallet || walletData);
      }

      if (showConnectSetup && isEligible) {
        const connectResponse = await fetch(
          `${API_CONFIG.BASE_URL}/api/connect/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (connectResponse.ok) {
          const connectData = await connectResponse.json();
          setConnectStatus(connectData);
        }
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const startOnboarding = async () => {
    if (!user) return;

    setOnboardingLoading(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/connect/onboard`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const supported = await Linking.canOpenURL(data.onboardingUrl);
        if (supported) {
          await Linking.openURL(data.onboardingUrl);
        } else {
          Alert.alert("Error", "No se pudo abrir el enlace de configuración");
        }
      } else {
        const error = await response.json();
        Alert.alert("Error", error.error || "Error al iniciar configuración");
      }
    } catch {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const euros = parseFloat(withdrawAmount.replace(",", "."));
    if (!euros || Number.isNaN(euros) || euros <= 0) {
      Alert.alert("Importe no válido", "Introduce un importe válido en euros.");
      return;
    }
    const cents = Math.round(euros * 100);
    if (cents < 5000) {
      Alert.alert("Importe mínimo", "El monto mínimo de retiro es 50 €.");
      return;
    }
    const available = wallet?.availableForWithdrawal ?? 0;
    if (cents > available) {
      Alert.alert("Saldo insuficiente", "No tienes saldo suficiente.");
      return;
    }

    setWithdrawing(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/wallet/withdraw`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: cents }),
      });

      if (response.ok) {
        Alert.alert(
          "Solicitud enviada",
          "Tu solicitud de retiro ha sido enviada y será revisada por el administrador.",
        );
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert("Error", error.error || "No se pudo procesar el retiro");
      }
    } catch {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setWithdrawing(false);
    }
  };

  const getRoleText = () => {
    switch (user?.role) {
      case "delivery_driver":
        return "Repartidor";
      case "business_owner":
        return "Negocio";
      case "customer":
        return "Cliente";
      case "admin":
      case "super_admin":
        return "Administrador";
      default:
        return "Usuario";
    }
  };

  const getBalanceColor = () => {
    if (!wallet) return "#6B7280";
    const available = wallet.availableForWithdrawal;
    if (available >= 10000) return "#10B981";
    if (available >= 5000) return "#F59E0B";
    return "#6B7280";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Cargando wallet...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={32} color="#FF6B35" />
        <Text style={styles.title}>Mi Wallet</Text>
        <Text style={styles.subtitle}>{getRoleText()}</Text>
      </View>

      {/* Banner de notificación si hay deuda de efectivo */}
      {wallet && wallet.cashOwed > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            Recibiste entregas en efectivo. Debes entregar{" "}
            {formatEuros(wallet.cashOwed)} al negocio antes de poder retirar tu
            saldo.
          </Text>
        </View>
      )}

      {/* Balance Card */}
      {wallet && (
        <View
          style={[styles.balanceCard, { borderLeftColor: getBalanceColor() }]}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>
              Saldo disponible para retiro
            </Text>
            <Ionicons name="cash-outline" size={24} color={getBalanceColor()} />
          </View>
          <Text style={[styles.balanceAmount, { color: getBalanceColor() }]}>
            {formatEuros(wallet.availableForWithdrawal)}
          </Text>
          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Total Ganado</Text>
              <Text style={styles.balanceItemValue}>
                {formatEuros(wallet.totalEarned)}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Retirado</Text>
              <Text style={styles.balanceItemValue}>
                {formatEuros(wallet.totalWithdrawn)}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Pendiente</Text>
              <Text style={styles.balanceItemValue}>
                {formatEuros(wallet.pendingBalance)}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Balance</Text>
              <Text style={styles.balanceItemValue}>
                {formatEuros(wallet.balance)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Connect Status - Solo repartidores y negocios */}
      {showConnectSetup && isEligible && (
        <View style={styles.connectCard}>
          <View style={styles.connectHeader}>
            <Ionicons
              name={
                connectStatus?.canReceivePayments
                  ? "checkmark-circle"
                  : "time-outline"
              }
              size={24}
              color={connectStatus?.canReceivePayments ? "#10B981" : "#F59E0B"}
            />
            <Text style={styles.connectTitle}>Cuenta Bancaria (Stripe)</Text>
          </View>

          {!connectStatus?.hasAccount ? (
            <View>
              <Text style={styles.connectDescription}>
                Conecta tu cuenta bancaria para retiros automáticos
              </Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={startOnboarding}
                disabled={onboardingLoading}
              >
                {onboardingLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color="white"
                    />
                    <Text style={styles.connectButtonText}>Configurar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : connectStatus.canReceivePayments ? (
            <View style={styles.connectSuccess}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.connectSuccessText}>
                Cuenta configurada para retiros automáticos
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.connectWarning}>
                Completa la configuración de tu cuenta
              </Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={startOnboarding}
                disabled={onboardingLoading}
              >
                {onboardingLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color="white"
                    />
                    <Text style={styles.connectButtonText}>Completar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Acciones Rápidas</Text>
        <View style={styles.actionsGrid}>
          {showWithdrawals && isEligible && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                wallet && wallet.cashOwed > 0 ? { opacity: 0.5 } : {},
              ]}
              disabled={(wallet && wallet.cashOwed > 0) || false}
              onPress={() => {
                if (wallet && wallet.cashOwed > 0) {
                  Alert.alert(
                    "No puedes retirar",
                    "No puedes retirar hasta saldar tu deuda de efectivo.",
                  );
                  return;
                }
                setShowWithdrawModal(true);
              }}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={24}
                color="#FF6B35"
              />
              <Text style={styles.actionText}>Retirar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Ionicons name="list-outline" size={24} color="#FF6B35" />
            <Text style={styles.actionText}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* Historial de transacciones */}
        {showHistory && (
          <View style={styles.historyBox}>
            <Text style={styles.historyTitle}>Historial</Text>
            {loadingHistory ? (
              <ActivityIndicator size="small" color="#FF6B35" />
            ) : transactions.length === 0 ? (
              <Text style={{ color: "#6B7280" }}>
                No hay transacciones recientes.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 260 }}>
                {transactions.map((tx, idx) => (
                  <View key={tx.id || idx} style={styles.historyRow}>
                    <Ionicons
                      name={
                        tx.type === "cash_debt"
                          ? "remove-circle-outline"
                          : "add-circle-outline"
                      }
                      size={18}
                      color={tx.type === "cash_debt" ? "#F59E0B" : "#10B981"}
                    />
                    <Text style={styles.historyText}>
                      {tx.type === "cash_debt"
                        ? "Deuda de efectivo"
                        : tx.description || "Movimiento"}
                    </Text>
                    <Text
                      style={{
                        fontWeight: "bold",
                        color:
                          tx.amount < 0 ? "#F59E0B" : "#10B981",
                      }}
                    >
                      {tx.amount < 0 ? "-" : "+"}
                      {formatEuros(Math.abs(tx.amount))}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Pagos Seguros</Text>
          <Text style={styles.infoText}>
            Los retiros se solicitan desde aquí y el administrador los procesa
            mediante tu cuenta de pago configurada.
          </Text>
        </View>
      </View>

      {/* Modal de retiro */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Retirar saldo</Text>
            <Text style={styles.modalSubtitle}>
              Disponible: {formatEuros(wallet?.availableForWithdrawal ?? 0)}.
              Mínimo 50 €. El pago se realiza a tu cuenta configurada.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Importe en euros (ej: 50)"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Solicitar retiro</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  balanceItem: {
    width: "48%",
    marginBottom: 12,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  balanceItemValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  connectCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  connectHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  connectTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  connectDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  connectButton: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  connectButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  connectSuccess: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectSuccessText: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "500",
    marginLeft: 6,
  },
  connectWarning: {
    fontSize: 14,
    color: "#F59E0B",
    fontWeight: "500",
    marginBottom: 12,
  },
  actionsCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionButton: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: "#374151",
    marginTop: 4,
    fontWeight: "500",
  },
  historyBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  historyTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  historyText: {
    flex: 1,
    color: "#374151",
  },
  infoCard: {
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancel: {
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  modalConfirm: {
    backgroundColor: "#FF6B35",
  },
  modalConfirmText: {
    color: "white",
    fontWeight: "600",
  },
});
