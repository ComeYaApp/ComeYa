import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";

interface RecommendationData {
  personalizedForYou: Array<{
    id: string;
    type: "restaurant" | "product" | "category";
    name: string;
    description: string;
    imageUrl: string;
    rating: number;
    price?: number;
    estimatedTime?: number;
    confidence: number;
    reason: string;
  }>;
  trendingNow: Array<{
    id: string;
    name: string;
    imageUrl: string;
    orderCount: number;
    trendScore: number;
  }>;
  basedOnWeather: Array<{
    id: string;
    name: string;
    imageUrl: string;
    weatherReason: string;
  }>;
  reorderSuggestions: Array<{
    id: string;
    name: string;
    imageUrl: string;
    lastOrdered: string;
    frequency: number;
  }>;
  similarUsers: Array<{
    id: string;
    name: string;
    similarity: number;
    favoriteRestaurant: string;
  }>;
  predictedOrders: Array<{
    day: string;
    probability: number;
    suggestedTime: string;
    suggestedItems: string[];
  }>;
}

interface UserPreferences {
  cuisineTypes: string[];
  priceRange: "budget" | "mid" | "premium";
  dietaryRestrictions: string[];
  preferredOrderTimes: string[];
  favoriteCategories: string[];
  spiceLevel: number;
  healthScore: number;
}

export default function AIRecommendationsScreen() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] =
    useState<RecommendationData | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "foryou" | "trending" | "predictions" | "preferences"
  >("foryou");

  useEffect(() => {
    if (user?.id) {
      loadRecommendations();
      loadUserPreferences();
    }
  }, [user?.id]);

  const loadRecommendations = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/ai/personalized`,
        {
          headers: { Authorization: `Bearer ${user?.token}` },
        },
      );
      const data = await response.json();

      if (data.success) {
        setRecommendations({
          personalizedForYou: data.recommendations.map((r: any) => ({
            id: r.id,
            type: r.itemType,
            name: r.itemData?.name || "Producto",
            description: r.reason,
            imageUrl:
              r.itemData?.image || "https://via.placeholder.com/100x100",
            rating: r.itemData?.rating ? r.itemData.rating / 10 : 4.5,
            price: r.itemData?.price,
            confidence: r.confidenceScore,
            reason: r.reason,
          })),
          trendingNow: [],
          basedOnWeather: [],
          reorderSuggestions: [],
          similarUsers: [],
          predictedOrders: [],
        });
      }
    } catch (error) {
      console.error("Error loading recommendations:", error);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const mockPreferences: UserPreferences = {
        cuisineTypes: ["Mexicana", "Italiana", "Asiática"],
        priceRange: "mid",
        dietaryRestrictions: ["Sin gluten"],
        preferredOrderTimes: ["19:00-21:00", "13:00-15:00"],
        favoriteCategories: ["Pizza", "Tacos", "Postres"],
        spiceLevel: 3,
        healthScore: 7,
      };

      setPreferences(mockPreferences);
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (
    newPreferences: Partial<UserPreferences>,
  ) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/ai/preferences`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify(newPreferences),
        },
      );

      if (response.ok) {
        Alert.alert(
          "Éxito",
          "Preferencias actualizadas. Las recomendaciones mejorarán.",
        );
        loadRecommendations();
      }
    } catch (error) {
      Alert.alert("Error", "No se pudieron actualizar las preferencias");
    }
  };

  const orderRecommendation = async (itemId: string, type: string) => {
    Alert.alert(
      "Ordenar Recomendación",
      "¿Quieres agregar este elemento a tu carrito?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Agregar",
          onPress: () => {
            // Navigate to product/restaurant detail
            Alert.alert("Éxito", "Agregado al carrito");
          },
        },
      ],
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "MXN",
    }).format(amount / 100);
  };

  const renderForYou = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Recomendado Para Ti</Text>
      <Text style={styles.sectionSubtitle}>
        Basado en tu historial y preferencias
      </Text>

      {recommendations?.personalizedForYou.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.recommendationCard}
          onPress={() => orderRecommendation(item.id, item.type)}
        >
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.recommendationImage}
          />
          <View style={styles.recommendationInfo}>
            <View style={styles.recommendationHeader}>
              <Text style={styles.recommendationName}>{item.name}</Text>
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceText}>{item.confidence}%</Text>
                <Text style={styles.confidenceLabel}>match</Text>
              </View>
            </View>

            <Text style={styles.recommendationDescription}>
              {item.description}
            </Text>
            <Text style={styles.recommendationReason}>💡 {item.reason}</Text>

            <View style={styles.recommendationMeta}>
              <Text style={styles.recommendationRating}>⭐ {item.rating}</Text>
              {item.price && (
                <Text style={styles.recommendationPrice}>
                  {formatCurrency(item.price)}
                </Text>
              )}
              {item.estimatedTime && (
                <Text style={styles.recommendationTime}>
                  🕐 {item.estimatedTime} min
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Weather-based recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Perfecto para el Clima</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recommendations?.basedOnWeather.map((item) => (
            <TouchableOpacity key={item.id} style={styles.weatherCard}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.weatherImage}
              />
              <Text style={styles.weatherName}>{item.name}</Text>
              <Text style={styles.weatherReason}>{item.weatherReason}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Reorder suggestions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Volver a Pedir</Text>
        {recommendations?.reorderSuggestions.map((item) => (
          <TouchableOpacity key={item.id} style={styles.reorderCard}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.reorderImage}
            />
            <View style={styles.reorderInfo}>
              <Text style={styles.reorderName}>{item.name}</Text>
              <Text style={styles.reorderDetails}>
                Última vez: {item.lastOrdered} • Pedido {item.frequency} veces
              </Text>
            </View>
            <TouchableOpacity style={styles.reorderButton}>
              <Text style={styles.reorderButtonText}>Pedir</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderTrending = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Tendencias Ahora</Text>
      <Text style={styles.sectionSubtitle}>Lo más popular en tu área</Text>

      {recommendations?.trendingNow.map((item, index) => (
        <TouchableOpacity key={item.id} style={styles.trendingCard}>
          <View style={styles.trendingRank}>
            <Text style={styles.trendingRankText}>#{index + 1}</Text>
          </View>
          <Image source={{ uri: item.imageUrl }} style={styles.trendingImage} />
          <View style={styles.trendingInfo}>
            <Text style={styles.trendingName}>{item.name}</Text>
            <Text style={styles.trendingStats}>
              {item.orderCount} pedidos hoy • {item.trendScore}% trending
            </Text>
          </View>
          <View style={styles.trendingScore}>
            <Text style={styles.trendingScoreText}>🔥</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Similar users section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usuarios con Gustos Similares</Text>
        {recommendations?.similarUsers.map((user) => (
          <View key={user.id} style={styles.similarUserCard}>
            <View style={styles.similarUserInfo}>
              <Text style={styles.similarUserName}>{user.name}</Text>
              <Text style={styles.similarUserDetails}>
                {user.similarity}% similar • Le gusta {user.favoriteRestaurant}
              </Text>
            </View>
            <TouchableOpacity style={styles.exploreButton}>
              <Text style={styles.exploreButtonText}>Explorar</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderPredictions = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Predicciones IA</Text>
      <Text style={styles.sectionSubtitle}>
        Cuándo y qué es probable que pidas
      </Text>

      {recommendations?.predictedOrders.map((prediction, index) => (
        <View key={index} style={styles.predictionCard}>
          <View style={styles.predictionHeader}>
            <Text style={styles.predictionDay}>{prediction.day}</Text>
            <View style={styles.probabilityContainer}>
              <Text style={styles.probabilityText}>
                {prediction.probability}%
              </Text>
              <Text style={styles.probabilityLabel}>probable</Text>
            </View>
          </View>

          <Text style={styles.predictionTime}>
            Hora sugerida: {prediction.suggestedTime}
          </Text>

          <View style={styles.suggestedItems}>
            <Text style={styles.suggestedItemsLabel}>Elementos sugeridos:</Text>
            <View style={styles.itemTags}>
              {prediction.suggestedItems.map((item, idx) => (
                <View key={idx} style={styles.itemTag}>
                  <Text style={styles.itemTagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.scheduleButton}>
            <Text style={styles.scheduleButtonText}>Programar Pedido</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* AI Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights de IA</Text>
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>🧠 Patrón Detectado</Text>
          <Text style={styles.insightText}>
            Tiendes a pedir comida mexicana los viernes por la noche. ¿Quieres
            que te recordemos?
          </Text>
          <TouchableOpacity style={styles.insightButton}>
            <Text style={styles.insightButtonText}>
              Configurar Recordatorio
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>📊 Análisis de Gastos</Text>
          <Text style={styles.insightText}>
            Gastas 15% menos cuando pides antes de las 7 PM. Te sugerimos pedir
            temprano para ahorrar.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderPreferences = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Preferencias de IA</Text>
      <Text style={styles.sectionSubtitle}>
        Ayúdanos a mejorar tus recomendaciones
      </Text>

      <View style={styles.preferenceSection}>
        <Text style={styles.preferenceTitle}>Tipos de Cocina Favoritos</Text>
        <View style={styles.preferenceOptions}>
          {["Mexicana", "Italiana", "Asiática", "Americana", "Vegetariana"].map(
            (cuisine) => (
              <TouchableOpacity
                key={cuisine}
                style={[
                  styles.preferenceOption,
                  preferences?.cuisineTypes.includes(cuisine) &&
                    styles.preferenceOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.preferenceOptionText,
                    preferences?.cuisineTypes.includes(cuisine) &&
                      styles.preferenceOptionTextActive,
                  ]}
                >
                  {cuisine}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>
      </View>

      <View style={styles.preferenceSection}>
        <Text style={styles.preferenceTitle}>Rango de Precios</Text>
        <View style={styles.preferenceOptions}>
          {[
            { key: "budget", label: "Económico ($)" },
            { key: "mid", label: "Medio ($$)" },
            { key: "premium", label: "Premium ($$$)" },
          ].map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.preferenceOption,
                preferences?.priceRange === range.key &&
                  styles.preferenceOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.preferenceOptionText,
                  preferences?.priceRange === range.key &&
                    styles.preferenceOptionTextActive,
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.preferenceSection}>
        <Text style={styles.preferenceTitle}>Nivel de Picante</Text>
        <View style={styles.spiceLevelContainer}>
          {[1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.spiceLevel,
                (preferences?.spiceLevel || 0) >= level &&
                  styles.spiceLevelActive,
              ]}
            >
              <Text style={styles.spiceLevelText}>🌶️</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.preferenceSection}>
        <Text style={styles.preferenceTitle}>Puntuación de Salud</Text>
        <Text style={styles.preferenceSubtitle}>
          ¿Qué tan importante es la comida saludable? (1-10)
        </Text>
        <View style={styles.healthScoreContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <TouchableOpacity
              key={score}
              style={[
                styles.healthScore,
                (preferences?.healthScore || 0) >= score &&
                  styles.healthScoreActive,
              ]}
            >
              <Text style={styles.healthScoreText}>{score}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.savePreferencesButton}
        onPress={() => updatePreferences(preferences || {})}
      >
        <Text style={styles.savePreferencesButtonText}>
          Guardar Preferencias
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Analizando tus preferencias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recomendaciones IA</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "foryou", label: "Para Ti" },
          { key: "trending", label: "Trending" },
          { key: "predictions", label: "Predicciones" },
          { key: "preferences", label: "Preferencias" },
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
        {activeTab === "foryou" && renderForYou()}
        {activeTab === "trending" && renderTrending()}
        {activeTab === "predictions" && renderPredictions()}
        {activeTab === "preferences" && renderPreferences()}
      </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 16,
  },
  section: {
    marginTop: 24,
  },
  recommendationCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    flex: 1,
  },
  confidenceContainer: {
    alignItems: "center",
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  confidenceLabel: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  recommendationDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  recommendationReason: {
    fontSize: 12,
    color: Colors.light.tint,
    fontStyle: "italic",
    marginBottom: 8,
  },
  recommendationMeta: {
    flexDirection: "row",
    gap: 12,
  },
  recommendationRating: {
    fontSize: 12,
    color: Colors.light.text,
  },
  recommendationPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  recommendationTime: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  weatherCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: "center",
    width: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weatherImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  weatherName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 4,
  },
  weatherReason: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
    textAlign: "center",
  },
  reorderCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reorderImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  reorderInfo: {
    flex: 1,
  },
  reorderName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  reorderDetails: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  reorderButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reorderButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  trendingCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendingRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  trendingRankText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  trendingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  trendingStats: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  trendingScore: {
    alignItems: "center",
  },
  trendingScoreText: {
    fontSize: 24,
  },
  similarUserCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  similarUserInfo: {
    flex: 1,
  },
  similarUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  similarUserDetails: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  exploreButton: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exploreButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "600",
  },
  predictionCard: {
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
  predictionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  predictionDay: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  probabilityContainer: {
    alignItems: "center",
  },
  probabilityText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "green",
  },
  probabilityLabel: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  predictionTime: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  suggestedItems: {
    marginBottom: 12,
  },
  suggestedItemsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  itemTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  itemTag: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemTagText: {
    fontSize: 12,
    color: Colors.light.text,
  },
  scheduleButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  scheduleButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  insightCard: {
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
  insightTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  insightButton: {
    backgroundColor: Colors.light.background,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  insightButtonText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontWeight: "600",
  },
  preferenceSection: {
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
  preferenceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  preferenceSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  preferenceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preferenceOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
  },
  preferenceOptionActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  preferenceOptionText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  preferenceOptionTextActive: {
    color: "white",
  },
  spiceLevelContainer: {
    flexDirection: "row",
    gap: 8,
  },
  spiceLevel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
  spiceLevelActive: {
    backgroundColor: Colors.light.tint,
  },
  spiceLevelText: {
    fontSize: 16,
  },
  healthScoreContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  healthScore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
  healthScoreActive: {
    backgroundColor: Colors.light.tint,
  },
  healthScoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
  },
  savePreferencesButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  savePreferencesButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
