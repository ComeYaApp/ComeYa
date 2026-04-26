import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import {
  DashboardTab,
  DriversTab,
  FinanceTab,
  BusinessesTab,
  UsersTab,
  OrdersTab,
  CouponsTab,
  SupportTab,
  ZonesTab,
  SettingsTab,
  VerificationsTab,
} from "@/components/admin/tabs";
import type {
  DashboardMetrics,
  ActiveOrder,
  OnlineDriver,
  AdminUser,
  AdminOrder,
  Business,
} from "@/components/admin/types/admin.types";

interface MenuItem {
  title: string;
  subtitle: string;
  icon: string;
  tab: string;
  color: string;
}

const menuItems: MenuItem[] = [
  {
    title: "Verificaciones",
    subtitle: "Aprobar repartidores y negocios",
    icon: "user-check",
    tab: "verifications",
    color: "#10B981",
  },
  {
    title: "Pedidos",
    subtitle: "Gestionar pedidos",
    icon: "package",
    tab: "orders",
    color: "#2196F3",
  },
  {
    title: "Repartidores",
    subtitle: "Estado y ubicación",
    icon: "truck",
    tab: "drivers",
    color: "#9C27B0",
  },
  {
    title: "Usuarios",
    subtitle: "Administrar cuentas",
    icon: "users",
    tab: "users",
    color: "#FF9800",
  },
  {
    title: "Negocios",
    subtitle: "Restaurantes",
    icon: "briefcase",
    tab: "businesses",
    color: "#4CAF50",
  },
  {
    title: "Finanzas",
    subtitle: "Ingresos y comisiones",
    icon: "trending-up",
    tab: "finance",
    color: "#00BCD4",
  },
  {
    title: "Cupones",
    subtitle: "Promociones",
    icon: "tag",
    tab: "coupons",
    color: "#FF5722",
  },
  {
    title: "Productos",
    subtitle: "Gestión de inventario",
    icon: "box",
    tab: "products",
    color: "#8BC34A",
  },
  {
    title: "Logs",
    subtitle: "Auditoría del sistema",
    icon: "file-text",
    tab: "logs",
    color: "#9E9E9E",
  },
  {
    title: "Configuración",
    subtitle: "Ajustes del sistema",
    icon: "sliders",
    tab: "settings",
    color: "#607D8B",
  },
  {
    title: "Tarifas Delivery",
    subtitle: "Configurar costos de envío",
    icon: "navigation",
    tab: "delivery-config",
    color: "#00BCD4",
  },
  {
    title: "Soporte",
    subtitle: "Tickets de ayuda",
    icon: "message-circle",
    tab: "support",
    color: "#795548",
  },
];

export default function AdminMenuScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [userRoleEdit, setUserRoleEdit] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessModalVisible, setBusinessModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [driverModalVisible, setDriverModalVisible] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [couponModalVisible, setCouponModalVisible] = useState(false);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any | null>(null);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [adminLogs, setAdminLogs] = useState<any[]>([]);

  console.log('RENDER - Modal states:', { userModalVisible, selectedUser: selectedUser?.name });

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, ordersRes, driversRes] = await Promise.all([
        apiRequest("GET", "/api/admin/dashboard/metrics"),
        apiRequest("GET", "/api/admin/dashboard/active-orders"),
        apiRequest("GET", "/api/admin/dashboard/online-drivers"),
      ]);
      const metricsData = await metricsRes.json();
      const ordersData = await ordersRes.json();
      const driversData = await driversRes.json();
      setDashboardMetrics(metricsData);
      setActiveOrders(ordersData.orders || []);
      setOnlineDrivers(driversData.drivers || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, ordersRes, businessesRes] = await Promise.all([
        apiRequest("GET", "/api/admin/users"),
        apiRequest("GET", "/api/admin/orders"),
        apiRequest("GET", "/api/admin/businesses"),
      ]);

      const usersData = await usersRes.json();
      const ordersData = await ordersRes.json();
      const businessesData = await businessesRes.json();

      setUsers(usersData.users || []);
      setOrders(ordersData.orders || []);
      setBusinesses(businessesData.businesses || []);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showToast("Error al cargar datos del panel", "error");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchDashboardData();
    } else if (["users", "orders", "businesses"].includes(activeTab || "")) {
      fetchData();
    } else if (activeTab === "drivers") {
      fetchDrivers();
    } else if (activeTab === "finance") {
      fetchTransactions();
    } else if (activeTab === "coupons") {
      fetchCoupons();
    } else if (activeTab === "zones") {
      fetchZones();
    } else if (activeTab === "products" && selectedBusinessId) {
      fetchProducts(selectedBusinessId);
    } else if (activeTab === "products") {
      fetchData();
    } else if (activeTab === "logs") {
      fetchAdminLogs();
    }
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === "dashboard") {
      fetchDashboardData();
    } else {
      fetchData();
    }
  };

  const handleMenuPress = (tab: string) => {
    Haptics.selectionAsync();
    setUserModalVisible(false);
    setOrderModalVisible(false);
    setSelectedUser(null);
    setSelectedOrder(null);
    setActiveTab(tab);
    
    // Forzar recarga de datos al cambiar de tab
    if (["users", "orders", "businesses"].includes(tab)) {
      fetchData();
    } else if (tab === "dashboard") {
      fetchDashboardData();
    }
  };

  const handleBack = () => {
    setUserModalVisible(false);
    setOrderModalVisible(false);
    setSelectedUser(null);
    setSelectedOrder(null);
    setActiveTab(null);
  };

  const openUserModal = (user: AdminUser) => {
    console.log("Opening user modal for:", user.name);
    setSelectedUser(user);
    setUserRoleEdit(user.role);
    setUserModalVisible(true);
  };

  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;
    try {
      const response = await apiRequest("PUT", `/api/admin/users/${selectedUser.id}`, {
        role: userRoleEdit,
        name: selectedUser.name,
        email: selectedUser.email,
        phone: selectedUser.phone
      });
      
      if (response.ok) {
        showToast("Usuario actualizado correctamente", "success");
        setUserModalVisible(false);
        fetchData();
      } else {
        showToast("Error al actualizar usuario", "error");
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showToast("Error de conexión", "error");
    }
  };

  const handleBusinessPress = (business: Business) => {
    setSelectedBusiness(business);
    setBusinessModalVisible(true);
  };

  const handleSaveBusiness = async () => {
    if (!selectedBusiness) return;
    try {
      const res = await apiRequest("PUT", `/api/admin/businesses/${selectedBusiness.id}`, {
        name:             selectedBusiness.name,
        address:          selectedBusiness.address,
        phone:            selectedBusiness.phone,
        type:             selectedBusiness.type,
        isActive:         selectedBusiness.isActive,
        customCommission: (selectedBusiness as any).customCommission ?? null,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Negocio actualizado", "success");
        setBusinessModalVisible(false);
        fetchData();
      } else {
        showToast(data.error ?? "Error al guardar", "error");
      }
    } catch {
      showToast("Error de conexion", "error");
    }
  };

  const handleDriverPress = (driver: any) => {
    setSelectedDriver(driver);
    setDriverModalVisible(true);
  };

  const fetchDrivers = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/drivers");
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const handleTransactionPress = (transaction: any) => {
    setSelectedTransaction(transaction);
    setTransactionModalVisible(true);
  };

  const fetchTransactions = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/finance");
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const handleOrderPress = (order: AdminOrder) => {
    setSelectedOrder(order);
    setOrderModalVisible(true);
    showToast(`Abriendo pedido #${order.id.slice(0, 8)}`, "info");
  };

  const handleUserAction = (action: string, user: AdminUser) => {
    Alert.alert(
      `${action} Usuario`,
      `¿Estás seguro de ${action.toLowerCase()} a ${user.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          onPress: () => {
            showToast(`Usuario ${action.toLowerCase()}`, "success");
            setUserModalVisible(false);
          }
        }
      ]
    );
  };

  const handleOrderAction = (action: string, order: AdminOrder) => {
    Alert.alert(
      `${action} Pedido`,
      `¿Cambiar estado del pedido #${order.id.slice(0, 8)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          onPress: () => {
            showToast(`Pedido ${action.toLowerCase()}`, "success");
            setOrderModalVisible(false);
          }
        }
      ]
    );
  };

  const handleDashboardOrderPress = (order: ActiveOrder) => {
    const mappedOrder: AdminOrder = {
      id: order.id,
      userId: order.customer?.id || "",
      businessId: order.business?.id || "",
      businessName: order.business?.name || "Negocio",
      businessImage: null,
      customerName: order.customer?.name || "Cliente",
      customerPhone: "",
      status: order.status,
      subtotal: order.total,
      deliveryFee: 0,
      total: order.total,
      paymentMethod: "card",
      deliveryAddress: order.deliveryAddress?.address || "Dirección no disponible",
      deliveryLatitude: order.deliveryAddress?.latitude,
      deliveryLongitude: order.deliveryAddress?.longitude,
      items: "",
      notes: null,
      createdAt: order.createdAt,
      estimatedDelivery: null,
      deliveredAt: null,
      deliveryPersonId: order.driver?.id || null,
      platformFee: null,
      businessEarnings: null,
      deliveryEarnings: null,
    };
    setSelectedOrder(mappedOrder);
    setActiveTab("orders");
    setOrderModalVisible(true);
  };

  const handleDashboardDriverPress = (driver: OnlineDriver) => {
    const existing = drivers.find((d) => d.id === driver.id);
    const fallback = {
      id: driver.id,
      name: driver.name,
      email: existing?.email || "",
      phone: existing?.phone || "",
      isOnline: driver.isOnline,
      isApproved: existing?.isApproved ?? true,
      strikes: existing?.strikes ?? 0,
      totalDeliveries: existing?.totalDeliveries ?? 0,
      rating: existing?.rating ?? null,
      createdAt: existing?.createdAt || driver.lastActiveAt || new Date().toISOString(),
    };
    setSelectedDriver(existing || fallback);
    setActiveTab("drivers");
    setDriverModalVisible(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "verifications":
        return <VerificationsTab theme={theme} showToast={showToast} />;
      case "dashboard":
        return (
          <DashboardTab
            metrics={dashboardMetrics}
            activeOrders={activeOrders}
            onlineDrivers={onlineDrivers}
            stats={null}
            onOrderPress={handleDashboardOrderPress}
            onDriverPress={handleDashboardDriverPress}
            navigation={{ navigate: (screen: string) => setActiveTab(screen === "MapView" ? "map" : screen) }}
          />
        );
      case "drivers":
        return <DriversTab theme={theme} showToast={showToast} />;
      case "finance":
        return <FinanceTab theme={theme} showToast={showToast} />;
      case "businesses":
        return (
          <View style={{ flex: 1 }}>
            <BusinessesTab businesses={businesses} onBusinessPress={handleBusinessPress} />
            {businessModalVisible && selectedBusiness && (
              <Pressable style={styles.modalOverlay} onPress={() => setBusinessModalVisible(false)}>
                <Pressable
                  style={[styles.modalCard, { backgroundColor: theme.card }]}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <ThemedText type="h3" style={{ color: theme.text }}>Detalles del Negocio</ThemedText>
                    <Pressable onPress={() => setBusinessModalVisible(false)} hitSlop={12}>
                      <Feather name="x" size={24} color={theme.text} />
                    </Pressable>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <ThemedText style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                          {selectedBusiness.name?.charAt(0).toUpperCase() || 'B'}
                        </ThemedText>
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Nombre:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedBusiness.name}
                          onChangeText={(text) => setSelectedBusiness({...selectedBusiness, name: text})}
                          placeholder="Nombre del negocio"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Dirección:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedBusiness.address || ''}
                          onChangeText={(text) => setSelectedBusiness({...selectedBusiness, address: text})}
                          placeholder="Dirección"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Telefono:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedBusiness.phone || ''}
                          onChangeText={(text) => setSelectedBusiness({...selectedBusiness, phone: text})}
                          placeholder="Telefono"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="phone-pad"
                        />
                      </View>

                      {/* Comision personalizada */}
                      <View style={{ width: '100%', marginBottom: 15, backgroundColor: theme.backgroundSecondary, padding: 12, borderRadius: 10 }}>
                        <ThemedText style={{ fontWeight: '700', color: theme.text, marginBottom: 4 }}>Comision personalizada (%)</ThemedText>
                        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
                          {(selectedBusiness as any).customCommission != null
                            ? `Usando comision especifica: ${(selectedBusiness as any).customCommission}%`
                            : 'Usando comision global del sistema'}
                        </ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.card }}
                          value={(selectedBusiness as any).customCommission != null ? String((selectedBusiness as any).customCommission) : ''}
                          onChangeText={(text) => setSelectedBusiness({...selectedBusiness, customCommission: text === '' ? null : parseInt(text) || 0} as any)}
                          placeholder="Dejar vacio = usa global"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    
                    <ThemedText style={{ fontWeight: 'bold', marginBottom: 15, fontSize: 16 }}>Tipo de Negocio:</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 25 }}>
                      {[
                        { key: 'restaurant', label: 'Restaurante', color: '#3B82F6' },
                        { key: 'market', label: 'Mercado', color: '#10B981' }
                      ].map((type) => (
                        <Pressable
                          key={type.key}
                          onPress={() => setSelectedBusiness({...selectedBusiness, type: type.key})}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                            borderRadius: 25,
                            backgroundColor: selectedBusiness.type === type.key ? type.color : '#f5f5f5',
                            borderWidth: 1,
                            borderColor: selectedBusiness.type === type.key ? type.color : '#ddd',
                            flex: 1,
                            alignItems: 'center'
                          }}
                        >
                          <ThemedText style={{ 
                            color: selectedBusiness.type === type.key ? 'white' : '#333',
                            fontWeight: selectedBusiness.type === type.key ? 'bold' : 'normal'
                          }}>
                            {type.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    
                    <View style={{ backgroundColor: theme.backgroundSecondary, padding: 15, borderRadius: 10, marginBottom: 20 }}>
                      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Estado:</ThemedText>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Pressable
                          onPress={() => setSelectedBusiness({...selectedBusiness, isActive: true})}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: selectedBusiness.isActive ? '#10B981' : theme.backgroundSecondary,
                            flex: 1,
                            alignItems: 'center'
                          }}
                        >
                          <ThemedText style={{ color: selectedBusiness.isActive ? 'white' : theme.text }}>Activo</ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => setSelectedBusiness({...selectedBusiness, isActive: false})}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: !selectedBusiness.isActive ? '#EF4444' : theme.backgroundSecondary,
                            flex: 1,
                            alignItems: 'center'
                          }}
                        >
                          <ThemedText style={{ color: !selectedBusiness.isActive ? 'white' : theme.text }}>Inactivo</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </ScrollView>
                  
                  <Pressable 
                    style={{ 
                      padding: 16, 
                      backgroundColor: '#FF8C00', 
                      borderRadius: 10, 
                      alignItems: 'center',
                      marginTop: 10
                    }}
                    onPress={handleSaveBusiness}
                  >
                    <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Guardar Cambios</ThemedText>
                  </Pressable>
                </Pressable>
              </Pressable>
            )}
          </View>
        );
      case "users":
        return (
          <View style={{ flex: 1 }}>
            <UsersTab users={users} onUserPress={openUserModal} />
            {userModalVisible && selectedUser && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999999
              }}>
                <View style={{
                  backgroundColor: theme.card,
                  borderRadius: 15,
                  padding: 25,
                  width: '90%',
                  maxWidth: 450,
                  maxHeight: '80%'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <ThemedText type="h3">Editar Usuario</ThemedText>
                    <Pressable onPress={() => setUserModalVisible(false)}>
                      <ThemedText style={{ fontSize: 24, color: '#666' }}>✕</ThemedText>
                    </Pressable>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#FF8C00', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <ThemedText style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                          {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
                        </ThemedText>
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Nombre:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedUser.name}
                          onChangeText={(text) => setSelectedUser({...selectedUser, name: text})}
                          placeholder="Nombre del usuario"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Email:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedUser.email || ''}
                          onChangeText={(text) => setSelectedUser({...selectedUser, email: text})}
                          placeholder="Email"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="email-address"
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Teléfono:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedUser.phone || ''}
                          onChangeText={(text) => setSelectedUser({...selectedUser, phone: text})}
                          placeholder="Teléfono"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                    
                    <ThemedText style={{ fontWeight: 'bold', marginBottom: 15, fontSize: 16 }}>Cambiar Rol:</ThemedText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                      {[
                        { key: 'customer', label: 'Cliente', color: '#6B7280' },
                        { key: 'business', label: 'Negocio', color: '#3B82F6' },
                        { key: 'driver', label: 'Repartidor', color: '#10B981' },
                        { key: 'admin', label: 'ComeYa', color: '#9333EA' }
                      ].map((role) => (
                        <Pressable
                          key={role.key}
                          onPress={() => setUserRoleEdit(role.key)}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 18,
                            borderRadius: 25,
                            backgroundColor: userRoleEdit === role.key ? role.color : theme.backgroundSecondary,
                            borderWidth: 1,
                            borderColor: userRoleEdit === role.key ? role.color : theme.border,
                            minWidth: 85,
                            alignItems: 'center'
                          }}
                        >
                          <ThemedText style={{ 
                            color: userRoleEdit === role.key ? 'white' : theme.text,
                            fontWeight: userRoleEdit === role.key ? 'bold' : 'normal',
                            fontSize: 14
                          }}>
                            {role.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    
                    <View style={{ backgroundColor: theme.backgroundSecondary, padding: 15, borderRadius: 10, marginBottom: 20 }}>
                      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Información actual:</ThemedText>
                      <ThemedText style={{ marginBottom: 5, color: theme.text }}>Rol actual: <ThemedText style={{ fontWeight: 'bold', color: theme.text }}>{selectedUser.role}</ThemedText></ThemedText>
                      <ThemedText>Registrado: <ThemedText style={{ fontWeight: 'bold' }}>{new Date(selectedUser.createdAt).toLocaleDateString('es-ES')}</ThemedText></ThemedText>
                    </View>
                  </ScrollView>
                  
                  <Pressable 
                    style={{ 
                      padding: 16, 
                      backgroundColor: '#FF8C00', 
                      borderRadius: 10, 
                      alignItems: 'center',
                      marginTop: 10
                    }}
                    onPress={handleUpdateUserRole}
                  >
                    <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Guardar Cambios</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      case "orders":
        return (
          <View style={{ flex: 1 }}>
            {orders.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                <Feather name="package" size={48} color={theme.textSecondary} />
                <ThemedText style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16 }}>No hay pedidos</ThemedText>
                <ThemedText style={{ color: theme.textSecondary, marginTop: 8, fontSize: 14, textAlign: 'center' }}>Los pedidos aparecerán aquí cuando los clientes realicen compras</ThemedText>
              </View>
            ) : (
              <OrdersTab orders={orders} onOrderPress={handleOrderPress} />
            )}
            {orderModalVisible && selectedOrder && (
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setOrderModalVisible(false)}
              >
                <Pressable
                  style={[styles.modalCard, { backgroundColor: theme.card }]}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.modalHeaderRow}>
                    <ThemedText type="h3" style={{ color: theme.text }}>
                      Detalles del Pedido
                    </ThemedText>
                    <Pressable onPress={() => setOrderModalVisible(false)} style={styles.closeButton} hitSlop={12}>
                      <Feather name="x" size={22} color={theme.text} />
                    </Pressable>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHero}>
                      <View style={[styles.modalAvatar, { backgroundColor: ComeYaColors.warning }]}>
                        <ThemedText style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>
                          #
                        </ThemedText>
                      </View>
                      <ThemedText type="h2" style={{ marginBottom: 5, color: theme.text }}>
                        #{selectedOrder.id.slice(0, 8)}
                      </ThemedText>
                      <ThemedText style={{ color: theme.textSecondary, marginBottom: 3 }}>
                        🏦 {selectedOrder.businessName}
                      </ThemedText>
                      <ThemedText style={{ color: theme.textSecondary, marginBottom: 3 }}>
                        👤 {selectedOrder.customerName}
                      </ThemedText>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        💰 €{(selectedOrder.total / 100).toFixed(2)}
                      </ThemedText>
                    </View>

                    <ThemedText style={{ fontWeight: "bold", marginBottom: 15, fontSize: 16, color: theme.text }}>
                      Estado del Pedido:
                    </ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 25 }}>
                      {[
                        { key: "pending", label: "Pendiente", color: "#F59E0B" },
                        { key: "confirmed", label: "Confirmado", color: "#3B82F6" },
                        { key: "preparing", label: "Preparando", color: "#8B5CF6" },
                        { key: "ready", label: "Listo", color: "#06B6D4" },
                        { key: "on_the_way", label: "En Camino", color: "#10B981" },
                        { key: "delivered", label: "Entregado", color: "#059669" },
                        { key: "cancelled", label: "Cancelado", color: "#EF4444" },
                      ].map((status) => (
                        <Pressable
                          key={status.key}
                          onPress={() => setSelectedOrder({ ...selectedOrder, status: status.key })}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 15,
                            borderRadius: 20,
                            backgroundColor:
                              selectedOrder.status === status.key ? status.color : theme.backgroundSecondary,
                            borderWidth: 1,
                            borderColor: selectedOrder.status === status.key ? status.color : theme.border,
                            minWidth: 80,
                            alignItems: "center",
                          }}
                        >
                          <ThemedText
                            style={{
                              color: selectedOrder.status === status.key ? "white" : theme.text,
                              fontWeight: selectedOrder.status === status.key ? "bold" : "normal",
                              fontSize: 12,
                            }}
                          >
                            {status.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>

                    <View
                      style={{
                        backgroundColor: theme.backgroundSecondary,
                        padding: 15,
                        borderRadius: 10,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: theme.border,
                      }}
                    >
                      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
                        Información del pedido:
                      </ThemedText>
                      <ThemedText style={{ marginBottom: 5, color: theme.text }}>
                        Método de pago: <ThemedText style={{ fontWeight: "bold", color: theme.text }}>
                          {selectedOrder.paymentMethod === "card" ? "Tarjeta" : "Efectivo"}
                        </ThemedText>
                      </ThemedText>
                      <ThemedText style={{ marginBottom: 5, color: theme.text }}>
                        Dirección: <ThemedText style={{ fontWeight: "bold", color: theme.text }}>
                          {selectedOrder.deliveryAddress}
                        </ThemedText>
                      </ThemedText>
                      <ThemedText style={{ color: theme.text }}>
                        Creado: <ThemedText style={{ fontWeight: "bold", color: theme.text }}>
                          {new Date(selectedOrder.createdAt).toLocaleString("es-ES")}
                        </ThemedText>
                      </ThemedText>
                      {selectedOrder.notes ? (
                        <ThemedText style={{ marginTop: 5, color: theme.text }}>
                          Notas: <ThemedText style={{ fontWeight: "bold", color: theme.text }}>
                            {selectedOrder.notes}
                          </ThemedText>
                        </ThemedText>
                      ) : null}
                    </View>
                  </ScrollView>

                  <Pressable
                    style={{
                      padding: 16,
                      backgroundColor: ComeYaColors.primary,
                      borderRadius: 10,
                      alignItems: "center",
                      marginTop: 10,
                    }}
                    onPress={() => {
                      showToast("Estado del pedido actualizado", "success");
                      setOrderModalVisible(false);
                    }}
                  >
                    <ThemedText style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                      Actualizar Estado
                    </ThemedText>
                  </Pressable>
                </Pressable>
              </Pressable>
            )}
          </View>
        );
      case "coupons":
      case "cupones":
        return (
          <View style={{ flex: 1 }}>
            <CouponsTab theme={theme} showToast={showToast} onSelectCoupon={handleCouponPress} />
            {couponModalVisible && selectedCoupon && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999999
              }}>
                <View style={{
                  backgroundColor: theme.card,
                  borderRadius: 15,
                  padding: 25,
                  width: '90%',
                  maxWidth: 500,
                  maxHeight: '85%'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <ThemedText type="h3">Detalles del Cupón</ThemedText>
                    <Pressable onPress={() => setCouponModalVisible(false)}>
                      <ThemedText style={{ fontSize: 24, color: '#666' }}>✕</ThemedText>
                    </Pressable>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#FF5722', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <ThemedText style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                          %
                        </ThemedText>
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Código:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedCoupon.code}
                          onChangeText={(text) => setSelectedCoupon({...selectedCoupon, code: text})}
                          placeholder="Código del cupón"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Valor de descuento:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedCoupon.discountValue?.toString() || ''}
                          onChangeText={(text) => setSelectedCoupon({...selectedCoupon, discountValue: parseFloat(text) || 0})}
                          placeholder="20"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Monto mínimo:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedCoupon.minOrderAmount ? (selectedCoupon.minOrderAmount / 100).toString() : ''}
                          onChangeText={(text) => setSelectedCoupon({...selectedCoupon, minOrderAmount: parseFloat(text) * 100 || null})}
                          placeholder="100"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: theme.backgroundSecondary, padding: 15, borderRadius: 10, marginBottom: 20 }}>
                      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Información del cupón:</ThemedText>
                      <ThemedText style={{ marginBottom: 5, color: theme.text }}>Tipo: <ThemedText style={{ fontWeight: 'bold', color: theme.text }}>{selectedCoupon.discountType === 'percentage' ? 'Porcentaje' : 'Fijo'}</ThemedText></ThemedText>
                      <ThemedText style={{ marginBottom: 5, color: theme.text }}>Usos: <ThemedText style={{ fontWeight: 'bold', color: theme.text }}>{selectedCoupon.usedCount}/{selectedCoupon.maxUses || '∞'}</ThemedText></ThemedText>
                      <ThemedText>Creado: <ThemedText style={{ fontWeight: 'bold' }}>{new Date(selectedCoupon.createdAt).toLocaleDateString('es-ES')}</ThemedText></ThemedText>
                    </View>
                    
                    <ThemedText style={{ fontWeight: 'bold', marginBottom: 15, fontSize: 16 }}>Estado del Cupón:</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 25 }}>
                      <Pressable
                        onPress={() => setSelectedCoupon({...selectedCoupon, isActive: true})}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          borderRadius: 25,
                          backgroundColor: selectedCoupon.isActive ? '#10B981' : theme.backgroundSecondary,
                          borderWidth: 1,
                          borderColor: selectedCoupon.isActive ? '#10B981' : theme.border,
                          flex: 1,
                          alignItems: 'center'
                        }}
                      >
                        <ThemedText style={{ 
                          color: selectedCoupon.isActive ? 'white' : theme.text,
                          fontWeight: selectedCoupon.isActive ? 'bold' : 'normal'
                        }}>
                          Activo
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setSelectedCoupon({...selectedCoupon, isActive: false})}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          borderRadius: 25,
                          backgroundColor: !selectedCoupon.isActive ? '#EF4444' : theme.backgroundSecondary,
                          borderWidth: 1,
                          borderColor: !selectedCoupon.isActive ? '#EF4444' : theme.border,
                          flex: 1,
                          alignItems: 'center'
                        }}
                      >
                        <ThemedText style={{ 
                          color: !selectedCoupon.isActive ? 'white' : theme.text,
                          fontWeight: !selectedCoupon.isActive ? 'bold' : 'normal'
                        }}>
                          Inactivo
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ScrollView>
                  
                  <Pressable 
                    style={{ 
                      padding: 16, 
                      backgroundColor: '#FF8C00', 
                      borderRadius: 10, 
                      alignItems: 'center',
                      marginTop: 10
                    }}
                    onPress={() => {
                      showToast('Cupón actualizado', 'success');
                      setCouponModalVisible(false);
                    }}
                  >
                    <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Actualizar Cupón</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      case "support":
        return <SupportTab theme={theme} showToast={showToast} />;
      case "zones":
      case "zonas":
        return (
          <View style={{ flex: 1 }}>
            <ZonesTab theme={theme} showToast={showToast} onSelectZone={handleZonePress} />
            {zoneModalVisible && selectedZone && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999999
              }}>
                <View style={{
                  backgroundColor: theme.card,
                  borderRadius: 15,
                  padding: 25,
                  width: '90%',
                  maxWidth: 500,
                  maxHeight: '85%'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <ThemedText type="h3">Detalles de la Zona</ThemedText>
                    <Pressable onPress={() => setZoneModalVisible(false)}>
                      <ThemedText style={{ fontSize: 24, color: '#666' }}>✕</ThemedText>
                    </Pressable>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <ThemedText style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                          🗺️
                        </ThemedText>
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Nombre:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedZone.name}
                          onChangeText={(text) => setSelectedZone({...selectedZone, name: text})}
                          placeholder="Nombre de la zona"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Descripción:</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedZone.description || ''}
                          onChangeText={(text) => setSelectedZone({...selectedZone, description: text})}
                          placeholder="Descripción de la zona"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600', color: theme.text }}>Tarifa de entrega (€):</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedZone.deliveryFee ? (selectedZone.deliveryFee / 100).toString() : ''}
                          onChangeText={(text) => setSelectedZone({...selectedZone, deliveryFee: parseFloat(text) * 100 || 0})}
                          placeholder="3.00"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                      
                      <View style={{ width: '100%', marginBottom: 15 }}>
                        <ThemedText style={{ marginBottom: 5, fontWeight: '600' }}>Tiempo máximo (min):</ThemedText>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 8, fontSize: 16, color: theme.text, backgroundColor: theme.backgroundSecondary }}
                          value={selectedZone.maxDeliveryTime?.toString() || ''}
                          onChangeText={(text) => setSelectedZone({...selectedZone, maxDeliveryTime: parseInt(text) || 0})}
                          placeholder="30"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: theme.backgroundSecondary, padding: 15, borderRadius: 10, marginBottom: 20 }}>
                      <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Información de la zona:</ThemedText>
                      <ThemedText style={{ marginBottom: 5 }}>Radio: <ThemedText style={{ fontWeight: 'bold' }}>{selectedZone.radiusKm || 0} km</ThemedText></ThemedText>
                      <ThemedText style={{ marginBottom: 5 }}>Coordenadas: <ThemedText style={{ fontWeight: 'bold' }}>{selectedZone.centerLatitude || 'N/A'}, {selectedZone.centerLongitude || 'N/A'}</ThemedText></ThemedText>
                      <ThemedText>Creada: <ThemedText style={{ fontWeight: 'bold' }}>{selectedZone.createdAt ? new Date(selectedZone.createdAt).toLocaleDateString('es-ES') : 'N/A'}</ThemedText></ThemedText>
                    </View>
                    
                    <ThemedText style={{ fontWeight: 'bold', marginBottom: 15, fontSize: 16 }}>Estado de la Zona:</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 25 }}>
                      <Pressable
                        onPress={() => setSelectedZone({...selectedZone, isActive: true})}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          borderRadius: 25,
                          backgroundColor: selectedZone.isActive ? '#10B981' : theme.backgroundSecondary,
                          borderWidth: 1,
                          borderColor: selectedZone.isActive ? '#10B981' : theme.border,
                          flex: 1,
                          alignItems: 'center'
                        }}
                      >
                        <ThemedText style={{ 
                          color: selectedZone.isActive ? 'white' : theme.text,
                          fontWeight: selectedZone.isActive ? 'bold' : 'normal'
                        }}>
                          Activa
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setSelectedZone({...selectedZone, isActive: false})}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          borderRadius: 25,
                          backgroundColor: !selectedZone.isActive ? '#EF4444' : theme.backgroundSecondary,
                          borderWidth: 1,
                          borderColor: !selectedZone.isActive ? '#EF4444' : theme.border,
                          flex: 1,
                          alignItems: 'center'
                        }}
                      >
                        <ThemedText style={{ 
                          color: !selectedZone.isActive ? 'white' : theme.text,
                          fontWeight: !selectedZone.isActive ? 'bold' : 'normal'
                        }}>
                          Inactiva
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ScrollView>
                  
                  <Pressable 
                    style={{ 
                      padding: 16, 
                      backgroundColor: '#FF8C00', 
                      borderRadius: 10, 
                      alignItems: 'center',
                      marginTop: 10
                    }}
                    onPress={() => {
                      showToast('Zona actualizada', 'success');
                      setZoneModalVisible(false);
                    }}
                  >
                    <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Actualizar Zona</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      case "support":
      case "soporte":
        return <SupportTab theme={theme} showToast={showToast} />;
      case "settings":
      case "configuracion":
        return <SettingsTab theme={theme} showToast={showToast} />;
      case "delivery-config":
        const DeliveryConfigScreen = require("./DeliveryConfigScreen").default;
        return <DeliveryConfigScreen />;
      case "map":
        const MapViewScreen = require("./MapViewScreen").default;
        return <MapViewScreen navigation={{ goBack: handleBack }} />;
      case "products":
      case "productos":
        return (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <ThemedText style={{ marginBottom: 12, fontWeight: '600' }}>Selecciona un negocio:</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {businesses.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        setSelectedBusinessId(b.id);
                        fetchProducts(b.id);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 20,
                        backgroundColor: selectedBusinessId === b.id ? ComeYaColors.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: ComeYaColors.primary,
                      }}
                    >
                      <ThemedText style={{ color: selectedBusinessId === b.id ? '#fff' : ComeYaColors.primary, fontSize: 14 }}>
                        {b.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            
            {selectedBusinessId ? (
              products.length === 0 ? (
                <View style={{ backgroundColor: theme.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
                  <Feather name="box" size={48} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 16 }}>No hay productos</ThemedText>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {products.map((p) => (
                    <View key={p.id} style={{ backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {p.image ? (
                          <View style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', marginRight: 12 }}>
                            <Image
                              source={{ uri: p.image }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />
                          </View>
                        ) : (
                          <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: p.isAvailable ? ComeYaColors.success + '20' : theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Feather name="box" size={20} color={p.isAvailable ? ComeYaColors.success : theme.textSecondary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <ThemedText style={{ fontWeight: '600' }}>{p.name}</ThemedText>
                          <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>{p.category}</ThemedText>
                          {p.description && (
                            <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                              {p.description}
                            </ThemedText>
                          )}
                        </View>
                        <ThemedText style={{ color: ComeYaColors.primary, fontWeight: 'bold' }}>
                          €{(p.price / 100).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
                        {p.isWeightBased && (
                          <View style={{ backgroundColor: ComeYaColors.warning + '20', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}>
                            <ThemedText style={{ color: ComeYaColors.warning, fontSize: 12 }}>Por peso</ThemedText>
                          </View>
                        )}
                        <View style={{ backgroundColor: p.isAvailable ? ComeYaColors.success + '20' : ComeYaColors.error + '20', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}>
                          <ThemedText style={{ color: p.isAvailable ? ComeYaColors.success : ComeYaColors.error, fontSize: 12 }}>
                            {p.isAvailable ? 'Disponible' : 'Agotado'}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )
            ) : (
              <View style={{ backgroundColor: theme.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
                <Feather name="arrow-up" size={48} color={theme.textSecondary} />
                <ThemedText style={{ color: theme.textSecondary, marginTop: 16 }}>Selecciona un negocio arriba</ThemedText>
              </View>
            )}
          </View>
        );
      case "logs":
        return (
          <View style={{ flex: 1, padding: 16 }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Logs de auditoría ({adminLogs.length})</ThemedText>
            {adminLogs.length === 0 ? (
              <View style={{ backgroundColor: theme.card, padding: 32, borderRadius: 12, alignItems: 'center' }}>
                <Feather name="file-text" size={48} color={theme.textSecondary} />
                <ThemedText style={{ color: theme.textSecondary, marginTop: 16 }}>No hay registros de auditoría</ThemedText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {adminLogs.map((log) => (
                  <View key={log.id} style={{ backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ backgroundColor: getLogActionColor(log.action) + '20', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}>
                        <ThemedText style={{ color: getLogActionColor(log.action), fontSize: 12, fontWeight: '600' }}>
                          {log.action}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {new Date(log.createdAt).toLocaleString('es-ES')}
                      </ThemedText>
                    </View>
                    <ThemedText style={{ marginBottom: 4 }}>
                      {log.resource}{log.resourceId ? ` (${log.resourceId.slice(0, 8)}...)` : ''}
                    </ThemedText>
                    {log.userEmail && (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>Por: {log.userEmail}</ThemedText>
                    )}
                    {log.ipAddress && (
                      <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>IP: {log.ipAddress}</ThemedText>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  const getLogActionColor = (action: string) => {
    switch (action) {
      case "LOGIN_SUCCESS":
        return ComeYaColors.success;
      case "LOGIN_FAILED":
      case "RATE_LIMIT_BLOCKED":
        return ComeYaColors.error;
      case "CREATE":
        return "#2196F3";
      case "UPDATE":
        return ComeYaColors.warning;
      case "DELETE":
        return ComeYaColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const fetchCoupons = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/coupons");
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    }
  };

  const handleCouponPress = (coupon: any) => {
    setSelectedCoupon(coupon);
    setCouponModalVisible(true);
  };

  const fetchZones = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/zones");
      const data = await res.json();
      setZones(data.zones || []);
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  };

  const handleZonePress = (zone: any) => {
    setSelectedZone(zone);
    setZoneModalVisible(true);
  };

  const fetchProducts = async (businessId: string) => {
    try {
      const res = await apiRequest("GET", `/api/admin/businesses/${businessId}/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/logs");
      const data = await res.json();
      setAdminLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching admin logs:", error);
    }
  };

  if (activeTab) {
    // Tabs que manejan su propio scroll internamente
    const selfScrollingTabs = ["dashboard", "finance", "drivers", "verifications"];
    const isSelfScrolling = selfScrollingTabs.includes(activeTab);

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={['top']}>
        <View style={[styles.header]}>
          <View style={styles.headerContent}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h2">
              {menuItems.find(item => item.tab === activeTab)?.title}
            </ThemedText>
          </View>
        </View>
        {isSelfScrolling ? (
          <View style={{ flex: 1 }}>
            {renderTabContent()}
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ComeYaColors.primary}
              />
            }
          >
            {renderTabContent()}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={['top']}>
      <View style={[styles.header]}>
        <ThemedText type="h1">Panel ComeYa</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Bienvenido, {user?.name}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {menuItems.map((item) => (
            <Pressable
              key={item.tab}
              onPress={() => handleMenuPress(item.tab)}
              style={[
                styles.card,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <View
                style={[
                  styles.cardIcon,
                  { backgroundColor: item.color + "20" },
                ]}
              >
                <Feather name={item.icon as any} size={28} color={item.color} />
              </View>
              <ThemedText type="body" style={styles.cardTitle}>
                {item.title}
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.cardSubtitle, { color: theme.textSecondary }]}
              >
                {item.subtitle}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ScrollView>



      {/* Order Overlay */}
      {orderModalVisible && (
        <Pressable style={styles.modalOverlay} onPress={() => setOrderModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                Detalles del Pedido
              </ThemedText>
              <Pressable onPress={() => setOrderModalVisible(false)} style={styles.closeButton} hitSlop={12}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            {selectedOrder && (
              <View>
                <ThemedText type="h2" style={{ marginBottom: 10, color: theme.text }}>
                  #{selectedOrder.id.slice(0, 8)}
                </ThemedText>
                <ThemedText style={{ marginBottom: 5, color: theme.textSecondary }}>
                  🏪 {selectedOrder.businessName}
                </ThemedText>
                <ThemedText style={{ marginBottom: 5, color: theme.textSecondary }}>
                  👤 {selectedOrder.customerName}
                </ThemedText>
                <ThemedText style={{ marginBottom: 15, color: theme.textSecondary }}>
                  💰 €{(selectedOrder.total / 100).toFixed(2)} | {selectedOrder.status}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable 
                    style={{ flex: 1, padding: 12, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' }}
                    onPress={() => handleOrderAction("Confirmar", selectedOrder)}
                  >
                    <ThemedText style={{ color: "white", fontWeight: 'bold' }}>Confirmar</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={{ flex: 1, padding: 12, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' }}
                    onPress={() => handleOrderAction("Cancelar", selectedOrder)}
                  >
                    <ThemedText style={{ color: "white", fontWeight: 'bold' }}>Cancelar</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing["4xl"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  card: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minHeight: 120,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    textAlign: "center",
    lineHeight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "85%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalHero: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    paddingBottom: Spacing.md,
  },
  modalBody: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  userDetailCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minWidth: 70,
  },
});