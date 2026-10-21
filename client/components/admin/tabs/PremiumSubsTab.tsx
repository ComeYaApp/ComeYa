import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { BorderRadius, Spacing } from "@/constants/theme";

const PRIMARY = "#E60000";

const PLAN_COLORS: Record<string, string> = {
  impulso_local: "#3B82F6",
  top_soria: "#10B981",
  top_local: "#10B981",
  premium_soria: "#F59E0B",
  premium_local: "#F59E0B",
  soria_local: "#8B5CF6",
  premium: "#F59E0B",
  business: "#10B981",
  professional: "#3B82F6",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Gratis",
  impulso_local: "Impulso Local",
  top_soria: "Top Local",
  top_local: "Top Local",
  premium_soria: "Premium Local",
  premium_local: "Premium Local",
  soria_local: "Soria Local",
  premium: "Premium",
  business: "Negocio",
  professional: "Profesional",
};

const fmt = (cents?: number | null) =>
  `${((cents ?? 0) / 100).toFixed(2)} €`;
const formatDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-ES") : "—";

function statusMeta(sub: any) {
  if (sub?.status === "pending_payment")
    return { label: "Pago pendiente", color: "#F59E0B" };
  if (sub?.status === "cancelled")
    return { label: "Cancelado", color: "#EF4444" };
  if (sub?.isExpired || sub?.status === "expired")
    return { label: "Expirado", color: "#EF4444" };
  return { label: "Activo", color: "#10B981" };
}

export function PremiumSubsTab() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/premium-subscribers");
      const data = await res.json();
      if (data.success) {
        setSubs(data.subscribers ?? []);
        setStats(data.stats);
      }
    } catch {
      // se conserva la lista anterior
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = subs;
    if (filter === "active") {
      list = list.filter(
        (s) => s.status === "active" && !s.isExpired,
      );
    } else if (filter === "expired") {
      list = list.filter((s) => s.isExpired || s.status === "expired");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.userName?.toLowerCase().includes(q) ||
          s.userEmail?.toLowerCase().includes(q) ||
          s.businessName?.toLowerCase().includes(q) ||
          s.plan?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [subs, filter, search]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
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
        <View style={s.header}>
          <View style={[s.iconWrap, { backgroundColor: "#F59E0B18" }]}>
            <Feather name="star" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>
              Suscripciones
            </Text>
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              {subs.length} suscriptores
            </Text>
          </View>
        </View>

        {stats && (
          <View style={s.statsRow}>
            {[
              {
                label: "Activos",
                value: stats.totalActive ?? 0,
                color: "#10B981",
              },
              {
                label: "Expirados",
                value: stats.totalExpired ?? 0,
                color: "#EF4444",
              },
              {
                label: "Ingresos",
                value: fmt(stats.totalRevenue),
                color: "#F59E0B",
              },
            ].map((k) => (
              <View
                key={k.label}
                style={[
                  s.statCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[s.statValue, { color: k.color }]}>{k.value}</Text>
                <Text style={[s.statLabel, { color: theme.textSecondary }]}>
                  {k.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View
          style={[
            s.searchWrap,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={15} color={theme.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="Buscar por usuario, negocio o plan..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={s.filterRow}>
          {(
            [
              { id: "all", label: "Todos" },
              { id: "active", label: "Activos" },
              { id: "expired", label: "Expirados" },
            ] as const
          ).map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                s.chip,
                {
                  backgroundColor:
                    filter === f.id ? PRIMARY : theme.card,
                  borderColor:
                    filter === f.id ? PRIMARY : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: filter === f.id ? "#FFF" : theme.text,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Feather name="star" size={40} color={theme.textSecondary} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              Sin suscriptores
            </Text>
            <Text style={[s.emptySub, { color: theme.textSecondary }]}>
              Las suscripciones activas aparecerán aquí.
            </Text>
          </View>
        ) : (
          filtered.map((sub) => {
            const planColor = PLAN_COLORS[sub.plan] ?? "#F59E0B";
            const st = statusMeta(sub);
            return (
              <Pressable
                key={sub.id}
                onPress={() => setSelected(sub)}
                style={[
                  s.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={s.cardTop}>
                  <View
                    style={[s.planPill, { backgroundColor: planColor + "18" }]}
                  >
                    <Feather name="star" size={10} color={planColor} />
                    <Text style={[s.planTxt, { color: planColor }]}>
                      {PLAN_LABELS[sub.plan] ?? sub.plan}
                    </Text>
                  </View>
                  <View
                    style={[s.statusPill, { backgroundColor: st.color + "18" }]}
                  >
                    <Text style={[s.statusTxt, { color: st.color }]}>
                      {st.label}
                    </Text>
                  </View>
                </View>
                <Text style={[s.name, { color: theme.text }]}>
                  {sub.userName ?? sub.userId}
                </Text>
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {sub.userEmail ?? "Sin email"}
                </Text>
                {sub.businessName && (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    Negocio: {sub.businessName}
                  </Text>
                )}
                <View style={s.cardBottom}>
                  <Text style={[s.price, { color: theme.text }]}>
                    {fmt(sub.price)}/
                    {sub.billingCycle === "yearly" ? "año" : "mes"}
                  </Text>
                  <Text style={[s.days, { color: st.color }]}>
                    {st.label === "Expirado"
                      ? "Expirado"
                      : `${sub.daysRemaining ?? 0} días`}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setSelected(null)}
          />
          <View
            style={[
              s.modalCard,
              {
                backgroundColor: theme.card,
                paddingBottom: insets.bottom + 16,
                maxHeight: "88%",
              },
            ]}
          >
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.text }]}>
                Detalles de suscripción
              </Text>
              <Pressable onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
                <Section title="USUARIO" theme={theme}>
                  <Row label="Nombre" value={selected.userName} theme={theme} />
                  <Row label="Email" value={selected.userEmail} theme={theme} />
                  <Row label="ID" value={selected.userId} theme={theme} />
                </Section>
                <Section title="SUSCRIPCIÓN" theme={theme}>
                  <Row
                    label="Plan"
                    value={PLAN_LABELS[selected.plan] ?? selected.plan}
                    theme={theme}
                  />
                  <Row
                    label="Precio"
                    value={`${fmt(selected.price)}/${selected.billingCycle === "yearly" ? "año" : "mes"}`}
                    theme={theme}
                  />
                  <Row
                    label="Estado"
                    value={statusMeta(selected).label}
                    theme={theme}
                  />
                  <Row
                    label="Negocio"
                    value={selected.businessName ?? "—"}
                    theme={theme}
                  />
                  <Row
                    label="Auto-renovable"
                    value={selected.autoRenew ? "Sí" : "No"}
                    theme={theme}
                  />
                </Section>
                <Section title="PERIODO" theme={theme}>
                  <Row
                    label="Inicio"
                    value={formatDate(selected.currentPeriodStart)}
                    theme={theme}
                  />
                  <Row
                    label="Fin"
                    value={formatDate(selected.currentPeriodEnd)}
                    theme={theme}
                  />
                  <Row
                    label="Días restantes"
                    value={
                      selected.isExpired
                        ? "0"
                        : String(selected.daysRemaining ?? 0)
                    }
                    theme={theme}
                  />
                </Section>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, theme, children }: any) {
  return (
    <View
      style={[
        s.section,
        { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
      ]}
    >
      <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value, theme }: any) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[s.rowValue, { color: theme.text }]} numberOfLines={2}>
        {value ?? "—"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 12, textAlign: "center" },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  planTxt: { fontSize: 9, fontWeight: "800" },
  statusPill: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "700", marginTop: 8 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: { fontSize: 13, fontWeight: "700" },
  days: { fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
});
