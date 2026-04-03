import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

interface UserLevel {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  benefits: string[];
  icon: string;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'freeDelivery' | 'cashback' | 'product';
  value: number;
  available: boolean;
  expiresAt?: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  type: 'orders' | 'spending' | 'reviews' | 'referrals';
  expiresAt: string;
  completed: boolean;
}

interface Subscription {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  popular?: boolean;
  savings: number;
}

export default function LoyaltyScreen() {
  const [userPoints, setUserPoints] = useState(2450);
  const [userLevel, setUserLevel] = useState('gold');
  const [totalSpent, setTotalSpent] = useState(15750);
  const [ordersCount, setOrdersCount] = useState(87);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'challenges' | 'premium'>('overview');
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));

  const levels: UserLevel[] = [
    {
      id: 'bronze',
      name: 'Bronce',
      minPoints: 0,
      maxPoints: 999,
      color: '#CD7F32',
      benefits: ['5% cashback', 'Soporte básico'],
      icon: 'medal'
    },
    {
      id: 'silver',
      name: 'Plata',
      minPoints: 1000,
      maxPoints: 2499,
      color: '#C0C0C0',
      benefits: ['8% cashback', 'Entrega gratis 1x/mes', 'Soporte prioritario'],
      icon: 'medal'
    },
    {
      id: 'gold',
      name: 'Oro',
      minPoints: 2500,
      maxPoints: 4999,
      color: '#FFD700',
      benefits: ['12% cashback', 'Entrega gratis ilimitada', 'Descuentos exclusivos', 'Soporte VIP'],
      icon: 'medal'
    },
    {
      id: 'platinum',
      name: 'Platino',
      minPoints: 5000,
      maxPoints: 9999,
      color: '#E5E4E2',
      benefits: ['15% cashback', 'Entrega gratis + express', 'Acceso anticipado', 'Concierge personal'],
      icon: 'diamond'
    },
    {
      id: 'diamond',
      name: 'Diamante',
      minPoints: 10000,
      maxPoints: 999999,
      color: '#B9F2FF',
      benefits: ['20% cashback', 'Beneficios premium', 'Eventos exclusivos', 'Gerente dedicado'],
      icon: 'diamond'
    }
  ];

  const rewards: Reward[] = [
    {
      id: '1',
      title: '20% Descuento',
      description: 'En tu próximo pedido',
      pointsCost: 500,
      type: 'discount',
      value: 20,
      available: true
    },
    {
      id: '2',
      title: 'Entrega Gratis',
      description: 'Válido por 30 días',
      pointsCost: 300,
      type: 'freeDelivery',
      value: 1,
      available: true
    },
    {
      id: '3',
      title: '$50 Cashback',
      description: 'Directo a tu billetera',
      pointsCost: 1000,
      type: 'cashback',
      value: 50,
      available: true
    },
    {
      id: '4',
      title: 'Tacos Gratis',
      description: 'Orden de 3 tacos en El Güero',
      pointsCost: 800,
      type: 'product',
      value: 85,
      available: false,
      expiresAt: '2024-02-01'
    }
  ];

  const challenges: Challenge[] = [
    {
      id: '1',
      title: 'Explorador Semanal',
      description: 'Ordena de 3 restaurantes diferentes',
      progress: 2,
      target: 3,
      reward: 200,
      type: 'orders',
      expiresAt: '2024-01-21',
      completed: false
    },
    {
      id: '2',
      title: 'Gran Gastador',
      description: 'Gasta $500 este mes',
      progress: 350,
      target: 500,
      reward: 300,
      type: 'spending',
      expiresAt: '2024-01-31',
      completed: false
    },
    {
      id: '3',
      title: 'Crítico Gastronómico',
      description: 'Deja 5 reseñas con fotos',
      progress: 5,
      target: 5,
      reward: 150,
      type: 'reviews',
      expiresAt: '2024-01-25',
      completed: true
    }
  ];

  const subscriptions: Subscription[] = [
    {
      id: 'basic',
      name: 'ComeYa Plus',
      price: 99,
      benefits: [
        'Entrega gratis ilimitada',
        '10% descuento en todos los pedidos',
        'Soporte prioritario',
        'Acceso a ofertas exclusivas'
      ],
      savings: 300
    },
    {
      id: 'premium',
      name: 'ComeYa Premium',
      price: 199,
      benefits: [
        'Todo de ComeYa Plus',
        '15% descuento en todos los pedidos',
        'Entrega express gratis',
        'Cashback del 5%',
        'Acceso anticipado a nuevos restaurantes',
        'Concierge gastronómico'
      ],
      popular: true,
      savings: 600
    }
  ];

  const getCurrentLevel = () => {
    return levels.find(level => level.id === userLevel) || levels[0];
  };

  const getNextLevel = () => {
    const currentLevelIndex = levels.findIndex(level => level.id === userLevel);
    return currentLevelIndex < levels.length - 1 ? levels[currentLevelIndex + 1] : null;
  };

  const getLevelProgress = () => {
    const current = getCurrentLevel();
    const next = getNextLevel();
    if (!next) return 100;
    
    const progress = ((userPoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100;
    return Math.min(progress, 100);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const redeemReward = (reward: Reward) => {
    if (userPoints < reward.pointsCost) {
      Alert.alert('Puntos Insuficientes', 'No tienes suficientes puntos para canjear esta recompensa');
      return;
    }

    Alert.alert(
      'Confirmar Canje',
      `¿Canjear ${reward.title} por ${reward.pointsCost} puntos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Canjear',
          onPress: () => {
            setUserPoints(prev => prev - reward.pointsCost);
            setShowRewardModal(false);
            Alert.alert('¡Éxito!', 'Recompensa canjeada exitosamente');
          }
        }
      ]
    );
  };

  const claimChallenge = (challenge: Challenge) => {
    if (!challenge.completed) return;

    setUserPoints(prev => prev + challenge.reward);
    Alert.alert('¡Desafío Completado!', `Has ganado ${challenge.reward} puntos`);
  };

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: getLevelProgress(),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [userPoints]);

  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Level Card */}
      <LinearGradient
        colors={[getCurrentLevel().color, getCurrentLevel().color + '80']}
        style={styles.levelCard}
      >
        <View style={styles.levelHeader}>
          <View style={styles.levelInfo}>
            <Ionicons name={getCurrentLevel().icon as any} size={32} color="white" />
            <View style={styles.levelText}>
              <Text style={styles.levelName}>{getCurrentLevel().name}</Text>
              <Text style={styles.levelPoints}>{userPoints.toLocaleString()} puntos</Text>
            </View>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Nivel {levels.findIndex(l => l.id === userLevel) + 1}</Text>
          </View>
        </View>

        {getNextLevel() && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                Progreso a {getNextLevel()?.name}
              </Text>
              <Text style={styles.progressPoints}>
                {getNextLevel()?.minPoints! - userPoints} puntos restantes
              </Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill,
                  {
                    width: animatedValue.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    })
                  }
                ]} 
              />
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialIcons name="shopping-bag" size={24} color={Colors.primary} />
          <Text style={styles.statValue}>{ordersCount}</Text>
          <Text style={styles.statLabel}>Pedidos</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="attach-money" size={24} color={Colors.success} />
          <Text style={styles.statValue}>${totalSpent.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Gastado</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="star" size={24} color={Colors.warning} />
          <Text style={styles.statValue}>{Math.floor(userPoints * 0.05)}</Text>
          <Text style={styles.statLabel}>Cashback</Text>
        </View>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsContainer}>
        <Text style={styles.sectionTitle}>Beneficios Actuales</Text>
        {getCurrentLevel().benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Actividad Reciente</Text>
        <View style={styles.activityItem}>
          <View style={styles.activityIcon}>
            <Ionicons name="add" size={16} color={Colors.success} />
          </View>
          <View style={styles.activityDetails}>
            <Text style={styles.activityTitle}>+50 puntos</Text>
            <Text style={styles.activityDescription}>Pedido en Tacos El Güero</Text>
          </View>
          <Text style={styles.activityTime}>Hace 2h</Text>
        </View>
        
        <View style={styles.activityItem}>
          <View style={styles.activityIcon}>
            <Ionicons name="gift" size={16} color={Colors.primary} />
          </View>
          <View style={styles.activityDetails}>
            <Text style={styles.activityTitle}>Recompensa canjeada</Text>
            <Text style={styles.activityDescription}>Entrega gratis</Text>
          </View>
          <Text style={styles.activityTime}>Ayer</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderRewardsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Canjea tus Puntos</Text>
      <Text style={styles.sectionSubtitle}>
        Tienes {userPoints.toLocaleString()} puntos disponibles
      </Text>

      {rewards.map((reward) => (
        <TouchableOpacity
          key={reward.id}
          style={[styles.rewardCard, !reward.available && styles.rewardCardDisabled]}
          onPress={() => {
            setSelectedReward(reward);
            setShowRewardModal(true);
          }}
          disabled={!reward.available}
        >
          <View style={styles.rewardIcon}>
            <Ionicons 
              name={
                reward.type === 'discount' ? 'pricetag' :
                reward.type === 'freeDelivery' ? 'bicycle' :
                reward.type === 'cashback' ? 'wallet' :
                'gift'
              } 
              size={24} 
              color={reward.available ? Colors.primary : Colors.gray} 
            />
          </View>
          
          <View style={styles.rewardDetails}>
            <Text style={[styles.rewardTitle, !reward.available && styles.rewardTitleDisabled]}>
              {reward.title}
            </Text>
            <Text style={[styles.rewardDescription, !reward.available && styles.rewardDescriptionDisabled]}>
              {reward.description}
            </Text>
            {reward.expiresAt && (
              <Text style={styles.rewardExpiry}>
                Expira: {new Date(reward.expiresAt).toLocaleDateString()}
              </Text>
            )}
          </View>
          
          <View style={styles.rewardCost}>
            <Text style={[styles.rewardPoints, !reward.available && styles.rewardPointsDisabled]}>
              {reward.pointsCost}
            </Text>
            <Text style={[styles.rewardPointsLabel, !reward.available && styles.rewardPointsLabelDisabled]}>
              puntos
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderChallengesTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Desafíos Activos</Text>
      <Text style={styles.sectionSubtitle}>
        Completa desafíos para ganar puntos extra
      </Text>

      {challenges.map((challenge) => (
        <View key={challenge.id} style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <View style={styles.challengeIcon}>
              <Ionicons 
                name={
                  challenge.type === 'orders' ? 'restaurant' :
                  challenge.type === 'spending' ? 'card' :
                  challenge.type === 'reviews' ? 'star' :
                  'people'
                } 
                size={20} 
                color={challenge.completed ? Colors.success : Colors.primary} 
              />
            </View>
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <Text style={styles.challengeDescription}>{challenge.description}</Text>
            </View>
            <View style={styles.challengeReward}>
              <Text style={styles.challengeRewardPoints}>+{challenge.reward}</Text>
              <Text style={styles.challengeRewardLabel}>puntos</Text>
            </View>
          </View>

          <View style={styles.challengeProgress}>
            <View style={styles.challengeProgressBar}>
              <View 
                style={[
                  styles.challengeProgressFill,
                  { width: `${(challenge.progress / challenge.target) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.challengeProgressText}>
              {challenge.progress}/{challenge.target}
            </Text>
          </View>

          <View style={styles.challengeFooter}>
            <Text style={styles.challengeExpiry}>
              Expira: {new Date(challenge.expiresAt).toLocaleDateString()}
            </Text>
            {challenge.completed && (
              <TouchableOpacity 
                style={styles.claimButton}
                onPress={() => claimChallenge(challenge)}
              >
                <Text style={styles.claimButtonText}>Reclamar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPremiumTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Suscripciones Premium</Text>
      <Text style={styles.sectionSubtitle}>
        Desbloquea beneficios exclusivos y ahorra más
      </Text>

      {subscriptions.map((subscription) => (
        <View key={subscription.id} style={[
          styles.subscriptionCard,
          subscription.popular && styles.popularSubscription
        ]}>
          {subscription.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>MÁS POPULAR</Text>
            </View>
          )}

          <View style={styles.subscriptionHeader}>
            <Text style={styles.subscriptionName}>{subscription.name}</Text>
            <View style={styles.subscriptionPrice}>
              <Text style={styles.subscriptionPriceAmount}>${subscription.price}</Text>
              <Text style={styles.subscriptionPriceLabel}>/mes</Text>
            </View>
          </View>

          <Text style={styles.subscriptionSavings}>
            Ahorra hasta ${subscription.savings} al mes
          </Text>

          <View style={styles.subscriptionBenefits}>
            {subscription.benefits.map((benefit, index) => (
              <View key={index} style={styles.subscriptionBenefit}>
                <Ionicons name="checkmark" size={16} color={Colors.success} />
                <Text style={styles.subscriptionBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[
            styles.subscriptionButton,
            subscription.popular && styles.popularSubscriptionButton
          ]}>
            <Text style={[
              styles.subscriptionButtonText,
              subscription.popular && styles.popularSubscriptionButtonText
            ]}>
              Suscribirse Ahora
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Free Trial Banner */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        style={styles.trialBanner}
      >
        <Ionicons name="gift" size={32} color="white" />
        <View style={styles.trialContent}>
          <Text style={styles.trialTitle}>Prueba Gratis por 7 Días</Text>
          <Text style={styles.trialDescription}>
            Disfruta todos los beneficios premium sin costo
          </Text>
        </View>
        <TouchableOpacity style={styles.trialButton}>
          <Text style={styles.trialButtonText}>Iniciar</Text>
        </TouchableOpacity>
      </LinearGradient>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Programa de Lealtad</Text>
        <TouchableOpacity>
          <Ionicons name="gift" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Resumen
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'rewards' && styles.activeTab]}
          onPress={() => setActiveTab('rewards')}
        >
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
            Recompensas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
          onPress={() => setActiveTab('challenges')}
        >
          <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>
            Desafíos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'premium' && styles.activeTab]}
          onPress={() => setActiveTab('premium')}
        >
          <Text style={[styles.tabText, activeTab === 'premium' && styles.activeTabText]}>
            Premium
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'rewards' && renderRewardsTab()}
      {activeTab === 'challenges' && renderChallengesTab()}
      {activeTab === 'premium' && renderPremiumTab()}

      {/* Reward Modal */}
      <Modal visible={showRewardModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReward && (
              <>
                <View style={styles.modalHeader}>
                  <Ionicons 
                    name={
                      selectedReward.type === 'discount' ? 'pricetag' :
                      selectedReward.type === 'freeDelivery' ? 'bicycle' :
                      selectedReward.type === 'cashback' ? 'wallet' :
                      'gift'
                    } 
                    size={48} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.modalTitle}>{selectedReward.title}</Text>
                  <Text style={styles.modalDescription}>{selectedReward.description}</Text>
                </View>

                <View style={styles.modalCost}>
                  <Text style={styles.modalCostLabel}>Costo:</Text>
                  <Text style={styles.modalCostValue}>{selectedReward.pointsCost} puntos</Text>
                </View>

                <View style={styles.modalBalance}>
                  <Text style={styles.modalBalanceLabel}>Tu saldo:</Text>
                  <Text style={styles.modalBalanceValue}>{userPoints.toLocaleString()} puntos</Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={() => setShowRewardModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.modalRedeemButton,
                      userPoints < selectedReward.pointsCost && styles.modalRedeemButtonDisabled
                    ]}
                    onPress={() => redeemReward(selectedReward)}
                    disabled={userPoints < selectedReward.pointsCost}
                  >
                    <Text style={styles.modalRedeemText}>Canjear</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    alignItems: 'center',
    paddingVertical: 15,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.gray,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  levelCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  levelText: {
    gap: 5,
  },
  levelName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  levelPoints: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  levelBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
  },
  progressPoints: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
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
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  benefitsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
  },
  activityContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  activityDescription: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.gray,
  },
  rewardCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardCardDisabled: {
    opacity: 0.6,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  rewardDetails: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  rewardTitleDisabled: {
    color: Colors.gray,
  },
  rewardDescription: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  rewardDescriptionDisabled: {
    color: Colors.lightGray,
  },
  rewardExpiry: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 4,
  },
  rewardCost: {
    alignItems: 'center',
  },
  rewardPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  rewardPointsDisabled: {
    color: Colors.gray,
  },
  rewardPointsLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  rewardPointsLabelDisabled: {
    color: Colors.lightGray,
  },
  challengeCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  challengeDescription: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  challengeReward: {
    alignItems: 'center',
  },
  challengeRewardPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.success,
  },
  challengeRewardLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  challengeProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  challengeProgressText: {
    fontSize: 12,
    color: Colors.gray,
    minWidth: 40,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeExpiry: {
    fontSize: 12,
    color: Colors.gray,
  },
  claimButton: {
    backgroundColor: Colors.success,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  claimButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    position: 'relative',
  },
  popularSubscription: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subscriptionName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subscriptionPrice: {
    alignItems: 'center',
  },
  subscriptionPriceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subscriptionPriceLabel: {
    fontSize: 14,
    color: Colors.gray,
  },
  subscriptionSavings: {
    fontSize: 14,
    color: Colors.success,
    marginBottom: 20,
  },
  subscriptionBenefits: {
    marginBottom: 20,
  },
  subscriptionBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  subscriptionBenefitText: {
    fontSize: 14,
    color: Colors.text,
  },
  subscriptionButton: {
    backgroundColor: Colors.background,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  popularSubscriptionButton: {
    backgroundColor: Colors.primary,
  },
  subscriptionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  popularSubscriptionButtonText: {
    color: 'white',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 15,
    gap: 15,
  },
  trialContent: {
    flex: 1,
  },
  trialTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  trialDescription: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  trialButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  trialButtonText: {
    color: Colors.primary,
    fontSize: 14,
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
    borderRadius: 20,
    padding: 30,
    width: width - 40,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 15,
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
  },
  modalCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  modalCostLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  modalCostValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  modalBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 30,
  },
  modalBalanceLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  modalBalanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalRedeemButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalRedeemButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalRedeemText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});