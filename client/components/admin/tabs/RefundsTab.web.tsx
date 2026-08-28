import React, { useState, useEffect, useCallback } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { confirm } from "@/hooks/useWebDialog";
import {
  REFUND_METHOD_LABELS,
  REFUND_STATUS_LABELS,
  LIABLE_PARTY_LABELS,
} from "@shared/orderIssues";

const PRIMARY = "#DC2626";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B" },
  processing: { label: "Procesando", color: "#3B82F6" },
  completed: { label: "Completada", color: "#22C55E" },
  failed: { label: "Fallida", color: "#EF4444" },
};

const METHOD_META: Record<string, { label: string; color: string; icon: string }> = {
  stripe: { label: "Stripe", color: "#635BFF", icon: "credit-card" },
  manual_transfer: { label: "Transferencia", color: "#F59E0B", icon: "send" },
  cash_none: { label: "Sin cargo", color: "#6B7280", icon: "minus-circle" },
};

const TYPE_LABELS: Record<string, string> = {
  issue: "Incidencia",
  cancellation: "Cancelación",
  dispute: "Disputa",
  manual: "Manual",
};

const fmt = (cents?: number | null) => `${((cents ?? 0) / 100).toFixed(2)} €`;

interface RefundRow {
  id: string;
  orderId: string;
  issueId: string | null;
  amount: number;
  type: string;
  reason: string | null;
  method: string;
  methodLabel: string;
  status: string;
  stripeRefundId: string | null;
  liableParty: string | null;
  businessDeduction: number;
  driverDeduction: number;
  platformCost: number;
  failureReason: string | null;
  proofUrl: string | null;
  notes: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  businessName: string | null;
  orderTotal: number | null;
  paymentMethod: string | null;
}

export function RefundsTab() {
  const { isDark } = useTheme();
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#1a1a1a" : "#fff";

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        apiRequest("GET", "/api/admin/refunds?limit=200"),
        apiRequest("GET", "/api/admin/refunds/summary"),
      ]);
      const [r, s] = await Promise.all([rRes.json(), sRes.json()]);
      setRefunds(r.refunds ?? []);
      setCounts(r.counts ?? {});
      if (s.success) setSummary(s);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async (refund: RefundRow) => {
    const ok = await confirm({
      title: "Marcar como pagada",
      message: `Confirma que has transferido ${fmt(refund.amount)} al cliente del pedido ${displayOrderNumber({ id: refund.orderId })}. Deja una nota con la referencia de la transferencia.`,
      confirmLabel: "Ya está pagada",
      variant: "info",
    });
    if (!ok) return;
    setActing(refund.id);
    try {
      const res = await apiRequest("POST", `/api/admin/refunds/${refund.id}/mark-paid`, {
        notes: proofNote.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        setProofNote("");
        setSelected(null);
        load();
        flash(true, "Devolución marcada como pagada");
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setActing(null);
    }
  };

  const retry = async (refund: RefundRow) => {
    setActing(refund.id);
    try {
      const res = await apiRequest("POST", `/api/admin/refunds/${refund.id}/retry`);
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        load();
        flash(true, data.message ?? "Reintento enviado");
      } else {
        flash(false, data.error ?? "No se pudo reintentar");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setActing(null);
    }
  };

  const filtered = refunds
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.orderId?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    });

  // ── Detalle ───────────────────────────────────────────────────────────────
  if (selected) {
    const st = STATUS_META[selected.status] ?? { label: selected.status, color: "#888" };
    const me = METHOD_META[selected.method] ?? { label: selected.method, color: "#888", icon: "help-circle" };
    return (
      <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 28, maxWidth: 800 }}>
        <TouchableOpacity style={dt.back} onPress={() => setSelected(null)}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[dt.backTxt, { color: text }]}>Volver a devoluciones</Text>
        </TouchableOpacity>

        {msg && (
          <View style={[dt.flash, { backgroundColor: msg.ok ? "#22C55E15" : "#EF444415", borderColor: msg.ok ? "#22C55E" : "#EF4444" }]}>
            <Text style={{ color: msg.ok ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600" }}>{msg.text}</Text>
          </View>
        )}

        <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
          <View style={dt.row}>
            <Text style={[dt.amount, { color: PRIMARY }]}>{fmt(selected.amount)}</Text>
            <View style={[dt.pill, { backgroundColor: st.color + "20" }]}>
              <Text style={[dt.pillTxt, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          {[
            { icon: "package", label: "Pedido", value: `${displayOrderNumber({ id: selected.orderId })}` },
            { icon: "user", label: "Cliente", value: selected.customerName },
            { icon: "phone", label: "Teléfono", value: selected.customerPhone },
            { icon: me.icon as any, label: "Método", value: me.label },
            { icon: "tag", label: "Tipo", value: TYPE_LABELS[selected.type] ?? selected.type },
            { icon: "calendar", label: "Fecha", value: new Date(selected.createdAt).toLocaleString("es-ES") },
            selected.reason ? { icon: "file-text", label: "Motivo", value: selected.reason } : null,
            selected.stripeRefundId ? { icon: "zap", label: "Stripe refund", value: selected.stripeRefundId } : null,
            selected.failureReason ? { icon: "alert-triangle", label: "Error", value: selected.failureReason } : null,
          ]
            .filter(Boolean)
            .map((r: any) => (
              <View key={r.label} style={dt.infoRow}>
                <View style={[dt.infoIcon, { backgroundColor: PRIMARY + "15" }]}>
                  <Feather name={r.icon} size={13} color={PRIMARY} />
                </View>
                <Text style={[dt.infoLabel, { color: sub }]}>{r.label}</Text>
                <Text style={[dt.infoValue, { color: text }]}>{r.value}</Text>
              </View>
            ))}

          {/* Reparto del coste */}
          <View style={[dt.divider, { backgroundColor: border }]} />
          <Text style={[dt.sectionTitle, { color: sub }]}>COSTE ASUMIDO POR</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Negocio", value: selected.businessDeduction },
              { label: "Repartidor", value: selected.driverDeduction },
              { label: "Plataforma", value: selected.platformCost },
            ].map((s) => (
              <View key={s.label} style={[dt.stat, { backgroundColor: isDark ? "#111" : "#f8f8f8" }]}>
                <Text style={{ color: text, fontSize: 15, fontWeight: "800" }}>{fmt(s.value)}</Text>
                <Text style={{ color: sub, fontSize: 11 }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Acciones */}
          {selected.status === "pending" && selected.method === "manual_transfer" && (
            <>
              <View style={[dt.divider, { backgroundColor: border }]} />
              <Text style={{ color: text, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
                Transferencia manual pendiente
              </Text>
              <TextInput
                style={[dt.input, { color: text, backgroundColor: inputBg, borderColor: border }]}
                placeholder="Referencia o nota de la transferencia (opcional)..."
                placeholderTextColor={sub}
                value={proofNote}
                onChangeText={setProofNote}
                multiline
              />
              <TouchableOpacity
                style={[dt.btn, { backgroundColor: "#22C55E", marginTop: 8 }]}
                onPress={() => markPaid(selected)}
                disabled={acting === selected.id}
              >
                {acting === selected.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="check" size={14} color="#fff" />
                )}
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  Ya transferí {fmt(selected.amount)} al cliente
                </Text>
              </TouchableOpacity>
            </>
          )}

          {selected.status === "failed" && (
            <>
              <View style={[dt.divider, { backgroundColor: border }]} />
              <TouchableOpacity
                style={[dt.btn, { backgroundColor: "#3B82F6" }]}
                onPress={() => retry(selected)}
                disabled={acting === selected.id}
              >
                {acting === selected.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="refresh-cw" size={14} color="#fff" />
                )}
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Reintentar devolución</Text>
              </TouchableOpacity>
            </>
          )}

          {selected.notes ? (
            <>
              <View style={[dt.divider, { backgroundColor: border }]} />
              <Text style={{ color: sub, fontSize: 12 }}>Notas: {selected.notes}</Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* KPIs */}
      {summary && (
        <View style={[kp.wrap, { borderBottomColor: border }]}>
          {[
            { label: "Devuelto (mes)", value: fmt(summary.refunded?.month), color: "#22C55E" },
            { label: "Pendiente de transferir", value: fmt(summary.pendingManual?.amount), color: summary.pendingManual?.count > 0 ? "#F59E0B" : "#6B7280", warn: summary.pendingManual?.count },
            { label: "Fallidas", value: fmt(summary.failed?.amount), color: summary.failed?.count > 0 ? "#EF4444" : "#6B7280", warn: summary.failed?.count },
            { label: "Coste plataforma (total)", value: fmt(summary.cost?.platform), color: PRIMARY },
          ].map((k) => (
            <View key={k.label} style={[kp.card, { backgroundColor: card, borderColor: k.color + "40" }]}>
              <Text style={{ color: sub, fontSize: 11, fontWeight: "600" }}>{k.label}</Text>
              <Text style={{ color: k.color, fontSize: 17, fontWeight: "800" }}>{k.value}</Text>
              {k.warn ? (
                <Text style={{ color: k.color, fontSize: 10, fontWeight: "700" }}>{k.warn} caso(s)</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <View style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={[tb.searchWrap, { backgroundColor: inputBg, borderColor: border }]}>
          <Feather name="search" size={14} color={sub} />
          <TextInput
            style={[tb.searchInput, { color: text }] as any}
            placeholder="Buscar por pedido, cliente o motivo..."
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Text style={[tb.count, { color: sub }]}>{filtered.length} devoluciones</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[tb.filterRow, { borderBottomColor: border }]}
        contentContainerStyle={tb.filterContent}
      >
        {[
          { id: "all", label: `Todas (${counts.total ?? 0})`, color: "#3B82F6" },
          { id: "pending", label: `Pendientes (${counts.pending ?? 0})`, color: "#F59E0B" },
          { id: "processing", label: `Procesando (${counts.processing ?? 0})`, color: "#3B82F6" },
          { id: "completed", label: `Completadas (${counts.completed ?? 0})`, color: "#22C55E" },
          { id: "failed", label: `Fallidas (${counts.failed ?? 0})`, color: "#EF4444" },
        ].map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[tb.chip, { backgroundColor: active ? f.color : inputBg, borderColor: active ? f.color : border }]}
            >
              <Text style={[tb.chipTxt, { color: active ? "#fff" : text }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}>
          <Feather name="credit-card" size={40} color={sub} />
          <Text style={{ color: sub, fontSize: 15 }}>Sin devoluciones registradas</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />
          }
        >
          {filtered.map((r) => {
            const st = STATUS_META[r.status] ?? { label: r.status, color: "#888" };
            const me = METHOD_META[r.method] ?? { label: r.methodLabel, color: "#888", icon: "help-circle" };
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setSelected(r)}
                style={[li.card, { backgroundColor: card, borderColor: border, borderLeftColor: me.color }]}
              >
                <View style={li.top}>
                  <Text style={[li.amount, { color: PRIMARY }]}>{fmt(r.amount)}</Text>
                  <View style={[li.pill, { backgroundColor: st.color + "18" }]}>
                    <View style={[li.dot, { backgroundColor: st.color }]} />
                    <Text style={[li.pillTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={[li.date, { color: sub }]}>
                    {new Date(r.createdAt).toLocaleDateString("es-ES")}
                  </Text>
                </View>
                <View style={li.mid}>
                  <Feather name={me.icon as any} size={12} color={me.color} />
                  <Text style={[li.bizName, { color: me.color, fontWeight: "700" }]}>{me.label}</Text>
                  <Text style={{ color: sub, fontSize: 11 }}>·</Text>
                  <Text style={[li.bizName, { color: sub }]}>{TYPE_LABELS[r.type] ?? r.type}</Text>
                  <Text style={{ color: sub, fontSize: 11 }}>·</Text>
                  <Text style={[li.bizName, { color: sub }]} numberOfLines={1}>
                    #{r.orderId?.slice(-6).toUpperCase()}
                  </Text>
                </View>
                <Text style={[li.desc, { color: text }]} numberOfLines={1}>
                  {r.customerName ?? "Cliente"} — {r.reason ?? "Sin motivo"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const kp = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  card: { flex: 1, minWidth: 160, borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
});

const tb = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
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
  searchInput: { flex: 1, fontSize: 13 } as any,
  count: { fontSize: 12, fontWeight: "600" },
  filterRow: { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  chipTxt: { fontSize: 12, fontWeight: "600" },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  amount: { fontSize: 15, fontWeight: "800", marginRight: "auto" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 11, marginLeft: "auto" },
  mid: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  bizName: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  desc: { fontSize: 12 },
});

const dt = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  backTxt: { fontSize: 14, fontWeight: "600" },
  flash: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  card: { borderRadius: 16, padding: 24, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  amount: { fontSize: 24, fontWeight: "800" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillTxt: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, marginVertical: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoIcon: { width: 26, height: 26, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  infoLabel: { width: 110, fontSize: 12 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 },
  stat: { borderRadius: 10, padding: 10, alignItems: "center", minWidth: 90 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 40,
  } as any,
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12 },
});

export default RefundsTab;
