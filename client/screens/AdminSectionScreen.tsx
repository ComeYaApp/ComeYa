import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import {
  UsersTab,
  OrdersTab,
  BusinessesTab,
  DriversTab,
  CouponsTab,
  SupportTab,
  ZonesTab,
  SettingsTab,
  FinanceTab,
} from "@/components/admin/tabs";
import type {
  AdminUser,
  AdminOrder,
  Business,
} from "@/components/admin/types/admin.types";

interface AdminSectionScreenProps {
  section: "users" | "orders" | "businesses" | "drivers" | "coupons" | "support" | "zones" | "settings" | "finance" | "logs";
  title: string;
}

const sectionConfig = {
  users: { icon: "users", title: "Usuarios" },
  orders: { icon: "package", title: "Pedidos" },
  businesses: { icon: "store", title: "Negocios" },
  drivers: { icon: "truck", title: "Repartidores" },
  coupons: { icon: "tag", title: "Cupones" },
  support: { icon: "message-circle", title: "Soporte" },
  zones: { icon: "map-pin", title: "Zonas de Entrega" },
  settings: { icon: "sliders", title: "Configuración" },
  finance: { icon: "trending-up", title: "Finanzas" },
  logs: { icon: "file-text", title: "Logs de Auditoría" },
};

export default function AdminSectionScreen({ section, title }: AdminSectionScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const config = sectionConfig[section];

  const fetchData = async () => {
    try {
      if (section === "users" || section === "orders" || section === "businesses") {
        const [usersRes, ordersRes, businessesRes] = await Promise.all([
          apiRequest("GET", "/api/admin/users"),
          apiRequest("GET", "/api/admin/orders"),
          apiRequest("GET", "/api/businesses"),
        ]);

        const usersData = await usersRes.json();
        const ordersData = await ordersRes.json();
        const businessesData = await businessesRes.json();

        setUsers(usersData.users || []);
        setOrders(ordersData.orders || []);
        setBusinesses(Array.isArray(businessesData) ? businessesData : businessesData.businesses || []);
      }
    } catch (error) {
      console.error(`Error fetching ${section} data:`, error);
      showToast(`Error al cargar datos de ${title.toLowerCase()}`, "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [section]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderContent = () => {
    switch (section) {
      case "users":
        return <UsersTab users={users} onUserPress={() => {}} />;
      case "orders":
        return <OrdersTab orders={orders} onOrderPress={() => {}} />;
      case "businesses":
        return (
          <BusinessesTab
            businesses={businesses}
            onAddBusiness={() => {}}
            onEditBusiness={() => {}}
            onManageProducts={() => {}}
          />
        );
      case "drivers":
        return <DriversTab theme={theme} showToast={showToast} />;
      case "coupons":
        return <CouponsTab theme={theme} showToast={showToast} />;
      case "support":
        return <SupportTab theme={theme} showToast={showToast} />;
      case "zones":
        return <ZonesTab theme={theme} showToast={showToast} />;
      case "settings":
        return <SettingsTab theme={theme} showToast={showToast} />;
      case "finance":
        return <FinanceTab theme={theme} showToast={showToast} />;
      default:
        return (
          <View style={styles.emptyState}>
            <Feather name={config.icon as any} size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Sección en desarrollo
            </ThemedText>
          </View>
        );
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
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.titleContainer}>
            <View style={[styles.titleIcon, { backgroundColor: ComeYaColors.primaryLight }]}>
              <Feather name={config.icon as any} size={20} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h2">{title}</ThemedText>
          </View>
        </View>
      </View>

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
        {renderContent()}
      </ScrollView>
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
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing["4xl"],
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
});