import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { confirm } from "@/hooks/useWebDialog";

const GREEN = "#16A34A";
const ACCENT = "#DC2626";

export type DriverSection =
  | "available"
  | "deliveries_active"
  | "deliveries_history"
  | "earnings_stats"
  | "earnings_history"
  | "map"
  | "profile_personal"
  | "profile_account"
  | "profile_vehicle";

interface NavItem {
  id: DriverSection;
  label: string;
  icon: string;
  color: string;
  children?: { id: DriverSection; label: string; icon: string }[];
}

const NAV: NavItem[] = [
  { id: "available", label: "Pedidos disponibles", icon: "zap", color: GREEN },
  {
    id: "deliveries_active" as DriverSection,
    label: "Mis entregas",
    icon: "truck",
    color: "#3B82F6",
    children: [
      { id: "deliveries_active", label: "Activas", icon: "activity" },
      { id: "deliveries_history", label: "Historial", icon: "archive" },
    ],
  },
  {
    id: "earnings_stats" as DriverSection,
    label: "Ganancias",
    icon: "trending-up",
    color: "#F59E0B",
    children: [
      { id: "earnings_stats", label: "Estadísticas", icon: "bar-chart-2" },
      { id: "earnings_history", label: "Historial", icon: "list" },
    ],
  },
  { id: "map", label: "Mi mapa GPS", icon: "map", color: "#8B5CF6" },
  {
    id: "profile_account" as DriverSection,
    label: "Mi perfil",
    icon: "user",
    color: "#EC4899",
    children: [
      { id: "profile_personal", label: "Datos personales", icon: "user" },
      { id: "profile_vehicle", label: "Mi vehículo", icon: "navigation" },
      { id: "profile_account", label: "Cuentas de cobro", icon: "credit-card" },
    ],
  },
];

interface Props {
  active: DriverSection;
  onChange: (s: DriverSection) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  togglingOnline: boolean;
  children: React.ReactNode;
}

export function DriverShell({
  active,
  onChange,
  isOnline,
  onToggleOnline,
  togglingOnline,
  children,
}: Props) {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const sideBg = isDark ? "#141414" : "#fff";
  const border = isDark ? "#222" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#555" : "#aaa";
  const inputBg = isDark ? "#1e1e1e" : "#f8f8f8";

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    NAV.forEach((item) => {
      if (item.children?.some((c) => c.id === active)) s.add(item.id);
    });
    return s;
  });

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <View style={[sh.root, { backgroundColor: bg }]}>
      {/* ── Sidebar ── */}
      <View
        style={[
          sh.sidebar,
          { backgroundColor: sideBg, borderRightColor: border },
        ]}
      >
        {/* Logo */}
        <View style={[sh.logoRow, { borderBottomColor: border }]}>
          <View style={sh.logoBadge}>
            <Text style={sh.logoTxt}>CY</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.appName, { color: text }]}>ComeYa</Text>
            <Text style={[sh.appRole, { color: sub }]}>Panel Repartidor</Text>
          </View>
          <View
            style={[
              sh.statusDot,
              { backgroundColor: isOnline ? "#10B981" : "#6B7280" },
            ]}
          />
        </View>

        {/* User */}
        <View style={[sh.userRow, { borderBottomColor: border }]}>
          <View style={[sh.avatar, { backgroundColor: GREEN + "20" }]}>
            <Text style={[sh.avatarTxt, { color: GREEN }]}>
              {user?.name?.charAt(0).toUpperCase() ?? "D"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.userName, { color: text }]} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={[sh.userRole, { color: sub }]}>Repartidor</Text>
          </View>
        </View>

        {/* Online toggle */}
        <View
          style={[
            sh.onlineRow,
            {
              backgroundColor: isOnline ? "#16A34A10" : inputBg,
              borderBottomColor: border,
            },
          ]}
        >
          <View
            style={[
              sh.onlinePulse,
              { backgroundColor: isOnline ? GREEN : "#9ca3af" },
            ]}
          />
          <Text
            style={[sh.onlineTxt, { color: isOnline ? GREEN : sub, flex: 1 }]}
          >
            {isOnline ? "En línea" : "Desconectado"}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={onToggleOnline}
            disabled={togglingOnline}
            trackColor={{ false: "#d1d5db", true: GREEN + "80" }}
            thumbColor={isOnline ? GREEN : "#9ca3af"}
          />
        </View>

        {/* Nav */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={[sh.groupLabel, { color: sub }]}>NAVEGACIÓN</Text>

          {NAV.map((item) => {
            const hasChildren = !!item.children?.length;
            const isParentActive =
              active === item.id || item.children?.some((c) => c.id === active);
            const isOpen = expanded.has(item.id);

            return (
              <View key={item.id}>
                <Pressable
                  onPress={() => {
                    if (hasChildren) {
                      toggleGroup(item.id);
                      if (!item.children?.some((c) => c.id === active)) {
                        onChange(item.children![0].id);
                      }
                    } else {
                      onChange(item.id);
                    }
                  }}
                  style={[
                    sh.navItem,
                    isParentActive &&
                      !hasChildren && {
                        backgroundColor: item.color + "12",
                        borderRightWidth: 3,
                        borderRightColor: item.color,
                      },
                  ]}
                >
                  <View
                    style={[
                      sh.navIcon,
                      {
                        backgroundColor: isParentActive
                          ? item.color + "20"
                          : "transparent",
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon as any}
                      size={16}
                      color={isParentActive ? item.color : sub}
                    />
                  </View>
                  <Text
                    style={[
                      sh.navLabel,
                      { color: isParentActive ? item.color : text },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {hasChildren && (
                    <Feather
                      name={isOpen ? "chevron-down" : "chevron-right"}
                      size={13}
                      color={sub}
                    />
                  )}
                </Pressable>

                {hasChildren &&
                  isOpen &&
                  item.children!.map((child) => {
                    const isChildActive = active === child.id;
                    return (
                      <Pressable
                        key={child.id}
                        onPress={() => onChange(child.id)}
                        style={[
                          sh.childItem,
                          isChildActive && {
                            backgroundColor: item.color + "10",
                            borderRightWidth: 3,
                            borderRightColor: item.color,
                          },
                        ]}
                      >
                        <View style={sh.childDot}>
                          <Feather
                            name={child.icon as any}
                            size={13}
                            color={isChildActive ? item.color : sub}
                          />
                        </View>
                        <Text
                          style={[
                            sh.childLabel,
                            { color: isChildActive ? item.color : text },
                          ]}
                        >
                          {child.label}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={[sh.footer, { borderTopColor: border }]}>
          <Pressable
            onPress={async () => {
              const ok = await confirm({
                title: "Cerrar sesión",
                message: "¿Estás seguro?",
                confirmLabel: "Salir",
                variant: "warning",
              });
              if (ok) logout();
            }}
            style={sh.logoutBtn}
          >
            <Feather name="log-out" size={15} color="#EF4444" />
            <Text style={sh.logoutTxt}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={sh.content}>{children}</View>
    </View>
  );
}

const sh = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 240, borderRightWidth: 1, flexDirection: "column" },
  content: { flex: 1 },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 18,
    borderBottomWidth: 1,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  logoTxt: { fontSize: 13, fontWeight: "900", color: "#fff" },
  appName: { fontSize: 14, fontWeight: "800" },
  appRole: { fontSize: 10, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxt: { fontSize: 14, fontWeight: "800" },
  userName: { fontSize: 12, fontWeight: "700" },
  userRole: { fontSize: 10, marginTop: 1 },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  onlinePulse: { width: 8, height: 8, borderRadius: 4 },
  onlineTxt: { fontSize: 12, fontWeight: "700" },
  groupLabel: {
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
    letterSpacing: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  navLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  childItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 7,
    paddingLeft: 42,
    paddingRight: 14,
  },
  childDot: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  childLabel: { flex: 1, fontSize: 12, fontWeight: "500" },
  footer: { borderTopWidth: 1, padding: 14 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  logoutTxt: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});
