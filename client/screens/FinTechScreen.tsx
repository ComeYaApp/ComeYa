import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

interface WalletData {
  balance: number;
  availableCredit: number;
  investments: number;
  monthlyEarnings: number;
  creditScore: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: 'payment' | 'transfer' | 'loan' | 'investment' | 'cashback';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface LoanOffer {
  id: string;
  amount: number;
  interestRate: number;
  term: number;
  monthlyPayment: number;
  approved: boolean;
}

interface InvestmentOption {
  id: string;
  name: string;
  type: 'conservative' | 'moderate' | 'aggressive';
  expectedReturn: number;
  risk: string;
  minAmount: number;
  description: string;
}

export default function FinTechScreen() {
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 2450.75,
    availableCredit: 15000,
    investments: 8750.30,
    monthlyEarnings: 425.60,
    creditScore: 785,
    transactions: [
      {
        id: '1',
        type: 'payment',
        amount: -45.50,
        description: 'Pedido - Tacos El Güero',
        date: '2024-01-15T10:30:00Z',
        status: 'completed'
      },
      {
        id: '2',
        type: 'cashback',
        amount: 12.30,
        description: 'Cashback - Compra en Super Mercado',
        date: '2024-01-14T15:20:00Z',
        status: 'completed'
      },
      {
        id: '3',
        type: 'investment',
        amount: 500,
        description: 'Inversión - Fondo Conservador',
        date: '2024-01-13T09:15:00Z',
        status: 'completed'
      }
    ]
  });

  const [activeTab, setActiveTab] = useState<'wallet' | 'loans' | 'investments' | 'payments'>('wallet');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPhone, setTransferPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loanOffers: LoanOffer[] = [
    {
      id: '1',
      amount: 5000,
      interestRate: 12.5,
      term: 12,
      monthlyPayment: 445.50,
      approved: true
    },
    {
      id: '2',
      amount: 10000,
      interestRate: 15.0,
      term: 24,
      monthlyPayment: 484.97,
      approved: true
    },
    {
      id: '3',
      amount: 25000,
      interestRate: 18.5,
      term: 36,
      monthlyPayment: 906.25,
      approved: false
    }
  ];

  const investmentOptions: InvestmentOption[] = [
    {
      id: '1',
      name: 'Fondo Conservador',
      type: 'conservative',
      expectedReturn: 8.5,
      risk: 'Bajo',
      minAmount: 100,
      description: 'Inversión segura con rendimientos estables'
    },
    {
      id: '2',
      name: 'Fondo Balanceado',
      type: 'moderate',
      expectedReturn: 12.8,
      risk: 'Medio',
      minAmount: 500,
      description: 'Balance entre seguridad y crecimiento'
    },
    {
      id: '3',
      name: 'Fondo Agresivo',
      type: 'aggressive',
      expectedReturn: 18.2,
      risk: 'Alto',
      minAmount: 1000,
      description: 'Mayor potencial de crecimiento con más riesgo'
    }
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const handleTransfer = () => {
    if (!transferAmount || !transferPhone) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount > walletData.balance) {
      Alert.alert('Error', 'Saldo insuficiente');
      return;
    }

    Alert.alert(
      'Confirmar Transferencia',
      `¿Enviar $${amount} a ${transferPhone}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            setWalletData(prev => ({
              ...prev,
              balance: prev.balance - amount,
              transactions: [
                {
                  id: Date.now().toString(),
                  type: 'transfer',
                  amount: -amount,
                  description: `Transferencia a ${transferPhone}`,
                  date: new Date().toISOString(),
                  status: 'completed'
                },
                ...prev.transactions
              ]
            }));
            setShowTransferModal(false);
            setTransferAmount('');
            setTransferPhone('');
            Alert.alert('Éxito', 'Transferencia realizada');
          }
        }
      ]
    );
  };

  const handleLoanRequest = (loan: LoanOffer) => {
    if (!loan.approved) {
      Alert.alert('No Aprobado', 'Este préstamo requiere evaluación adicional');
      return;
    }

    Alert.alert(
      'Solicitar Préstamo',
      `¿Solicitar préstamo de $${loan.amount.toLocaleString()} con pago mensual de $${loan.monthlyPayment}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: () => {
            setWalletData(prev => ({
              ...prev,
              balance: prev.balance + loan.amount,
              transactions: [
                {
                  id: Date.now().toString(),
                  type: 'loan',
                  amount: loan.amount,
                  description: `Préstamo aprobado - ${loan.term} meses`,
                  date: new Date().toISOString(),
                  status: 'completed'
                },
                ...prev.transactions
              ]
            }));
            Alert.alert('Aprobado', 'Préstamo depositado en tu cuenta');
          }
        }
      ]
    );
  };

  const handleInvestment = (investment: InvestmentOption, amount: number) => {
    if (amount < investment.minAmount) {
      Alert.alert('Error', `Monto mínimo: $${investment.minAmount}`);
      return;
    }

    if (amount > walletData.balance) {
      Alert.alert('Error', 'Saldo insuficiente');
      return;
    }

    Alert.alert(
      'Confirmar Inversión',
      `¿Invertir $${amount} en ${investment.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Invertir',
          onPress: () => {
            setWalletData(prev => ({
              ...prev,
              balance: prev.balance - amount,
              investments: prev.investments + amount,
              transactions: [
                {
                  id: Date.now().toString(),
                  type: 'investment',
                  amount: -amount,
                  description: `Inversión en ${investment.name}`,
                  date: new Date().toISOString(),
                  status: 'completed'
                },
                ...prev.transactions
              ]
            }));
            setShowInvestModal(false);
            Alert.alert('Éxito', 'Inversión realizada');
          }
        }
      ]
    );
  };

  const renderWalletTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Balance Card */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Ionicons name="wallet" size={24} color="white" />
        </View>
        <Text style={styles.balanceAmount}>${walletData.balance.toLocaleString()}</Text>
        <View style={styles.balanceActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowTransferModal(true)}
          >
            <Ionicons name="send" size={20} color="white" />
            <Text style={styles.actionText}>Enviar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.actionText}>Recargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="qr-code" size={20} color="white" />
            <Text style={styles.actionText}>QR</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialIcons name="trending-up" size={24} color={Colors.success} />
          <Text style={styles.statValue}>${walletData.monthlyEarnings}</Text>
          <Text style={styles.statLabel}>Ganancias del Mes</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="account-balance" size={24} color={Colors.primary} />
          <Text style={styles.statValue}>${walletData.investments.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Inversiones</Text>
        </View>
      </View>

      {/* Credit Score */}
      <View style={styles.creditCard}>
        <View style={styles.creditHeader}>
          <Text style={styles.creditTitle}>Score Crediticio</Text>
          <Text style={styles.creditScore}>{walletData.creditScore}</Text>
        </View>
        <View style={styles.creditBar}>
          <View style={[styles.creditProgress, { width: `${(walletData.creditScore / 850) * 100}%` }]} />
        </View>
        <Text style={styles.creditLabel}>Excelente - Crédito disponible: ${walletData.availableCredit.toLocaleString()}</Text>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactionsContainer}>
        <Text style={styles.sectionTitle}>Transacciones Recientes</Text>
        {walletData.transactions.slice(0, 5).map((transaction) => (
          <View key={transaction.id} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <Ionicons 
                name={
                  transaction.type === 'payment' ? 'restaurant' :
                  transaction.type === 'transfer' ? 'send' :
                  transaction.type === 'loan' ? 'card' :
                  transaction.type === 'investment' ? 'trending-up' :
                  'gift'
                } 
                size={20} 
                color={transaction.amount > 0 ? Colors.success : Colors.error} 
              />
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDescription}>{transaction.description}</Text>
              <Text style={styles.transactionDate}>
                {new Date(transaction.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={[
              styles.transactionAmount,
              { color: transaction.amount > 0 ? Colors.success : Colors.error }
            ]}>
              {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderLoansTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Préstamos Disponibles</Text>
      <Text style={styles.sectionSubtitle}>
        Basado en tu historial crediticio y actividad en ComeYa
      </Text>

      {loanOffers.map((loan) => (
        <View key={loan.id} style={styles.loanCard}>
          <View style={styles.loanHeader}>
            <Text style={styles.loanAmount}>${loan.amount.toLocaleString()}</Text>
            <View style={[
              styles.loanStatus,
              { backgroundColor: loan.approved ? Colors.success : Colors.warning }
            ]}>
              <Text style={styles.loanStatusText}>
                {loan.approved ? 'Pre-aprobado' : 'Evaluación'}
              </Text>
            </View>
          </View>
          
          <View style={styles.loanDetails}>
            <View style={styles.loanDetailItem}>
              <Text style={styles.loanDetailLabel}>Tasa de Interés</Text>
              <Text style={styles.loanDetailValue}>{loan.interestRate}% anual</Text>
            </View>
            <View style={styles.loanDetailItem}>
              <Text style={styles.loanDetailLabel}>Plazo</Text>
              <Text style={styles.loanDetailValue}>{loan.term} meses</Text>
            </View>
            <View style={styles.loanDetailItem}>
              <Text style={styles.loanDetailLabel}>Pago Mensual</Text>
              <Text style={styles.loanDetailValue}>${loan.monthlyPayment}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.loanButton,
              { backgroundColor: loan.approved ? Colors.primary : Colors.gray }
            ]}
            onPress={() => handleLoanRequest(loan)}
            disabled={!loan.approved}
          >
            <Text style={styles.loanButtonText}>
              {loan.approved ? 'Solicitar Ahora' : 'Requiere Evaluación'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const renderInvestmentsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Opciones de Inversión</Text>
      <Text style={styles.sectionSubtitle}>
        Haz crecer tu dinero con nuestros fondos de inversión
      </Text>

      {investmentOptions.map((investment) => (
        <View key={investment.id} style={styles.investmentCard}>
          <View style={styles.investmentHeader}>
            <Text style={styles.investmentName}>{investment.name}</Text>
            <View style={[
              styles.riskBadge,
              { 
                backgroundColor: 
                  investment.type === 'conservative' ? Colors.success :
                  investment.type === 'moderate' ? Colors.warning :
                  Colors.error
              }
            ]}>
              <Text style={styles.riskText}>{investment.risk}</Text>
            </View>
          </View>

          <Text style={styles.investmentDescription}>{investment.description}</Text>

          <View style={styles.investmentStats}>
            <View style={styles.investmentStat}>
              <Text style={styles.investmentStatLabel}>Rendimiento Esperado</Text>
              <Text style={styles.investmentStatValue}>{investment.expectedReturn}% anual</Text>
            </View>
            <View style={styles.investmentStat}>
              <Text style={styles.investmentStatLabel}>Inversión Mínima</Text>
              <Text style={styles.investmentStatValue}>${investment.minAmount}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.investButton}
            onPress={() => setShowInvestModal(true)}
          >
            <Text style={styles.investButtonText}>Invertir Ahora</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const renderPaymentsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Servicios de Pago</Text>
      
      {/* Payment Services */}
      <View style={styles.servicesGrid}>
        <TouchableOpacity style={styles.serviceCard}>
          <Ionicons name="phone-portrait" size={32} color={Colors.primary} />
          <Text style={styles.serviceTitle}>Recarga Celular</Text>
          <Text style={styles.serviceSubtitle}>Todas las compañías</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard}>
          <MaterialIcons name="receipt" size={32} color={Colors.primary} />
          <Text style={styles.serviceTitle}>Pagar Servicios</Text>
          <Text style={styles.serviceSubtitle}>Luz, agua, gas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard}>
          <MaterialIcons name="school" size={32} color={Colors.primary} />
          <Text style={styles.serviceTitle}>Colegiaturas</Text>
          <Text style={styles.serviceSubtitle}>Escuelas y universidades</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serviceCard}>
          <MaterialIcons name="local-government" size={32} color={Colors.primary} />
          <Text style={styles.serviceTitle}>Gobierno</Text>
          <Text style={styles.serviceSubtitle}>Multas y trámites</Text>
        </TouchableOpacity>
      </View>

      {/* Virtual Card */}
      <View style={styles.virtualCardContainer}>
        <Text style={styles.sectionTitle}>Tarjeta Virtual ComeYa</Text>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.virtualCard}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>ComeYa Card</Text>
            <MaterialIcons name="contactless-payment" size={24} color="white" />
          </View>
          <Text style={styles.cardNumber}>**** **** **** 1234</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardHolder}>Juan Pérez</Text>
            <Text style={styles.cardExpiry}>12/27</Text>
          </View>
        </LinearGradient>
        
        <TouchableOpacity style={styles.cardButton}>
          <Text style={styles.cardButtonText}>Solicitar Tarjeta Física</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ComeYa FinTech</Text>
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'wallet' && styles.activeTab]}
          onPress={() => setActiveTab('wallet')}
        >
          <Ionicons name="wallet" size={20} color={activeTab === 'wallet' ? Colors.primary : Colors.gray} />
          <Text style={[styles.tabText, activeTab === 'wallet' && styles.activeTabText]}>Billetera</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'loans' && styles.activeTab]}
          onPress={() => setActiveTab('loans')}
        >
          <MaterialIcons name="account-balance" size={20} color={activeTab === 'loans' ? Colors.primary : Colors.gray} />
          <Text style={[styles.tabText, activeTab === 'loans' && styles.activeTabText]}>Préstamos</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'investments' && styles.activeTab]}
          onPress={() => setActiveTab('investments')}
        >
          <MaterialIcons name="trending-up" size={20} color={activeTab === 'investments' ? Colors.primary : Colors.gray} />
          <Text style={[styles.tabText, activeTab === 'investments' && styles.activeTabText]}>Inversiones</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'payments' && styles.activeTab]}
          onPress={() => setActiveTab('payments')}
        >
          <MaterialIcons name="payment" size={20} color={activeTab === 'payments' ? Colors.primary : Colors.gray} />
          <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>Pagos</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'wallet' && renderWalletTab()}
      {activeTab === 'loans' && renderLoansTab()}
      {activeTab === 'investments' && renderInvestmentsTab()}
      {activeTab === 'payments' && renderPaymentsTab()}

      {/* Transfer Modal */}
      <Modal visible={showTransferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enviar Dinero</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Número de teléfono"
              value={transferPhone}
              onChangeText={setTransferPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Cantidad"
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTransferModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleTransfer}
              >
                <Text style={styles.confirmButtonText}>Enviar</Text>
              </TouchableOpacity>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 5,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: Colors.gray,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  balanceLabel: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray,
    textAlign: 'center',
  },
  creditCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  creditTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  creditScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.success,
  },
  creditBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginBottom: 10,
  },
  creditProgress: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  creditLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  transactionsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loanCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  loanAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  loanStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  loanStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loanDetails: {
    marginBottom: 20,
  },
  loanDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  loanDetailLabel: {
    fontSize: 14,
    color: Colors.gray,
  },
  loanDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  loanButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  loanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  investmentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  investmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  investmentDescription: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 15,
  },
  investmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  investmentStat: {
    alignItems: 'center',
  },
  investmentStatLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 5,
  },
  investmentStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  investButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  investButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 30,
  },
  serviceCard: {
    width: (width - 55) / 2,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    gap: 10,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  serviceSubtitle: {
    fontSize: 12,
    color: Colors.gray,
    textAlign: 'center',
  },
  virtualCardContainer: {
    marginBottom: 20,
  },
  virtualCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    height: 200,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardNumber: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardHolder: {
    color: 'white',
    fontSize: 14,
  },
  cardExpiry: {
    color: 'white',
    fontSize: 14,
  },
  cardButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: width - 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});