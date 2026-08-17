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
import { CouponForm } from "./CouponsTab.form.web";

const PRIMARY = "#DC2626";
const PINK = "#EC4899";

export interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const CouponsTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [filtered, setFiltered] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "inactive" | "expired"
  >("all");
  const [editing, setEditing] = useState<Coupon | null | "new">(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const load = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        apiRequest("GET", "/api/coupons/admin/all"),
        apiRequest("GET", "/api/coupons/admin/stats"),
      ]);
      const [c, s] = await Promise.all([cRes.json(), sRes.json()]);
      setCoupons(c.coupons ?? []);
      if (s.success) setStats(s);
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
    const now = new Date();
    let list = coupons;
    if (filter === "active")
      list = list.filter(
        (c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > now),
      );
    if (filter === "inactive") list = list.filter((c) => !c.isActive);
    if (filter === "expired")
      list = list.filter((c) => c.expiresAt && new Date(c.expiresAt) <= now);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.code.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [search, filter, coupons]);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const res = await apiRequest("PUT", `/api/coupons/admin/${coupon.id}`, {
        isActive: !coupon.isActive,
      });
      const data = await res.json();
      if (data.success) {
        setCoupons((prev) =>
          prev.map((c) =>
            c.id === coupon.id ? { ...c, isActive: !c.isActive } : c,
          ),
        );
        flash(true, coupon.isActive ? "Cupón desactivado" : "Cupón activado");
      }
    } catch {
      flash(false, "Error de conexión");
    }
  };

  const remove = async (coupon: Coupon) => {
    if (
      !window.confirm(
        `¿Eliminar el cupón "${coupon.code}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setDeleting(coupon.id);
    try {
      await apiRequest("DELETE", `/api/coupons/admin/${coupon.id}`);
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      flash(true, "Cupón eliminado");
    } catch {
      flash(false, "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const fmtDiscount = (c: Coupon) =>
    c.discountType === "percentage"
      ? `${c.discountValue}% dto.`
      : `${(c.discountValue / 100).toFixed(2)} € dto.`;

  const isExpired = (c: Coupon) =>
    !!c.expiresAt && new Date(c.expiresAt) <= new Date();

  const now = new Date();
  const activeCount = coupons.filter(
    (c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > now),
  ).length;
  const expiredCount = coupons.filter(
    (c) => c.expiresAt && new Date(c.expiresAt) <= now,
  ).length;
  const totalUses = coupons.reduce((s, c) => s + c.usedCount, 0);

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
      <View style={{ flex: 1 }}>
        {/* KPI bar */}
        <View
          style={[
            kpi.bar,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          {[
            { label: "Total", value: coupons.length, color: PINK },
            { label: "Activos", value: activeCount, color: "#10B981" },
            { label: "Expirados", value: expiredCount, color: "#EF4444" },
            { label: "Usos tot.", value: totalUses, color: "#F59E0B" },
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
              placeholder="Buscar código..."
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
            {filtered.length} cupones
          </Text>
          <TouchableOpacity
            onPress={() => setEditing("new")}
            style={[tb.addBtn, { backgroundColor: PINK }]}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={tb.addTxt}>Nuevo cupón</Text>
          </TouchableOpacity>
        </View>

        {/* Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[tb.filterRow, { borderBottomColor: border }]}
          contentContainerStyle={tb.filterContent}
        >
          {(
            [
              { id: "all", label: "Todos", color: PINK },
              { id: "active", label: "Activos", color: "#10B981" },
              { id: "inactive", label: "Inactivos", color: "#6B7280" },
              { id: "expired", label: "Expirados", color: "#EF4444" },
            ] as const
          ).map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                tb.chip,
                {
                  backgroundColor: filter === f.id ? f.color : inputBg,
                  borderColor: filter === f.id ? f.color : border,
                },
              ]}
            >
              <Text
                style={[tb.chipTxt, { color: filter === f.id ? "#fff" : text }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feedback */}
        {msg && (
          <View
            style={[
              tb.msgBar,
              { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" },
            ]}
          >
            <Feather
              name={msg.ok ? "check-circle" : "alert-circle"}
              size={13}
              color={msg.ok ? "#10B981" : "#EF4444"}
            />
            <Text
              style={[tb.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}
            >
              {msg.text}
            </Text>
          </View>
        )}

        {/* Lista */}
        {filtered.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Feather name="tag" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>Sin cupones</Text>
            <TouchableOpacity
              onPress={() => setEditing("new")}
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: PINK,
                },
              ]}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                Crear primer cupón
              </Text>
            </TouchableOpacity>
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
            {filtered.map((coupon) => {
              const expired = isExpired(coupon);
              const statusColor = expired
                ? "#EF4444"
                : coupon.isActive
                  ? "#10B981"
                  : "#6B7280";
              const statusLabel = expired
                ? "Expirado"
                : coupon.isActive
                  ? "Activo"
                  : "Inactivo";
              const usePct = coupon.maxUses
                ? Math.round((coupon.usedCount / coupon.maxUses) * 100)
                : null;
              const isEditing = editing !== "new" && editing?.id === coupon.id;

              return (
                <View
                  key={coupon.id}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isEditing ? PINK : border,
                      borderLeftColor: statusColor,
                    },
                  ]}
                >
                  <View style={li.row}>
                    {/* Code + discount */}
                    <View
                      style={[li.codeWrap, { backgroundColor: PINK + "12" }]}
                    >
                      <Text style={[li.code, { color: PINK }]}>
                        {coupon.code}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[li.discount, { color: text }]}>
                        {fmtDiscount(coupon)}
                      </Text>
                      {coupon.minOrderAmount && (
                        <Text style={[li.min, { color: sub }]}>
                          Mín. {(coupon.minOrderAmount / 100).toFixed(2)} €
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        li.statusPill,
                        { backgroundColor: statusColor + "15" },
                      ]}
                    >
                      <View
                        style={[li.statusDot, { backgroundColor: statusColor }]}
                      />
                      <Text style={[li.statusTxt, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Stats row */}
                  <View style={li.statsRow}>
                    <View style={li.statItem}>
                      <Feather name="users" size={11} color={sub} />
                      <Text style={[li.statTxt, { color: sub }]}>
                        {coupon.usedCount}/{coupon.maxUses ?? "∞"} usos
                      </Text>
                    </View>
                    {coupon.maxUsesPerUser && (
                      <View style={li.statItem}>
                        <Feather name="user" size={11} color={sub} />
                        <Text style={[li.statTxt, { color: sub }]}>
                          {coupon.maxUsesPerUser}/usuario
                        </Text>
                      </View>
                    )}
                    {coupon.expiresAt && (
                      <View style={li.statItem}>
                        <Feather
                          name="clock"
                          size={11}
                          color={expired ? "#EF4444" : sub}
                        />
                        <Text
                          style={[
                            li.statTxt,
                            { color: expired ? "#EF4444" : sub },
                          ]}
                        >
                          {`${expired ? "Expiró" : "Expira"} ${new Date(coupon.expiresAt).toLocaleDateString("es-ES")}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Barra de uso */}
                  {usePct !== null && (
                    <View
                      style={[
                        li.usageTrack,
                        { backgroundColor: isDark ? "#333" : "#f0f0f0" },
                      ]}
                    >
                      <View
                        style={[
                          li.usageFill,
                          {
                            width: `${Math.min(usePct, 100)}%` as any,
                            backgroundColor: usePct >= 90 ? "#EF4444" : PINK,
                          },
                        ]}
                      />
                    </View>
                  )}

                  {/* Actions */}
                  <View style={li.actions}>
                    <TouchableOpacity
                      onPress={() => setEditing(isEditing ? null : coupon)}
                      style={[
                        li.actionBtn,
                        {
                          backgroundColor: isEditing
                            ? PINK + "20"
                            : "#3B82F615",
                          borderColor: isEditing ? PINK : "#3B82F630",
                        },
                      ]}
                    >
                      <Feather
                        name="edit-2"
                        size={12}
                        color={isEditing ? PINK : "#3B82F6"}
                      />
                      <Text
                        style={[
                          li.actionTxt,
                          { color: isEditing ? PINK : "#3B82F6" },
                        ]}
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleActive(coupon)}
                      style={[
                        li.actionBtn,
                        {
                          backgroundColor: coupon.isActive
                            ? "#EF444415"
                            : "#10B98115",
                          borderColor: coupon.isActive
                            ? "#EF444430"
                            : "#10B98130",
                        },
                      ]}
                    >
                      <Feather
                        name={coupon.isActive ? "pause" : "play"}
                        size={12}
                        color={coupon.isActive ? "#EF4444" : "#10B981"}
                      />
                      <Text
                        style={[
                          li.actionTxt,
                          { color: coupon.isActive ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {coupon.isActive ? "Desactivar" : "Activar"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => remove(coupon)}
                      disabled={deleting === coupon.id}
                      style={[
                        li.actionBtn,
                        {
                          backgroundColor: "#EF444410",
                          borderColor: "#EF444425",
                        },
                      ]}
                    >
                      {deleting === coupon.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Feather name="trash-2" size={12} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Panel crear/editar */}
      {editing !== null && (
        <CouponForm
          coupon={editing === "new" ? null : editing}
          isDark={isDark}
          onClose={() => setEditing(null)}
          onSaved={(c, isNew) => {
            if (isNew) {
              setCoupons((prev) => [c, ...prev]);
            } else {
              setCoupons((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            }
            flash(true, isNew ? "Cupón creado" : "Cupón actualizado");
            setEditing(null);
          }}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
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
    gap: 10,
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterRow: { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipTxt: { fontSize: 12, fontWeight: "600" },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  msgTxt: { fontSize: 12, fontWeight: "600" },
});

const li = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  codeWrap: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  code: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  discount: { fontSize: 14, fontWeight: "700" },
  min: { fontSize: 11, marginTop: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statTxt: { fontSize: 11 },
  usageTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  usageFill: { height: 4, borderRadius: 2, minWidth: 4 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionTxt: { fontSize: 11, fontWeight: "600" },
});
