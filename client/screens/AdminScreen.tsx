import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Text,
} from "react-native";
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
import { SubscriptionPlansTab } from "@/components/admin/tabs/SubscriptionPlansTab";
import { PaymentProofsTab } from "@/components/admin/tabs/PaymentProofsTab";
import type {
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
    title: "Comprobantes",
    subtitle: "Verificar pagos manuales",
    icon: "file-text",
    tab: "proofs",
    color: "#F59E0B",
  },
  {
    title: "Cupones",
    subtitle: "Promociones",
    icon: "tag",
    tab: "coupons",
    color: "#FF5722",
  },
  {
    title: "Configuración",
    subtitle: "Ajustes del sistema",
    icon: "sliders",
    tab: "settings",
    color: "#607D8B",
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [userRoleEdit, setUserRoleEdit] = useState("");

  // Debug modal state
  console.log('Modal states:', { userModalVisible, orderModalVisible, selectedUser, selectedOrder });

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
    if (["users", "orders", "businesses"].includes(activeTab || "")) {
      fetchData();
    }
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMenuPress = (tab: string) => {
    Haptics.selectionAsync();
    // Cerrar modales antes de cambiar de pestaña
    setUserModalVisible(false);
    setOrderModalVisible(false);
    setSelectedUser(null);
    setSelectedOrder(null);
    setActiveTab(tab);
  };

  const handleBack = () => {
    // Cerrar modales antes de cambiar de pestaña
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

  const handleOrderPress = (order: AdminOrder) => {
    console.log('Order pressed:', order);
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

  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;
    try {
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
      showToast("Rol actualizado correctamente", "success");
      setUserModalVisible(false);
      fetchData();
    } catch (error) {
      showToast("Error al actualizar el rol", "error");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "drivers":
        return <DriversTab theme={theme} showToast={showToast} />;
      case "finance":
        return <FinanceTab theme={theme} showToast={showToast} />;
      case "proofs":
        return <PaymentProofsTab theme={theme} showToast={showToast} />;
      case "businesses":
        return (
          <BusinessesTab
            businesses={businesses}
            onBusinessPress={() => {}}
          />
        );
      case "users":
        return <UsersTab users={users} onUserPress={openUserModal} />;
      case "orders":
        return <OrdersTab orders={orders} onOrderPress={handleOrderPress} />;
      case "coupons":
        return <CouponsTab theme={theme} showToast={showToast} />;
      case "support":
        return <SupportTab theme={theme} showToast={showToast} />;
      case "zones":
        return <ZonesTab theme={theme} showToast={showToast} />;
      case "settings":
        return <SettingsTab theme={theme} showToast={showToast} />;
      default:
        return (
          <View style={styles.emptyState}>
            <Feather name="settings" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Sección en desarrollo
            </ThemedText>
          </View>
        );
    }
  };

  if (activeTab) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.headerContent}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h2">
              {menuItems.find(item => item.tab === activeTab)?.title}
            </ThemedText>
          </View>
        </View>
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
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h1">🔧 Panel ComeYa</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Bienvenido, {user?.name} - ARCHIVO CORRECTO
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

      {/* User Modal - Restored */}
      <Modal
        visible={userModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUserModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h3">Detalles del Usuario</ThemedText>
              <Pressable onPress={() => setUserModalVisible(false)}>
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
                            {role === "customer" ? "Cliente" : role === "business" ? "Negocio" : role === "driver" ? "Repartidor" : "ComeYa"}
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

      {/* Order Modal */}
      <Modal
        visible={orderModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: 50 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
            <ThemedText type="h2">Detalles del Pedido</ThemedText>
            <Pressable onPress={() => setOrderModalVisible(false)}>
              <ThemedText>X</ThemedText>
            </Pressable>
          </View>
          {selectedOrder && (
            <View style={{ padding: 20 }}>
              <ThemedText type="h3">#{selectedOrder.id.slice(0, 8)}</ThemedText>
              <ThemedText style={{ marginTop: 8 }}>Negocio: {selectedOrder.businessName}</ThemedText>
              <ThemedText>Cliente: {selectedOrder.customerName}</ThemedText>
              <ThemedText>Total: €{(selectedOrder.total / 100).toFixed(2)}</ThemedText>
              <ThemedText>Estado: {selectedOrder.status}</ThemedText>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <Pressable 
                  style={{ flex: 1, padding: 15, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => handleOrderAction("Confirmar", selectedOrder)}
                >
                  <ThemedText style={{ color: "white" }}>Confirmar</ThemedText>
                </Pressable>
                <Pressable 
                  style={{ flex: 1, padding: 15, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' }}
                  onPress={() => handleOrderAction("Cancelar", selectedOrder)}
                >
                  <ThemedText style={{ color: "white" }}>Cancelar</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
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
  modalContainer: {
    flex: 1,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalContent: {
    height: "85%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalBody: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
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