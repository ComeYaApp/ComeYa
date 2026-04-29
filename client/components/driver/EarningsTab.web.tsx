import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const GREEN  = "#16A34A";
const AMBER  = "#F59E0B";
const BLUE   = "#3B82F6";
const PURPLE = "#8B5CF6";

type Period = "today" | "week" | "month" | "total";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy",
  week:  "Esta semana",
  month: "Este mes",
  total: "Total histórico",
};

interface StatsData {
  stats: {
    totalDeliveries: number;
    rating?: number;
    completionRate: number;
    avgDeliveryTime: number;
    todayEarnings?: number;
    weekEarnings?: number;
    monthEarnings?: number;
    totalEarnings?: number;
  };
  deliveries?: {
    id: string;
    businessName: string;
    deliveryFee: number;
    deliveryEarnings?: number;
    deliveredAt: string | null;
    createdAt: string;
    paymentMethod: string;
    status: string;
  }[];
}

interface Props {
  mode: "stats" | "history";
}

export function EarningsTab({ mode }: Props) {
  const { isDark } = useTheme();
  const [data, setData]             = useState<StatsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod]         = useState<Period>("week");

  const bg     = isDark ? "#0d0d0d" : "#f2f3f5";
  const card   = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const chipBg = isDark ? "#222"    : "#f0f0f0";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/delivery/stats");
      const json = await res.json();
      if (json.success !== false) setData(json);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtEur  = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const earnings = {
    today: (data?.stats?.todayEarnings  ?? 0) / 100,
    week:  (data?.stats?.weekEarnings   ?? 0) / 100,
    month: (data?.stats?.monthEarnings  ?? 0) / 100,
    total: (data?.stats?.totalEarnings  ?? 0) / 100,
  };

  const currentEarning = earnings[period];
  const stats = data?.stats;
  const deliveries = data?.deliveries ?? [];

  // ── Mini bar chart from deliveries (last 7 days) ──────────────────────────
  const last7: { label: string; value: number }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("es-ES", { weekday: "short" });
    const dayDeliveries = deliveries.filter(dl => {
      const dlDate = new Date(dl.deliveredAt ?? dl.createdAt);
      return dlDate.toDateString() === d.toDateString() && dl.status === "completed";
    });
    const total = dayDeliveries.reduce((s, dl) => s + (dl.deliveryEarnings ?? dl.deliveryFee ?? 0), 0) / 100;
    return { label: dayStr, value: total };
  });
  const maxBar = Math.max(...last7.map(d => d.value), 1);

  if (loading) return (
    <View style={[s.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  // ── STATS MODE ─────────────────────────────────────────────────────────────
  if (mode === "stats") return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>Mis ganancias</Text>
        <Text style={[s.subtitle, { color: sub }]}>Estadísticas y rendimiento</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero earnings card ── */}
        <View style={[s.heroCard, { backgroundColor: GREEN }]}>
          <Text style={s.heroLabel}>{PERIOD_LABELS[period]}</Text>
          <Text style={s.heroAmount}>€{currentEarning.toFixed(2)}</Text>
          {currentEarning === 0 && earnings.total > 0 && (
            <View style={s.heroHint}>
              <Feather name="info" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.heroHintTxt}>Sin entregas en este período</Text>
            </View>
          )}
          {/* Period selector */}
          <View style={s.periodRow}>
            {(["today", "week", "month", "total"] as Period[]).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.periodBtn, { backgroundColor: period === p ? "#fff" : "rgba(255,255,255,0.2)" }]}
              >
                <Text style={[s.periodTxt, { color: period === p ? GREEN : "#fff" }]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Stats grid ── */}
        <View style={s.statsGrid}>
          {[
            { icon: "truck",        label: "Entregas totales",  value: stats?.totalDeliveries ?? 0,                    color: BLUE   },
            { icon: "star",         label: "Calificación",      value: stats?.rating ? (stats.rating / 10).toFixed(1) : "—", color: AMBER  },
            { icon: "check-circle", label: "Tasa completadas",  value: `${stats?.completionRate ?? 100}%`,             color: GREEN  },
            { icon: "clock",        label: "Tiempo promedio",   value: `${stats?.avgDeliveryTime ?? 0} min`,           color: PURPLE },
          ].map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: card, borderColor: border }]}>
              <View style={[s.statIcon, { backgroundColor: st.color + "18" }]}>
                <Feather name={st.icon as any} size={20} color={st.color} />
              </View>
              <Text style={[s.statVal, { color: text }]}>{st.value}</Text>
              <Text style={[s.statLbl, { color: sub }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Earnings breakdown ── */}
        <View style={[s.breakdownCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: text }]}>Desglose de ganancias</Text>
          {([
            { label: "Hoy",          value: earnings.today, color: BLUE   },
            { label: "Esta semana",  value: earnings.week,  color: GREEN  },
            { label: "Este mes",     value: earnings.month, color: AMBER  },
            { label: "Total",        value: earnings.total, color: PURPLE },
          ] as { label: string; value: number; color: string }[]).map(row => (
            <View key={row.label} style={[s.breakdownRow, { borderBottomColor: border }]}>
              <View style={[s.breakdownDot, { backgroundColor: row.color }]} />
              <Text style={[s.breakdownLabel, { color: text }]}>{row.label}</Text>
              <Text style={[s.breakdownVal, { color: row.color }]}>€{row.value.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* ── Bar chart last 7 days ── */}
        <View style={[s.chartCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: text }]}>Últimos 7 días</Text>
          <View style={s.chartArea}>
            {last7.map((d, i) => {
              const pct = maxBar > 0 ? (d.value / maxBar) * 100 : 0;
              return (
                <View key={i} style={s.barCol}>
                  <Text style={[s.barVal, { color: sub }]}>
                    {d.value > 0 ? `€${d.value.toFixed(0)}` : ""}
                  </Text>
                  <View style={[s.barTrack, { backgroundColor: chipBg }]}>
                    <View style={[s.barFill, { height: `${Math.max(pct, 2)}%` as any, backgroundColor: GREEN }]} />
                  </View>
                  <Text style={[s.barLabel, { color: sub }]}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Payment info ── */}
        <View style={[s.infoCard, { backgroundColor: BLUE + "10", borderColor: BLUE + "30" }]}>
          <Feather name="info" size={16} color={BLUE} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.infoTitle, { color: text }]}>¿Cómo recibes tus pagos?</Text>
            <Text style={[s.infoBody, { color: sub }]}>
              Cuando el cliente confirme la entrega, tus fondos se liberan automáticamente. ComeYa te transfiere vía Bizum o IBAN. Configura tus cuentas en Mi Perfil → Cuentas de pago.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // ── HISTORY MODE ───────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>Historial de ganancias</Text>
        <Text style={[s.subtitle, { color: sub }]}>{deliveries.length} entregas registradas</Text>
      </View>

      {/* KPI strip */}
      <View style={[s.kpiStrip, { backgroundColor: card, borderBottomColor: border }]}>
        {[
          { label: "Total",       value: fmtEur(data?.stats?.totalEarnings ?? 0), color: GREEN  },
          { label: "Este mes",    value: fmtEur(data?.stats?.monthEarnings  ?? 0), color: BLUE   },
          { label: "Esta semana", value: fmtEur(data?.stats?.weekEarnings   ?? 0), color: AMBER  },
          { label: "Entregas",    value: stats?.totalDeliveries ?? 0,              color: PURPLE },
        ].map(k => (
          <View key={k.label} style={s.kpiItem}>
            <Text style={[s.kpiVal, { color: k.color }]}>{k.value}</Text>
            <Text style={[s.kpiLbl, { color: sub }]}>{k.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />}
        showsVerticalScrollIndicator={false}
      >
        {deliveries.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: chipBg }]}>
              <Feather name="inbox" size={36} color={sub} />
            </View>
            <Text style={[s.emptyTitle, { color: text }]}>Sin historial aún</Text>
            <Text style={[s.emptySub, { color: sub }]}>Las entregas completadas aparecerán aquí.</Text>
          </View>
        ) : (
          deliveries.map((dl, i) => {
            const earning = (dl.deliveryEarnings ?? dl.deliveryFee ?? 0) / 100;
            return (
              <View key={dl.id} style={[s.historyRow, { backgroundColor: card, borderColor: border }]}>
                <View style={[s.historyIcon, { backgroundColor: GREEN + "18" }]}>
                  <Feather name="check-circle" size={18} color={GREEN} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.historyBusiness, { color: text }]} numberOfLines={1}>{dl.businessName}</Text>
                  <Text style={[s.historyDate, { color: sub }]}>
                    {fmtDate(dl.deliveredAt ?? dl.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.historyEarning, { color: GREEN }]}>+€{earning.toFixed(2)}</Text>
                  <Text style={[s.historyMethod, { color: sub }]}>
                    {dl.paymentMethod === "cash" ? "Efectivo" : "Digital"}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  title:          { fontSize: 20, fontWeight: "800" },
  subtitle:       { fontSize: 12, marginTop: 2 },
  scrollContent:  { padding: 20, gap: 16, paddingBottom: 40 },
  listContent:    { padding: 20, gap: 10, paddingBottom: 40 },
  heroCard:       { borderRadius: 16, padding: 24, alignItems: "center", gap: 8 },
  heroLabel:      { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  heroAmount:     { fontSize: 44, fontWeight: "900", color: "#fff" },
  heroHint:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroHintTxt:    { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  periodRow:      { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  periodBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  periodTxt:      { fontSize: 11, fontWeight: "700" },
  statsGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard:       { width: "47%", borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center", gap: 6 },
  statIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  statVal:        { fontSize: 22, fontWeight: "800" },
  statLbl:        { fontSize: 11, textAlign: "center" },
  breakdownCard:  { borderRadius: 12, borderWidth: 1, padding: 16 },
  sectionTitle:   { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  breakdownRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  breakdownDot:   { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { flex: 1, fontSize: 13 },
  breakdownVal:   { fontSize: 15, fontWeight: "800" },
  chartCard:      { borderRadius: 12, borderWidth: 1, padding: 16 },
  chartArea:      { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, marginTop: 8 },
  barCol:         { flex: 1, alignItems: "center", height: "100%" as any, gap: 4 },
  barVal:         { fontSize: 9, fontWeight: "600" },
  barTrack:       { flex: 1, width: "100%", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill:        { width: "100%", borderRadius: 4 },
  barLabel:       { fontSize: 9, fontWeight: "600" },
  infoCard:       { flexDirection: "row", alignItems: "flex-start", borderRadius: 12, borderWidth: 1, padding: 14 },
  infoTitle:      { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  infoBody:       { fontSize: 12, lineHeight: 18 },
  kpiStrip:       { flexDirection: "row", borderBottomWidth: 1 },
  kpiItem:        { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
  kpiVal:         { fontSize: 16, fontWeight: "800" },
  kpiLbl:         { fontSize: 10, fontWeight: "600" },
  empty:          { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon:      { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  emptyTitle:     { fontSize: 17, fontWeight: "700" },
  emptySub:       { fontSize: 13, textAlign: "center", maxWidth: 320 },
  historyRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14 },
  historyIcon:    { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  historyBusiness:{ fontSize: 14, fontWeight: "600" },
  historyDate:    { fontSize: 11, marginTop: 2 },
  historyEarning: { fontSize: 15, fontWeight: "800" },
  historyMethod:  { fontSize: 10, marginTop: 2 },
});
