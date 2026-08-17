import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";

interface WalletData {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalSpent: number;
  loyaltyPoints: number;
  cashback: number;
  virtualCard: {
    number: string;
    expiryDate: string;
    cvv: string;
    isActive: boolean;
  };
  transactions: Array<{
    id: string;
    type: "credit" | "debit" | "transfer" | "cashback" | "refund";
    amount: number;
    description: string;
    date: string;
    status: "completed" | "pending" | "failed";
    category: string;
    merchant?: string;
  }>;
  p2pContacts: Array<{
    id: string;
    name: string;
    phone: string;
    avatar: string;
    lastTransfer: string;
  }>;
}

interface Investment {
  id: string;
  name: string;
  type: "savings" | "investment";
  amount: number;
  interestRate: number;
  duration: string;
  returns: number;
  status: "active" | "matured";
}

export default function EnhancedWalletScreen() {
  const { user } = useAuth();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "p2p" | "invest" | "cards"
  >("overview");
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendRecipient, setSendRecipient] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");

  useEffect(() => {
    loadWalletData();
    loadInvestments();
  }, []);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // Mock enhanced wallet data
      const mockData: WalletData = {
        balance: 125000,
        pendingBalance: 15000,
        totalEarned: 450000,
        totalSpent: 325000,
        loyaltyPoints: 2450,
        cashback: 8500,
        virtualCard: {
          number: "**** **** **** 1234",
          expiryDate: "12/26",
          cvv: "***",
          isActive: true,
        },
        transactions: [
          {
            id: "1",
            type: "debit",
            amount: -15000,
            description: "Pedido - Tacos El Güero",
            date: "2024-01-12T19:30:00Z",
            status: "completed",
            category: "Comida",
            merchant: "Tacos El Güero",
          },
          {
            id: "2",
            type: "cashback",
            amount: 750,
            description: "Cashback 5% - Pedido anterior",
            date: "2024-01-12T19:35:00Z",
            status: "completed",
            category: "Cashback",
          },
          {
            id: "3",
            type: "credit",
            amount: 50000,
            description: "Recarga desde tarjeta",
            date: "2024-01-10T14:20:00Z",
            status: "completed",
            category: "Recarga",
          },
          {
            id: "4",
            type: "transfer",
            amount: -25000,
            description: "Transferencia a María González",
            date: "2024-01-09T16:45:00Z",
            status: "completed",
            category: "Transferencia",
          },
          {
            id: "5",
            type: "refund",
            amount: 12000,
            description: "Reembolso - Pedido cancelado",
            date: "2024-01-08T11:15:00Z",
            status: "completed",
            category: "Reembolso",
          },
        ],
        p2pContacts: [
          {
            id: "1",
            name: "María González",
            phone: "+58 33 1234 5678",
            avatar: "https://via.placeholder.com/50x50",
            lastTransfer: "2024-01-09",
          },
          {
            id: "2",
            name: "Carlos Ruiz",
            phone: "+58 33 8765 4321",
            avatar: "https://via.placeholder.com/50x50",
            lastTransfer: "2024-01-05",
          },
          {
            id: "3",
            name: "Ana López",
            phone: "+58 33 5555 1234",
            avatar: "https://via.placeholder.com/50x50",
            lastTransfer: "2024-01-03",
          },
        ],
      };

      setWalletData(mockData);
    } catch (error) {
      console.error("Error loading wallet data:", error);
      Alert.alert("Error", "No se pudieron cargar los datos de la billetera");
    } finally {
      setLoading(false);
    }
  };

  const loadInvestments = async () => {
    try {
      const mockInvestments: Investment[] = [
        {
          id: "1",
          name: "Ahorro ComeYa",
          type: "savings",
          amount: 50000,
          interestRate: 8.5,
          duration: "6 meses",
          returns: 2125,
          status: "active",
        },
        {
          id: "2",
          name: "Inversión Crecimiento",
          type: "investment",
          amount: 100000,
          interestRate: 12.0,
          duration: "1 año",
          returns: 8500,
          status: "active",
        },
      ];

      setInvestments(mockInvestments);
    } catch (error) {
      console.error("Error loading investments:", error);
    }
  };

  const sendMoney = async () => {
    if (!sendAmount || !sendRecipient) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    const amount = parseFloat(sendAmount) * 100;
    if (amount > (walletData?.balance || 0)) {
      Alert.alert("Error", "Saldo insuficiente");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/wallet/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            recipient: sendRecipient,
            amount: amount,
          }),
        },
      );

      if (response.ok) {
        Alert.alert("¡Éxito!", "Dinero enviado correctamente");
        setShowSendModal(false);
        setSendAmount("");
        setSendRecipient("");
        loadWalletData();
      } else {
        throw new Error("Error sending money");
      }
    } catch (error) {
      console.error("Error sending money:", error);
      Alert.alert("Error", "No se pudo enviar el dinero");
    }
  };

  const topUpWallet = async () => {
    if (!topUpAmount) {
      Alert.alert("Error", "Ingresa el monto a recargar");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/wallet/topup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            amount: parseFloat(topUpAmount) * 100,
          }),
        },
      );

      if (response.ok) {
        Alert.alert("¡Éxito!", "Billetera recargada correctamente");
        setShowTopUpModal(false);
        setTopUpAmount("");
        loadWalletData();
      } else {
        throw new Error("Error topping up wallet");
      }
    } catch (error) {
      console.error("Error topping up wallet:", error);
      Alert.alert("Error", "No se pudo recargar la billetera");
    }
  };

  const requestMoney = (contactId: string) => {
    Alert.alert("Solicitar Dinero", "Funcionalidad en desarrollo");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "EUR",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit":
        return "💰";
      case "debit":
        return "🛒";
      case "transfer":
        return "💸";
      case "cashback":
        return "🎁";
      case "refund":
        return "↩️";
      default:
        return "💳";
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "credit":
      case "cashback":
      case "refund":
        return "green";
      case "debit":
      case "transfer":
        return "red";
      default:
        return Colors.light.text;
    }
  };

  const renderOverview = () => (
    <ScrollView>
      {/* Balance Card */}
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        style={styles.balanceCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceTitle}>ComeYa Wallet</Text>
          <TouchableOpacity onPress={() => setShowQRModal(true)}>
            <Text style={styles.qrIcon}>📱</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceAmount}>
          {formatCurrency(walletData?.balance || 0)}
        </Text>
        <Text style={styles.balanceSubtitle}>Saldo disponible</Text>

        {walletData?.pendingBalance && walletData.pendingBalance > 0 && (
          <Text style={styles.pendingBalance}>
            + {formatCurrency(walletData.pendingBalance)} pendiente
          </Text>
        )}
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => setShowTopUpModal(true)}
        >
          <Text style={styles.quickActionIcon}>💳</Text>
          <Text style={styles.quickActionText}>Recargar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => setShowSendModal(true)}
        >
          <Text style={styles.quickActionIcon}>💸</Text>
          <Text style={styles.quickActionText}>Enviar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => setShowQRModal(true)}
        >
          <Text style={styles.quickActionIcon}>📱</Text>
          <Text style={styles.quickActionText}>Recibir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => setActiveTab("invest")}
        >
          <Text style={styles.quickActionIcon}>📈</Text>
          <Text style={styles.quickActionText}>Invertir</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCurrency(walletData?.totalEarned || 0)}
          </Text>
          <Text style={styles.statLabel}>Total Ganado</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCurrency(walletData?.totalSpent || 0)}
          </Text>
          <Text style={styles.statLabel}>Total Gastado</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCurrency(walletData?.cashback || 0)}
          </Text>
          <Text style={styles.statLabel}>Cashback</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{walletData?.loyaltyPoints || 0}</Text>
          <Text style={styles.statLabel}>Puntos</Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transacciones Recientes</Text>
          <TouchableOpacity onPress={() => setActiveTab("transactions")}>
            <Text style={styles.seeAllText}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {walletData?.transactions.slice(0, 3).map((transaction) => (
          <View key={transaction.id} style={styles.transactionItem}>
            <Text style={styles.transactionIcon}>
              {getTransactionIcon(transaction.type)}
            </Text>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>
                {transaction.description}
              </Text>
              <Text style={styles.transactionDate}>
                {formatDate(transaction.date)}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                { color: getTransactionColor(transaction.type) },
              ]}
            >
              {transaction.amount > 0 ? "+" : ""}
              {formatCurrency(transaction.amount)}
            </Text>
          </View>
        ))}
      </View>

      {/* Cashback Offers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ofertas de Cashback</Text>
        <View style={styles.cashbackOffers}>
          <View style={styles.cashbackOffer}>
            <Text style={styles.cashbackIcon}>🍕</Text>
            <View style={styles.cashbackInfo}>
              <Text style={styles.cashbackTitle}>Pizza Napoli</Text>
              <Text style={styles.cashbackDescription}>10% cashback</Text>
            </View>
          </View>
          <View style={styles.cashbackOffer}>
            <Text style={styles.cashbackIcon}>🌮</Text>
            <View style={styles.cashbackInfo}>
              <Text style={styles.cashbackTitle}>Tacos El Güero</Text>
              <Text style={styles.cashbackDescription}>5% cashback</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderTransactions = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Todas las Transacciones</Text>

      {walletData?.transactions.map((transaction) => (
        <View key={transaction.id} style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionIcon}>
              {getTransactionIcon(transaction.type)}
            </Text>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>
                {transaction.description}
              </Text>
              <Text style={styles.transactionCategory}>
                {transaction.category}
              </Text>
              <Text style={styles.transactionDate}>
                {formatDate(transaction.date)}
              </Text>
            </View>
            <View style={styles.transactionAmountContainer}>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: getTransactionColor(transaction.type) },
                ]}
              >
                {transaction.amount > 0 ? "+" : ""}
                {formatCurrency(transaction.amount)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      transaction.status === "completed" ? "green" : "orange",
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {transaction.status === "completed"
                    ? "Completado"
                    : "Pendiente"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderP2P = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Enviar y Recibir Dinero</Text>

      {/* Quick Send */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Contactos Frecuentes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {walletData?.p2pContacts.map((contact) => (
            <TouchableOpacity key={contact.id} style={styles.contactCard}>
              <Image
                source={{ uri: contact.avatar }}
                style={styles.contactAvatar}
              />
              <Text style={styles.contactName}>{contact.name}</Text>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.contactActionButton}
                  onPress={() => {
                    setSendRecipient(contact.phone);
                    setShowSendModal(true);
                  }}
                >
                  <Text style={styles.contactActionText}>Enviar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactActionButton, styles.requestButton]}
                  onPress={() => requestMoney(contact.id)}
                >
                  <Text style={styles.contactActionText}>Pedir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* QR Code Section */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Código QR</Text>
        <TouchableOpacity
          style={styles.qrSection}
          onPress={() => setShowQRModal(true)}
        >
          <Text style={styles.qrSectionIcon}>📱</Text>
          <View style={styles.qrSectionInfo}>
            <Text style={styles.qrSectionTitle}>Mostrar mi código QR</Text>
            <Text style={styles.qrSectionDescription}>
              Otros usuarios pueden escanearlo para enviarte dinero
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Send Money Form */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Enviar a Nuevo Contacto</Text>
        <TouchableOpacity
          style={styles.sendMoneyButton}
          onPress={() => setShowSendModal(true)}
        >
          <Text style={styles.sendMoneyButtonText}>+ Enviar Dinero</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderInvestments = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Inversiones y Ahorros</Text>

      {/* Investment Summary */}
      <View style={styles.investmentSummary}>
        <Text style={styles.investmentSummaryTitle}>Total Invertido</Text>
        <Text style={styles.investmentSummaryAmount}>
          {formatCurrency(
            investments.reduce((sum, inv) => sum + inv.amount, 0),
          )}
        </Text>
        <Text style={styles.investmentSummaryReturns}>
          Ganancias: +
          {formatCurrency(
            investments.reduce((sum, inv) => sum + inv.returns, 0),
          )}
        </Text>
      </View>

      {/* Investment Options */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Opciones de Inversión</Text>

        <TouchableOpacity style={styles.investmentOption}>
          <Text style={styles.investmentOptionIcon}>💰</Text>
          <View style={styles.investmentOptionInfo}>
            <Text style={styles.investmentOptionTitle}>Ahorro ComeYa</Text>
            <Text style={styles.investmentOptionDescription}>
              8.5% anual • Sin riesgo • Retiro flexible
            </Text>
          </View>
          <Text style={styles.investmentOptionRate}>8.5%</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.investmentOption}>
          <Text style={styles.investmentOptionIcon}>📈</Text>
          <View style={styles.investmentOptionInfo}>
            <Text style={styles.investmentOptionTitle}>
              Inversión Crecimiento
            </Text>
            <Text style={styles.investmentOptionDescription}>
              12% anual • Riesgo moderado • 1 año mínimo
            </Text>
          </View>
          <Text style={styles.investmentOptionRate}>12%</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.investmentOption}>
          <Text style={styles.investmentOptionIcon}>🚀</Text>
          <View style={styles.investmentOptionInfo}>
            <Text style={styles.investmentOptionTitle}>Inversión Agresiva</Text>
            <Text style={styles.investmentOptionDescription}>
              18% anual • Alto riesgo • 2 años mínimo
            </Text>
          </View>
          <Text style={styles.investmentOptionRate}>18%</Text>
        </TouchableOpacity>
      </View>

      {/* Current Investments */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Mis Inversiones</Text>

        {investments.map((investment) => (
          <View key={investment.id} style={styles.investmentCard}>
            <View style={styles.investmentHeader}>
              <Text style={styles.investmentName}>{investment.name}</Text>
              <Text style={styles.investmentStatus}>
                {investment.status === "active" ? "🟢 Activa" : "✅ Vencida"}
              </Text>
            </View>

            <View style={styles.investmentDetails}>
              <Text style={styles.investmentAmount}>
                {formatCurrency(investment.amount)}
              </Text>
              <Text style={styles.investmentRate}>
                {investment.interestRate}% anual
              </Text>
            </View>

            <View style={styles.investmentFooter}>
              <Text style={styles.investmentDuration}>
                {investment.duration}
              </Text>
              <Text style={styles.investmentReturns}>
                +{formatCurrency(investment.returns)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderCards = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Tarjetas Virtuales</Text>

      {/* Virtual Card */}
      <LinearGradient
        colors={["#1e3c72", "#2a5298"]}
        style={styles.virtualCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ComeYa Card</Text>
          <Text style={styles.cardType}>Virtual</Text>
        </View>

        <Text style={styles.cardNumber}>{walletData?.virtualCard.number}</Text>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.cardLabel}>Expira</Text>
            <Text style={styles.cardValue}>
              {walletData?.virtualCard.expiryDate}
            </Text>
          </View>
          <View>
            <Text style={styles.cardLabel}>CVV</Text>
            <Text style={styles.cardValue}>{walletData?.virtualCard.cvv}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Card Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardAction}>
          <Text style={styles.cardActionIcon}>👁️</Text>
          <Text style={styles.cardActionText}>Ver Detalles</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardAction}>
          <Text style={styles.cardActionIcon}>🔒</Text>
          <Text style={styles.cardActionText}>Bloquear</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardAction}>
          <Text style={styles.cardActionIcon}>⚙️</Text>
          <Text style={styles.cardActionText}>Configurar</Text>
        </TouchableOpacity>
      </View>

      {/* Card Benefits */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Beneficios de la Tarjeta</Text>
        <View style={styles.benefits}>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>💳</Text>
            <Text style={styles.benefitText}>Compras online seguras</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🎁</Text>
            <Text style={styles.benefitText}>
              Cashback en todas las compras
            </Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🔒</Text>
            <Text style={styles.benefitText}>Protección contra fraudes</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>📱</Text>
            <Text style={styles.benefitText}>Control total desde la app</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando billetera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ComeYa Wallet</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "overview", label: "Inicio" },
          { key: "transactions", label: "Historial" },
          { key: "p2p", label: "Enviar" },
          { key: "invest", label: "Invertir" },
          { key: "cards", label: "Tarjetas" },
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
        {activeTab === "overview" && renderOverview()}
        {activeTab === "transactions" && renderTransactions()}
        {activeTab === "p2p" && renderP2P()}
        {activeTab === "invest" && renderInvestments()}
        {activeTab === "cards" && renderCards()}
      </View>

      {/* QR Modal */}
      <Modal
        visible={showQRModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <Text style={styles.modalCancel}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Mi Código QR</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.qrContainer}>
            <QRCode
              value={`ComeYa://pay/${user?.id}`}
              size={200}
              backgroundColor="white"
              color="black"
            />
            <Text style={styles.qrText}>
              Comparte este código para recibir dinero
            </Text>
            <Text style={styles.qrSubtext}>ID: {user?.id}</Text>
          </View>
        </View>
      </Modal>

      {/* Send Money Modal */}
      <Modal
        visible={showSendModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSendModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Enviar Dinero</Text>
            <TouchableOpacity onPress={sendMoney}>
              <Text style={styles.modalSave}>Enviar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Destinatario</Text>
            <TextInput
              style={styles.modalInput}
              value={sendRecipient}
              onChangeText={setSendRecipient}
              placeholder="Teléfono o email"
              keyboardType="email-address"
            />

            <Text style={styles.modalSectionTitle}>Monto</Text>
            <TextInput
              style={styles.modalInput}
              value={sendAmount}
              onChangeText={setSendAmount}
              placeholder="0.00"
              keyboardType="numeric"
            />

            <Text style={styles.availableBalance}>
              Saldo disponible: {formatCurrency(walletData?.balance || 0)}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Top Up Modal */}
      <Modal
        visible={showTopUpModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTopUpModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Recargar Billetera</Text>
            <TouchableOpacity onPress={topUpWallet}>
              <Text style={styles.modalSave}>Recargar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Monto a Recargar</Text>
            <TextInput
              style={styles.modalInput}
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              placeholder="0.00"
              keyboardType="numeric"
            />

            <View style={styles.quickAmounts}>
              {[100, 200, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmount}
                  onPress={() => setTopUpAmount(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>${amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 11,
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
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  qrIcon: {
    fontSize: 24,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  balanceSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  pendingBalance: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "600",
  },
  statsGrid: {
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  transactionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  transactionAmountContainer: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: "white",
    fontWeight: "600",
  },
  cashbackOffers: {
    gap: 12,
  },
  cashbackOffer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
  },
  cashbackIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cashbackInfo: {
    flex: 1,
  },
  cashbackTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  cashbackDescription: {
    fontSize: 12,
    color: "green",
    fontWeight: "600",
  },
  contactCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: "center",
    width: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  contactName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 8,
  },
  contactActions: {
    flexDirection: "row",
    gap: 4,
  },
  contactActionButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  requestButton: {
    backgroundColor: Colors.light.background,
  },
  contactActionText: {
    fontSize: 10,
    color: "white",
    fontWeight: "600",
  },
  qrSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
  },
  qrSectionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  qrSectionInfo: {
    flex: 1,
  },
  qrSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  qrSectionDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  sendMoneyButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  sendMoneyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  investmentSummary: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  investmentSummaryTitle: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    marginBottom: 8,
  },
  investmentSummaryAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  investmentSummaryReturns: {
    fontSize: 14,
    color: "green",
    fontWeight: "600",
  },
  investmentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  investmentOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  investmentOptionInfo: {
    flex: 1,
  },
  investmentOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  investmentOptionDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  investmentOptionRate: {
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
  },
  investmentCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  investmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  investmentStatus: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  investmentDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  investmentAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  investmentRate: {
    fontSize: 14,
    fontWeight: "600",
    color: "green",
  },
  investmentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  investmentDuration: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  investmentReturns: {
    fontSize: 14,
    fontWeight: "600",
    color: "green",
  },
  virtualCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  cardType: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 2,
    marginBottom: 24,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardAction: {
    alignItems: "center",
  },
  cardActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardActionText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "600",
  },
  benefits: {
    gap: 12,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
  },
  modalSave: {
    fontSize: 16,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  availableBalance: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    textAlign: "center",
  },
  quickAmounts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  quickAmount: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickAmountText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "600",
  },
  qrContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  qrText: {
    fontSize: 16,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  qrSubtext: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
