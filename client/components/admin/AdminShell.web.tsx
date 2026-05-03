import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { confirm } from "@/hooks/useWebDialog";

const PRIMARY = "#DC2626";

export type AdminSection =
  | "dashboard"
  | "orders" | "orders_active" | "orders_history"
  | "businesses" | "businesses_list" | "businesses_zones" | "businesses_categories"
  | "drivers" | "drivers_list" | "drivers_map"
  | "users"
  | "finance" | "finance_payouts" | "finance_proofs" | "finance_accounts" | "finance_earnings" | "finance_giftcards"
  | "premiums"
  | "marketing" | "coupons"
  | "support" | "support_tickets" | "support_verifications"
  | "settings" | "delivery_config";

interface NavItem {
  id: AdminSection;
  label: string;
  icon: string;
  color: string;
  children?: { id: AdminSection; label: string; icon: string }[];
}

const NAV: NavItem[] = [
  {
    id: "dashboard", label: "Dashboard", icon: "bar-chart-2", color: PRIMARY,
  },
  {
    id: "orders", label: "Pedidos", icon: "shopping-bag", color: "#3B82F6",
    children: [
      { id: "orders_active",  label: "Activos",   icon: "zap"     },
      { id: "orders_history", label: "Historial", icon: "archive" },
    ],
  },
  {
    id: "businesses", label: "Negocios", icon: "briefcase", color: "#10B981",
    children: [
      { id: "businesses_list",       label: "Todos los negocios", icon: "list"  },
      { id: "businesses_categories", label: "Categorías",         icon: "grid" },
    ],
  },
  {
    id: "drivers", label: "Repartidores", icon: "truck", color: "#8B5CF6",
    children: [
      { id: "drivers_list",    label: "Lista",            icon: "users"      },
      { id: "drivers_map",     label: "Mapa",             icon: "map"        },
      { id: "delivery_config", label: "Tarifas delivery", icon: "navigation" },
    ],
  },
  {
    id: "users", label: "Usuarios", icon: "users", color: "#F59E0B",
  },
  {
    id: "finance", label: "Finanzas", icon: "dollar-sign", color: "#06B6D4",
    children: [
      { id: "finance_earnings",   label: "Ganancias",    icon: "trending-up" },
      { id: "finance_payouts",    label: "Payouts",      icon: "send"        },
      { id: "finance_proofs",     label: "Comprobantes", icon: "file-text"   },
      { id: "finance_giftcards",  label: "Gift Cards",   icon: "gift"        },
      { id: "premiums",         label: "Suscripciones", icon: "star"        },
      { id: "finance_accounts",   label: "Cuentas",      icon: "credit-card" },
    ],
  },
  {
    id: "marketing", label: "Marketing", icon: "gift", color: "#EC4899",
    children: [
      { id: "coupons", label: "Cupones", icon: "tag" },
    ],
  },
  {
    id: "support", label: "Soporte", icon: "message-circle", color: "#84CC16",
    children: [
      { id: "support_tickets",       label: "Tickets",        icon: "inbox"        },
    ],
  },
  {
    id: "support_verifications", label: "Verificaciones", icon: "user-check", color: "#06B6D4",
  },
  {
    id: "settings", label: "Configuración", icon: "sliders", color: "#6B7280",
  },
];

interface Props {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  metrics?: any;
  children: React.ReactNode;
}

export function AdminShell({ active, onChange, metrics, children }: Props) {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const bg     = isDark ? "#0d0d0d" : "#f2f3f5";
  const sideBg = isDark ? "#141414" : "#fff";
  const border = isDark ? "#222"    : "#ebebeb";

  // Track which parent groups are expanded
  const [expanded, setExpanded] = useState<Set<AdminSection>>(() => {
    const s = new Set<AdminSection>();
    NAV.forEach(item => {
      if (item.children?.some(c => c.id === active)) s.add(item.id);
    });
    return s;
  });

  const toggle = (id: AdminSection) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const badges: Partial<Record<AdminSection, number>> = {
    orders:              metrics?.pendingOrders   || 0,
    orders_active:       metrics?.pendingOrders   || 0,
    finance_proofs:      metrics?.pendingPayments || 0,
    finance:             metrics?.pendingPayments || 0,
    support_tickets:     metrics?.openTickets     || 0,
    support:             metrics?.openTickets     || 0,
    drivers:             metrics?.pendingVerifications || 0,
    support_verifications: metrics?.pendingVerifications || 0,
  };

  const text = isDark ? "#fff" : "#111";
  const sub  = isDark ? "#555" : "#aaa";

  return (
    <View style={[sh.root, { backgroundColor: bg }]}>
      {/* ── Sidebar ── */}
      <View style={[sh.sidebar, { backgroundColor: sideBg, borderRightColor: border }]}>
        {/* Logo */}
        <View style={[sh.logoRow, { borderBottomColor: border }]}>
          <View style={sh.logoBadge}><Text style={sh.logoTxt}>CY</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.appName, { color: text }]}>ComeYa</Text>
            <Text style={[sh.appRole, { color: sub }]}>Admin Panel</Text>
          </View>
          <View style={sh.onlineDot} />
        </View>

        {/* User */}
        <View style={[sh.userRow, { borderBottomColor: border }]}>
          <View style={[sh.avatar, { backgroundColor: PRIMARY + "20" }]}>
            <Text style={[sh.avatarTxt, { color: PRIMARY }]}>
              {user?.name?.charAt(0).toUpperCase() ?? "A"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.userName, { color: text }]} numberOfLines={1}>{user?.name}</Text>
            <Text style={[sh.userRole, { color: sub }]}>Administrador</Text>
          </View>
        </View>

        {/* Nav */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={[sh.groupLabel, { color: sub }]}>NAVEGACIÓN</Text>

          {NAV.map(item => {
            const isParentActive = active === item.id || item.children?.some(c => c.id === active);
            const isOpen = expanded.has(item.id);
            const badge  = badges[item.id];
            const hasChildren = !!item.children?.length;

            return (
              <View key={item.id}>
                <Pressable
                  onPress={() => {
                    if (hasChildren) {
                      toggle(item.id);
                      // also navigate to parent if no child selected
                      if (!item.children?.some(c => c.id === active)) {
                        onChange(item.children![0].id);
                      }
                    } else {
                      onChange(item.id);
                    }
                  }}
                  style={[
                    sh.navItem,
                    isParentActive && !hasChildren && {
                      backgroundColor: item.color + "12",
                      borderRightWidth: 3,
                      borderRightColor: item.color,
                    },
                  ]}
                >
                  <View style={[sh.navIcon, { backgroundColor: isParentActive ? item.color + "20" : "transparent" }]}>
                    <Feather name={item.icon as any} size={16} color={isParentActive ? item.color : sub} />
                  </View>
                  <Text style={[sh.navLabel, { color: isParentActive ? item.color : text }]}>
                    {item.label}
                  </Text>
                  {!!badge && (
                    <View style={[sh.badge, { backgroundColor: item.color }]}>
                      <Text style={sh.badgeTxt}>{badge > 99 ? "99+" : badge}</Text>
                    </View>
                  )}
                  {hasChildren && (
                    <Feather
                      name={isOpen ? "chevron-down" : "chevron-right"}
                      size={13}
                      color={sub}
                    />
                  )}
                </Pressable>

                {/* Children */}
                {hasChildren && isOpen && item.children!.map(child => {
                  const isChildActive = active === child.id;
                  const childBadge = badges[child.id];
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
                        <Feather name={child.icon as any} size={13} color={isChildActive ? item.color : sub} />
                      </View>
                      <Text style={[sh.childLabel, { color: isChildActive ? item.color : text }]}>
                        {child.label}
                      </Text>
                      {!!childBadge && (
                        <View style={[sh.badge, { backgroundColor: item.color }]}>
                          <Text style={sh.badgeTxt}>{childBadge > 99 ? "99+" : childBadge}</Text>
                        </View>
                      )}
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
              const ok = await confirm({ title: "Cerrar sesión", message: "¿Estás seguro?", confirmLabel: "Salir", variant: "warning" });
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
  root:      { flex: 1, flexDirection: "row" },
  sidebar:   { width: 236, borderRightWidth: 1, flexDirection: "column" },
  content:   { flex: 1 },
  logoRow:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 18, borderBottomWidth: 1 },
  logoBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
  logoTxt:   { fontSize: 13, fontWeight: "900", color: "#fff" },
  appName:   { fontSize: 14, fontWeight: "800" },
  appRole:   { fontSize: 10, marginTop: 1 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  userRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatar:    { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 14, fontWeight: "800" },
  userName:  { fontSize: 12, fontWeight: "700" },
  userRole:  { fontSize: 10, marginTop: 1 },
  groupLabel:{ fontSize: 9, fontWeight: "700", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, letterSpacing: 1 },
  navItem:   { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingHorizontal: 14 },
  navIcon:   { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  navLabel:  { flex: 1, fontSize: 13, fontWeight: "600" },
  badge:     { minWidth: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  badgeTxt:  { fontSize: 9, fontWeight: "800", color: "#fff" },
  childItem: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7, paddingLeft: 42, paddingRight: 14 },
  childDot:  { width: 22, height: 22, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  childLabel:{ flex: 1, fontSize: 12, fontWeight: "500" },
  footer:    { borderTopWidth: 1, padding: 14 },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  logoutTxt: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});
