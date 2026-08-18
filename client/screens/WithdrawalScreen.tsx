import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { API_CONFIG } from "../constants/api";

const MINIMUM_WITHDRAWAL = 50; // $50 €

interface ConnectStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  canReceivePayments: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

export default function WithdrawalScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"stripe" | "bank_transfer">("stripe");
  const [bankData, setBankData] = useState({
    iban: "",
    clabe: "",
    bankName: "",
    accountHolder: "",
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(
    null,
  );
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadTransactions();
    loadConnectStatus();
    loadBankAccount();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadWalletData();
      loadTransactions();
      loadConnectStatus();
      loadBankAccount();
    }, []),
  );

  const loadBankAccount = async () => {
    try {
      const token = user?.token;
      if (!token) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/bank-account`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok && data?.bankAccount) {
        const parsed =
          typeof data.bankAccount === "string"
            ? (() => {
                try {
                  return JSON.parse(data.bankAccount);
                } catch (err) {
                  return {};
                }
              })()
            : data.bankAccount;

        setBankData({
          iban: parsed?.iban || "",
          clabe: parsed?.clabe || "",
          bankName: parsed?.bankName || "",
          accountHolder: parsed?.accountHolder || "",
        });
      }
    } catch (error) {
      console.error("Error loading bank account:", error);
    }
  };

  const loadConnectStatus = async () => {
    try {
      const token = user?.token;
      if (!token) return;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/connect/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (response.ok) {
        setConnectStatus(data);
      }
    } catch (error) {
      console.error("Error loading Connect status:", error);
    }
  };

  const startOnboarding = async () => {
    if (!user) return;

    setOnboardingLoading(true);
    try {
      const accountType =
        user.role === "business_owner" ? "business" : "driver";

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/connect/onboard`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountType,
            businessId: user.role === "business_owner" ? user.id : undefined,
          }),
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
    } catch (error) {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const refreshOnboarding = async () => {
    if (!connectStatus?.accountId) {
      Alert.alert("Error", "No hay cuenta Stripe para refrescar");
      return;
    }
    setOnboardingLoading(true);
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/connect/refresh-onboarding`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId: connectStatus.accountId }),
        },
      );

      if (response.ok) {
        const data = await response.json();

        const supported = await Linking.canOpenURL(data.onboardingUrl);
        if (supported) {
          await Linking.openURL(data.onboardingUrl);
        }
      } else {
        const error = await response.json().catch(() => ({}));
        Alert.alert(
          "Error",
          error.error || "Error al actualizar configuración",
        );
      }
    } catch (error) {
      Alert.alert("Error", "Error de conexión");
    } finally {
      setOnboardingLoading(false);
    }
  };

  const loadWalletData = async () => {
    try {
      const token = user?.token;
      console.log("🔑 Token:", token ? "exists" : "missing");
      console.log("👤 User ID:", user?.id);
      console.log("👤 User Name:", user?.name);
      console.log("👤 User Role:", user?.role);
      console.log("👤 User Email:", user?.email);
      if (!token) {
        console.log("❌ No token, skipping wallet load");
        return;
      }

      console.log(
        "📡 Fetching wallet from:",
        `${API_CONFIG.BASE_URL}/api/wallet/balance`,
      );
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      console.log("💰 Wallet response:", data);

      if (data?.wallet || data?.success) {
        setWallet(data.wallet || data);
        console.log("✅ Wallet loaded:", data);
      } else {
        console.log("⚠️ Wallet load failed:", data);
      }
    } catch (error) {
      console.error("❌ Error loading wallet:", error);
    }
  };

  const loadTransactions = async () => {
    try {
      const token = user?.token;
      if (!token) return;

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      console.log("📑 Transactions response:", data);
      if (data?.transactions) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      setTransactions([]);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum < MINIMUM_WITHDRAWAL) {
      Alert.alert("Error", `El monto mínimo es $${MINIMUM_WITHDRAWAL} €`);
      return;
    }

    const availableBalance = (wallet?.balance || 0) - (wallet?.cashOwed || 0);
    if (amountNum * 100 > availableBalance) {
      Alert.alert("Error", "Saldo insuficiente");
      return;
    }

    if (wallet?.cashOwed > 0) {
      Alert.alert(
        "Error",
        "Debes liquidar tu efectivo pendiente antes de retirar",
      );
      return;
    }

    if (method === "stripe" && !connectStatus?.canReceivePayments) {
      Alert.alert(
        "Configura tu cuenta Stripe",
        "Ve a Metodos de Pago para completar la configuracion de Stripe Connect.",
        [
          {
            text: "Ir a configurar",
            onPress: () => navigation.navigate("PaymentMethods" as never),
          },
          { text: "Cancelar", style: "cancel" },
        ],
      );
      return;
    }

    if (method === "bank_transfer") {
      const numeroCuenta = bankData.iban || bankData.clabe;
      if (
        !numeroCuenta ||
        (numeroCuenta.length !== 24 && numeroCuenta.length !== 18) ||
        !bankData.bankName ||
        !bankData.accountHolder
      ) {
        Alert.alert(
          "Configura tu cuenta bancaria",
          "Ve a Métodos de Pago > Agregar cuenta bancaria para guardar tu IBAN y titular.",
          [
            {
              text: "Ir a configurar",
              onPress: () => navigation.navigate("AddBankAccount" as never),
            },
            { text: "Cancelar", style: "cancel" },
          ],
        );
        return;
      }
    }

    const persistBankAccount = async () => {
      if (method !== "bank_transfer") return true;
      try {
        const token = user?.token;
        if (!token) return false;

        const response = await fetch(
          `${API_CONFIG.BASE_URL}/api/bank-account`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              iban: bankData.iban,
              clabe: bankData.clabe,
              bankName: bankData.bankName,
              accountHolder: bankData.accountHolder,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json();
          Alert.alert(
            "Error",
            error.error || "No se pudo guardar la cuenta bancaria",
          );
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error saving bank account:", error);
        Alert.alert("Error", "No se pudo guardar la cuenta bancaria");
        return false;
      }
    };

    setLoading(true);
    try {
      const token = user?.token;
      if (!token) {
        Alert.alert("Error", "Sesión expirada");
        return;
      }

      if (method === "bank_transfer") {
        const saved = await persistBankAccount();
        if (!saved) {
          setLoading(false);
          return;
        }
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/wallet/withdraw`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: amountNum * 100,
            method,
            bankAccount:
              method === "bank_transfer"
                ? {
                    accountNumber: bankData.iban || bankData.clabe,
                    bankName: bankData.bankName,
                    accountHolder: bankData.accountHolder,
                    accountType: "bank_transfer",
                  }
                : undefined,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Éxito",
          method === "stripe"
            ? "Retiro procesado automáticamente. Recibirás el dinero en 1-2 días hábiles."
            : "Solicitud enviada. El admin procesará tu retiro pronto.",
        );
        setAmount("");
        setBankData({
          iban: "",
          clabe: "",
          bankName: "",
          accountHolder: "",
        });
        loadWalletData();
        loadTransactions();
        loadConnectStatus();
      } else {
        Alert.alert("Error", data.error || "No se pudo procesar el retiro");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const availableBalance =
    wallet?.availableBalance !== undefined
      ? wallet.availableBalance / 100
      : ((wallet?.balance || 0) - (wallet?.cashOwed || 0)) / 100;
  const retainedCash = (wallet?.cashOwed || 0) / 100;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Retiros</Text>
          <Text style={styles.headerSubtitle}>
            Gestiona tu saldo y transferencias
          </Text>
        </View>
      </View>

      {/* Balance Card con saldo disponible y retenido */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo disponible para retiro</Text>
        <Text style={styles.balanceAmount}>{availableBalance.toFixed(2)} €</Text>
        <View style={styles.retainRow}>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color="#F59E0B"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.cashOwed}>
            Saldo retenido (deuda de efectivo): {retainedCash.toFixed(2)} €
          </Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: "#fff", fontSize: 12 }}>
            Ganado: €
            {(wallet?.totalEarned ? wallet.totalEarned / 100 : 0).toFixed(2)} |
            Retirado: €
            {(wallet?.totalWithdrawn ? wallet.totalWithdrawn / 100 : 0).toFixed(
              2,
            )}{" "}
            | Pendiente: €
            {(wallet?.pendingBalance ? wallet.pendingBalance / 100 : 0).toFixed(
              2,
            )}
          </Text>
        </View>
      </View>

      {/* Banner si hay deuda de efectivo */}
      {wallet?.cashOwed > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons
            name="warning"
            size={18}
            color="#F59E0B"
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#92400E", fontWeight: "bold" }}>
              Tienes deuda de efectivo pendiente
            </Text>
            <Text style={{ color: "#92400E", fontSize: 13 }}>
              Entrega {retainedCash.toFixed(2)} € al negocio para habilitar
              retiros. Mientras haya deuda, no podrás retirar.
            </Text>
          </View>
        </View>
      )}

      {/* Withdrawal Form */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Solicitar Retiro</Text>

        <Text style={styles.label}>Monto</Text>
        <TextInput
          style={styles.input}
          placeholder={`Mínimo $${MINIMUM_WITHDRAWAL}`}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <Text style={styles.hint}>Máximo: {availableBalance.toFixed(2)} €</Text>

        <Text style={styles.label}>Método de Retiro</Text>
        <View style={styles.methodButtons}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              method === "stripe" && styles.methodButtonActive,
            ]}
            onPress={() => setMethod("stripe")}
          >
            <Ionicons
              name="flash-outline"
              size={16}
              color={method === "stripe" ? "#4CAF50" : "#666"}
            />
            <Text
              style={[
                styles.methodText,
                method === "stripe" && styles.methodTextActive,
              ]}
            >
              Automatico (1-2 dias)
            </Text>
            <Text style={styles.methodSubtext}>
              {connectStatus?.canReceivePayments
                ? "Listo para retirar"
                : "Configurar en Metodos de Pago"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.methodButton,
              method === "bank_transfer" && styles.methodButtonActive,
            ]}
            onPress={() => setMethod("bank_transfer")}
          >
            <Ionicons
              name="card-outline"
              size={16}
              color={method === "bank_transfer" ? "#4CAF50" : "#666"}
            />
            <Text
              style={[
                styles.methodText,
                method === "bank_transfer" && styles.methodTextActive,
              ]}
            >
              SPEI / CoDi (manual)
            </Text>
            <Text style={styles.methodSubtext}>
              Procesa en 3-5 días hábiles
            </Text>
          </TouchableOpacity>
        </View>

        {method === "bank_transfer" && (
          <View style={styles.bankForm}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons
                name="card-outline"
                size={18}
                color="#4CAF50"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600", color: "#0F172A" }}>
                Cuenta bancaria para retiros (IBAN)
              </Text>
            </View>

            {bankData.iban || bankData.clabe ? (
              <View style={styles.bankSummary}>
                <Text style={styles.bankSummaryLabel}>Cuenta (IBAN)</Text>
                <Text style={styles.bankSummaryValue}>
                  {bankData.iban || bankData.clabe}
                </Text>
                <Text style={styles.bankSummaryLabel}>Banco</Text>
                <Text style={styles.bankSummaryValue}>
                  {bankData.bankName || "—"}
                </Text>
                <Text style={styles.bankSummaryLabel}>Titular</Text>
                <Text style={styles.bankSummaryValue}>
                  {bankData.accountHolder || "—"}
                </Text>
              </View>
            ) : (
              <Text style={{ color: "#6B7280", marginBottom: 8 }}>
                Configura tu cuenta bancaria en Métodos de Pago. Se usará
                automáticamente para tus retiros.
              </Text>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("AddBankAccount" as never)}
            >
              <Ionicons name="settings-outline" size={16} color="#FF6B35" />
              <Text style={styles.secondaryButtonText}>
                Configurar cuenta bancaria
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {method === "stripe" && (
          <View style={styles.bankForm}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons
                name="flash-outline"
                size={18}
                color="#4CAF50"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600", color: "#0F172A" }}>
                Retiros automaticos via Stripe
              </Text>
            </View>

            {connectStatus?.canReceivePayments ? (
              <View style={styles.bankSummary}>
                <Text style={styles.bankSummaryLabel}>Estado</Text>
                <Text style={styles.bankSummaryValue}>
                  Cuenta lista para retiros
                </Text>
                <Text style={styles.bankSummaryLabel}>Retiros</Text>
                <Text style={styles.bankSummaryValue}>
                  Disponibles en 1-2 dias
                </Text>
              </View>
            ) : (
              <Text style={{ color: "#6B7280", marginBottom: 8 }}>
                Configura tu cuenta Stripe Connect en Metodos de Pago para
                habilitar retiros automaticos.
              </Text>
            )}

            {!connectStatus?.canReceivePayments && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate("PaymentMethods" as never)}
              >
                <Ionicons name="settings-outline" size={16} color="#FF6B35" />
                <Text style={styles.secondaryButtonText}>
                  Configurar Stripe
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.withdrawButton,
            (loading || retainedCash > 0) && styles.withdrawButtonDisabled,
          ]}
          onPress={handleWithdraw}
          disabled={loading || retainedCash > 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.withdrawButtonText}>Solicitar Retiro</Text>
          )}
        </TouchableOpacity>
        {retainedCash > 0 && (
          <Text style={{ color: "#B45309", fontSize: 12, marginTop: 4 }}>
            No puedes retirar hasta saldar tu deuda de efectivo.
          </Text>
        )}
      </View>

      {/* History */}
      <View style={styles.history}>
        <Text style={styles.sectionTitle}>Historial de Transacciones</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No hay transacciones aún</Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyAmount}>
                  {tx.amount > 0 ? "+" : ""}{(tx.amount / 100).toFixed(2)} €
                </Text>
                <Text style={styles.historyMethod}>
                  {tx.type === "income"
                    ? "Ingreso"
                    : tx.type === "delivery_payment"
                      ? "Pago Entrega"
                      : tx.type === "order_payment"
                        ? "Venta (tarjeta)"
                        : tx.type === "cash_settlement"
                          ? "Venta (efectivo)"
                          : tx.type === "withdrawal"
                            ? "Retiro"
                            : tx.type}
                </Text>
              </View>
              <View style={styles.historyRight}>
                <Text
                  style={[
                    styles.historyStatus,
                    tx.status === "completed" && styles.statusCompleted,
                    tx.status === "pending" && styles.statusPending,
                    tx.status === "failed" && styles.statusFailed,
                  ]}
                >
                  {tx.status === "completed"
                    ? "Completado"
                    : tx.status === "pending"
                      ? "Pendiente"
                      : "Fallido"}
                </Text>
                <Text style={styles.historyDate}>
                  {new Date(tx.createdAt).toLocaleDateString("es-VE", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  balanceCard: {
    backgroundColor: "#4CAF50",
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#f5f5f5",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
  },
  balanceLabel: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  cashOwed: {
    color: "#ffeb3b",
    fontSize: 14,
    marginTop: 8,
  },
  retainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  form: {
    backgroundColor: "#fff",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  methodButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
  },
  methodButtonActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  methodText: {
    fontSize: 14,
    color: "#666",
  },
  methodTextActive: {
    color: "#4CAF50",
    fontWeight: "bold",
  },
  methodTextDisabled: {
    color: "#ccc",
  },
  methodButtonDisabled: {
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
  },
  methodSubtext: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
  },
  bankForm: {
    marginTop: 16,
  },
  withdrawButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  withdrawButtonDisabled: {
    backgroundColor: "#ccc",
  },
  withdrawButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  history: {
    backgroundColor: "#fff",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    padding: 24,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  historyLeft: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  historyMethod: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  historyRight: {
    alignItems: "flex-end",
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusCompleted: {
    color: "#4CAF50",
  },
  statusPending: {
    color: "#FF9800",
  },
  statusFailed: {
    color: "#f44336",
  },
  historyDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  errorMessage: {
    fontSize: 11,
    color: "#f44336",
    marginTop: 2,
  },
  bankSummary: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  bankSummaryLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
  bankSummaryValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    marginBottom: 2,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  secondaryButtonText: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  infoCard: {
      backgroundColor: "#fff",
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#e2e8f0",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#0F172A",
      marginBottom: 2,
    },
    infoText: {
      fontSize: 13,
      color: "#475569",
    },
    infoButton: {
      backgroundColor: "#e2e8f0",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    infoButtonText: {
      color: "#0F172A",
      fontWeight: "600",
      fontSize: 13,
    },
  }
);
