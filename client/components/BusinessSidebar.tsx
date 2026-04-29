import React, { useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

const PRIMARY = "#DC2626";

const NAV_ITEMS = [
  { id: "BusinessDashboard", label: "Dashboard",  icon: "bar-chart-2", sub: null },
  { id: "BusinessOrders",    label: "Pedidos",     icon: "package",     sub: null },
  { id: "BusinessProducts",  label: "Productos",   icon: "grid",        sub: null },
  {
    id: "BusinessProfile",
    label: "Perfil",
    icon: "user",
    sub: [
      { id: "account",     label: "Cuenta",        icon: "user"      },
      { id: "business",    label: "Mi Negocio",     icon: "briefcase" },
      { id: "payments",    label: "Pagos",          icon: "credit-card" },
      { id: "preferences", label: "Preferencias",  icon: "sliders"   },
      { id: "more",        label: "Más",            icon: "grid"      },
    ],
  },
];

interface Props {
  /** Sección activa dentro de Perfil (account | preferences | more) */
  activeSubSection?: string;
  onSubSectionChange?: (id: string) => void;
}

export function BusinessSidebar({ activeSubSection, onSubSectionChange }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();

  const card   = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333"    : "#e8e8e8";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const sub    = isDark ? "#aaa"    : "#666";

  const activeName = route.name;
  const isProfileActive = activeName === "BusinessProfile";

  return (
    <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
      {/* Logo + negocio */}
      <View style={s.header}>
        <Image
          source={require("../../assets/images/comeya-logo-final.png")}
          style={s.logo}
          contentFit="contain"
        />
        <Text style={[s.bizName, { color: text }]} numberOfLines={1}>
          {selectedBusiness?.name || "Mi Negocio"}
        </Text>
        <Text style={[s.role, { color: sub }]}>Panel de negocio</Text>
      </View>

      {/* Navegación */}
      <View style={s.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = activeName === item.id;
          return (
            <View key={item.id}>
              <Pressable
                onPress={() => navigation.navigate(item.id)}
                style={[s.navItem, isActive && { backgroundColor: PRIMARY + "10", borderRightWidth: 3, borderRightColor: PRIMARY }]}
              >
                <Feather name={item.icon as any} size={18} color={isActive ? PRIMARY : sub} />
                <Text style={[s.navText, { color: isActive ? PRIMARY : text }]}>{item.label}</Text>
              </Pressable>

              {/* Subitems de Perfil — solo visibles cuando Perfil está activo */}
              {item.sub && isProfileActive && (
                <View style={[s.subItems, { borderLeftColor: border }]}>
                  {item.sub.map(subItem => {
                    const isSubActive = activeSubSection === subItem.id;
                    return (
                      <Pressable
                        key={subItem.id}
                        onPress={() => onSubSectionChange?.(subItem.id)}
                        style={[s.subItem, isSubActive && { backgroundColor: PRIMARY + "08" }]}
                      >
                        <Feather name={subItem.icon as any} size={15} color={isSubActive ? PRIMARY : sub} />
                        <Text style={[s.subItemText, { color: isSubActive ? PRIMARY : sub }]}>{subItem.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: border }]}>
        <Pressable onPress={() => navigation.navigate("Main")} style={s.navItem}>
          <Feather name="log-out" size={18} color={sub} />
          <Text style={[s.navText, { color: sub }]}>Salir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: { width: 240, borderRightWidth: 1, flexDirection: "column" },
  header: { padding: 24, paddingBottom: 16 },
  logo: { width: 100, height: 32, marginBottom: 12 },
  bizName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  role: { fontSize: 12 },
  nav: { flex: 1 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  navText: { fontSize: 14, fontWeight: "600" },
  subItems: { marginLeft: 20, borderLeftWidth: 1, paddingLeft: 8, marginBottom: 4 },
  subItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  subItemText: { fontSize: 13, fontWeight: "500" },
  footer: { borderTopWidth: 1 },
});
