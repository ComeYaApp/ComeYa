import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

interface AnalyticsData {
  customerSegmentation: {
    newCustomers: number;
    returningCustomers: number;
    vipCustomers: number;
    churnedCustomers: number;
  };
  businessPerformance: Array<{
    businessId: string;
    name: string;
    revenue: number;
    orders: number;
    rating: number;
    growth: number;
  }>;
  predictiveInsights: {
    demandForecast: Array<{
      date: string;
      predictedOrders: number;
      confidence: number;
    }>;
    revenueProjection: {
      nextMonth: number;
      nextQuarter: number;
      confidence: number;
    };
    riskFactors: Array<{
      factor: string;
      risk: "high" | "medium" | "low";
      impact: string;
    }>;
  };
  marketTrends: {
    peakHours: Array<{ hour: number; orders: number }>;
    popularCategories: Array<{ category: string; percentage: number }>;
    seasonalTrends: Array<{ month: string; orders: number; revenue: number }>;
  };
}

export default function BusinessIntelligenceScreen() {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "customers" | "predictions" | "trends"
  >("overview");
  const [timeRange, setTimeRange] = useState<
    "week" | "month" | "quarter" | "year"
  >("month");

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Mock data - in real app, fetch from AI/ML service
      const mockData: AnalyticsData = {
        customerSegmentation: {
          newCustomers: 245,
          returningCustomers: 1832,
          vipCustomers: 156,
          churnedCustomers: 89,
        },
        businessPerformance: [
          {
            businessId: "1",
            name: "Tacos El Güero",
            revenue: 125000,
            orders: 450,
            rating: 4.8,
            growth: 15.2,
          },
          {
            businessId: "2",
            name: "Pizza Napoli",
            revenue: 98000,
            orders: 320,
            rating: 4.6,
            growth: 8.7,
          },
          {
            businessId: "3",
            name: "Sushi Zen",
            revenue: 156000,
            orders: 280,
            rating: 4.9,
            growth: 22.1,
          },
          {
            businessId: "4",
            name: "Burger House",
            revenue: 87000,
            orders: 380,
            rating: 4.4,
            growth: -2.3,
          },
          {
            businessId: "5",
            name: "Café Central",
            revenue: 65000,
            orders: 520,
            rating: 4.7,
            growth: 12.8,
          },
        ],
        predictiveInsights: {
          demandForecast: [
            { date: "2024-01-15", predictedOrders: 1250, confidence: 85 },
            { date: "2024-01-16", predictedOrders: 1180, confidence: 82 },
            { date: "2024-01-17", predictedOrders: 1420, confidence: 88 },
            { date: "2024-01-18", predictedOrders: 1380, confidence: 86 },
            { date: "2024-01-19", predictedOrders: 1650, confidence: 91 },
            { date: "2024-01-20", predictedOrders: 1820, confidence: 89 },
            { date: "2024-01-21", predictedOrders: 1750, confidence: 87 },
          ],
          revenueProjection: {
            nextMonth: 2850000,
            nextQuarter: 8200000,
            confidence: 83,
          },
          riskFactors: [
            {
              factor: "Competencia nueva",
              risk: "medium",
              impact: "Posible reducción del 8% en pedidos",
            },
            {
              factor: "Temporada baja",
              risk: "low",
              impact: "Reducción estacional del 5%",
            },
            {
              factor: "Problemas de entrega",
              risk: "high",
              impact: "Riesgo de perder 15% de clientes",
            },
          ],
        },
        marketTrends: {
          peakHours: [
            { hour: 12, orders: 320 },
            { hour: 13, orders: 450 },
            { hour: 14, orders: 380 },
            { hour: 19, orders: 520 },
            { hour: 20, orders: 680 },
            { hour: 21, orders: 590 },
          ],
          popularCategories: [
            { category: "Comida Mexicana", percentage: 35 },
            { category: "Pizza", percentage: 22 },
            { category: "Hamburguesas", percentage: 18 },
            { category: "Sushi", percentage: 12 },
            { category: "Postres", percentage: 8 },
            { category: "Otros", percentage: 5 },
          ],
          seasonalTrends: [
            { month: "Ene", orders: 12500, revenue: 2800000 },
            { month: "Feb", orders: 11800, revenue: 2650000 },
            { month: "Mar", orders: 13200, revenue: 2950000 },
            { month: "Abr", orders: 14100, revenue: 3150000 },
            { month: "May", orders: 15600, revenue: 3480000 },
            { month: "Jun", orders: 16200, revenue: 3620000 },
          ],
        },
      };

      setAnalyticsData(mockData);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
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
      {/* Key Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights Clave</Text>
        <View style={styles.insightGrid}>
          <View style={styles.insightCard}>
            <Text style={styles.insightValue}>📈 +22.1%</Text>
            <Text style={styles.insightLabel}>Mejor crecimiento</Text>
            <Text style={styles.insightDetail}>Sushi Zen</Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightValue}>⚠️ -2.3%</Text>
            <Text style={styles.insightLabel}>Necesita atención</Text>
            <Text style={styles.insightDetail}>Burger House</Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightValue}>🎯 91%</Text>
            <Text style={styles.insightLabel}>Confianza predicción</Text>
            <Text style={styles.insightDetail}>Fin de semana</Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightValue}>🔥 20:00</Text>
            <Text style={styles.insightLabel}>Hora pico</Text>
            <Text style={styles.insightDetail}>680 pedidos</Text>
          </View>
        </View>
      </View>

      {/* Revenue Projection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proyección de Ingresos</Text>
        <View style={styles.projectionCard}>
          <View style={styles.projectionItem}>
            <Text style={styles.projectionLabel}>Próximo Mes</Text>
            <Text style={styles.projectionValue}>
              {formatCurrency(
                analyticsData?.predictiveInsights.revenueProjection.nextMonth ||
                  0,
              )}
            </Text>
            <Text style={styles.projectionConfidence}>
              {analyticsData?.predictiveInsights.revenueProjection.confidence}%
              confianza
            </Text>
          </View>
          <View style={styles.projectionItem}>
            <Text style={styles.projectionLabel}>Próximo Trimestre</Text>
            <Text style={styles.projectionValue}>
              {formatCurrency(
                analyticsData?.predictiveInsights.revenueProjection
                  .nextQuarter || 0,
              )}
            </Text>
            <Text style={styles.projectionGrowth}>
              +18.5% vs trimestre anterior
            </Text>
          </View>
        </View>
      </View>

      {/* Top Performing Businesses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Negocios Top</Text>
        {analyticsData?.businessPerformance
          .slice(0, 3)
          .map((business, index) => (
            <View key={business.businessId} style={styles.businessCard}>
              <View style={styles.businessRank}>
                <Text style={styles.businessRankText}>{index + 1}</Text>
              </View>
              <View style={styles.businessInfo}>
                <Text style={styles.businessName}>{business.name}</Text>
                <Text style={styles.businessStats}>
                  {formatCurrency(business.revenue)} • {business.orders} pedidos
                  • ⭐ {business.rating}
                </Text>
              </View>
              <View style={styles.businessGrowth}>
                <Text
                  style={[
                    styles.businessGrowthText,
                    { color: business.growth > 0 ? "green" : "red" },
                  ]}
                >
                  {business.growth > 0 ? "+" : ""}
                  {business.growth}%
                </Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );

  const renderCustomers = () => (
    <ScrollView>
      {/* Customer Segmentation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Segmentación de Clientes</Text>
        {analyticsData && (
          <PieChart
            data={[
              {
                name: "Nuevos",
                population: analyticsData.customerSegmentation.newCustomers,
                color: "#4CAF50",
                legendFontColor: "#7F7F7F",
              },
              {
                name: "Recurrentes",
                population:
                  analyticsData.customerSegmentation.returningCustomers,
                color: Colors.light.tint,
                legendFontColor: "#7F7F7F",
              },
              {
                name: "VIP",
                population: analyticsData.customerSegmentation.vipCustomers,
                color: "#FF9800",
                legendFontColor: "#7F7F7F",
              },
              {
                name: "Perdidos",
                population: analyticsData.customerSegmentation.churnedCustomers,
                color: "#F44336",
                legendFontColor: "#7F7F7F",
              },
            ]}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
      </View>

      {/* Customer Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Métricas de Clientes</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>2,322</Text>
            <Text style={styles.metricLabel}>Total Clientes</Text>
            <Text style={styles.metricChange}>+12.5%</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>78.9%</Text>
            <Text style={styles.metricLabel}>Retención</Text>
            <Text style={styles.metricChange}>+2.1%</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>$485</Text>
            <Text style={styles.metricLabel}>Valor Promedio</Text>
            <Text style={styles.metricChange}>+8.3%</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>3.8%</Text>
            <Text style={styles.metricLabel}>Tasa de Abandono</Text>
            <Text style={[styles.metricChange, { color: "green" }]}>-0.5%</Text>
          </View>
        </View>
      </View>

      {/* Customer Lifecycle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ciclo de Vida del Cliente</Text>
        <View style={styles.lifecycleContainer}>
          <View style={styles.lifecycleStage}>
            <View
              style={[styles.lifecycleIcon, { backgroundColor: "#4CAF50" }]}
            >
              <Text style={styles.lifecycleIconText}>1</Text>
            </View>
            <Text style={styles.lifecycleTitle}>Adquisición</Text>
            <Text style={styles.lifecycleValue}>245 nuevos</Text>
            <Text style={styles.lifecycleDetail}>Este mes</Text>
          </View>
          <View style={styles.lifecycleStage}>
            <View
              style={[
                styles.lifecycleIcon,
                { backgroundColor: Colors.light.tint },
              ]}
            >
              <Text style={styles.lifecycleIconText}>2</Text>
            </View>
            <Text style={styles.lifecycleTitle}>Activación</Text>
            <Text style={styles.lifecycleValue}>89.2%</Text>
            <Text style={styles.lifecycleDetail}>Primer pedido</Text>
          </View>
          <View style={styles.lifecycleStage}>
            <View
              style={[styles.lifecycleIcon, { backgroundColor: "#FF9800" }]}
            >
              <Text style={styles.lifecycleIconText}>3</Text>
            </View>
            <Text style={styles.lifecycleTitle}>Retención</Text>
            <Text style={styles.lifecycleValue}>78.9%</Text>
            <Text style={styles.lifecycleDetail}>Segundo pedido</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderPredictions = () => (
    <ScrollView>
      {/* Demand Forecast */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pronóstico de Demanda (7 días)</Text>
        {analyticsData && (
          <LineChart
            data={{
              labels: analyticsData.predictiveInsights.demandForecast.map(
                (d) => d.date.split("-")[2],
              ),
              datasets: [
                {
                  data: analyticsData.predictiveInsights.demandForecast.map(
                    (d) => d.predictedOrders,
                  ),
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  strokeWidth: 3,
                },
              ],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "6", strokeWidth: "2", stroke: "#4CAF50" },
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        )}
      </View>

      {/* Risk Factors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Factores de Riesgo</Text>
        {analyticsData?.predictiveInsights.riskFactors.map((risk, index) => (
          <View key={index} style={styles.riskCard}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskFactor}>{risk.factor}</Text>
              <View
                style={[
                  styles.riskBadge,
                  styles[
                    `risk${risk.risk.charAt(0).toUpperCase() + risk.risk.slice(1)}`
                  ],
                ]}
              >
                <Text style={styles.riskBadgeText}>
                  {risk.risk.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.riskImpact}>{risk.impact}</Text>
          </View>
        ))}
      </View>

      {/* Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recomendaciones IA</Text>
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>
            🎯 Optimización de Horarios
          </Text>
          <Text style={styles.recommendationText}>
            Aumentar personal entre 19:00-21:00 podría incrementar ingresos en
            15%
          </Text>
        </View>
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>
            📈 Expansión de Mercado
          </Text>
          <Text style={styles.recommendationText}>
            Zona Norte muestra potencial para 3 nuevos negocios basado en
            demanda
          </Text>
        </View>
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>
            ⚠️ Retención de Clientes
          </Text>
          <Text style={styles.recommendationText}>
            Implementar programa de lealtad podría reducir abandono en 25%
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderTrends = () => (
    <ScrollView>
      {/* Peak Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horas Pico</Text>
        {analyticsData && (
          <BarChart
            data={{
              labels: analyticsData.marketTrends.peakHours.map(
                (h) => `${h.hour}:00`,
              ),
              datasets: [
                {
                  data: analyticsData.marketTrends.peakHours.map(
                    (h) => h.orders,
                  ),
                },
              ],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        )}
      </View>

      {/* Popular Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categorías Populares</Text>
        {analyticsData?.marketTrends.popularCategories.map(
          (category, index) => (
            <View key={index} style={styles.categoryItem}>
              <Text style={styles.categoryName}>{category.category}</Text>
              <View style={styles.categoryBar}>
                <View
                  style={[
                    styles.categoryBarFill,
                    { width: `${category.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.categoryPercentage}>
                {category.percentage}%
              </Text>
            </View>
          ),
        )}
      </View>

      {/* Seasonal Trends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tendencias Estacionales</Text>
        {analyticsData && (
          <LineChart
            data={{
              labels: analyticsData.marketTrends.seasonalTrends.map(
                (s) => s.month,
              ),
              datasets: [
                {
                  data: analyticsData.marketTrends.seasonalTrends.map(
                    (s) => s.orders / 1000,
                  ),
                  color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
                  strokeWidth: 2,
                },
                {
                  data: analyticsData.marketTrends.seasonalTrends.map(
                    (s) => s.revenue / 1000000,
                  ),
                  color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
              legend: ["Pedidos (K)", "Ingresos (M)"],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "4", strokeWidth: "2" },
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        )}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Analizando datos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Business Intelligence</Text>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(["week", "month", "quarter", "year"] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === range && styles.timeRangeTextActive,
              ]}
            >
              {range === "week"
                ? "Semana"
                : range === "month"
                  ? "Mes"
                  : range === "quarter"
                    ? "Trimestre"
                    : "Año"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "overview", label: "Resumen" },
          { key: "customers", label: "Clientes" },
          { key: "predictions", label: "Predicciones" },
          { key: "trends", label: "Tendencias" },
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
        {activeTab === "customers" && renderCustomers()}
        {activeTab === "predictions" && renderPredictions()}
        {activeTab === "trends" && renderTrends()}
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
  timeRangeContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  timeRangeText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  timeRangeTextActive: {
    color: "white",
    fontWeight: "600",
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
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  insightCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  insightValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  insightLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  insightDetail: {
    fontSize: 10,
    color: Colors.light.text,
  },
  projectionCard: {
    flexDirection: "row",
    gap: 16,
  },
  projectionItem: {
    flex: 1,
    alignItems: "center",
  },
  projectionLabel: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 8,
  },
  projectionValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  projectionConfidence: {
    fontSize: 12,
    color: "green",
  },
  projectionGrowth: {
    fontSize: 12,
    color: "green",
  },
  businessCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  businessRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  businessRankText: {
    color: "white",
    fontWeight: "bold",
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  businessStats: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  businessGrowth: {
    alignItems: "flex-end",
  },
  businessGrowthText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: "600",
    color: "green",
  },
  lifecycleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  lifecycleStage: {
    flex: 1,
    alignItems: "center",
  },
  lifecycleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lifecycleIconText: {
    color: "white",
    fontWeight: "bold",
  },
  lifecycleTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  lifecycleValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 2,
  },
  lifecycleDetail: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  riskCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  riskFactor: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  riskHigh: {
    backgroundColor: "#ffebee",
  },
  riskMedium: {
    backgroundColor: "#fff3e0",
  },
  riskLow: {
    backgroundColor: "#e8f5e8",
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.text,
  },
  riskImpact: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  recommendationCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryName: {
    width: 120,
    fontSize: 12,
    color: Colors.light.text,
  },
  categoryBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginHorizontal: 12,
  },
  categoryBarFill: {
    height: "100%",
    backgroundColor: Colors.light.tint,
    borderRadius: 4,
  },
  categoryPercentage: {
    width: 40,
    fontSize: 12,
    color: Colors.light.text,
    textAlign: "right",
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
