import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";

interface PricingRule {
  id: string;
  name: string;
  type: "surge" | "discount" | "time_based" | "demand_based";
  isActive: boolean;
  conditions: {
    timeRange?: { start: string; end: string };
    demandThreshold?: number;
    weatherCondition?: string;
    dayOfWeek?: string[];
  };
  adjustment: {
    type: "percentage" | "fixed";
    value: number;
  };
  priority: number;
}

interface PricingAnalytics {
  currentSurge: number;
  demandLevel: "low" | "medium" | "high" | "extreme";
  activeRules: number;
  revenueImpact: number;
  customerSatisfaction: number;
  averageOrderValue: number;
}

export default function DynamicPricingScreen() {
  const { user } = useAuth();
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [analytics, setAnalytics] = useState<PricingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "rules" | "analytics" | "settings"
  >("rules");

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      const mockRules: PricingRule[] = [
        {
          id: "1",
          name: "Hora Pico Almuerzo",
          type: "surge",
          isActive: true,
          conditions: {
            timeRange: { start: "12:00", end: "14:00" },
            demandThreshold: 80,
          },
          adjustment: { type: "percentage", value: 15 },
          priority: 1,
        },
        {
          id: "2",
          name: "Descuento Madrugada",
          type: "discount",
          isActive: true,
          conditions: {
            timeRange: { start: "02:00", end: "06:00" },
          },
          adjustment: { type: "percentage", value: -20 },
          priority: 2,
        },
        {
          id: "3",
          name: "Fin de Semana Premium",
          type: "surge",
          isActive: true,
          conditions: {
            dayOfWeek: ["Friday", "Saturday", "Sunday"],
            timeRange: { start: "19:00", end: "23:00" },
          },
          adjustment: { type: "percentage", value: 25 },
          priority: 3,
        },
      ];

      const mockAnalytics: PricingAnalytics = {
        currentSurge: 15,
        demandLevel: "high",
        activeRules: 2,
        revenueImpact: 18.5,
        customerSatisfaction: 4.2,
        averageOrderValue: 28500,
      };

      setPricingRules(mockRules);
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error("Error loading pricing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    setPricingRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule,
      ),
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "MXN",
    }).format(amount / 100);
  };

  const getDemandColor = (level: string) => {
    switch (level) {
      case "low":
        return "green";
      case "medium":
        return "orange";
      case "high":
        return "red";
      case "extreme":
        return "darkred";
      default:
        return Colors.light.tabIconDefault;
    }
  };

  const renderRules = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Reglas de Precios Dinámicos</Text>

      {pricingRules.map((rule) => (
        <View key={rule.id} style={styles.ruleCard}>
          <View style={styles.ruleHeader}>
            <View style={styles.ruleInfo}>
              <Text style={styles.ruleName}>{rule.name}</Text>
              <View
                style={[
                  styles.ruleType,
                  { backgroundColor: rule.type === "surge" ? "red" : "green" },
                ]}
              >
                <Text style={styles.ruleTypeText}>
                  {rule.type === "surge" ? "SURGE" : "DESCUENTO"}
                </Text>
              </View>
            </View>
            <Switch
              value={rule.isActive}
              onValueChange={() => toggleRule(rule.id)}
              trackColor={{
                false: Colors.light.tabIconDefault,
                true: Colors.light.tint,
              }}
            />
          </View>

          <View style={styles.ruleDetails}>
            <Text style={styles.ruleAdjustment}>
              Ajuste: {rule.adjustment.value > 0 ? "+" : ""}
              {rule.adjustment.value}%
            </Text>
            <Text style={styles.rulePriority}>Prioridad: {rule.priority}</Text>
          </View>

          <View style={styles.ruleConditions}>
            {rule.conditions.timeRange && (
              <Text style={styles.ruleCondition}>
                🕐 {rule.conditions.timeRange.start} -{" "}
                {rule.conditions.timeRange.end}
              </Text>
            )}
            {rule.conditions.demandThreshold && (
              <Text style={styles.ruleCondition}>
                📊 Demanda {">"} {rule.conditions.demandThreshold}%
              </Text>
            )}
            {rule.conditions.dayOfWeek && (
              <Text style={styles.ruleCondition}>
                📅 {rule.conditions.dayOfWeek.join(", ")}
              </Text>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addRuleButton}>
        <Text style={styles.addRuleText}>+ Agregar Nueva Regla</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAnalytics = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Analytics de Precios</Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{analytics?.currentSurge}%</Text>
          <Text style={styles.metricLabel}>Surge Actual</Text>
        </View>

        <View style={styles.metricCard}>
          <Text
            style={[
              styles.metricValue,
              { color: getDemandColor(analytics?.demandLevel || "low") },
            ]}
          >
            {analytics?.demandLevel?.toUpperCase()}
          </Text>
          <Text style={styles.metricLabel}>Nivel de Demanda</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{analytics?.activeRules}</Text>
          <Text style={styles.metricLabel}>Reglas Activas</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>+{analytics?.revenueImpact}%</Text>
          <Text style={styles.metricLabel}>Impacto en Ingresos</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Impacto en el Negocio</Text>

        <View style={styles.impactItem}>
          <Text style={styles.impactLabel}>Valor Promedio de Pedido:</Text>
          <Text style={styles.impactValue}>
            {formatCurrency(analytics?.averageOrderValue || 0)}
          </Text>
        </View>

        <View style={styles.impactItem}>
          <Text style={styles.impactLabel}>Satisfacción del Cliente:</Text>
          <Text style={styles.impactValue}>
            {analytics?.customerSatisfaction}/5.0 ⭐
          </Text>
        </View>

        <View style={styles.impactItem}>
          <Text style={styles.impactLabel}>Incremento de Ingresos:</Text>
          <Text style={[styles.impactValue, { color: "green" }]}>
            +{analytics?.revenueImpact}%
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Recomendaciones IA</Text>

        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>
            🎯 Optimización Detectada
          </Text>
          <Text style={styles.recommendationText}>
            Reducir surge en horario 14:00-16:00 podría aumentar pedidos en 12%
          </Text>
        </View>

        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>
            📈 Oportunidad de Ingresos
          </Text>
          <Text style={styles.recommendationText}>
            Implementar surge por clima lluvioso podría generar +8% ingresos
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Configuración de Precios</Text>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Configuración General</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Surge Máximo Permitido</Text>
          <Text style={styles.settingValue}>50%</Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Descuento Máximo</Text>
          <Text style={styles.settingValue}>30%</Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Actualización de Precios</Text>
          <Text style={styles.settingValue}>Cada 5 minutos</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Factores de Demanda</Text>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Clima</Text>
          <Switch
            value={true}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Eventos Locales</Text>
          <Switch
            value={true}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Disponibilidad de Repartidores</Text>
          <Switch
            value={true}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Historial de Demanda</Text>
          <Switch
            value={true}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Notificaciones</Text>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Alertas de Surge Alto</Text>
          <Switch
            value={true}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.factorItem}>
          <Text style={styles.factorLabel}>Reportes Diarios</Text>
          <Switch
            value={false}
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando precios dinámicos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Precios Dinámicos</Text>

      <View style={styles.tabContainer}>
        {[
          { key: "rules", label: "Reglas" },
          { key: "analytics", label: "Analytics" },
          { key: "settings", label: "Config" },
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
        {activeTab === "rules" && renderRules()}
        {activeTab === "analytics" && renderAnalytics()}
        {activeTab === "settings" && renderSettings()}
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
    fontSize: 14,
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
  ruleCard: {
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
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ruleInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  ruleName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginRight: 12,
  },
  ruleType: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ruleTypeText: {
    fontSize: 10,
    color: "white",
    fontWeight: "600",
  },
  ruleDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  ruleAdjustment: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  rulePriority: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  ruleConditions: {
    gap: 4,
  },
  ruleCondition: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  addRuleButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderStyle: "dashed",
  },
  addRuleText: {
    fontSize: 16,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
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
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    textAlign: "center",
  },
  impactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  impactLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  impactValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
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
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  factorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  factorLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
