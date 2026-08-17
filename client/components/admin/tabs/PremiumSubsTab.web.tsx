import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

const PLAN_COLORS: Record<string, string> = {
  premium: "#F59E0B",
  business: "#10B981",
  professional: "#3B82F6",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Gratis",
  premium: "Premium",
  business: "Negocio",
  professional: "Profesional",
};

const fmt = (cents: number) => `${(cents / 100).toFixed(2)} €`;
const formatDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("es-ES") : "—";

export const PremiumSubsTab: React.FC = () => {
  const { isDark } = useTheme();
  const [subs, setSubs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/premium-subscribers");
      const data = await res.json();
      if (data.success) {
        setSubs(data.subscribers ?? []);
        setStats(data.stats);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      <View
        style={{
          flex: selected ? undefined : 1,
          flexBasis: selected ? 400 : undefined,
          flexGrow: selected ? 0 : 1,
          flexShrink: 0,
        }}
      >
        <View
          style={[hd.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View style={[hd.iconWrap, { backgroundColor: "#F59E0B15" }]}>
            <Feather name="star" size={15} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[hd.title, { color: text }]}>
              Suscripciones premium
            </Text>
            <Text style={[hd.sub, { color: sub }]}>
              {subs.length} suscriptores
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              load();
            }}
            style={hd.refreshBtn}
          >
            <Feather name="refresh-cw" size={14} color={sub} />
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        {stats && (
          <View
            style={[
              statsBar.root,
              { backgroundColor: card, borderBottomColor: border },
            ]}
          >
            <View style={statsBar.stat}>
              <Text style={[statsBar.statVal, { color: "#10B981" }]}>
                {stats.totalActive}
              </Text>
              <Text style={[statsBar.statLbl, { color: sub }]}>Activos</Text>
            </View>
            <View style={statsBar.stat}>
              <Text style={[statsBar.statVal, { color: "#EF4444" }]}>
                {stats.totalExpired}
              </Text>
              <Text style={[statsBar.statLbl, { color: sub }]}>Expirados</Text>
            </View>
            <View style={statsBar.stat}>
              <Text style={[statsBar.statVal, { color: "#F59E0B" }]}>
                {fmt(stats.totalRevenue)}
              </Text>
              <Text style={[statsBar.statLbl, { color: sub }]}>Ingresos</Text>
            </View>
          </View>
        )}

        {subs.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              padding: 40,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#F59E0B15",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather name="star" size={28} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: text }}>
              Sin suscriptores premium
            </Text>
            <Text style={{ fontSize: 13, color: sub, textAlign: "center" }}>
              Los usuarios con plan premium aparecerán aquí
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
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
            {subs.map((s) => {
              const planColor = PLAN_COLORS[s.plan] ?? "#F59E0B";
              const isSelected = selected?.id === s.id;
              const isExpired = s.isExpired || s.status === "expired";
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(isSelected ? null : s)}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? planColor : border,
                      borderLeftColor: planColor,
                    },
                  ]}
                >
                  <View style={li.top}>
                    <View
                      style={[
                        li.planPill,
                        { backgroundColor: planColor + "18" },
                      ]}
                    >
                      <Feather name="star" size={10} color={planColor} />
                      <Text style={[li.planTxt, { color: planColor }]}>
                        {PLAN_LABELS[s.plan] ?? s.plan.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        li.statusPill,
                        {
                          backgroundColor:
                            (isExpired ? "#EF4444" : "#10B981") + "18",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          li.statusTxt,
                          { color: isExpired ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {isExpired ? "Expirado" : "Activo"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[li.name, { color: text }]}>
                    {s.userName ?? s.userId}
                  </Text>
                  <Text style={[li.sub, { color: sub }]}>
                    {s.userEmail ?? "Sin email"}
                  </Text>
                  <View style={li.row}>
                    <View style={li.col}>
                      <Text style={[li.lbl, { color: sub }]}>Precio</Text>
                      <Text style={[li.val, { color: text }]}>
                        {fmt(s.price)}/
                        {s.billingCycle === "yearly" ? "año" : "mes"}
                      </Text>
                    </View>
                    <View style={li.col}>
                      <Text style={[li.lbl, { color: sub }]}>Expira</Text>
                      <Text
                        style={[
                          li.val,
                          { color: isExpired ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {isExpired ? "Expirado" : `${s.daysRemaining} días`}
                      </Text>
                    </View>
                  </View>
                  <View style={li.hint}>
                    <Feather
                      name={isSelected ? "chevron-up" : "eye"}
                      size={12}
                      color={planColor}
                    />
                    <Text style={[li.hintTxt, { color: planColor }]}>
                      {isSelected ? "Cerrar" : "Ver detalles"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel detalle ── */}
      {selected && (
        <View
          style={[
            det.panel,
            { backgroundColor: card, borderLeftColor: border },
          ]}
        >
          <View style={[det.header, { borderBottomColor: border }]}>
            <Text style={[det.title, { color: text }]}>
              Detalles de suscripción
            </Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Feather name="x" size={18} color={sub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                det.section,
                {
                  backgroundColor: isDark ? "#222" : "#f8f8f8",
                  borderColor: border,
                },
              ]}
            >
              <Text style={[det.sectionTitle, { color: sub }]}>USUARIO</Text>
              {[
                {
                  label: "Nombre",
                  value: selected.userName ?? "—",
                  highlight: true,
                },
                {
                  label: "Email",
                  value: selected.userEmail ?? "—",
                  highlight: false,
                },
                { label: "ID", value: selected.userId, highlight: false },
              ].map((r) => (
                <View key={r.label} style={det.dataRow}>
                  <Text style={[det.dataLbl, { color: sub }]}>{r.label}</Text>
                  <Text
                    style={[
                      det.dataVal,
                      {
                        color: r.highlight ? PRIMARY : text,
                        fontWeight: r.highlight ? "700" : "500",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                det.section,
                {
                  backgroundColor: isDark ? "#222" : "#f8f8f8",
                  borderColor: border,
                },
              ]}
            >
              <Text style={[det.sectionTitle, { color: sub }]}>
                SUSCRIPCIÓN
              </Text>
              {[
                {
                  label: "Plan",
                  value: PLAN_LABELS[selected.plan] ?? selected.plan,
                  highlight: true,
                },
                {
                  label: "Precio",
                  value: `${fmt(selected.price)}/${selected.billingCycle === "yearly" ? "año" : "mes"}`,
                  highlight: false,
                },
                { label: "Estado", value: selected.status, highlight: false },
                {
                  label: "Auto-renovable",
                  value: selected.autoRenew ? "Sí" : "No",
                  highlight: false,
                },
              ].map((r) => (
                <View key={r.label} style={det.dataRow}>
                  <Text style={[det.dataLbl, { color: sub }]}>{r.label}</Text>
                  <Text
                    style={[
                      det.dataVal,
                      {
                        color: r.highlight ? "#F59E0B" : text,
                        fontWeight: r.highlight ? "700" : "500",
                      },
                    ]}
                  >
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                det.section,
                {
                  backgroundColor: isDark ? "#222" : "#f8f8f8",
                  borderColor: border,
                },
              ]}
            >
              <Text style={[det.sectionTitle, { color: sub }]}>PERIODO</Text>
              {[
                {
                  label: "Inicio",
                  value: formatDate(selected.currentPeriodStart),
                  highlight: false,
                },
                {
                  label: "Fin",
                  value: formatDate(selected.currentPeriodEnd),
                  highlight: !selected.isExpired,
                },
                {
                  label: "Días restantes",
                  value: selected.isExpired ? "0" : `${selected.daysRemaining}`,
                  highlight: !selected.isExpired,
                },
              ].map((r) => (
                <View key={r.label} style={det.dataRow}>
                  <Text style={[det.dataLbl, { color: sub }]}>{r.label}</Text>
                  <Text
                    style={[
                      det.dataVal,
                      {
                        color: r.highlight ? "#10B981" : text,
                        fontWeight: r.highlight ? "700" : "500",
                      },
                    ]}
                  >
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>

            {selected.cancelledAt && (
              <View
                style={[
                  det.infoBanner,
                  { backgroundColor: "#EF444415", borderColor: "#EF444430" },
                ]}
              >
                <Feather name="alert-triangle" size={14} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 12, flex: 1 }}>
                  Cancelado el {formatDate(selected.cancelledAt)}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const hd = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 1 },
  refreshBtn: { padding: 6 },
});

const statsBar = StyleSheet.create({
  root: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 20,
  },
  stat: { alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLbl: { fontSize: 10, marginTop: 2 },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  planTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  sub: { fontSize: 12, marginBottom: 8 },
  row: { flexDirection: "row", gap: 16, marginTop: 4 },
  col: { flex: 1 },
  lbl: { fontSize: 10, marginBottom: 2 },
  val: { fontSize: 13, fontWeight: "600" },
  hint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  hintTxt: { fontSize: 12, fontWeight: "600" },
});

const det = StyleSheet.create({
  panel: { flex: 1, borderLeftWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontWeight: "700" },
  section: { borderRadius: 12, padding: 12, borderWidth: 1, gap: 6 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  dataLbl: { fontSize: 12 },
  dataVal: { fontSize: 13, flex: 1, textAlign: "right" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
});
