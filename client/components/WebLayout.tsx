import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Text,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";

const PRIMARY = "#DC2626";

interface WebLayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  contentStyle?: object;
  /** Contenido del sidebar (si no se pasa, se muestra el sidebar de navegación por defecto) */
  sidebarContent?: React.ReactNode;
  /** Ocultar sidebar completamente */
  hideSidebar?: boolean;
}

export function WebLayout({
  children,
  showSearch = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  contentStyle,
  sidebarContent,
  hideSidebar = false,
}: WebLayoutProps) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { isMobile, px } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";
  const inputBg = isDark ? "#2a2a2a" : "#f0f0f0";

  const NAV_ITEMS = [
    { icon: "home", label: "Inicio", route: "Main" },
    { icon: "package", label: "Pedidos", route: "OrdersTab" },
    { icon: "heart", label: "Favoritos", route: "Favorites" },
    { icon: "gift", label: "Gift Cards", route: "GiftCards" },
    { icon: "award", label: "Puntos", route: "Gamification" },
    { icon: "user", label: "Perfil", route: "Profile" },
  ];

  const DefaultSidebar = (
    <View
      style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}
    >
      <Text style={[s.sideTitle, { color: sub }]}>NAVEGACIÓN</Text>
      {NAV_ITEMS.map((item) => (
        <Pressable
          key={item.route}
          onPress={() => navigation.navigate(item.route as any)}
          style={s.sideItem}
        >
          <Feather name={item.icon as any} size={15} color={sub} />
          <Text style={[s.sideItemText, { color: text }]}>{item.label}</Text>
        </Pressable>
      ))}

      {(user?.role === "business_owner" || user?.role === "admin") && (
        <>
          <Text style={[s.sideTitle, { color: sub, marginTop: 20 }]}>
            NEGOCIO
          </Text>
          <Pressable
            onPress={() => navigation.navigate("BusinessDashboard" as any)}
            style={s.sideItem}
          >
            <Feather name="bar-chart-2" size={15} color={sub} />
            <Text style={[s.sideItemText, { color: text }]}>Dashboard</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("BusinessOrders" as any)}
            style={s.sideItem}
          >
            <Feather name="list" size={15} color={sub} />
            <Text style={[s.sideItemText, { color: text }]}>Pedidos</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("BusinessReservations" as any)}
            style={s.sideItem}
          >
            <Feather name="calendar" size={15} color={sub} />
            <Text style={[s.sideItemText, { color: text }]}>Reservas</Text>
          </Pressable>
        </>
      )}

      {user?.role === "delivery_driver" && (
        <>
          <Text style={[s.sideTitle, { color: sub, marginTop: 20 }]}>
            REPARTIDOR
          </Text>
          <Pressable
            onPress={() => navigation.navigate("DriverDashboard" as any)}
            style={s.sideItem}
          >
            <Feather name="truck" size={15} color={sub} />
            <Text style={[s.sideItemText, { color: text }]}>Mi panel</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── NAVBAR ── */}
      <View
        style={[
          s.navbar,
          {
            backgroundColor: card,
            borderBottomColor: border,
            paddingHorizontal: px,
          },
        ]}
      >
        <Pressable
          style={s.navLogo}
          onPress={() => navigation.navigate("Main" as any)}
        >
          <View
            style={[
              s.navLogoCircle,
              { backgroundColor: isDark ? "#222" : "#fff" },
            ]}
          >
            <ComeYaLogo size={22} />
          </View>
          {!isMobile && <Text style={s.navLogoText}>ComeYa</Text>}
        </Pressable>

        {showSearch ? (
          <View
            style={[
              s.navSearch,
              {
                backgroundColor: inputBg,
                borderColor: border,
                flex: 1,
                marginHorizontal: isMobile ? 10 : 20,
              },
            ]}
          >
            <Feather name="search" size={15} color={sub} />
            <TextInput
              style={[s.navSearchInput, { color: text }]}
              placeholder={isMobile ? "Buscar..." : searchPlaceholder}
              placeholderTextColor={sub}
              value={searchValue}
              onChangeText={onSearchChange}
            />
            {searchValue ? (
              <Pressable onPress={() => onSearchChange?.("")}>
                <Feather name="x" size={15} color={sub} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={s.navActions}>
          {!isMobile && (
            <Pressable
              style={s.navBtn}
              onPress={() => navigation.navigate("OrdersTab" as any)}
            >
              <Feather name="package" size={16} color={text} />
              <Text style={[s.navBtnText, { color: text }]}>Pedidos</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.navCartBtn, { backgroundColor: PRIMARY }]}
            onPress={() => navigation.navigate("Cart" as any)}
          >
            <Feather name="shopping-cart" size={16} color="#fff" />
            {!isMobile && <Text style={s.navCartText}>Carrito</Text>}
          </Pressable>
          <Pressable
            style={[s.navAvatar, { backgroundColor: PRIMARY + "20" }]}
            onPress={() => navigation.navigate("Profile" as any)}
          >
            <Text style={[s.navAvatarText, { color: PRIMARY }]}>
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={s.body}>
        {/* Sidebar — solo desktop y si no está oculto */}
        {!isMobile && !hideSidebar && (sidebarContent ?? DefaultSidebar)}

        {/* Contenido */}
        <View style={[s.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Navbar — idéntico al de HomeScreen
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  navLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  navLogoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  navLogoText: { fontSize: 18, fontWeight: "900", color: PRIMARY },
  navSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  navSearchInput: { flex: 1, fontSize: 14, outlineStyle: "none" } as any,
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navBtnText: { fontSize: 13, fontWeight: "600" },
  navCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navCartText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  navAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  navAvatarText: { fontSize: 14, fontWeight: "700" },
  // Body
  body: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 210,
    paddingVertical: 20,
    paddingHorizontal: 14,
    borderRightWidth: 1,
  },
  sideTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sideItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  sideItemText: { fontSize: 13, fontWeight: "500" },
  content: { flex: 1 },
});
