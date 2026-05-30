import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";

interface SuperAppService {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "delivery" | "services" | "payments" | "utilities";
  isActive: boolean;
  estimatedTime?: string;
  minOrder?: number;
  commission?: number;
}

interface ServiceProvider {
  id: string;
  name: string;
  rating: number;
  imageUrl: string;
  category: string;
  isOpen: boolean;
  deliveryTime: string;
  minOrder: number;
  deliveryFee: number;
}

interface UtilityService {
  id: string;
  name: string;
  icon: string;
  type: "phone" | "electricity" | "water" | "gas" | "internet" | "tv";
  provider: string;
  accountNumber?: string;
  lastPayment?: string;
  nextDue?: string;
  amount?: number;
}

export default function SuperAppScreen() {
  const { user } = useAuth();
  const [services, setServices] = useState<SuperAppService[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [utilities, setUtilities] = useState<UtilityService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "services" | "pharmacy" | "grocery" | "utilities" | "payments"
  >("services");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");

  useEffect(() => {
    loadSuperAppData();
  }, []);

  const loadSuperAppData = async () => {
    setLoading(true);
    try {
      // Mock super app services
      const mockServices: SuperAppService[] = [
        {
          id: "1",
          name: "Farmacia",
          icon: "💊",
          description: "Medicamentos y productos de salud",
          category: "delivery",
          isActive: true,
          estimatedTime: "30-45 min",
          minOrder: 5000,
          commission: 12,
        },
        {
          id: "2",
          name: "Supermercado",
          icon: "🛒",
          description: "Despensa y productos del hogar",
          category: "delivery",
          isActive: true,
          estimatedTime: "45-60 min",
          minOrder: 20000,
          commission: 8,
        },
        {
          id: "3",
          name: "Limpieza",
          icon: "🧹",
          description: "Servicio de limpieza a domicilio",
          category: "services",
          isActive: true,
          estimatedTime: "2-4 horas",
          commission: 20,
        },
        {
          id: "4",
          name: "Mascotas",
          icon: "🐕",
          description: "Cuidado y paseo de mascotas",
          category: "services",
          isActive: true,
          estimatedTime: "1-2 horas",
          commission: 25,
        },
        {
          id: "5",
          name: "Recarga Móvil",
          icon: "📱",
          description: "Recarga tu celular al instante",
          category: "utilities",
          isActive: true,
          commission: 3,
        },
        {
          id: "6",
          name: "Pago de Servicios",
          icon: "💡",
          description: "Luz, agua, gas, internet",
          category: "utilities",
          isActive: true,
          commission: 2,
        },
      ];

      const mockProviders: ServiceProvider[] = [
        {
          id: "1",
          name: "Farmacia San Pablo",
          rating: 4.8,
          imageUrl: "https://via.placeholder.com/80x80",
          category: "pharmacy",
          isOpen: true,
          deliveryTime: "30-45 min",
          minOrder: 5000,
          deliveryFee: 2500,
        },
        {
          id: "2",
          name: "Farmacia Guadalajara",
          rating: 4.6,
          imageUrl: "https://via.placeholder.com/80x80",
          category: "pharmacy",
          isOpen: true,
          deliveryTime: "35-50 min",
          minOrder: 5000,
          deliveryFee: 3000,
        },
        {
          id: "3",
          name: "Walmart Express",
          rating: 4.5,
          imageUrl: "https://via.placeholder.com/80x80",
          category: "grocery",
          isOpen: true,
          deliveryTime: "45-60 min",
          minOrder: 20000,
          deliveryFee: 4000,
        },
        {
          id: "4",
          name: "Soriana Híper",
          rating: 4.3,
          imageUrl: "https://via.placeholder.com/80x80",
          category: "grocery",
          isOpen: true,
          deliveryTime: "50-70 min",
          minOrder: 25000,
          deliveryFee: 5000,
        },
      ];

      const mockUtilities: UtilityService[] = [
        {
          id: "1",
          name: "Telcel",
          icon: "📱",
          type: "phone",
          provider: "Telcel",
          accountNumber: "33-1234-5678",
          lastPayment: "2024-01-10",
          nextDue: "2024-02-10",
          amount: 30000,
        },
        {
          id: "2",
          name: "CFE",
          icon: "💡",
          type: "electricity",
          provider: "Comisión Federal de Electricidad",
          accountNumber: "123456789",
          nextDue: "2024-01-20",
          amount: 85000,
        },
        {
          id: "3",
          name: "SIAPA",
          icon: "💧",
          type: "water",
          provider: "Sistema de Agua Potable",
          accountNumber: "987654321",
          nextDue: "2024-01-25",
          amount: 45000,
        },
      ];

      setServices(mockServices);
      setProviders(mockProviders);
      setUtilities(mockUtilities);
    } catch (error) {
      console.error("Error loading super app data:", error);
      Alert.alert("Error", "No se pudieron cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  const rechargePhone = async () => {
    if (!phoneNumber || !rechargeAmount) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/superapp/recharge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            phoneNumber,
            amount: parseFloat(rechargeAmount) * 100,
          }),
        },
      );

      if (response.ok) {
        Alert.alert("¡Éxito!", "Recarga realizada correctamente");
        setPhoneNumber("");
        setRechargeAmount("");
      } else {
        throw new Error("Error processing recharge");
      }
    } catch (error) {
      console.error("Error recharging phone:", error);
      Alert.alert("Error", "No se pudo procesar la recarga");
    }
  };

  const payUtility = async (utilityId: string) => {
    const utility = utilities.find((u) => u.id === utilityId);
    if (!utility) return;

    Alert.alert(
      "Confirmar Pago",
      `¿Quieres pagar ${formatCurrency(utility.amount || 0)} para ${utility.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Pagar",
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL}/api/superapp/pay-utility`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user?.token}`,
                  },
                  body: JSON.stringify({ utilityId }),
                },
              );

              if (response.ok) {
                Alert.alert("¡Éxito!", "Pago realizado correctamente");
                loadSuperAppData();
              }
            } catch (error) {
              Alert.alert("Error", "No se pudo procesar el pago");
            }
          },
        },
      ],
    );
  };

  const openService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    if (!service.isActive) {
      Alert.alert(
        "Servicio no disponible",
        "Este servicio estará disponible próximamente",
      );
      return;
    }

    // Navigate to specific service
    switch (service.name) {
      case "Farmacia":
        setActiveTab("pharmacy");
        break;
      case "Supermercado":
        setActiveTab("grocery");
        break;
      case "Recarga Móvil":
      case "Pago de Servicios":
        setActiveTab("utilities");
        break;
      default:
        Alert.alert("Próximamente", `${service.name} estará disponible pronto`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "MXN",
    }).format(amount / 100);
  };

  const renderServices = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Todos los Servicios</Text>
      <Text style={styles.sectionSubtitle}>
        Todo lo que necesitas en una sola app
      </Text>

      {/* Service Categories */}
      <View style={styles.categoryGrid}>
        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => setActiveTab("pharmacy")}
        >
          <Text style={styles.categoryIcon}>💊</Text>
          <Text style={styles.categoryName}>Farmacia</Text>
          <Text style={styles.categoryDescription}>Medicamentos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => setActiveTab("grocery")}
        >
          <Text style={styles.categoryIcon}>🛒</Text>
          <Text style={styles.categoryName}>Supermercado</Text>
          <Text style={styles.categoryDescription}>Despensa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.categoryCard}
          onPress={() => setActiveTab("utilities")}
        >
          <Text style={styles.categoryIcon}>💡</Text>
          <Text style={styles.categoryName}>Servicios</Text>
          <Text style={styles.categoryDescription}>Pagos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.categoryCard}>
          <Text style={styles.categoryIcon}>🧹</Text>
          <Text style={styles.categoryName}>Limpieza</Text>
          <Text style={styles.categoryDescription}>A domicilio</Text>
        </TouchableOpacity>
      </View>

      {/* All Services */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Todos los Servicios</Text>

        {services.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[
              styles.serviceCard,
              !service.isActive && styles.serviceCardDisabled,
            ]}
            onPress={() => openService(service.id)}
          >
            <Text style={styles.serviceIcon}>{service.icon}</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDescription}>
                {service.description}
              </Text>
              {service.estimatedTime && (
                <Text style={styles.serviceTime}>
                  ⏱️ {service.estimatedTime}
                </Text>
              )}
            </View>
            <View style={styles.serviceStatus}>
              {service.isActive ? (
                <Text style={styles.serviceActive}>Disponible</Text>
              ) : (
                <Text style={styles.serviceInactive}>Próximamente</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Popular Services */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Servicios Populares</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={styles.popularService}>
            <Text style={styles.popularServiceIcon}>🍕</Text>
            <Text style={styles.popularServiceName}>Comida</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.popularService}>
            <Text style={styles.popularServiceIcon}>💊</Text>
            <Text style={styles.popularServiceName}>Farmacia</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.popularService}>
            <Text style={styles.popularServiceIcon}>🛒</Text>
            <Text style={styles.popularServiceName}>Súper</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.popularService}>
            <Text style={styles.popularServiceIcon}>📱</Text>
            <Text style={styles.popularServiceName}>Recarga</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ScrollView>
  );

  const renderPharmacy = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Farmacias Disponibles</Text>
      <Text style={styles.sectionSubtitle}>
        Medicamentos y productos de salud a domicilio
      </Text>

      {providers
        .filter((p) => p.category === "pharmacy")
        .map((pharmacy) => (
          <TouchableOpacity key={pharmacy.id} style={styles.providerCard}>
            <Image
              source={{ uri: pharmacy.imageUrl }}
              style={styles.providerImage}
            />
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{pharmacy.name}</Text>
              <View style={styles.providerMeta}>
                <Text style={styles.providerRating}>⭐ {pharmacy.rating}</Text>
                <Text style={styles.providerTime}>
                  🕐 {pharmacy.deliveryTime}
                </Text>
                <Text style={styles.providerFee}>
                  🚚 {formatCurrency(pharmacy.deliveryFee)}
                </Text>
              </View>
              <Text style={styles.providerMinOrder}>
                Pedido mínimo: {formatCurrency(pharmacy.minOrder)}
              </Text>
            </View>
            <View style={styles.providerStatus}>
              <Text
                style={[
                  styles.providerStatusText,
                  { color: pharmacy.isOpen ? "green" : "red" },
                ]}
              >
                {pharmacy.isOpen ? "Abierto" : "Cerrado"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

      {/* Popular Pharmacy Products */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Productos Populares</Text>
        <View style={styles.productGrid}>
          <View style={styles.productCard}>
            <Text style={styles.productIcon}>💊</Text>
            <Text style={styles.productName}>Paracetamol</Text>
            <Text style={styles.productPrice}>$25</Text>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.productIcon}>🩹</Text>
            <Text style={styles.productName}>Curitas</Text>
            <Text style={styles.productPrice}>$35</Text>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.productIcon}>🧴</Text>
            <Text style={styles.productName}>Alcohol</Text>
            <Text style={styles.productPrice}>$45</Text>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.productIcon}>🌡️</Text>
            <Text style={styles.productName}>Termómetro</Text>
            <Text style={styles.productPrice}>$180</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderGrocery = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Supermercados</Text>
      <Text style={styles.sectionSubtitle}>Despensa y productos del hogar</Text>

      {providers
        .filter((p) => p.category === "grocery")
        .map((grocery) => (
          <TouchableOpacity key={grocery.id} style={styles.providerCard}>
            <Image
              source={{ uri: grocery.imageUrl }}
              style={styles.providerImage}
            />
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{grocery.name}</Text>
              <View style={styles.providerMeta}>
                <Text style={styles.providerRating}>⭐ {grocery.rating}</Text>
                <Text style={styles.providerTime}>
                  🕐 {grocery.deliveryTime}
                </Text>
                <Text style={styles.providerFee}>
                  🚚 {formatCurrency(grocery.deliveryFee)}
                </Text>
              </View>
              <Text style={styles.providerMinOrder}>
                Pedido mínimo: {formatCurrency(grocery.minOrder)}
              </Text>
            </View>
            <View style={styles.providerStatus}>
              <Text
                style={[
                  styles.providerStatusText,
                  { color: grocery.isOpen ? "green" : "red" },
                ]}
              >
                {grocery.isOpen ? "Abierto" : "Cerrado"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

      {/* Grocery Categories */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Categorías</Text>
        <View style={styles.categoryGrid}>
          <TouchableOpacity style={styles.groceryCategory}>
            <Text style={styles.groceryCategoryIcon}>🥛</Text>
            <Text style={styles.groceryCategoryName}>Lácteos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.groceryCategory}>
            <Text style={styles.groceryCategoryIcon}>🍞</Text>
            <Text style={styles.groceryCategoryName}>Panadería</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.groceryCategory}>
            <Text style={styles.groceryCategoryIcon}>🥩</Text>
            <Text style={styles.groceryCategoryName}>Carnes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.groceryCategory}>
            <Text style={styles.groceryCategoryIcon}>🍎</Text>
            <Text style={styles.groceryCategoryName}>Frutas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderUtilities = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Servicios y Pagos</Text>

      {/* Phone Recharge */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Recarga Móvil</Text>
        <View style={styles.rechargeForm}>
          <TextInput
            style={styles.rechargeInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Número de teléfono"
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.rechargeInput}
            value={rechargeAmount}
            onChangeText={setRechargeAmount}
            placeholder="Monto ($)"
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={styles.rechargeButton}
            onPress={rechargePhone}
          >
            <Text style={styles.rechargeButtonText}>Recargar</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Amounts */}
        <View style={styles.quickAmounts}>
          {[20, 50, 100, 200].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickAmount}
              onPress={() => setRechargeAmount(amount.toString())}
            >
              <Text style={styles.quickAmountText}>${amount}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Utility Bills */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Pago de Servicios</Text>

        {utilities.map((utility) => (
          <View key={utility.id} style={styles.utilityCard}>
            <Text style={styles.utilityIcon}>{utility.icon}</Text>
            <View style={styles.utilityInfo}>
              <Text style={styles.utilityName}>{utility.name}</Text>
              <Text style={styles.utilityProvider}>{utility.provider}</Text>
              {utility.accountNumber && (
                <Text style={styles.utilityAccount}>
                  Cuenta: {utility.accountNumber}
                </Text>
              )}
              {utility.nextDue && (
                <Text style={styles.utilityDue}>Vence: {utility.nextDue}</Text>
              )}
            </View>
            <View style={styles.utilityPayment}>
              {utility.amount && (
                <Text style={styles.utilityAmount}>
                  {formatCurrency(utility.amount)}
                </Text>
              )}
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => payUtility(utility.id)}
              >
                <Text style={styles.payButtonText}>Pagar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Add New Service */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.addServiceButton}>
          <Text style={styles.addServiceIcon}>+</Text>
          <Text style={styles.addServiceText}>Agregar Nuevo Servicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPayments = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Centro de Pagos</Text>

      {/* P2P Payments */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Enviar Dinero</Text>
        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.paymentIcon}>💸</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Enviar a Contacto</Text>
            <Text style={styles.paymentDescription}>
              Transfiere dinero a amigos y familia
            </Text>
          </View>
          <Text style={styles.paymentArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.paymentIcon}>📱</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Código QR</Text>
            <Text style={styles.paymentDescription}>
              Paga escaneando códigos QR
            </Text>
          </View>
          <Text style={styles.paymentArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Bill Payments */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Pago de Cuentas</Text>

        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.paymentIcon}>💡</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Servicios Públicos</Text>
            <Text style={styles.paymentDescription}>
              Luz, agua, gas, teléfono
            </Text>
          </View>
          <Text style={styles.paymentArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.paymentIcon}>🏦</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Tarjetas de Crédito</Text>
            <Text style={styles.paymentDescription}>
              Paga tus tarjetas bancarias
            </Text>
          </View>
          <Text style={styles.paymentArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.paymentOption}>
          <Text style={styles.paymentIcon}>🎓</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Educación</Text>
            <Text style={styles.paymentDescription}>Colegiaturas y cursos</Text>
          </View>
          <Text style={styles.paymentArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Payments */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Pagos Recientes</Text>

        <View style={styles.recentPayment}>
          <Text style={styles.recentPaymentIcon}>💡</Text>
          <View style={styles.recentPaymentInfo}>
            <Text style={styles.recentPaymentTitle}>CFE - Luz</Text>
            <Text style={styles.recentPaymentDate}>10 Ene 2024</Text>
          </View>
          <Text style={styles.recentPaymentAmount}>$850.00</Text>
        </View>

        <View style={styles.recentPayment}>
          <Text style={styles.recentPaymentIcon}>📱</Text>
          <View style={styles.recentPaymentInfo}>
            <Text style={styles.recentPaymentTitle}>Telcel - Recarga</Text>
            <Text style={styles.recentPaymentDate}>08 Ene 2024</Text>
          </View>
          <Text style={styles.recentPaymentAmount}>$100.00</Text>
        </View>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando servicios...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ComeYa Super App</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: "services", label: "Servicios" },
          { key: "pharmacy", label: "Farmacia" },
          { key: "grocery", label: "Súper" },
          { key: "utilities", label: "Pagos" },
          { key: "payments", label: "Envíos" },
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
        {activeTab === "services" && renderServices()}
        {activeTab === "pharmacy" && renderPharmacy()}
        {activeTab === "grocery" && renderGrocery()}
        {activeTab === "utilities" && renderUtilities()}
        {activeTab === "payments" && renderPayments()}
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
    marginBottom: 20,
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
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  categoryCard: {
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
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  serviceCardDisabled: {
    opacity: 0.6,
  },
  serviceIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  serviceTime: {
    fontSize: 12,
    color: Colors.light.tint,
  },
  serviceStatus: {
    alignItems: "flex-end",
  },
  serviceActive: {
    fontSize: 12,
    color: "green",
    fontWeight: "600",
  },
  serviceInactive: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  popularService: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginRight: 12,
    width: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popularServiceIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  popularServiceName: {
    fontSize: 12,
    color: Colors.light.text,
    textAlign: "center",
  },
  providerCard: {
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
  providerImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  providerMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  providerRating: {
    fontSize: 12,
    color: Colors.light.text,
  },
  providerTime: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  providerFee: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  providerMinOrder: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  providerStatus: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  providerStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  productCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  productIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  groceryCategory: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  groceryCategoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  groceryCategoryName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
  },
  rechargeForm: {
    gap: 12,
    marginBottom: 16,
  },
  rechargeInput: {
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  rechargeButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  rechargeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
  },
  quickAmount: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  quickAmountText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "600",
  },
  utilityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  utilityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  utilityInfo: {
    flex: 1,
  },
  utilityName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  utilityProvider: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  utilityAccount: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 2,
  },
  utilityDue: {
    fontSize: 12,
    color: "orange",
    fontWeight: "600",
  },
  utilityPayment: {
    alignItems: "flex-end",
  },
  utilityAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  payButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  addServiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderStyle: "dashed",
  },
  addServiceIcon: {
    fontSize: 24,
    color: Colors.light.tint,
    marginRight: 8,
  },
  addServiceText: {
    fontSize: 16,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  paymentArrow: {
    fontSize: 18,
    color: Colors.light.tabIconDefault,
  },
  recentPayment: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  recentPaymentIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  recentPaymentInfo: {
    flex: 1,
  },
  recentPaymentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  recentPaymentDate: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  recentPaymentAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
});
