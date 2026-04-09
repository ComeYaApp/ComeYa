import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";

interface MenuSection {
  title: string;
  icon: string;
  items: MenuItem[];
}

interface MenuItem {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
}

const menuSections: MenuSection[] = [
  {
    title: "Monitoreo",
    icon: "activity",
    items: [
      {
        title: "Dashboard",
        subtitle: "Métricas y pedidos activos",
        icon: "bar-chart-2",
        route: "/admin/dashboard",
        color: ComeYaColors.primary,
      },
      {
        title: "Pedidos",
        subtitle: "Gestionar todos los pedidos",
        icon: "package",
        route: "/admin/orders",
        color: "#2196F3",
      },
      {
        title: "Repartidores",
        subtitle: "Estado y ubicación en tiempo real",
        icon: "truck",
        route: "/admin/drivers",
        color: "#9C27B0",
      },
    ],
  },
  {
    title: "Gestión",
    icon: "briefcase",
    items: [
      {
        title: "Usuarios",
        subtitle: "Administrar cuentas de usuario",
        icon: "users",
        route: "/admin/users",
        color: "#FF9800",
      },
      {
        title: "Negocios",
        subtitle: "Gestionar restaurantes y mercados",
        icon: "store",
        route: "/admin/businesses",
        color: "#4CAF50",
      },
      {
        title: "Zonas de Entrega",
        subtitle: "Configurar áreas y tarifas",
        icon: "map-pin",
        route: "/admin/zones",
        color: "#E91E63",
      },
    ],
  },
  {
    title: "Finanzas",
    icon: "dollar-sign",
    items: [
      {
        title: "Finanzas",
        subtitle: "Ingresos, comisiones y pagos",
        icon: "trending-up",
        route: "/admin/finance",
        color: "#00BCD4",
      },
      {
        title: "Tasa de Cambio",
        subtitle: "Configurar tasa USD/Bs",
        icon: "dollar-sign",
        route: "/admin/exchange-rate",
        color: "#4CAF50",
      },
      {
        title: "Cupones",
        subtitle: "Promociones y descuentos",
        icon: "tag",
        route: "/admin/coupons",
        color: "#FF5722",
      },
    ],
  },
  {
    title: "Sistema",
    icon: "settings",
    items: [
      {
        title: "Configuración",
        subtitle: "Ajustes del sistema",
        icon: "sliders",
        route: "/admin/settings",
        color: "#607D8B",
      },
      {
        title: "Soporte",
        subtitle: "Tickets y chat de ayuda",
        icon: "message-circle",
        route: "/admin/support",
        color: "#795548",
      },
      {
        title: "Logs de Auditoría",
        subtitle: "Registro de actividades",
        icon: "file-text",
        route: "/admin/logs",
        color: "#9E9E9E",
      },
    ],
  },
];

export default function AdminMenuScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();

  const handleMenuPress = (route: string) => {
    Haptics.selectionAsync();
    router.push(route as any);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
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
        {menuSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: ComeYaColors.primaryLight },
                  ]}
                >
                  <Feather
                    name={section.icon as any}
                    size={20}
                    color={ComeYaColors.primary}
                  />
                </View>
                <ThemedText type="h4" style={styles.sectionTitle}>
                  {section.title}
                </ThemedText>
              </View>
            </View>

            <View
              style={[
                styles.menuGrid,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              {section.items.map((item, itemIndex) => (
                <Pressable
                  key={item.title}
                  onPress={() => handleMenuPress(item.route)}
                  style={[
                    styles.menuItem,
                    {
                      borderBottomWidth:
                        itemIndex < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      { backgroundColor: item.color + "20" },
                    ]}
                  >
                    <Feather name={item.icon as any} size={24} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <ThemedText type="body" style={styles.menuTitle}>
                      {item.title}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={[styles.menuSubtitle, { color: theme.textSecondary }]}
                    >
                      {item.subtitle}
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing["4xl"],
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  menuGrid: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  menuSubtitle: {
    lineHeight: 18,
  },
});