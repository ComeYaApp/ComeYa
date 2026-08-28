import React, { useState, useEffect } from "react";
import { formatCurrency as centralFormatCurrency } from "@/utils/currency";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  Switch,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";

interface MarketplaceStore {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  isActive: boolean;
  products: number;
  sales: number;
  rating: number;
  commission: number;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: "percentage" | "fixed" | "bogo" | "free_delivery";
  value: number;
  minOrder?: number;
  validUntil: string;
  isActive: boolean;
  usageCount: number;
  maxUsage: number;
}

interface ABTest {
  id: string;
  name: string;
  type: "price" | "ui" | "promotion";
  status: "running" | "completed" | "paused";
  variants: Array<{
    name: string;
    traffic: number;
    conversions: number;
    revenue: number;
  }>;
  startDate: string;
  endDate: string;
}

export default function AdvancedMarketplaceScreen() {
  const { user } = useAuth();
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "stores" | "promotions" | "abtests" | "analytics"
  >("stores");

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    try {
      const mockStores: MarketplaceStore[] = [
        {
          id: "1",
          name: "Tienda Virtual Tacos El Güero",
          description: "Productos y salsas especiales",
          imageUrl: "https://via.placeholder.com/80x80",
          category: "Comida Mexicana",
          isActive: true,
          products: 24,
          sales: 156,
          rating: 4.8,
          commission: 15,
        },
        {
          id: "2",
          name: "Pizza Napoli Store",
          description: "Ingredientes premium para pizza",
          imageUrl: "https://via.placeholder.com/80x80",
          category: "Italiana",
          isActive: true,
          products: 18,
          sales: 89,
          rating: 4.6,
          commission: 12,
        },
      ];

      const mockPromotions: Promotion[] = [
        {
          id: "1",
          title: "Descuento de Bienvenida",
          description: "20% off en tu primer pedido",
          type: "percentage",
          value: 20,
          minOrder: 30000,
          validUntil: "2024-02-15",
          isActive: true,
          usageCount: 245,
          maxUsage: 1000,
        },
        {
          id: "2",
          title: "Entrega Gratis Viernes",
          description: "Sin costo de envío los viernes",
          type: "free_delivery",
          value: 0,
          validUntil: "2024-01-31",
          isActive: true,
          usageCount: 89,
          maxUsage: 500,
        },
      ];

      const mockABTests: ABTest[] = [
        {
          id: "1",
          name: "Precio Pizza Hawaiana",
          type: "price",
          status: "running",
          variants: [
            {
              name: "Control ($180)",
              traffic: 50,
              conversions: 45,
              revenue: 81000,
            },
            {
              name: "Test ($165)",
              traffic: 50,
              conversions: 52,
              revenue: 85800,
            },
          ],
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        },
      ];

      setStores(mockStores);
      setPromotions(mockPromotions);
      setABTests(mockABTests);
    } catch (error) {
      console.error("Error loading marketplace data:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePromotion = async (promotionId: string) => {
    setPromotions((prev) =>
      prev.map((promo) =>
        promo.id === promotionId
          ? { ...promo, isActive: !promo.isActive }
          : promo,
      ),
    );
  };

  const formatCurrency = (amount: number) =>
    centralFormatCurrency(amount);

  const renderStores = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Tiendas Virtuales</Text>

      {stores.map((store) => (
        <View key={store.id} style={styles.storeCard}>
          <Image source={{ uri: store.imageUrl }} style={styles.storeImage} />
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeCategory}>{store.category}</Text>
            <Text style={styles.storeDescription}>{store.description}</Text>

            <View style={styles.storeStats}>
              <Text style={styles.storeStat}>
                📦 {store.products} productos
              </Text>
              <Text style={styles.storeStat}>💰 {store.sales} ventas</Text>
              <Text style={styles.storeStat}>⭐ {store.rating}</Text>
            </View>

            <Text style={styles.storeCommission}>
              Comisión: {store.commission}%
            </Text>
          </View>

          <View style={styles.storeActions}>
            <Switch
              value={store.isActive}
              trackColor={{
                false: Colors.light.tabIconDefault,
                true: Colors.light.tint,
              }}
            />
            <TouchableOpacity style={styles.manageButton}>
              <Text style={styles.manageButtonText}>Gestionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addStoreButton}>
        <Text style={styles.addStoreText}>+ Crear Nueva Tienda</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPromotions = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Promociones Inteligentes</Text>

      {promotions.map((promo) => (
        <View key={promo.id} style={styles.promoCard}>
          <View style={styles.promoHeader}>
            <Text style={styles.promoTitle}>{promo.title}</Text>
            <Switch
              value={promo.isActive}
              onValueChange={() => togglePromotion(promo.id)}
              trackColor={{
                false: Colors.light.tabIconDefault,
                true: Colors.light.tint,
              }}
            />
          </View>

          <Text style={styles.promoDescription}>{promo.description}</Text>

          <View style={styles.promoDetails}>
            <Text style={styles.promoValue}>
              {promo.type === "percentage"
                ? `${promo.value}%`
                : promo.type === "fixed"
                  ? formatCurrency(promo.value)
                  : "Gratis"}
            </Text>
            {promo.minOrder && (
              <Text style={styles.promoMinOrder}>
                Mín: {formatCurrency(promo.minOrder)}
              </Text>
            )}
          </View>

          <View style={styles.promoStats}>
            <Text style={styles.promoUsage}>
              Usado: {promo.usageCount}/{promo.maxUsage}
            </Text>
            <Text style={styles.promoExpiry}>Expira: {promo.validUntil}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addPromoButton}>
        <Text style={styles.addPromoText}>+ Nueva Promoción</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderABTests = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>A/B Testing</Text>

      {abTests.map((test) => (
        <View key={test.id} style={styles.testCard}>
          <View style={styles.testHeader}>
            <Text style={styles.testName}>{test.name}</Text>
            <View
              style={[
                styles.testStatus,
                {
                  backgroundColor:
                    test.status === "running" ? "green" : "orange",
                },
              ]}
            >
              <Text style={styles.testStatusText}>
                {test.status === "running" ? "Activo" : "Pausado"}
              </Text>
            </View>
          </View>

          <Text style={styles.testPeriod}>
            {test.startDate} - {test.endDate}
          </Text>

          <View style={styles.variants}>
            {test.variants.map((variant, index) => (
              <View key={index} style={styles.variant}>
                <Text style={styles.variantName}>{variant.name}</Text>
                <View style={styles.variantStats}>
                  <Text style={styles.variantStat}>
                    Tráfico: {variant.traffic}%
                  </Text>
                  <Text style={styles.variantStat}>
                    Conversión: {variant.conversions}%
                  </Text>
                  <Text style={styles.variantStat}>
                    Ingresos: {formatCurrency(variant.revenue)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.testActions}>
            <TouchableOpacity style={styles.testAction}>
              <Text style={styles.testActionText}>Ver Detalles</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.testAction}>
              <Text style={styles.testActionText}>Pausar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addTestButton}>
        <Text style={styles.addTestText}>+ Nuevo A/B Test</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAnalytics = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Analytics del Marketplace</Text>

      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>$2.8M</Text>
          <Text style={styles.analyticsLabel}>Ingresos Totales</Text>
          <Text style={styles.analyticsChange}>+15.2%</Text>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>1,245</Text>
          <Text style={styles.analyticsLabel}>Productos Activos</Text>
          <Text style={styles.analyticsChange}>+8.7%</Text>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>89.5%</Text>
          <Text style={styles.analyticsLabel}>Tasa de Conversión</Text>
          <Text style={styles.analyticsChange}>+2.1%</Text>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>$285</Text>
          <Text style={styles.analyticsLabel}>Ticket Promedio</Text>
          <Text style={styles.analyticsChange}>+5.8%</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Top Categorías</Text>

        <View style={styles.categoryRanking}>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryRank}>1</Text>
            <Text style={styles.categoryName}>Comida Mexicana</Text>
            <Text style={styles.categoryPercentage}>35%</Text>
          </View>

          <View style={styles.categoryItem}>
            <Text style={styles.categoryRank}>2</Text>
            <Text style={styles.categoryName}>Pizza</Text>
            <Text style={styles.categoryPercentage}>22%</Text>
          </View>

          <View style={styles.categoryItem}>
            <Text style={styles.categoryRank}>3</Text>
            <Text style={styles.categoryName}>Hamburguesas</Text>
            <Text style={styles.categoryPercentage}>18%</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando marketplace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marketplace Avanzado</Text>

      <View style={styles.tabContainer}>
        {[
          { key: "stores", label: "Tiendas" },
          { key: "promotions", label: "Promos" },
          { key: "abtests", label: "A/B Tests" },
          { key: "analytics", label: "Analytics" },
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

      <View style={styles.tabContent}>
        {activeTab === "stores" && renderStores()}
        {activeTab === "promotions" && renderPromotions()}
        {activeTab === "abtests" && renderABTests()}
        {activeTab === "analytics" && renderAnalytics()}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
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
  storeCard: {
    flexDirection: "row",
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
  storeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  storeCategory: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  storeDescription: {
    fontSize: 12,
    color: Colors.light.text,
    marginBottom: 8,
  },
  storeStats: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  storeStat: {
    fontSize: 10,
    color: Colors.light.tabIconDefault,
  },
  storeCommission: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  storeActions: {
    alignItems: "center",
    gap: 8,
  },
  manageButton: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "600",
  },
  addStoreButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderStyle: "dashed",
  },
  addStoreText: {
    fontSize: 16,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  promoCard: {
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
  promoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  promoDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  promoDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  promoValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  promoMinOrder: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  promoStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  promoUsage: {
    fontSize: 12,
    color: Colors.light.text,
  },
  promoExpiry: {
    fontSize: 12,
    color: "orange",
  },
  addPromoButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addPromoText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  testCard: {
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
  testHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  testStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  testStatusText: {
    fontSize: 10,
    color: "white",
    fontWeight: "600",
  },
  testPeriod: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  variants: {
    gap: 8,
    marginBottom: 12,
  },
  variant: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
  },
  variantName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  variantStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  variantStat: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  testActions: {
    flexDirection: "row",
    gap: 12,
  },
  testAction: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  testActionText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  addTestButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  addTestText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  analyticsCard: {
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
  analyticsValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    textAlign: "center",
    marginBottom: 4,
  },
  analyticsChange: {
    fontSize: 12,
    fontWeight: "600",
    color: "green",
  },
  categoryRanking: {
    gap: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
  },
  categoryRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.tint,
    color: "white",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
