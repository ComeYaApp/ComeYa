import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { confirm } from "@/hooks/useWebDialog";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import {
  AdminGlobalSearch,
  type AdminSearchResult,
} from "@/components/admin/AdminGlobalSearch";

const PRIMARY = "#E60000";

export type AdminSection =
  | "operations"
  | "notifications"
  | "dashboard"
  | "reservations"
  | "orders"
  | "orders_active"
  | "orders_history"
  | "businesses"
  | "businesses_list"
  | "businesses_zones"
  | "businesses_categories"
  | "drivers"
  | "drivers_list"
  | "drivers_map"
  | "users"
  | "finance"
  | "finance_payouts"
  | "finance_proofs"
  | "finance_reservations"
  | "finance_accounts"
  | "finance_earnings"
  | "finance_giftcards"
  | "finance_refunds"
  | "premiums"
  | "marketing"
  | "coupons"
  | "communications"
  | "support"
  | "support_tickets"
  | "support_issues"
  | "support_verifications"
  | "settings"
  | "system"
  | "delivery_config"
  | "logs"
  | "audit_logs";

/**
 * Secciones antiguas que se siguen mandando en notificaciones y enlaces:
 * se redirigen a su equivalente actual en vez de caer al dashboard.
 */
export const SECTION_ALIASES: Partial<Record<string, AdminSection>> = {
  proofs: "finance_proofs",
  payouts: "finance_payouts",
  earnings: "finance_earnings",
  refunds: "finance_refunds",
  issues: "support_issues",
  tickets: "support_tickets",
  verifications: "support_verifications",
  subscriptions: "premiums",
  finance_subscriptions: "premiums",
  AdminSupport: "support_issues",
  AdminOrders: "orders_active",
  AdminVerifications: "support_verifications",
  AdminVerification: "support_verifications",
  AdminFinance: "finance_earnings",
  AdminPayouts: "finance_payouts",
  AdminBusinesses: "businesses_list",
  AdminDashboard: "operations",
  AdminPanel: "operations",
  finance: "finance_earnings",
  support: "support_tickets",
  orders: "orders_active",
  businesses: "businesses_list",
  drivers: "drivers_list",
  drivers_map: "operations",
  users: "users",
  marketing: "coupons",
  audit_logs: "logs",
  dashboard: "operations",
};

interface NavItem {
  id: AdminSection;
  label: string;
  icon: string;
  color: string;
  group?: string;
  children?: { id: AdminSection; label: string; icon: string }[];
}

// Menú por GRUPOS de trabajo: Operación → Personas → Finanzas → Marketing →
// Soporte → Ajustes. Sin duplicados y con las secciones rotas arregladas.
const NAV: NavItem[] = [
  {
    id: "operations",
    label: "Centro de Operaciones",
    icon: "monitor",
    color: PRIMARY,
    group: "OPERACIÓN",
  },
  {
    id: "notifications",
    label: "Avisos",
    icon: "bell",
    color: "#EF4444",
    group: "OPERACIÓN",
  },
  {
    id: "orders",
    label: "Pedidos",
    icon: "shopping-bag",
    color: "#3B82F6",
    group: "OPERACIÓN",
    children: [
      { id: "orders_active", label: "Activos", icon: "zap" },
      { id: "orders_history", label: "Historial", icon: "archive" },
    ],
  },
  {
    id: "drivers",
    label: "Repartidores",
    icon: "truck",
    color: "#8B5CF6",
    group: "PERSONAS",
    children: [
      { id: "drivers_list", label: "Lista y gestión", icon: "users" },
    ],
  },
  {
    id: "businesses",
    label: "Negocios",
    icon: "briefcase",
    color: "#10B981",
    group: "PERSONAS",
    children: [
      { id: "businesses_list", label: "Todos los negocios", icon: "list" },
      { id: "businesses_categories", label: "Categorías", icon: "grid" },
      { id: "businesses_zones", label: "Zonas de reparto", icon: "map-pin" },
    ],
  },
  {
    id: "users",
    label: "Usuarios",
    icon: "users",
    color: "#F59E0B",
    group: "PERSONAS",
  },
  {
    id: "support_verifications",
    label: "Validaciones",
    icon: "user-check",
    color: "#06B6D4",
    group: "PERSONAS",
  },
  {
    id: "finance",
    label: "Finanzas",
    icon: "dollar-sign",
    color: "#06B6D4",
    group: "FINANZAS",
    children: [
      { id: "finance_earnings", label: "Ganancias", icon: "trending-up" },
      { id: "finance_payouts", label: "Payouts", icon: "send" },
      { id: "finance_proofs", label: "Comprobantes", icon: "file-text" },
      { id: "finance_reservations", label: "Cobros reservas", icon: "calendar" },
      { id: "finance_refunds", label: "Devoluciones", icon: "rotate-ccw" },
      { id: "finance_giftcards", label: "Gift Cards", icon: "gift" },
      { id: "premiums", label: "Suscripciones", icon: "star" },
      { id: "finance_accounts", label: "Cuentas de pago", icon: "credit-card" },
    ],
  },
  {
    id: "reservations",
    label: "Reservas",
    icon: "calendar",
    color: "#F97316",
    group: "MARKETING",
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: "gift",
    color: "#EC4899",
    group: "MARKETING",
    children: [
      { id: "coupons", label: "Cupones", icon: "tag" },
      { id: "communications", label: "Comunicaciones", icon: "send" },
    ],
  },
  {
    id: "support",
    label: "Soporte",
    icon: "message-circle",
    color: "#84CC16",
    group: "SOPORTE",
    children: [
      { id: "support_issues", label: "Incidencias", icon: "alert-circle" },
      { id: "support_tickets", label: "Tickets", icon: "inbox" },
    ],
  },
  {
    id: "settings",
    label: "Configuración",
    icon: "sliders",
    color: "#6B7280",
    group: "AJUSTES",
    children: [
      { id: "delivery_config", label: "Tarifas delivery", icon: "navigation" },
    ],
  },
  {
    id: "system",
    label: "Estado del sistema",
    icon: "activity",
    color: "#10B981",
    group: "AJUSTES",
  },
  {
    id: "logs",
    label: "Logs de auditoría",
    icon: "list",
    color: "#6B7280",
    group: "AJUSTES",
  },
];

interface Props {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  metrics?: any;
  onSearchSelect?: (result: AdminSearchResult) => void;
  children: React.ReactNode;
}

// Campana de avisos en tiempo real: historial del servidor + no leídos +
// enlace al Centro de Avisos completo.
function AdminBell({
  onNavigate,
  hook,
}: {
  onNavigate: (s: AdminSection) => void;
  hook: ReturnType<typeof useAdminNotifications>;
}) {
  const { isDark } = useTheme();
  const {
    notifs,
    unreadCount,
    markRead,
    markAllRead,
    clear,
    silenced,
    setSilenced,
    connected,
  } = hook;
  const [open, setOpen] = useState(false);

  const border = isDark ? "#222" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";

  const LEVEL_COLOR: Record<string, string> = {
    critical: "#EF4444",
    high: "#F59E0B",
    medium: "#3B82F6",
  };

  return (
    <View style={[bell.wrap, { borderBottomColor: border }]}>
      <Pressable style={bell.row} onPress={() => setOpen((v) => !v)}>
        <Feather name="bell" size={15} color="#EF4444" />
        <Text style={[bell.label, { color: text }]}>Avisos</Text>
        {unreadCount > 0 && (
          <View style={bell.badge}>
            <Text style={bell.badgeTxt}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        )}
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: connected ? "#10B981" : "#F59E0B",
          }}
        />
        <Feather name={open ? "chevron-up" : "chevron-down"} size={13} color={sub} />
      </Pressable>

      {open && (
        <View style={bell.panel}>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={{ color: "#3B82F6", fontSize: 11, fontWeight: "600" }}>
                Marcar leídos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSilenced(!silenced)}>
              <Text style={{ color: sub, fontSize: 11 }}>
                {silenced ? "🔇 Activar sonido" : "🔊 Silenciar"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clear}>
              <Text style={{ color: sub, fontSize: 11 }}>Limpiar vista</Text>
            </TouchableOpacity>
          </View>
          {notifs.length === 0 ? (
            <Text style={{ color: sub, fontSize: 11, paddingVertical: 6 }}>
              Sin avisos
            </Text>
          ) : (
            notifs.slice(0, 10).map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  markRead(n.id);
                  if (n.section) {
                    onNavigate(n.section as AdminSection);
                    setOpen(false);
                  }
                }}
                style={[bell.item, !n.read && { backgroundColor: "#EF444408" }]}
              >
                <View style={bell.itemTop}>
                  <Feather
                    name={n.icon as any}
                    size={12}
                    color={LEVEL_COLOR[n.level] || "#EF4444"}
                  />
                  <Text
                    style={{ color: text, fontSize: 11, fontWeight: n.read ? "500" : "700", flex: 1 }}
                    numberOfLines={1}
                  >
                    {n.title}
                  </Text>
                  <Text style={{ color: sub, fontSize: 9 }}>
                    {new Date(n.timestamp).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <Text style={{ color: sub, fontSize: 10, lineHeight: 13 }} numberOfLines={2}>
                  {n.body}
                </Text>
              </Pressable>
            ))
          )}
          <TouchableOpacity
            onPress={() => {
              setOpen(false);
              onNavigate("notifications" as AdminSection);
            }}
            style={{ paddingVertical: 6 }}
          >
            <Text style={{ color: "#3B82F6", fontSize: 11, fontWeight: "700" }}>
              Ver todos los avisos →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Avisos flotantes globales: cualquier evento del admin aparece aquí con
// botón "Ver" que lleva a la sección correspondiente, en cualquier pantalla.
function AdminToasts({
  hook,
  onNavigate,
}: {
  hook: ReturnType<typeof useAdminNotifications>;
  onNavigate: (s: AdminSection) => void;
}) {
  const { isDark } = useTheme();
  const { toasts, dismissToast } = hook;
  if (toasts.length === 0) return null;

  const LEVEL_COLOR: Record<string, string> = {
    critical: "#EF4444",
    high: "#F59E0B",
    medium: "#3B82F6",
  };
  const card = isDark ? "#1b1b1b" : "#fff";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#888" : "#666";

  return (
    <View style={toastLayer.wrap} pointerEvents="box-none">
      {toasts.map((t) => {
        const color = LEVEL_COLOR[t.level] || "#3B82F6";
        return (
          <View
            key={t.id}
            style={[toastLayer.card, { backgroundColor: card, borderLeftColor: color }]}
          >
            <View style={toastLayer.top}>
              <Feather name={t.icon as any} size={14} color={color} />
              <Text
                style={{ color: text, fontSize: 12, fontWeight: "800", flex: 1 }}
                numberOfLines={1}
              >
                {t.title}
              </Text>
              <TouchableOpacity onPress={() => dismissToast(t.id)}>
                <Feather name="x" size={13} color={sub} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: sub, fontSize: 11, lineHeight: 15 }} numberOfLines={2}>
              {t.body}
            </Text>
            <View style={toastLayer.actions}>
              {t.section ? (
                <TouchableOpacity
                  onPress={() => {
                    onNavigate(t.section as AdminSection);
                    dismissToast(t.id);
                  }}
                  style={[toastLayer.viewBtn, { backgroundColor: color }]}
                >
                  <Text style={toastLayer.viewTxt}>Ver</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AdminShell({ active, onChange, metrics, onSearchSelect, children }: Props) {
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  // Una sola instancia del centro de avisos para toda la shell (campana +
  // avisos flotantes); comparte el socket único con el resto del panel.
  const notifHook = useAdminNotifications();

  // Atajo web: Ctrl/Cmd+K abre el buscador global; Escape lo cierra.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearchSelect = (result: AdminSearchResult) => {
    if (onSearchSelect) {
      onSearchSelect(result);
      return;
    }
    if (result.type === "user") onChange("users");
    else if (result.type === "business") onChange("businesses_list");
    else if (result.type === "driver") onChange("drivers_list");
    else onChange("orders_active");
  };

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const sideBg = isDark ? "#141414" : "#fff";
  const border = isDark ? "#222" : "#ebebeb";

  // Track which parent groups are expanded
  const [expanded, setExpanded] = useState<Set<AdminSection>>(() => {
    const s = new Set<AdminSection>();
    NAV.forEach((item) => {
      if (item.children?.some((c) => c.id === active)) s.add(item.id);
    });
    return s;
  });

  const toggle = (id: AdminSection) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const badges: Partial<Record<AdminSection, number>> = {
    orders_active: metrics?.pendingOrders || 0,
    finance_proofs: metrics?.pendingPayments || 0,
    support_tickets: metrics?.openTickets || 0,
    support_issues: metrics?.openIssues || 0,
    support_verifications: metrics?.pendingVerifications || 0,
    notifications: notifHook.unreadCount || 0,
  };

  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#555" : "#aaa";

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
            <Text style={[sh.appRole, { color: sub }]}>Panel Admin</Text>
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
            <Text style={[sh.userName, { color: text }]} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={[sh.userRole, { color: sub }]} numberOfLines={1}>
              {user?.role === "super_admin" ? "Super Admin" : "Administrador"}
            </Text>
          </View>
        </View>

        {/* Nav */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={[
              sh.searchBtn,
              {
                backgroundColor: isDark ? "#1e1e1e" : "#f5f5f5",
                borderColor: border,
              },
            ]}
          >
            <Feather name="search" size={14} color={sub} />
            <Text style={[sh.searchTxt, { color: sub }]}>Buscar...</Text>
            <Text style={[sh.searchKbd, { color: sub }]}>Ctrl K</Text>
          </Pressable>
          <AdminBell onNavigate={onChange} hook={notifHook} />

          {NAV.map((item, idx) => {
            const isParentActive =
              active === item.id || item.children?.some((c) => c.id === active);
            const isOpen = expanded.has(item.id);
            const badge = badges[item.id];
            const hasChildren = !!item.children?.length;
            const showGroupHeader =
              !!item.group && item.group !== NAV[idx - 1]?.group;

            return (
              <View key={item.id}>
                {showGroupHeader && (
                  <Text style={[sh.groupLabel, { color: sub }]}>
                    {item.group}
                  </Text>
                )}
                <Pressable
                  onPress={() => {
                    if (hasChildren) {
                      toggle(item.id);
                      // also navigate to parent if no child selected
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
                  {!!badge && (
                    <View style={[sh.badge, { backgroundColor: item.color }]}>
                      <Text style={sh.badgeTxt}>
                        {badge > 99 ? "99+" : badge}
                      </Text>
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
                {hasChildren &&
                  isOpen &&
                  item.children!.map((child) => {
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
                        {!!childBadge && (
                          <View
                            style={[sh.badge, { backgroundColor: item.color }]}
                          >
                            <Text style={sh.badgeTxt}>
                              {childBadge > 99 ? "99+" : childBadge}
                            </Text>
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

      {/* Avisos flotantes globales (encima de cualquier sección) */}
      <AdminToasts hook={notifHook} onNavigate={onChange} />

      <AdminGlobalSearch
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
    </View>
  );
}

const sh = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 236, borderRightWidth: 1, flexDirection: "column" },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchTxt: { flex: 1, fontSize: 12 },
  searchKbd: { fontSize: 9, fontWeight: "700" },
  content: { flex: 1 },
  footer: { padding: 14, borderTopWidth: 1 },
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
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  logoTxt: { fontSize: 13, fontWeight: "900", color: "#fff" },
  appName: { fontSize: 14, fontWeight: "800" },
  appRole: { fontSize: 10, marginTop: 1 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
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
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },
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
  userEmail: { fontSize: 9, marginTop: 1, opacity: 0.7 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  logoutTxt: { fontSize: 13, fontWeight: "600", color: "#EF4444" },
});

const bell = StyleSheet.create({
  wrap: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontSize: 12, fontWeight: "700" },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff" },
  panel: { marginTop: 6, gap: 2 },
  item: { borderRadius: 8, padding: 6 },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
});

// Avisos flotantes globales: capa fija en la esquina superior derecha del
// contenido, por encima de cualquier sección
const toastLayer = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 330,
    gap: 8,
    zIndex: 9999,
  },
  card: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
