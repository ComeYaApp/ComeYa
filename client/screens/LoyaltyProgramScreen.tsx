import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

interface LoyaltyData {
  currentPoints: number;
  totalEarned: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum";
  nextLevel: string;
  pointsToNext: number;
  subscription: {
    isActive: boolean;
    type: "basic" | "premium" | "vip";
    benefits: string[];
    monthlyFee: number;
    savings: number;
  };
  rewards: Array<{
    id: string;
    title: string;
    description: string;
    pointsCost: number;
    type: "discount" | "freeDelivery" | "cashback" | "product";
    value: number;
    available: boolean;
    expiresAt?: string;
  }>;
  history: Array<{
    id: string;
    type: "earned" | "redeemed";
    points: number;
    description: string;
    date: string;
  }>;
}

export default function LoyaltyProgramScreen() {
  const { user } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "rewards" | "subscription" | "history"
  >("overview");
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  const loadLoyaltyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/loyalty/dashboard`,
        {
          headers: { Authorization: `Bearer ${user?.token}` },
        },
      );
      const data = await response.json();

      if (data.success) {
        const mockData: LoyaltyData = {
          currentPoints: data.dashboard.points.currentPoints,
          totalEarned: data.dashboard.points.totalEarned,
          level: data.dashboard.points.tier as any,
          nextLevel: getNextTierName(data.dashboard.points.tier),
          pointsToNext: data.dashboard.points.pointsToNextTier,
          subscription: {
            isActive: false,
            type: "premium",
            benefits: [
              "Entregas gratis ilimitadas",
              "20% descuento en todos los pedidos",
              "Soporte prioritario 24/7",
              "Acceso a ofertas exclusivas",
              "Puntos dobles en pedidos",
            ],
            monthlyFee: 9900,
            savings: 15000,
          },
          rewards: data.dashboard.rewards.map((r: any) => ({
            id: r.id,
            title: r.name,
            description: r.description,
            pointsCost: r.pointsCost,
            type: r.type,
            value: r.discountValue || r.cashbackAmount || 0,
            available: r.isActive,
          })),
          history: data.dashboard.recentActivity.map((a: any) => ({
            id: a.id,
            type: a.type === "earned" ? "earned" : "redeemed",
            points: a.points,
            description: a.description,
            date: new Date(a.createdAt).toLocaleDateString(),
          })),
        };
        setLoyaltyData(mockData);
      }
    } catch (error) {
      console.error("Error loading loyalty data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNextTierName = (tier: string) => {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    const idx = tiers.indexOf(tier.toLowerCase());
    return idx >= 0 && idx < tiers.length - 1
      ? tiers[idx + 1].charAt(0).toUpperCase() + tiers[idx + 1].slice(1)
      : "Max";
  };

  const redeemReward = async (rewardId: string) => {
    const reward = loyaltyData?.rewards.find((r) => r.id === rewardId);
    if (!reward || !loyaltyData) return;

    if (loyaltyData.currentPoints < reward.pointsCost) {
      Alert.alert(
        "Puntos insuficientes",
        "No tienes suficientes puntos para canjear esta recompensa",
      );
      return;
    }

    Alert.alert(
      "Confirmar Canje",
      `¿Quieres canjear "${reward.title}" por ${reward.pointsCost} puntos?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Canjear",
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL}/api/loyalty/redeem`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user?.token}`,
                  },
                  body: JSON.stringify({ rewardId }),
                },
              );

              if (response.ok) {
                Alert.alert("¡Éxito!", "Recompensa canjeada correctamente");
                loadLoyaltyData();
              }
            } catch (error) {
              Alert.alert("Error", "No se pudo canjear la recompensa");
            }
          },
        },
      ],
    );
  };

  const subscribeToProgram = async (type: "basic" | "premium" | "vip") => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/loyalty/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({ subscriptionType: type }),
        },
      );

      if (response.ok) {
        Alert.alert(
          "¡Bienvenido!",
          "Te has suscrito exitosamente al programa premium",
        );
        setShowSubscriptionModal(false);
        loadLoyaltyData();
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo procesar la suscripción");
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Bronze":
        return "#CD7F32";
      case "Silver":
        return "#C0C0C0";
      case "Gold":
        return "#FFD700";
      case "Platinum":
        return "#E5E4E2";
      default:
        return Colors.light.tint;
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "Bronze":
        return "🥉";
      case "Silver":
        return "🥈";
      case "Gold":
        return "🥇";
      case "Platinum":
        return "💎";
      default:
        return "⭐";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "MXN",
    }).format(amount / 100);
  };

  const renderOverview = () => (
    <ScrollView>
      {/* Level Card */}
      <LinearGradient
        colors={[getLevelColor(loyaltyData?.level || "Bronze"), "#ffffff"]}
        style={styles.levelCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.levelHeader}>
          <Text style={styles.levelIcon}>
            {getLevelIcon(loyaltyData?.level || "Bronze")}
          </Text>
          <View style={styles.levelInfo}>
            <Text style={styles.levelTitle}>Nivel {loyaltyData?.level}</Text>
            <Text style={styles.levelSubtitle}>
              {loyaltyData?.pointsToNext} puntos para {loyaltyData?.nextLevel}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((3000 - (loyaltyData?.pointsToNext || 0)) / 3000) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Points Summary */}
      <View style={styles.pointsGrid}>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsValue}>
            {loyaltyData?.currentPoints.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>Puntos Actuales</Text>
        </View>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsValue}>
            {loyaltyData?.totalEarned.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>Total Ganados</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setActiveTab("rewards")}
          >
            <Text style={styles.quickActionIcon}>🎁</Text>
            <Text style={styles.quickActionText}>Canjear Puntos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setShowSubscriptionModal(true)}
          >
            <Text style={styles.quickActionIcon}>⭐</Text>
            <Text style={styles.quickActionText}>Ser Premium</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setActiveTab("history")}
          >
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionText}>Ver Historial</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How to Earn Points */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Cómo Ganar Puntos?</Text>
        <View style={styles.earnMethods}>
          <View style={styles.earnMethod}>
            <Text style={styles.earnIcon}>🛒</Text>
            <View style={styles.earnInfo}>
              <Text style={styles.earnTitle}>Realizar Pedidos</Text>
              <Text style={styles.earnDescription}>
                1 punto por cada $10 pesos
              </Text>
            </View>
            <Text style={styles.earnPoints}>+10pts</Text>
          </View>

          <View style={styles.earnMethod}>
            <Text style={styles.earnIcon}>⭐</Text>
            <View style={styles.earnInfo}>
              <Text style={styles.earnTitle}>Dejar Reseñas</Text>
              <Text style={styles.earnDescription}>
                Reseña con 4+ estrellas
              </Text>
            </View>
            <Text style={styles.earnPoints}>+50pts</Text>
          </View>

          <View style={styles.earnMethod}>
            <Text style={styles.earnIcon}>👥</Text>
            <View style={styles.earnInfo}>
              <Text style={styles.earnTitle}>Referir Amigos</Text>
              <Text style={styles.earnDescription}>
                Por cada amigo que se registre
              </Text>
            </View>
            <Text style={styles.earnPoints}>+200pts</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderRewards = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Recompensas Disponibles</Text>
      <Text style={styles.sectionSubtitle}>
        Tienes {loyaltyData?.currentPoints.toLocaleString()} puntos para canjear
      </Text>

      {loyaltyData?.rewards.map((reward) => (
        <View
          key={reward.id}
          style={[
            styles.rewardCard,
            !reward.available && styles.rewardCardDisabled,
          ]}
        >
          <View style={styles.rewardHeader}>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              {reward.expiresAt && (
                <Text style={styles.rewardExpiry}>
                  Expira: {reward.expiresAt}
                </Text>
              )}
            </View>
            <View style={styles.rewardValue}>
              <Text style={styles.rewardValueText}>
                {reward.type === "discount"
                  ? `${reward.value}%`
                  : formatCurrency(reward.value)}
              </Text>
            </View>
          </View>

          <View style={styles.rewardFooter}>
            <Text style={styles.rewardCost}>{reward.pointsCost} puntos</Text>
            <TouchableOpacity
              style={[
                styles.redeemButton,
                (!reward.available ||
                  (loyaltyData?.currentPoints || 0) < reward.pointsCost) &&
                  styles.redeemButtonDisabled,
              ]}
              onPress={() => redeemReward(reward.id)}
              disabled={
                !reward.available ||
                (loyaltyData?.currentPoints || 0) < reward.pointsCost
              }
            >
              <Text style={styles.redeemButtonText}>
                {!reward.available
                  ? "No Disponible"
                  : (loyaltyData?.currentPoints || 0) < reward.pointsCost
                    ? "Puntos Insuficientes"
                    : "Canjear"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderSubscription = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Programa Premium</Text>

      {loyaltyData?.subscription.isActive ? (
        <View style={styles.activeSubscription}>
          <Text style={styles.activeSubscriptionTitle}>
            ¡Eres Miembro Premium! ⭐
          </Text>
          <Text style={styles.activeSubscriptionSubtitle}>
            Has ahorrado {formatCurrency(loyaltyData.subscription.savings)} este
            mes
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.subscriptionCard}
          onPress={() => setShowSubscriptionModal(true)}
        >
          <LinearGradient
            colors={["#FF6B6B", "#4ECDC4"]}
            style={styles.subscriptionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.subscriptionTitle}>ComeYa Premium</Text>
            <Text style={styles.subscriptionPrice}>
              {formatCurrency(loyaltyData?.subscription.monthlyFee || 0)}/mes
            </Text>
            <Text style={styles.subscriptionCTA}>¡Únete Ahora!</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beneficios Premium</Text>
        {loyaltyData?.subscription.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✅</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Historial de Puntos</Text>

      {loyaltyData?.history.map((item) => (
        <View key={item.id} style={styles.historyItem}>
          <View style={styles.historyInfo}>
            <Text style={styles.historyDescription}>{item.description}</Text>
            <Text style={styles.historyDate}>{item.date}</Text>
          </View>
          <Text
            style={[
              styles.historyPoints,
              { color: item.type === "earned" ? "green" : "red" },
            ]}
          >
            {item.type === "earned" ? "+" : ""}
            {item.points}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando programa de lealtad...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Programa de Lealtad</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "overview", label: "Resumen" },
          { key: "rewards", label: "Recompensas" },
          { key: "subscription", label: "Premium" },
          { key: "history", label: "Historial" },
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
        {activeTab === "rewards" && renderRewards()}
        {activeTab === "subscription" && renderSubscription()}
        {activeTab === "history" && renderHistory()}
      </View>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSubscriptionModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Suscripción Premium</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <LinearGradient
              colors={["#FF6B6B", "#4ECDC4"]}
              style={styles.premiumCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.premiumTitle}>ComeYa Premium</Text>
              <Text style={styles.premiumPrice}>
                {formatCurrency(loyaltyData?.subscription.monthlyFee || 0)}/mes
              </Text>
              <Text style={styles.premiumSavings}>
                Ahorra hasta{" "}
                {formatCurrency(loyaltyData?.subscription.savings || 0)} al mes
              </Text>
            </LinearGradient>

            <View style={styles.benefitsList}>
              {loyaltyData?.subscription.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>✅</Text>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => subscribeToProgram("premium")}
            >
              <Text style={styles.subscribeButtonText}>Suscribirme Ahora</Text>
            </TouchableOpacity>
          </ScrollView>
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
    fontSize: 12,
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
  levelCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  levelIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  levelSubtitle: {
    fontSize: 14,
    color: "white",
    opacity: 0.9,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "white",
    borderRadius: 4,
  },
  pointsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  pointsCard: {
    flex: 1,
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
  pointsValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  pointsLabel: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  quickAction: {
    alignItems: "center",
    padding: 12,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.light.text,
    textAlign: "center",
  },
  earnMethods: {
    gap: 12,
  },
  earnMethod: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
  },
  earnIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  earnDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  earnPoints: {
    fontSize: 14,
    fontWeight: "bold",
    color: "green",
  },
  rewardCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rewardCardDisabled: {
    opacity: 0.6,
  },
  rewardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  rewardExpiry: {
    fontSize: 12,
    color: "orange",
  },
  rewardValue: {
    alignItems: "flex-end",
  },
  rewardValueText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  rewardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardCost: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  redeemButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  redeemButtonDisabled: {
    backgroundColor: Colors.light.tabIconDefault,
  },
  redeemButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  subscriptionCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  subscriptionGradient: {
    padding: 24,
    alignItems: "center",
  },
  subscriptionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subscriptionPrice: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subscriptionCTA: {
    fontSize: 16,
    color: "white",
    opacity: 0.9,
  },
  activeSubscription: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.light.tint,
  },
  activeSubscriptionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 8,
  },
  activeSubscriptionSubtitle: {
    fontSize: 14,
    color: Colors.light.text,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  historyInfo: {
    flex: 1,
  },
  historyDescription: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  historyPoints: {
    fontSize: 16,
    fontWeight: "bold",
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
  modalContent: {
    flex: 1,
    padding: 20,
  },
  premiumCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  premiumTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  premiumPrice: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  premiumSavings: {
    fontSize: 16,
    color: "white",
    opacity: 0.9,
  },
  benefitsList: {
    marginBottom: 24,
  },
  subscribeButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  subscribeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
