import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

const PRIMARY = "#DC2626";

const NAV_ITEMS = [
  { id: "BusinessDashboard", label: "Dashboard",  icon: "bar-chart-2" },
  { id: "BusinessOrders",    label: "Pedidos",     icon: "package"    },
  { id: "BusinessProducts",  label: "Productos",   icon: "grid"       },
  { id: "BusinessStats",     label: "Analytics",   icon: "trending-up"},
  { id: "BusinessProfile",   label: "Perfil",      icon: "user"       },
];

export function BusinessSidebar() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();

  const card   = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333"    : "#e8e8e8";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const sub    = isDark ? "#aaa"    : "#666";

  // Detectar pantalla activa por nombre de ruta
  const activeName = route.name;

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
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate(item.id)}
              style={[s.navItem, isActive && { backgroundColor: PRIMARY + "10", borderRightWidth: 3, borderRightColor: PRIMARY }]}
            >
              <Feather name={item.icon as any} size={18} color={isActive ? PRIMARY : sub} />
              <Text style={[s.navText, { color: isActive ? PRIMARY : text }]}>{item.label}</Text>
            </Pressable>
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
  footer: { borderTopWidth: 1 },
});
