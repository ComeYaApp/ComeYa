import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import { NativeMap } from "@/components/NativeMap";
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
} from "@/components/admin/tabs";
import type {
  DashboardMetrics,
  ActiveOrder,
  OnlineDriver,
  AdminUser,
  AdminOrder,
  Business,
} from "@/components/admin/types/admin.types";

interface AdminLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  usersByRole: {
    customers: number;
    businesses: number;
    delivery: number;
    admins: number;
  };
}

interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
  isWeightBased: boolean;
  weightUnit: string | null;
  pricePerUnit: number | null;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isOnline: boolean;
  isApproved: boolean;
  strikes: number;
  totalDeliveries: number;
  rating: number | null;
  createdAt: string;
}

interface Wallet {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  balance: number;
  pendingBalance: number;
}

interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: string;
  bankName: string | null;
  accountNumber: string | null;
  createdAt: string;
}

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  lastMessageAt: string | null;
}

interface DeliveryZone {
  id: string;
  name: string;
  baseFee: number;
  pricePerKm: number;
  minOrderAmount: number;
  isActive: boolean;
}

interface SystemSetting {
  key: string;
  value: string;
  description: string;
}











export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "users"
    | "orders"
    | "businesses"
    | "products"
    | "logs"
    | "drivers"
    | "coupons"
    | "support"
    | "zones"
    | "settings"
  >("dashboard");
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [businessForm, setBusinessForm] = useState({
    name: "",
    type: "restaurant",
    description: "",
    image: "",
    address: "",
    phone: "",
    deliveryFee: "25",
    minOrderAmount: "50",
    isActive: true,
  });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    category: "",
    isAvailable: true,
    isWeightBased: false,
    weightUnit: "kg",
    pricePerUnit: "",
  });
  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [userRoleEdit, setUserRoleEdit] = useState("");

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
      setDashboardMetrics(null);
      setActiveOrders([]);
      setOnlineDrivers([]);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/logs?limit=50");
      const data = await res.json();
      setAdminLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching admin logs:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, ordersRes, businessesRes] = await Promise.all([
        apiRequest("GET", "/api/admin/stats"),
        apiRequest("GET", "/api/admin/users"),
        apiRequest("GET", "/api/admin/orders"),
        apiRequest("GET", "/api/businesses"),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const ordersData = await ordersRes.json();
      const businessesData = await businessesRes.json();

      setStats(statsData);
      setUsers(usersData.users || []);
      setOrders(ordersData.orders || []);
      setBusinesses(Array.isArray(businessesData) ? businessesData : businessesData.businesses || []);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showToast("Error al cargar datos del panel", "error");
      setStats(null);
      setUsers([]);
      setOrders([]);
      setBusinesses([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProducts = async (businessId: string) => {
    try {
      const res = await apiRequest("GET", `/api/businesses/${businessId}`);
      const data = await res.json();
      setProducts(data.business?.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    // Solo cargar datos básicos al inicio
    setIsLoading(false);
  }, []);

  // Cargar datos cuando cambia la pestaña activa
  useEffect(() => {
    const loadTabData = async () => {
      try {
        if (activeTab === "dashboard") {
          await fetchDashboardData();
        } else if (activeTab === "users" || activeTab === "orders" || activeTab === "businesses") {
          await fetchData();
        } else if (activeTab === "logs") {
          await fetchAdminLogs();
        }
      } catch (error) {
        console.error("Error loading tab data:", error);
      }
    };
    
    loadTabData();
  }, [activeTab]);

  // Auto-refresh solo para dashboard
  useEffect(() => {
    if (activeTab !== "dashboard") return;
    
    const interval = setInterval(() => {
      fetchDashboardData().catch(console.error);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (selectedBusinessId) {
      fetchProducts(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  const handleSaveBusiness = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const body = {
        ...businessForm,
        deliveryFee: parseFloat(businessForm.deliveryFee) * 100,
        minOrderAmount: parseFloat(businessForm.minOrderAmount) * 100,
      };
      if (editingBusiness) {
        await apiRequest(
          "PUT",
          `/api/admin/businesses/${editingBusiness.id}`,
          body,
        );
      } else {
        await apiRequest("POST", "/api/admin/businesses", body);
      }
      setShowBusinessModal(false);
      setEditingBusiness(null);
      setBusinessForm({
        name: "",
        type: "restaurant",
        description: "",
        image: "",
        address: "",
        phone: "",
        deliveryFee: "25",
        minOrderAmount: "50",
        isActive: true,
      });
      fetchData();
    } catch (error) {
      showToast("No se pudo guardar el negocio", "error");
    }
  };

  const handleSaveProduct = async () => {
    if (!selectedBusinessId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const body = {
        ...productForm,
        businessId: selectedBusinessId,
        price: parseFloat(productForm.price) * 100,
        pricePerUnit: productForm.isWeightBased
          ? parseFloat(productForm.pricePerUnit) * 100
          : null,
      };
      if (editingProduct) {
        await apiRequest(
          "PUT",
          `/api/admin/products/${editingProduct.id}`,
          body,
        );
      } else {
        await apiRequest("POST", "/api/admin/products", body);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({
        name: "",
        description: "",
        price: "",
        image: "",
        category: "",
        isAvailable: true,
        isWeightBased: false,
        weightUnit: "kg",
        pricePerUnit: "",
      });
      fetchProducts(selectedBusinessId);
    } catch (error) {
      showToast("No se pudo guardar el producto", "error");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await apiRequest("DELETE", `/api/admin/products/${productId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (selectedBusinessId) fetchProducts(selectedBusinessId);
    } catch (error) {
      showToast("No se pudo eliminar el producto", "error");
    }
  };

  const openUserModal = (user: AdminUser) => {
    console.log("Opening user modal for:", user.name);
    setSelectedUser(user);
    setUserRoleEdit(user.role);
    setShowUserModal(true);
  };

  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;
    try {
      // Mapear roles del frontend a los valores que acepta el servidor
      const roleMap: Record<string, string> = {
        customer: "customer",
        business: "business",
        driver: "driver",
        admin: "admin",
        super_admin: "super_admin"
      };
      
      const serverRole = roleMap[userRoleEdit] || userRoleEdit;
      
      await apiRequest("PUT", `/api/admin/users/${selectedUser.id}/role`, {
        role: serverRole,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Rol actualizado correctamente", "success");
      setShowUserModal(false);
      fetchData();
    } catch (error) {
      showToast("Error al actualizar el rol", "error");
    }
  };

  const openOrderModal = (order: AdminOrder) => {
    console.log("Opening order modal for:", order.id);
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleUpdateOrderStatus = async (status: string) => {
    if (!selectedOrder) return;
    try {
      await apiRequest("PUT", `/api/admin/orders/${selectedOrder.id}/status`, {
        status,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Estado del pedido actualizado", "success");
      setShowOrderModal(false);
      fetchData();
    } catch (error) {
      showToast("Error al actualizar el estado", "error");
    }
  };

  const openEditBusiness = (b: Business) => {
    setEditingBusiness(b);
    setBusinessForm({
      name: b.name,
      type: b.type,
      description: b.description || "",
      image: b.image || "",
      address: b.address || "",
      phone: b.phone || "",
      deliveryFee: ((b.deliveryFee || 0) / 100).toString(),
      minOrderAmount: ((b.minOrderAmount || 0) / 100).toString(),
      isActive: b.isActive,
    });
    setShowBusinessModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      description: p.description || "",
      price: ((p.price || 0) / 100).toString(),
      image: p.image || "",
      category: p.category || "",
      isAvailable: p.isAvailable,
      isWeightBased: p.isWeightBased,
      weightUnit: p.weightUnit || "kg",
      pricePerUnit: ((p.pricePerUnit || 0) / 100).toString(),
    });
    setShowProductModal(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return ComeYaColors.warning;
      case "confirmed":
        return "#2196F3";
      case "preparing":
        return ComeYaColors.primary;
      case "on_the_way":
        return "#9C27B0";
      case "delivered":
        return ComeYaColors.success;
      case "cancelled":
        return ComeYaColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "confirmed":
        return "Confirmado";
      case "preparing":
        return "Preparando";
      case "on_the_way":
        return "En camino";
      case "delivered":
        return "Entregado";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "customer":
        return "Cliente";
      case "business":
        return "Negocio";
      case "delivery":
        return "Repartidor";
      case "admin":
        return "ComeYa";
      default:
        return role;
    }
  };

  const getLogActionColor = (action: string) => {
    switch (action) {
      case "LOGIN_SUCCESS":
        return ComeYaColors.success;
      case "LOGIN_FAILED":
        return ComeYaColors.error;
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

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h1">Panel ComeYa</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Bienvenido, {user?.name}
        </ThemedText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {(
          [
            "dashboard",
            "users",
            "orders",
            "businesses",
            "products",
            "drivers",
            "coupons",
            "support",
            "zones",
            "settings",
            "logs",
          ] as const
        ).map((tab) => {
          const tabConfig: Record<string, { icon: string; label: string }> = {
            dashboard: { icon: "activity", label: "Dashboard" },
            users: { icon: "users", label: "Usuarios" },
            orders: { icon: "package", label: "Pedidos" },
            businesses: { icon: "briefcase", label: "Negocios" },
            products: { icon: "box", label: "Productos" },
            drivers: { icon: "truck", label: "Repartidores" },
            coupons: { icon: "tag", label: "Cupones" },
            support: { icon: "message-circle", label: "Soporte" },
            zones: { icon: "map-pin", label: "Zonas" },
            settings: { icon: "sliders", label: "Config" },
            logs: { icon: "file-text", label: "Logs" },
          };
          const config = tabConfig[tab] || { icon: "box", label: tab };
          return (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab);
              }}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    activeTab === tab ? ComeYaColors.primary : "transparent",
                  borderColor: ComeYaColors.primary,
                },
              ]}
            >
              <Feather
                name={config.icon as any}
                size={18}
                color={activeTab === tab ? "#FFFFFF" : ComeYaColors.primary}
              />
              <ThemedText
                type="small"
                style={{
                  color: activeTab === tab ? "#FFFFFF" : ComeYaColors.primary,
                  marginLeft: Spacing.xs,
                }}
              >
                {config.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {activeTab === "dashboard" && (
          <DashboardTab
            metrics={dashboardMetrics}
            activeOrders={activeOrders}
            onlineDrivers={onlineDrivers}
            stats={stats}
          />
        )}
        {activeTab === "users" && (
          <UsersTab users={users} onUserPress={openUserModal} />
        )}

        {activeTab === "orders" && (
          <OrdersTab orders={orders} onOrderPress={openOrderModal} />
        )}

        {activeTab === "businesses" && (
          <BusinessesTab
            businesses={businesses}
            onAddBusiness={() => {
              setEditingBusiness(null);
              setBusinessForm({
                name: "",
                type: "restaurant",
                description: "",
                image: "",
                address: "",
                phone: "",
                deliveryFee: "25",
                minOrderAmount: "50",
                isActive: true,
              });
              setShowBusinessModal(true);
            }}
            onEditBusiness={openEditBusiness}
            onManageProducts={(id: string) => {
              setSelectedBusinessId(id);
              setActiveTab("products");
            }}
          /> as any
        )}

        {activeTab === "products" ? (
          <View style={styles.listContainer}>
            <View
              style={[
                styles.section,
                { backgroundColor: theme.card, marginBottom: Spacing.md },
              ]}
            >
              <ThemedText type="body" style={{ marginBottom: Spacing.sm }}>
                Selecciona un negocio:
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  {businesses.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedBusinessId(b.id)}
                      style={[
                        styles.tab,
                        {
                          backgroundColor:
                            selectedBusinessId === b.id
                              ? ComeYaColors.primary
                              : "transparent",
                          borderColor: ComeYaColors.primary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            selectedBusinessId === b.id
                              ? "#FFFFFF"
                              : ComeYaColors.primary,
                        }}
                      >
                        {b.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            {selectedBusinessId ? (
              <>
                <Pressable
                  onPress={() => {
                    setEditingProduct(null);
                    setProductForm({
                      name: "",
                      description: "",
                      price: "",
                      image: "",
                      category: "",
                      isAvailable: true,
                      isWeightBased: false,
                      weightUnit: "kg",
                      pricePerUnit: "",
                    });
                    setShowProductModal(true);
                  }}
                  style={[
                    styles.addButton,
                    { backgroundColor: ComeYaColors.primary },
                  ]}
                >
                  <Feather name="plus" size={20} color="#FFFFFF" />
                  <ThemedText
                    type="body"
                    style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}
                  >
                    Agregar Producto
                  </ThemedText>
                </Pressable>
                {products.length === 0 ? (
                  <View
                    style={[styles.emptyState, { backgroundColor: theme.card }]}
                  >
                    <Feather name="box" size={48} color={theme.textSecondary} />
                    <ThemedText
                      type="body"
                      style={{
                        color: theme.textSecondary,
                        marginTop: Spacing.md,
                      }}
                    >
                      No hay productos
                    </ThemedText>
                  </View>
                ) : (
                  products.map((p) => (
                    <View
                      key={p.id}
                      style={[
                        styles.listItem,
                        { backgroundColor: theme.card },
                        Shadows.sm,
                      ]}
                    >
                      <View style={styles.listItemHeader}>
                        {p.image ? (
                          <Image
                            source={{ uri: p.image }}
                            style={styles.productImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.orderIcon,
                              {
                                backgroundColor: p.isAvailable
                                  ? ComeYaColors.primaryLight
                                  : theme.backgroundSecondary,
                              },
                            ]}
                          >
                            <Feather
                              name="box"
                              size={20}
                              color={
                                p.isAvailable
                                  ? ComeYaColors.primary
                                  : theme.textSecondary
                              }
                            />
                          </View>
                        )}
                        <View style={styles.listItemContent}>
                          <ThemedText type="body" style={{ fontWeight: "600" }}>
                            {p.name}
                          </ThemedText>
                          <ThemedText
                            type="caption"
                            style={{ color: theme.textSecondary }}
                          >
                            {p.category}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="h4"
                          style={{ color: ComeYaColors.primary }}
                        >
                          €{(p.price / 100).toFixed(2)}
                        </ThemedText>
                      </View>
                      <View style={styles.listItemFooter}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: Spacing.sm,
                          }}
                        >
                          {p.isWeightBased ? (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: ComeYaColors.warning + "20" },
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{ color: ComeYaColors.warning }}
                              >
                                Por peso
                              </ThemedText>
                            </View>
                          ) : null}
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: p.isAvailable
                                  ? ComeYaColors.success + "20"
                                  : ComeYaColors.error + "20",
                              },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{
                                color: p.isAvailable
                                  ? ComeYaColors.success
                                  : ComeYaColors.error,
                              }}
                            >
                              {p.isAvailable ? "Disponible" : "Agotado"}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: Spacing.md }}>
                          <Pressable onPress={() => openEditProduct(p)}>
                            <Feather
                              name="edit-2"
                              size={18}
                              color={ComeYaColors.primary}
                            />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteProduct(p.id)}>
                            <Feather
                              name="trash-2"
                              size={18}
                              color={ComeYaColors.error}
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : (
              <View
                style={[styles.emptyState, { backgroundColor: theme.card }]}
              >
                <Feather
                  name="arrow-up"
                  size={48}
                  color={theme.textSecondary}
                />
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: Spacing.md }}
                >
                  Selecciona un negocio arriba
                </ThemedText>
              </View>
            )}
          </View>
        ) : null}
        {activeTab === "logs" && (
          <View style={styles.listContainer}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Logs de auditoría ({adminLogs.length})
            </ThemedText>
            {adminLogs.length === 0 ? (
              <View
                style={[styles.emptyState, { backgroundColor: theme.card }]}
              >
                <Feather
                  name="file-text"
                  size={48}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={{ marginTop: Spacing.md, color: theme.textSecondary }}
                >
                  No hay registros de auditoría
                </ThemedText>
              </View>
            ) : (
              adminLogs.map((log) => (
                <View
                  key={log.id}
                  style={[styles.logCard, { backgroundColor: theme.card }]}
                >
                  <View style={styles.logHeader}>
                    <View
                      style={[
                        styles.actionBadge,
                        {
                          backgroundColor: getLogActionColor(log.action) + "20",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: getLogActionColor(log.action),
                          fontWeight: "600",
                        }}
                      >
                        {log.action}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {new Date(log.createdAt).toLocaleString("es-VE")}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ marginTop: Spacing.xs }}>
                    {log.resource}
                    {log.resourceId
                      ? ` (${log.resourceId.slice(0, 8)}...)`
                      : ""}
                  </ThemedText>
                  {log.userEmail ? (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Por: {log.userEmail}
                    </ThemedText>
                  ) : null}
                  {log.ipAddress ? (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      IP: {log.ipAddress}
                    </ThemedText>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "drivers" && (
          <DriversTab showToast={showToast} /> as any
        )}

        {activeTab === "coupons" && (
          <CouponsTab showToast={showToast} onSelectCoupon={() => {}} /> as any
        )}

        {activeTab === "support" && (
          <SupportTab showToast={showToast} /> as any
        )}

        {activeTab === "zones" && (
          <ZonesTab showToast={showToast} onSelectZone={() => {}} /> as any
        )}

        {activeTab === "settings" && (
          <SettingsTab showToast={showToast} /> as any
        )}
      </ScrollView>

      <Modal visible={showBusinessModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">
                {editingBusiness ? "Editar Negocio" : "Nuevo Negocio"}
              </ThemedText>
              <Pressable onPress={() => setShowBusinessModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Nombre
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={businessForm.name}
                onChangeText={(t) =>
                  setBusinessForm({ ...businessForm, name: t })
                }
                placeholder="Nombre del negocio"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Tipo
              </ThemedText>
              <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                {["restaurant", "market"].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() =>
                      setBusinessForm({ ...businessForm, type: t })
                    }
                    style={[
                      styles.tab,
                      {
                        backgroundColor:
                          businessForm.type === t
                            ? ComeYaColors.primary
                            : "transparent",
                        borderColor: ComeYaColors.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          businessForm.type === t
                            ? "#FFFFFF"
                            : ComeYaColors.primary,
                      }}
                    >
                      {t === "restaurant" ? "Restaurante" : "Mercado"}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Descripcion
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    height: 80,
                  },
                ]}
                value={businessForm.description}
                onChangeText={(t) =>
                  setBusinessForm({ ...businessForm, description: t })
                }
                placeholder="Descripcion"
                placeholderTextColor={theme.textSecondary}
                multiline
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Imagen URL
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={businessForm.image}
                onChangeText={(t) =>
                  setBusinessForm({ ...businessForm, image: t })
                }
                placeholder="URL de imagen"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Direccion
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={businessForm.address}
                onChangeText={(t) =>
                  setBusinessForm({ ...businessForm, address: t })
                }
                placeholder="Direccion"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Telefono
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={businessForm.phone}
                onChangeText={(t) =>
                  setBusinessForm({ ...businessForm, phone: t })
                }
                placeholder="Telefono"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
              <View
                style={{
                  flexDirection: "row",
                  gap: Spacing.md,
                  marginTop: Spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ marginBottom: 4 }}>
                    Costo de envio ($)
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                      },
                    ]}
                    value={businessForm.deliveryFee}
                    onChangeText={(t) =>
                      setBusinessForm({ ...businessForm, deliveryFee: t })
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ marginBottom: 4 }}>
                    Pedido minimo ($)
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                      },
                    ]}
                    value={businessForm.minOrderAmount}
                    onChangeText={(t) =>
                      setBusinessForm({ ...businessForm, minOrderAmount: t })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Pressable
                onPress={() =>
                  setBusinessForm({
                    ...businessForm,
                    isActive: !businessForm.isActive,
                  })
                }
                style={[styles.checkRow, { marginTop: Spacing.lg }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: ComeYaColors.primary,
                      backgroundColor: businessForm.isActive
                        ? ComeYaColors.primary
                        : "transparent",
                    },
                  ]}
                >
                  {businessForm.isActive ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Negocio activo
                </ThemedText>
              </Pressable>
            </ScrollView>
            <Pressable
              onPress={handleSaveBusiness}
              style={[
                styles.saveButton,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Guardar
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </ThemedText>
              <Pressable onPress={() => setShowProductModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Nombre
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={productForm.name}
                onChangeText={(t) =>
                  setProductForm({ ...productForm, name: t })
                }
                placeholder="Nombre del producto"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Descripcion
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    height: 80,
                  },
                ]}
                value={productForm.description}
                onChangeText={(t) =>
                  setProductForm({ ...productForm, description: t })
                }
                placeholder="Descripcion"
                placeholderTextColor={theme.textSecondary}
                multiline
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Precio ($)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={productForm.price}
                onChangeText={(t) =>
                  setProductForm({ ...productForm, price: t })
                }
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Categoria
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={productForm.category}
                onChangeText={(t) =>
                  setProductForm({ ...productForm, category: t })
                }
                placeholder="Ej: Tacos, Bebidas, Frutas"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{ marginBottom: 4, marginTop: Spacing.md }}
              >
                Imagen URL
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
                value={productForm.image}
                onChangeText={(t) =>
                  setProductForm({ ...productForm, image: t })
                }
                placeholder="URL de imagen"
                placeholderTextColor={theme.textSecondary}
              />
              <Pressable
                onPress={() =>
                  setProductForm({
                    ...productForm,
                    isWeightBased: !productForm.isWeightBased,
                  })
                }
                style={[styles.checkRow, { marginTop: Spacing.lg }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: ComeYaColors.primary,
                      backgroundColor: productForm.isWeightBased
                        ? ComeYaColors.primary
                        : "transparent",
                    },
                  ]}
                >
                  {productForm.isWeightBased ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Producto por peso (mercado)
                </ThemedText>
              </Pressable>
              {productForm.isWeightBased ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: Spacing.md,
                    marginTop: Spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ marginBottom: 4 }}>
                      Unidad
                    </ThemedText>
                    <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                      {["kg", "lb", "pza"].map((u) => (
                        <Pressable
                          key={u}
                          onPress={() =>
                            setProductForm({ ...productForm, weightUnit: u })
                          }
                          style={[
                            styles.tab,
                            {
                              backgroundColor:
                                productForm.weightUnit === u
                                  ? ComeYaColors.primary
                                  : "transparent",
                              borderColor: ComeYaColors.primary,
                              paddingHorizontal: Spacing.sm,
                            },
                          ]}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color:
                                productForm.weightUnit === u
                                  ? "#FFFFFF"
                                  : ComeYaColors.primary,
                            }}
                          >
                            {u}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ marginBottom: 4 }}>
                      Precio por unidad ($)
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                        },
                      ]}
                      value={productForm.pricePerUnit}
                      onChangeText={(t) =>
                        setProductForm({ ...productForm, pricePerUnit: t })
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ) : null}
              <Pressable
                onPress={() =>
                  setProductForm({
                    ...productForm,
                    isAvailable: !productForm.isAvailable,
                  })
                }
                style={[styles.checkRow, { marginTop: Spacing.lg }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: ComeYaColors.primary,
                      backgroundColor: productForm.isAvailable
                        ? ComeYaColors.primary
                        : "transparent",
                    },
                  ]}
                >
                  {productForm.isAvailable ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  Producto disponible
                </ThemedText>
              </Pressable>
            </ScrollView>
            <Pressable
              onPress={handleSaveProduct}
              style={[
                styles.saveButton,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Guardar
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h3">Detalles del Usuario</ThemedText>
              <Pressable onPress={() => setShowUserModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedUser ? (
                <>
                  <View style={[styles.userDetailCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.avatar, { backgroundColor: ComeYaColors.primaryLight, width: 60, height: 60 }]}>
                      <ThemedText type="h2" style={{ color: ComeYaColors.primaryDark }}>
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText type="h3" style={{ marginTop: Spacing.md }}>{selectedUser.name}</ThemedText>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>{selectedUser.email}</ThemedText>
                    {selectedUser.phone ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                        {selectedUser.phone}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={{ marginTop: Spacing.lg }}>
                    <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                      Estado de verificación
                    </ThemedText>
                    <View style={{ flexDirection: "row", gap: Spacing.md }}>
                      <View style={styles.infoChip}>
                        <Feather
                          name={selectedUser.emailVerified ? "check-circle" : "x-circle"}
                          size={14}
                          color={selectedUser.emailVerified ? ComeYaColors.success : ComeYaColors.error}
                        />
                        <ThemedText type="caption" style={{ marginLeft: 4 }}>
                          Email {selectedUser.emailVerified ? "verificado" : "sin verificar"}
                        </ThemedText>
                      </View>
                      <View style={styles.infoChip}>
                        <Feather
                          name={(selectedUser as any).phoneVerified ? "check-circle" : "x-circle"}
                          size={14}
                          color={(selectedUser as any).phoneVerified ? ComeYaColors.success : ComeYaColors.error}
                        />
                        <ThemedText type="caption" style={{ marginLeft: 4 }}>
                          Tel {(selectedUser as any).phoneVerified ? "verificado" : "sin verificar"}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={{ marginTop: Spacing.lg }}>
                    <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                      Cambiar Rol
                    </ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
                      {["customer", "business", "driver", "admin"].map((role) => (
                        <Pressable
                          key={role}
                          onPress={() => setUserRoleEdit(role)}
                          style={[
                            styles.tab,
                            {
                              backgroundColor: userRoleEdit === role ? ComeYaColors.primary : "transparent",
                              borderColor: ComeYaColors.primary,
                            },
                          ]}
                        >
                          <ThemedText
                            type="small"
                            style={{ color: userRoleEdit === role ? "#FFFFFF" : ComeYaColors.primary }}
                          >
                            {getRoleLabel(role)}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
                    Registrado: {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </ThemedText>
                </>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={handleUpdateUserRole}
              style={[styles.saveButton, { backgroundColor: ComeYaColors.primary }]}
            >
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Guardar Cambios
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showOrderModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}> 
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h3">Detalles del Pedido</ThemedText>
              <Pressable onPress={() => setShowOrderModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedOrder ? (
                <>
                  <View style={[styles.userDetailCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.orderIcon, { backgroundColor: ComeYaColors.primaryLight, width: 50, height: 50 }]}>
                      <Feather name="package" size={24} color={ComeYaColors.primary} />
                    </View>
                    <ThemedText type="h3" style={{ marginTop: Spacing.md }}>
                      #{selectedOrder.id.slice(0, 8)}
                    </ThemedText>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) + "20", marginTop: Spacing.xs }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedOrder.status) }]} />
                      <ThemedText type="caption" style={{ color: getStatusColor(selectedOrder.status), marginLeft: 6 }}>
                        {getStatusLabel(selectedOrder.status)}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.md }]}>
                    <View style={styles.detailRow}>
                      <Feather name="user" size={16} color={theme.textSecondary} />
                      <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>Cliente</ThemedText>
                        <ThemedText type="body">{selectedOrder.customerName}</ThemedText>
                        {selectedOrder.customerPhone ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>{selectedOrder.customerPhone}</ThemedText>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.sm }]}>
                    <View style={styles.detailRow}>
                      <Feather name="shopping-bag" size={16} color={theme.textSecondary} />
                      <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>Negocio</ThemedText>
                        <ThemedText type="body">{selectedOrder.businessName}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.sm }]}>
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={16} color={theme.textSecondary} />
                      <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>Dirección de entrega</ThemedText>
                        <ThemedText type="body">{selectedOrder.deliveryAddress}</ThemedText>
                      </View>
                    </View>
                    {selectedOrder.deliveryLatitude && selectedOrder.deliveryLongitude ? (
                      <Pressable
                        onPress={() => {
                          const url = `https://www.google.com/maps?q=${selectedOrder.deliveryLatitude},${selectedOrder.deliveryLongitude}`;
                          Linking.openURL(url);
                        }}
                        style={[styles.mapButton, { backgroundColor: ComeYaColors.primary }]}
                      >
                        <Feather name="map" size={16} color="#FFFFFF" />
                        <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}>
                          Ver en Mapa
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={{ marginTop: Spacing.lg }}>
                    <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                      Resumen del Pedido
                    </ThemedText>
                    <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary }]}>
                      {(() => {
                        try {
                          const items = JSON.parse(selectedOrder.items);
                          return items.map((item: any, index: number) => (
                            <View key={index} style={[styles.detailRow, { borderBottomWidth: index < items.length - 1 ? 1 : 0, borderBottomColor: theme.border }]}>
                              <ThemedText type="body" style={{ flex: 1 }}>{item.quantity}x {item.name}</ThemedText>
                              <ThemedText type="body">€{((item.price * item.quantity) / 100).toFixed(2)}</ThemedText>
                            </View>
                          ));
                        } catch {
                          return <ThemedText type="body" style={{ color: theme.textSecondary }}>Items no disponibles</ThemedText>;
                        }
                      })()}
                    </View>
                  </View>

                  <View style={{ marginTop: Spacing.lg }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs }}>
                      <ThemedText type="body" style={{ color: theme.textSecondary }}>Subtotal</ThemedText>
                      <ThemedText type="body">€{(selectedOrder.subtotal / 100).toFixed(2)}</ThemedText>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs }}>
                      <ThemedText type="body" style={{ color: theme.textSecondary }}>Envío</ThemedText>
                      <ThemedText type="body">€{(selectedOrder.deliveryFee / 100).toFixed(2)}</ThemedText>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <ThemedText type="h4">Total</ThemedText>
                      <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                        €{(selectedOrder.total / 100).toFixed(2)}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <ThemedText type="body" style={{ color: theme.textSecondary }}>Método de pago</ThemedText>
                      <ThemedText type="body">{selectedOrder.paymentMethod === "card" ? "Tarjeta" : "Efectivo"}</ThemedText>
                    </View>
                  </View>

                  {selectedOrder.platformFee || selectedOrder.businessEarnings || selectedOrder.deliveryEarnings ? (
                    <View style={{ marginTop: Spacing.lg }}>
                      <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                        Distribución de Comisiones
                      </ThemedText>
                      <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary }]}>
                        {selectedOrder.platformFee ? (
                          <View style={styles.detailRow}>
                            <ThemedText type="body" style={{ color: theme.textSecondary }}>Plataforma (15% productos)</ThemedText>
                            <ThemedText type="body">€{(selectedOrder.platformFee / 100).toFixed(2)}</ThemedText>
                          </View>
                        ) : null}
                        {selectedOrder.businessEarnings ? (
                          <View style={styles.detailRow}>
                            <ThemedText type="body" style={{ color: theme.textSecondary }}>Negocio (100% productos)</ThemedText>
                            <ThemedText type="body">€{(selectedOrder.businessEarnings / 100).toFixed(2)}</ThemedText>
                          </View>
                        ) : null}
                        {selectedOrder.deliveryEarnings ? (
                          <View style={styles.detailRow}>
                            <ThemedText type="body" style={{ color: theme.textSecondary }}>Repartidor (100% delivery)</ThemedText>
                            <ThemedText type="body">€{(selectedOrder.deliveryEarnings / 100).toFixed(2)}</ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {selectedOrder.notes ? (
                    <View style={{ marginTop: Spacing.lg }}>
                      <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                        Notas del cliente
                      </ThemedText>
                      <View style={[styles.detailSection, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="body">{selectedOrder.notes}</ThemedText>
                      </View>
                    </View>
                  ) : null}

                  <View style={{ marginTop: Spacing.lg }}>
                    <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                      Cambiar Estado
                    </ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
                      {["pending", "confirmed", "preparing", "ready", "picked_up", "delivered", "cancelled"].map((status) => (
                        <Pressable
                          key={status}
                          onPress={() => handleUpdateOrderStatus(status)}
                          style={[
                            styles.tab,
                            {
                              backgroundColor: selectedOrder.status === status ? getStatusColor(status) : "transparent",
                              borderColor: getStatusColor(status),
                            },
                          ]}
                        >
                          <ThemedText
                            type="small"
                            style={{ color: selectedOrder.status === status ? "#FFFFFF" : getStatusColor(status) }}
                          >
                            {getStatusLabel(status)}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
                    Creado: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </ThemedText>
                  {selectedOrder.deliveredAt ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Entregado: {new Date(selectedOrder.deliveredAt).toLocaleString()}
                    </ThemedText>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={() => setShowOrderModal(false)}
              style={[styles.saveButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing["4xl"],
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  listContainer: {
    gap: Spacing.md,
  },
  listItem: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetailCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  listItemContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  listItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  tabsScroll: {
    flexGrow: 0,
    marginBottom: Spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "85%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalBody: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  mapContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  map: {
    height: 250,
    width: "100%",
  },
  webMapPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  orderCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  logCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  actionBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  detailSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
});
