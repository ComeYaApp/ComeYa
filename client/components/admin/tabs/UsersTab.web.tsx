import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { UserDetail } from "./UsersTab.detail.web";

const PRIMARY = "#DC2626";

export const ROLE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  customer: { label: "Cliente", color: "#6B7280", icon: "user" },
  business_owner: { label: "Negocio", color: "#3B82F6", icon: "briefcase" },
  delivery_driver: { label: "Repartidor", color: "#10B981", icon: "truck" },
  admin: { label: "Admin", color: "#8B5CF6", icon: "shield" },
  super_admin: { label: "Super Admin", color: "#DC2626", icon: "star" },
};

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  isActive: boolean;
  isOnline: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  verificationStatus: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  profileImage: string | null;
}

interface Props {
  users?: any[];
  onUserPress?: (u: any) => void;
}

export const UsersTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatus] = useState("all");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/users");
      const data = await res.json();
      setUsers(data?.users ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter === "active") list = list.filter((u) => u.isActive);
    if (statusFilter === "inactive") list = list.filter((u) => !u.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q),
      );
    }
    setFiltered(list);
  }, [search, roleFilter, statusFilter, users]);

  // KPI counts
  const counts = Object.fromEntries(
    Object.keys(ROLE_META).map((r) => [
      r,
      users.filter((u) => u.role === r).length,
    ]),
  );
  const activeCount = users.filter((u) => u.isActive).length;

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>
      {/* ── Lista ── */}
      <View style={{ flex: 1 }}>
        {/* KPI bar */}
        <View
          style={[
            kpi.bar,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          {[
            { label: "Total", value: users.length, color: PRIMARY },
            {
              label: "Clientes",
              value: counts.customer ?? 0,
              color: "#6B7280",
            },
            {
              label: "Negocios",
              value: counts.business_owner ?? 0,
              color: "#3B82F6",
            },
            {
              label: "Repartidores",
              value: counts.delivery_driver ?? 0,
              color: "#10B981",
            },
            { label: "Activos", value: activeCount, color: "#F59E0B" },
          ].map((k) => (
            <View key={k.label} style={kpi.item}>
              <Text style={[kpi.val, { color: k.color }]}>{k.value}</Text>
              <Text style={[kpi.lbl, { color: sub }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Toolbar */}
        <View
          style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View
            style={[
              tb.searchWrap,
              { backgroundColor: inputBg, borderColor: border },
            ]}
          >
            <Feather name="search" size={14} color={sub} />
            <TextInput
              style={[tb.input, { color: text }]}
              placeholder="Buscar nombre, teléfono, email..."
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={14} color={sub} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[tb.count, { color: sub }]}>
            {filtered.length} usuarios
          </Text>
        </View>

        {/* Filtros rol */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[tb.filterRow, { borderBottomColor: border }]}
          contentContainerStyle={tb.filterContent}
        >
          <TouchableOpacity
            onPress={() => setRoleFilter("all")}
            style={[
              tb.chip,
              {
                backgroundColor: roleFilter === "all" ? PRIMARY : inputBg,
                borderColor: roleFilter === "all" ? PRIMARY : border,
              },
            ]}
          >
            <Text
              style={[
                tb.chipTxt,
                { color: roleFilter === "all" ? "#fff" : text },
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>
          {Object.entries(ROLE_META).map(([role, meta]) => (
            <TouchableOpacity
              key={role}
              onPress={() => setRoleFilter(role)}
              style={[
                tb.chip,
                {
                  backgroundColor: roleFilter === role ? meta.color : inputBg,
                  borderColor: roleFilter === role ? meta.color : border,
                },
              ]}
            >
              <Feather
                name={meta.icon as any}
                size={11}
                color={roleFilter === role ? "#fff" : meta.color}
              />
              <Text
                style={[
                  tb.chipTxt,
                  { color: roleFilter === role ? "#fff" : text },
                ]}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={[tb.divider, { backgroundColor: border }]} />
          {[
            { id: "all", label: "Todos", color: PRIMARY },
            { id: "active", label: "Activos", color: "#10B981" },
            { id: "inactive", label: "Inactivos", color: "#EF4444" },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setStatus(f.id)}
              style={[
                tb.chip,
                {
                  backgroundColor: statusFilter === f.id ? f.color : inputBg,
                  borderColor: statusFilter === f.id ? f.color : border,
                },
              ]}
            >
              <Text
                style={[
                  tb.chipTxt,
                  { color: statusFilter === f.id ? "#fff" : text },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        {filtered.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Feather name="users" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>Sin usuarios</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={PRIMARY}
              />
            }
          >
            {filtered.map((user) => {
              const meta = ROLE_META[user.role] ?? ROLE_META.customer;
              const isSelected = selected?.id === user.id;
              return (
                <TouchableOpacity
                  key={user.id}
                  onPress={() => setSelected(user)}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? meta.color : border,
                    },
                    isSelected && {
                      borderLeftColor: meta.color,
                      borderLeftWidth: 3,
                    },
                  ]}
                >
                  <View style={li.row}>
                    {/* Avatar */}
                    <View
                      style={[
                        li.avatar,
                        { backgroundColor: meta.color + "20" },
                      ]}
                    >
                      <Text style={[li.avatarTxt, { color: meta.color }]}>
                        {user.name?.charAt(0).toUpperCase() ?? "?"}
                      </Text>
                      {user.isOnline && <View style={li.onlineDot} />}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={li.nameRow}>
                        <Text
                          style={[li.name, { color: text }]}
                          numberOfLines={1}
                        >
                          {user.name}
                        </Text>
                        {!user.isActive && (
                          <View
                            style={[
                              li.inactivePill,
                              { backgroundColor: "#EF444415" },
                            ]}
                          >
                            <Text style={li.inactiveTxt}>Inactivo</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[li.phone, { color: sub }]}>
                        {user.phone}
                      </Text>
                      {user.email && (
                        <Text
                          style={[li.email, { color: sub }]}
                          numberOfLines={1}
                        >
                          {user.email}
                        </Text>
                      )}
                    </View>

                    {/* Role badge */}
                    <View
                      style={[
                        li.rolePill,
                        { backgroundColor: meta.color + "18" },
                      ]}
                    >
                      <Feather
                        name={meta.icon as any}
                        size={11}
                        color={meta.color}
                      />
                      <Text style={[li.roleTxt, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel detalle ── */}
      {selected && (
        <UserDetail
          user={selected}
          isDark={isDark}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            setSelected(updated);
            setUsers((prev) =>
              prev.map((u) => (u.id === updated.id ? updated : u)),
            );
          }}
        />
      )}
    </View>
  );
};

const kpi = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  item: { flex: 1, alignItems: "center", gap: 2 },
  val: { fontSize: 18, fontWeight: "800" },
  lbl: { fontSize: 10, fontWeight: "600" },
});

const tb = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13 } as any,
  count: { fontSize: 12, fontWeight: "600" },
  filterRow: { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipTxt: { fontSize: 12, fontWeight: "600" },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxt: { fontSize: 17, fontWeight: "800" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  name: { fontSize: 14, fontWeight: "700", flex: 1 },
  inactivePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  inactiveTxt: { fontSize: 10, fontWeight: "700", color: "#EF4444" },
  phone: { fontSize: 12, marginBottom: 1 },
  email: { fontSize: 11 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleTxt: { fontSize: 11, fontWeight: "700" },
});
