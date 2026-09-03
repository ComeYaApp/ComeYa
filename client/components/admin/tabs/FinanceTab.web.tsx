import React, { useState, useEffect, useCallback } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
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

const PRIMARY = "#E60000";

export const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  bizum: { label: "Bizum", color: "#00ADEF" },
  transferencia: { label: "Transferencia IBAN", color: "#2E7D32" },
  paypal: { label: "PayPal", color: "#003087" },
  stripe_card: { label: "Tarjeta Stripe", color: "#635BFF" },
  stripe_bizum: { label: "Bizum Stripe", color: "#00ADEF" },
  cash: { label: "Efectivo", color: "#F59E0B" },
};

const fmt = (cents: number) => {
  if (cents >= 100_000) return `${(cents / 100 / 1_000).toFixed(1)} €K`;
  return `${(cents / 100).toFixed(2)} €`;
};

interface Payout {
  id: string;
  orderId: string;
  recipientId: string;
  recipientType: "business" | "driver";
  amount: number;
  method: string | null;
  accountSnapshot: string | null;
  status: "pending" | "paid";
  paidBy: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  recipientName?: string;
  paymentAccounts?: any[];
  businessName?: string | null;
}

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
  defaultTab?: "earnings" | "payouts";
}

export const FinanceTab: React.FC<Props> = ({ defaultTab = "payouts" }) => {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<"earnings" | "payouts" | "history">(
    defaultTab === "earnings" ? "earnings" : "payouts",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Payout[]>([]);
  const [paid, setPaid] = useState<Payout[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [selected, setSelected] = useState<Payout | null>(null);
  const [payMethod, setPayMethod] = useState("bizum");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const load = useCallback(async () => {
    try {
      const [pRes, hRes, eRes] = await Promise.all([
        apiRequest("GET", "/api/admin/finance/payouts/pending"),
        apiRequest("GET", "/api/admin/finance/payouts/history"),
        apiRequest("GET", "/api/admin/finance/platform-earnings?period=month"),
      ]);
      const [p, h, e] = await Promise.all([
        pRes.json(),
        hRes.json(),
        eRes.json(),
      ]);
      if (p.success) setPending(p.payouts ?? []);
      if (h.success) setPaid(h.payouts ?? []);
      if (e.success) setEarnings(e);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3000);
  };

  const markPaid = async (payout: Payout) => {
    setProcessing(payout.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/finance/payouts/${payout.id}/mark-paid`,
        {
          method: payMethod,
          notes: notes || undefined,
        },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "✅ Pago registrado. Notificación enviada.");
        setPending((prev) => prev.filter((p) => p.id !== payout.id));
        setSelected(null);
        setNotes("");
        setPayMethod("bizum");
        load();
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  const TABS = [
    {
      id: "earnings",
      label: "Ganancias",
      icon: "trending-up",
      color: "#10B981",
    },
    {
      id: "payouts",
      label: `Payouts pendientes (${pending.length})`,
      icon: "send",
      color: "#F59E0B",
    },
    {
      id: "history",
      label: `Historial pagados (${paid.length})`,
      icon: "check-circle",
      color: "#3B82F6",
    },
  ] as const;

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
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Tab bar */}
      <View
        style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => {
              setTab(t.id);
              setSelected(null);
            }}
            style={[
              tb.tab,
              tab === t.id && {
                borderBottomWidth: 2,
                borderBottomColor: t.color,
              },
            ]}
          >
            <Feather
              name={t.icon as any}
              size={13}
              color={tab === t.id ? t.color : sub}
            />
            <Text style={[tb.tabTxt, { color: tab === t.id ? t.color : sub }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          <Text style={[tb.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}>
            {msg.text}
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 10 }}
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
        {/* ── GANANCIAS ── */}
        {tab === "earnings" && (
          <>
            {/* KPI grid */}
            <View style={ea.grid}>
              {[
                {
                  label: "Hoy",
                  value: fmt(earnings?.earnings?.today ?? 0),
                  color: PRIMARY,
                },
                {
                  label: "Semana",
                  value: fmt(earnings?.earnings?.week ?? 0),
                  color: "#10B981",
                },
                {
                  label: "Mes",
                  value: fmt(earnings?.earnings?.month ?? 0),
                  color: "#3B82F6",
                },
                {
                  label: "Total",
                  value: fmt(earnings?.earnings?.total ?? 0),
                  color: "#8B5CF6",
                },
              ].map((k) => (
                <View
                  key={k.label}
                  style={[
                    ea.kpiCard,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Text style={[ea.kpiVal, { color: k.color }]}>{k.value}</Text>
                  <Text style={[ea.kpiLbl, { color: sub }]}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Stats */}
            <View
              style={[
                ea.section,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              <Text style={[ea.sectionTitle, { color: sub }]}>
                ESTADÍSTICAS
              </Text>
              {[
                {
                  label: "Pedidos entregados",
                  value: earnings?.stats?.totalOrders ?? 0,
                  color: "#3B82F6",
                },
                {
                  label: "Comisión media/pedido",
                  value: fmt(earnings?.stats?.avgCommissionPerOrder ?? 0),
                  color: "#10B981",
                },
                {
                  label: "Tasa de conversión",
                  value: `${earnings?.stats?.conversionRate ?? "0.0"}%`,
                  color: "#F59E0B",
                },
                {
                  label: "Payouts pendientes",
                  value: pending.length,
                  color: "#EF4444",
                },
                {
                  label: "Monto pendiente",
                  value: fmt(pending.reduce((s, p) => s + p.amount, 0)),
                  color: "#F97316",
                },
              ].map((r) => (
                <View key={r.label} style={ea.statRow}>
                  <Text style={[ea.statLbl, { color: sub }]}>{r.label}</Text>
                  <Text style={[ea.statVal, { color: r.color }]}>
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Breakdown */}
            {earnings?.breakdown && (
              <View
                style={[
                  ea.section,
                  { backgroundColor: card, borderColor: border },
                ]}
              >
                <Text style={[ea.sectionTitle, { color: sub }]}>DESGLOSE</Text>
                {[
                  {
                    label: "Markup productos",
                    value: fmt(earnings.breakdown.productMarkup ?? 0),
                    color: "#10B981",
                  },
                  {
                    label: "Penalizaciones",
                    value: fmt(earnings.breakdown.penalties ?? 0),
                    color: "#F59E0B",
                  },
                  {
                    label: "Cupones aplicados",
                    value: fmt(
                      Math.abs(earnings.breakdown.couponsApplied ?? 0),
                    ),
                    color: "#EF4444",
                  },
                  {
                    label: "Neto total",
                    value: fmt(earnings.breakdown.netTotal ?? 0),
                    color: PRIMARY,
                  },
                ].map((r) => (
                  <View key={r.label} style={ea.statRow}>
                    <Text style={[ea.statLbl, { color: sub }]}>{r.label}</Text>
                    <Text
                      style={[
                        ea.statVal,
                        { color: r.color, fontWeight: "800" },
                      ]}
                    >
                      {r.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={[
                ea.infoBanner,
                { backgroundColor: "#3B82F610", borderColor: "#3B82F630" },
              ]}
            >
              <Feather name="info" size={13} color="#3B82F6" />
              <Text style={[ea.infoTxt, { color: "#3B82F6" }]}>
                Las ganancias son el 15% de markup sobre el precio base de los
                productos. Los pagos a negocios y repartidores se gestionan en
                la pestaña Payouts.
              </Text>
            </View>
          </>
        )}

        {/* ── PAYOUTS PENDIENTES ── */}
        {tab === "payouts" &&
          (pending.length === 0 ? (
            <View
              style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}
            >
              <View
                style={[
                  {
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "#10B98115",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Feather name="check-circle" size={28} color="#10B981" />
              </View>
              <Text style={[{ fontSize: 16, fontWeight: "700", color: text }]}>
                Sin payouts pendientes
              </Text>
              <Text style={[{ fontSize: 13, color: sub, textAlign: "center" }]}>
                Los payouts se generan automáticamente cuando el cliente
                confirma la entrega
              </Text>
            </View>
          ) : (
            pending.map((p) => {
              const isSelected = selected?.id === p.id;
              const typeColor =
                p.recipientType === "business" ? "#3B82F6" : "#10B981";
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelected(isSelected ? null : p)}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? typeColor : border,
                      borderLeftColor: typeColor,
                    },
                  ]}
                >
                  <View style={li.row}>
                    <View
                      style={[
                        li.typePill,
                        { backgroundColor: typeColor + "18" },
                      ]}
                    >
                      <Feather
                        name={
                          p.recipientType === "business" ? "briefcase" : "truck"
                        }
                        size={12}
                        color={typeColor}
                      />
                      <Text style={[li.typeTxt, { color: typeColor }]}>
                        {p.recipientType === "business"
                          ? "Negocio"
                          : "Repartidor"}
                      </Text>
                    </View>
                    <Text style={[li.amount, { color: "#10B981" }]}>
                      {fmt(p.amount)}
                    </Text>
                  </View>
                  <Text style={[li.name, { color: text }]}>
                    {p.recipientName ?? "—"}
                  </Text>
                  {p.businessName && p.recipientType === "driver" && (
                    <Text style={[li.sub, { color: sub }]}>
                      Negocio: {p.businessName}
                    </Text>
                  )}
                  <Text style={[li.sub, { color: sub }]}>
                    Pedido {displayOrderNumber({ id: p.orderId })} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString("es-ES")}
                  </Text>
                  <View style={li.hint}>
                    <Feather
                      name={isSelected ? "chevron-up" : "chevron-down"}
                      size={13}
                      color={typeColor}
                    />
                    <Text style={[li.hintTxt, { color: typeColor }]}>
                      {isSelected ? "Cerrar" : "Registrar pago"}
                    </Text>
                  </View>

                  {/* Inline payment form */}
                  {isSelected && (
                    <View style={[li.payForm, { borderTopColor: border }]}>
                      {/* Cuentas del recipiente */}
                      {(p.paymentAccounts ?? []).length > 0 && (
                        <View
                          style={[
                            li.accountsBox,
                            {
                              backgroundColor: isDark ? "#222" : "#f8f8f8",
                              borderColor: border,
                            },
                          ]}
                        >
                          <Text style={[li.accountsTitle, { color: sub }]}>
                            CUENTAS REGISTRADAS
                          </Text>
                          {(p.paymentAccounts ?? []).map((acc: any) => {
                            const m = METHOD_LABELS[acc.method];
                            return (
                              <View key={acc.id} style={li.accountRow}>
                                <View
                                  style={[
                                    li.methodDot,
                                    { backgroundColor: m?.color ?? "#888" },
                                  ]}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[li.accountMethod, { color: text }]}
                                  >
                                    {m?.label ?? acc.method}
                                    {acc.isDefault ? " ✓" : ""}
                                  </Text>
                                  {acc.pagoMovilPhone && (
                                    <Text
                                      style={[li.accountDetail, { color: sub }]}
                                    >
                                      Bizum: {acc.pagoMovilPhone}
                                    </Text>
                                  )}
                                  {acc.binanceId && (
                                    <Text
                                      style={[li.accountDetail, { color: sub }]}
                                    >
                                      IBAN: {acc.binanceId}
                                    </Text>
                                  )}
                                  {acc.zelleEmail && (
                                    <Text
                                      style={[li.accountDetail, { color: sub }]}
                                    >
                                      PayPal: {acc.zelleEmail}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Método */}
                      <Text style={[li.formLabel, { color: sub }]}>
                        MÉTODO UTILIZADO
                      </Text>
                      <View style={li.methodRow}>
                        {[
                          { id: "bizum", label: "Bizum", color: "#00ADEF" },
                          {
                            id: "transferencia",
                            label: "IBAN",
                            color: "#2E7D32",
                          },
                          { id: "paypal", label: "PayPal", color: "#003087" },
                        ].map((m) => (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => setPayMethod(m.id)}
                            style={[
                              li.methodChip,
                              {
                                backgroundColor:
                                  payMethod === m.id ? m.color : inputBg,
                                borderColor:
                                  payMethod === m.id ? m.color : border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                li.methodChipTxt,
                                { color: payMethod === m.id ? "#fff" : text },
                              ]}
                            >
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Nota */}
                      <Text style={[li.formLabel, { color: sub }]}>
                        REFERENCIA / NOTA
                      </Text>
                      <TextInput
                        style={[
                          li.noteInput,
                          {
                            backgroundColor: inputBg,
                            borderColor: border,
                            color: text,
                          },
                        ]}
                        placeholder="Ej: Bizum ref. 123456 (opcional)"
                        placeholderTextColor={sub}
                        value={notes}
                        onChangeText={setNotes}
                      />

                      <TouchableOpacity
                        onPress={() => markPaid(p)}
                        disabled={processing === p.id}
                        style={[
                          li.confirmBtn,
                          {
                            backgroundColor:
                              processing === p.id ? sub : "#10B981",
                          },
                        ]}
                      >
                        {processing === p.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather
                              name="check-circle"
                              size={15}
                              color="#fff"
                            />
                            <Text style={li.confirmTxt}>
                              Confirmar pago realizado
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ))}

        {/* ── HISTORIAL ── */}
        {tab === "history" &&
          (paid.length === 0 ? (
            <View
              style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}
            >
              <Feather name="clock" size={40} color={sub} />
              <Text style={{ color: sub, fontSize: 15 }}>
                Sin historial de pagos
              </Text>
            </View>
          ) : (
            paid.map((p) => {
              const typeColor =
                p.recipientType === "business" ? "#3B82F6" : "#10B981";
              const m = p.method ? METHOD_LABELS[p.method] : null;
              return (
                <View
                  key={p.id}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: border,
                      borderLeftColor: typeColor,
                    },
                  ]}
                >
                  <View style={li.row}>
                    <View
                      style={[
                        li.typePill,
                        { backgroundColor: typeColor + "18" },
                      ]}
                    >
                      <Feather
                        name={
                          p.recipientType === "business" ? "briefcase" : "truck"
                        }
                        size={12}
                        color={typeColor}
                      />
                      <Text style={[li.typeTxt, { color: typeColor }]}>
                        {p.recipientType === "business"
                          ? "Negocio"
                          : "Repartidor"}
                      </Text>
                    </View>
                    <Text style={[li.amount, { color: "#10B981" }]}>
                      {fmt(p.amount)}
                    </Text>
                  </View>
                  <Text style={[li.name, { color: text }]}>
                    {p.recipientName ?? "—"}
                  </Text>
                  <Text style={[li.sub, { color: sub }]}>
                    Pedido {displayOrderNumber({ id: p.orderId })}
                  </Text>
                  {m && (
                    <View
                      style={[li.paidTag, { backgroundColor: m.color + "15" }]}
                    >
                      <Feather name="check" size={11} color={m.color} />
                      <Text style={[li.paidTagTxt, { color: m.color }]}>
                        Pagado via {m.label}
                      </Text>
                      {p.paidAt && (
                        <Text style={[li.paidTagTxt, { color: sub }]}>
                          · {new Date(p.paidAt).toLocaleDateString("es-ES")}
                        </Text>
                      )}
                    </View>
                  )}
                  {p.notes && (
                    <Text style={[li.sub, { color: sub, fontStyle: "italic" }]}>
                      "{p.notes}"
                    </Text>
                  )}
                </View>
              );
            })
          ))}
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  bar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
  },
  tabTxt: { fontSize: 12, fontWeight: "600" },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  msgTxt: { fontSize: 12, fontWeight: "600" },
});

const ea = StyleSheet.create({
  grid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpiCard: {
    flex: 1,
    minWidth: 120,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  kpiVal: { fontSize: 22, fontWeight: "800" },
  kpiLbl: { fontSize: 11, fontWeight: "600" },
  section: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  statLbl: { fontSize: 13 },
  statVal: { fontSize: 14, fontWeight: "700" },
  infoBanner: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  infoTxt: { flex: 1, fontSize: 12, lineHeight: 18 },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeTxt: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 18, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  sub: { fontSize: 12, marginBottom: 1 },
  hint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  hintTxt: { fontSize: 12, fontWeight: "600" },
  payForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 10 },
  accountsBox: { borderRadius: 10, padding: 12, borderWidth: 1, gap: 8 },
  accountsTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  accountRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  methodDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  accountMethod: { fontSize: 12, fontWeight: "700" },
  accountDetail: { fontSize: 11, marginTop: 1 },
  formLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  methodChipTxt: { fontSize: 12, fontWeight: "700" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  confirmTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  paidTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  paidTagTxt: { fontSize: 11, fontWeight: "600" },
});
