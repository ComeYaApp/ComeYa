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
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { confirm } from "@/hooks/useWebDialog";
import {
  ISSUE_LABELS,
  ISSUE_STATUS_LABELS,
  RESOLUTION_LABELS,
  LIABLE_PARTY_LABELS,
} from "@shared/orderIssues";

const PRIMARY = "#E60000";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Abierta", color: "#EF4444" },
  in_review: { label: "En revisión", color: "#F59E0B" },
  resolved: { label: "Resuelta", color: "#22C55E" },
  rejected: { label: "Denegada", color: "#6B7280" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "#E60000" },
  high: { label: "Alta", color: "#EF4444" },
  medium: { label: "Media", color: "#F59E0B" },
  low: { label: "Baja", color: "#10B981" },
};

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  stripe_card: { label: "Tarjeta Stripe", color: "#635BFF" },
  stripe_bizum: { label: "Bizum Stripe", color: "#00ADEF" },
  paypal: { label: "PayPal", color: "#003087" },
  bizum_manual: { label: "Bizum manual", color: "#00ADEF" },
  sepa: { label: "SEPA", color: "#2E7D32" },
  cash: { label: "Efectivo", color: "#F59E0B" },
};

const fmt = (cents?: number | null) =>
  `${((cents ?? 0) / 100).toFixed(2)} €`;

interface IssueRow {
  id: string;
  orderId: string;
  issueType: string;
  issueLabel: string;
  description: string;
  photos: string[];
  status: string;
  priority: string;
  resolutionType: string | null;
  resolutionAmount: number | null;
  liableParty: string | null;
  createdAt: string;
  customerName: string | null;
  orderTotal: number | null;
  paymentMethod: string | null;
  businessName: string | null;
}

interface IssueDetail {
  issue: IssueRow & {
    customerMessage: string | null;
    internalNote: string | null;
    suggestedLiableParty: string;
  };
  order: any;
  customer: any;
  business: any;
  driver: any;
  messages: any[];
  refunds: any[];
  payment: {
    label: string;
    refundMethod: string;
    automatic: boolean;
    note: string;
  } | null;
  refundableAmount: number;
  customerHistory: {
    issues: any[];
    totalIssues: number;
    totalOrders: number;
    totalRefunded: number;
  };
}

export function IssuesTab() {
  const { isDark } = useTheme();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"open_attention" | "all" | "resolved" | "rejected">(
    "open_attention",
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<IssueRow | null>(null);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
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
      const res = await apiRequest("GET", "/api/admin/issues?limit=100");
      const data = await res.json();
      setIssues(data.issues ?? []);
      setCounts(data.counts ?? {});
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (issue: IssueRow) => {
    setSelected(issue);
    setLoadingDetail(true);
    try {
      const res = await apiRequest("GET", `/api/admin/issues/${issue.id}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      flash(false, "Error al cargar la incidencia");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/admin/issues/${selected.id}/messages`, {
        message: reply.trim(),
      });
      setReply("");
      await openDetail(selected);
      flash(true, "Respuesta enviada al cliente");
    } catch {
      flash(false, "Error al enviar la respuesta");
    } finally {
      setSending(false);
    }
  };

  const takeCase = async () => {
    if (!selected) return;
    try {
      await apiRequest("POST", `/api/admin/issues/${selected.id}/assign`);
      await openDetail(selected);
      load();
      flash(true, "Caso asignado a ti");
    } catch {
      flash(false, "Error al asignar");
    }
  };

  const resolveIssue = async (resolutionType: string, amountCents?: number) => {
    if (!selected || !detail) return;

    if (resolutionType === "refund_full") {
      const ok = await confirm({
        title: "Reembolsar todo",
        message: `Se devolverán ${fmt(detail.refundableAmount)} al cliente por ${
          detail.payment?.automatic
            ? "Stripe (automático, tarda 5-10 días hábiles en verse en su cuenta)"
            : "transferencia manual (quedará pendiente hasta que subas el comprobante)"
        }. El responsable asumirá el coste. ¿Confirmar?`,
        confirmLabel: "Devolver",
        variant: "warning",
      });
      if (!ok) return;
    }

    try {
      const res = await apiRequest("POST", `/api/admin/issues/${selected.id}/resolve`, {
        resolutionType,
        amount: amountCents,
        liableParty: detail.issue.suggestedLiableParty,
        customerMessage: reply.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        setReply("");
        await openDetail(selected);
        load();
        flash(true, data.message || "Incidencia resuelta");
      } else {
        flash(false, data.error || "Error al resolver");
      }
    } catch {
      flash(false, "Error al resolver la incidencia");
    }
  };

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const rejectIssue = async () => {
    if (!selected) return;
    if (!rejectNote.trim()) {
      setRejectError("La nota interna es obligatoria");
      return;
    }
    const ok = await confirm({
      title: "Denegar incidencia",
      message:
        "Vas a denegar esta incidencia sin compensación. El cliente recibirá un aviso con tu respuesta. ¿Confirmar?",
      confirmLabel: "Denegar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await apiRequest("POST", `/api/admin/issues/${selected.id}/reject`, {
        reason: rejectNote.trim(),
        customerMessage: reply.trim() || undefined,
      });
      setReply("");
      setRejectNote("");
      setRejectOpen(false);
      setRejectError(null);
      await openDetail(selected);
      load();
      flash(true, "Incidencia denegada");
    } catch {
      flash(false, "Error al denegar");
    }
  };

  const filtered = issues
    .filter((i) =>
      filter === "open_attention"
        ? i.status === "open" || i.status === "in_review"
        : filter === "all"
          ? true
          : filter === "resolved"
            ? i.status === "resolved"
            : i.status === "rejected",
    )
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        i.orderId?.toLowerCase().includes(q) ||
        i.issueLabel?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.customerName?.toLowerCase().includes(q) ||
        i.businessName?.toLowerCase().includes(q)
      );
    });

  const openCount = (counts.open ?? 0) + (counts.in_review ?? 0);

  const FILTERS = [
    { id: "open_attention", label: `Por atender (${openCount})`, color: "#EF4444" },
    { id: "all", label: `Todas (${counts.total ?? 0})`, color: "#3B82F6" },
    { id: "resolved", label: `Resueltas (${counts.resolved ?? 0})`, color: "#22C55E" },
    { id: "rejected", label: `Denegadas (${counts.rejected ?? 0})`, color: "#6B7280" },
  ] as const;

  // ── Detalle ───────────────────────────────────────────────────────────────
  if (selected && detail) {
    const st = STATUS_META[detail.issue.status] ?? { label: detail.issue.status, color: "#888" };
    const pr = PRIORITY_META[detail.issue.priority] ?? { label: detail.issue.priority, color: "#888" };
    const pay = detail.payment;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 28, maxWidth: 900 }}>
        <TouchableOpacity style={dt.back} onPress={() => { setSelected(null); setDetail(null); }}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[dt.backTxt, { color: text }]}>Volver a incidencias</Text>
        </TouchableOpacity>

        {msg && (
          <View style={[dt.flash, { backgroundColor: msg.ok ? "#22C55E15" : "#EF444415", borderColor: msg.ok ? "#22C55E" : "#EF4444" }]}>
            <Text style={{ color: msg.ok ? "#22C55E" : "#EF4444", fontSize: 13, fontWeight: "600" }}>{msg.text}</Text>
          </View>
        )}

        {/* Cabecera */}
        <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
          <View style={dt.row}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[dt.pill, { backgroundColor: st.color + "20" }]}>
                <Text style={[dt.pillTxt, { color: st.color }]}>{st.label}</Text>
              </View>
              <View style={[dt.pill, { backgroundColor: pr.color + "20" }]}>
                <Text style={[dt.pillTxt, { color: pr.color }]}>{pr.label}</Text>
              </View>
            </View>
            <Text style={[dt.date, { color: sub }]}>
              {new Date(detail.issue.createdAt).toLocaleString("es-ES")}
            </Text>
          </View>

          <Text style={[dt.title, { color: text }]}>{detail.issue.issueLabel}</Text>
          <Text style={[dt.desc, { color: text }]}>{detail.issue.description}</Text>

          {detail.issue.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {detail.issue.photos.map((p, i) => (
                <Image key={i} source={{ uri: p }} style={dt.photo} />
              ))}
            </ScrollView>
          )}

          {/* Contexto del pedido */}
          <View style={[dt.divider, { backgroundColor: border }]} />
          {[
            { icon: "package", label: "Pedido", value: `${displayOrderNumber(detail.order)}` },
            { icon: "user", label: "Cliente", value: detail.customer?.name },
            { icon: "phone", label: "Teléfono", value: detail.customer?.phone },
            { icon: "briefcase", label: "Negocio", value: detail.order?.businessName },
            { icon: "truck", label: "Repartidor", value: detail.driver?.name ?? "Sin asignar" },
            { icon: "credit-card", label: "Cobrado con", value: pay?.label },
            { icon: "tag", label: "Total del pedido", value: fmt(detail.order?.total) },
          ].map((r) =>
            r.value ? (
              <View key={r.label} style={dt.infoRow}>
                <View style={[dt.infoIcon, { backgroundColor: PRIMARY + "15" }]}>
                  <Feather name={r.icon as any} size={13} color={PRIMARY} />
                </View>
                <Text style={[dt.infoLabel, { color: sub }]}>{r.label}</Text>
                <Text style={[dt.infoValue, { color: text }]}>{r.value}</Text>
              </View>
            ) : null,
          )}

          {/* Cómo se devolvería el dinero */}
          {pay && (
            <View
              style={[
                dt.payBox,
                {
                  backgroundColor: isDark ? "#111" : "#f8f8f8",
                  borderColor: pay.automatic ? "#635BFF50" : "#F59E0B50",
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Feather name="info" size={13} color={pay.automatic ? "#635BFF" : "#F59E0B"} />
                <Text style={{ color: text, fontSize: 12, fontWeight: "700" }}>
                  Si compensas: {pay.automatic ? "devolución automática por Stripe" : "transferencia manual"}
                </Text>
              </View>
              <Text style={{ color: sub, fontSize: 12, lineHeight: 16 }}>{pay.note}</Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>
                Máximo aún devoluble: <Text style={{ color: text, fontWeight: "700" }}>{fmt(detail.refundableAmount)}</Text>
              </Text>
            </View>
          )}

          {/* Historial del cliente — señal de abuso */}
          <View style={[dt.divider, { backgroundColor: border }]} />
          <Text style={[dt.sectionTitle, { color: sub }]}>HISTORIAL DEL CLIENTE</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
            {[
              { label: "Pedidos", value: detail.customerHistory.totalOrders },
              { label: "Incidencias", value: detail.customerHistory.totalIssues },
              { label: "Reembolsado", value: fmt(detail.customerHistory.totalRefunded) },
            ].map((s) => (
              <View key={s.label} style={[dt.stat, { backgroundColor: isDark ? "#111" : "#f8f8f8" }]}>
                <Text style={{ color: text, fontSize: 15, fontWeight: "800" }}>{s.value}</Text>
                <Text style={{ color: sub, fontSize: 11 }}>{s.label}</Text>
              </View>
            ))}
          </View>
          {detail.customerHistory.totalIssues > 3 && (
            <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}>
              ⚠️ Cliente con {detail.customerHistory.totalIssues} incidencias — revisa el patrón antes de compensar
            </Text>
          )}
        </View>

        {/* Conversación */}
        <Text style={[dt.h2, { color: text }]}>Conversación con el cliente</Text>
        <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
          {detail.messages.length === 0 ? (
            <Text style={{ color: sub, fontSize: 13 }}>Todavía no hay mensajes.</Text>
          ) : (
            detail.messages.map((m) => (
              <View
                key={m.id}
                style={[
                  dt.bubble,
                  {
                    backgroundColor:
                      m.senderType === "admin" ? (isDark ? "#16323a" : "#e8f4fa") : isDark ? "#222" : "#f4f4f4",
                    alignSelf: m.senderType === "admin" ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <Text style={{ color: sub, fontSize: 10, marginBottom: 2 }}>
                  {m.senderType === "admin" ? "Soporte" : detail.customer?.name ?? "Cliente"} ·{" "}
                  {new Date(m.createdAt).toLocaleString("es-ES")}
                </Text>
                <Text style={{ color: text, fontSize: 13, lineHeight: 18 }}>{m.message}</Text>
              </View>
            ))
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              style={[dt.input, { color: text, backgroundColor: inputBg, borderColor: border }]}
              placeholder="Escribir al cliente (opcional antes de resolver)..."
              placeholderTextColor={sub}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <TouchableOpacity
              style={[dt.btnSend, { backgroundColor: "#3B82F6" }]}
              onPress={sendReply}
              disabled={sending || !reply.trim()}
            >
              <Feather name="send" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Reembolsos ya aplicados al pedido */}
        {detail.refunds.length > 0 && (
          <>
            <Text style={[dt.h2, { color: text }]}>Devoluciones de este pedido</Text>
            <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
              {detail.refunds.map((r) => (
                <View key={r.id} style={[dt.refundRow, { borderColor: border }]}>
                  <Text style={{ color: text, fontSize: 13, fontWeight: "700" }}>{fmt(r.amount)}</Text>
                  <Text style={{ color: sub, fontSize: 12 }}>
                    {r.method === "stripe" ? "Stripe" : r.method === "cash_none" ? "Sin cargo" : "Transferencia"} ·{" "}
                    {r.status === "completed" ? "completada" : r.status === "pending" ? "pendiente" : r.status === "failed" ? "fallida" : r.status}
                  </Text>
                  <Text style={{ color: sub, fontSize: 11 }}>
                    {new Date(r.createdAt).toLocaleDateString("es-ES")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Panel de resolución */}
        {detail.issue.status !== "resolved" && detail.issue.status !== "rejected" ? (
          <>
            <Text style={[dt.h2, { color: text }]}>Resolver incidencia</Text>
            <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
              {detail.issue.status === "open" && (
                <TouchableOpacity style={[dt.btn, { backgroundColor: isDark ? "#222" : "#f0f0f0" }]} onPress={takeCase}>
                  <Feather name="user-check" size={14} color={text} />
                  <Text style={{ color: text, fontWeight: "600", fontSize: 13 }}>Asignarme el caso</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[dt.btn, { backgroundColor: PRIMARY }]} onPress={() => resolveIssue("refund_full")}>
                <Feather name="rotate-ccw" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  Reembolsar todo ({fmt(detail.refundableAmount)})
                </Text>
              </TouchableOpacity>

              <PartialRefundButton
                maxCents={detail.refundableAmount}
                disabled={detail.refundableAmount <= 0}
                onSubmit={(cents) => resolveIssue("refund_partial", cents)}
                colors={{ text, sub, inputBg, border }}
              />

              <TouchableOpacity style={[dt.btn, { backgroundColor: "#3B82F6" }]} onPress={() => resolveIssue("redelivery")}>
                <Feather name="repeat" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Reenviar el pedido</Text>
              </TouchableOpacity>

              {rejectOpen ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={[
                      dt.input,
                      { color: text, backgroundColor: inputBg, borderColor: border },
                    ]}
                    placeholder="Motivo interno de la denegación (obligatorio)..."
                    placeholderTextColor={sub}
                    value={rejectNote}
                    onChangeText={(v) => {
                      setRejectNote(v);
                      setRejectError(null);
                    }}
                    multiline
                    autoFocus
                  />
                  {rejectError && (
                    <Text style={{ color: "#EF4444", fontSize: 12 }}>{rejectError}</Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[dt.btnConfirm, { backgroundColor: "#6B7280" }]}
                      onPress={rejectIssue}
                    >
                      <Feather name="x-circle" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        Confirmar denegación
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dt.btnSend, { backgroundColor: isDark ? "#2a2a2a" : "#e5e5e5" }]}
                      onPress={() => {
                        setRejectOpen(false);
                        setRejectError(null);
                      }}
                    >
                      <Feather name="x" size={14} color={sub} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[dt.btn, { backgroundColor: isDark ? "#2a2a2a" : "#e5e5e5" }]}
                  onPress={() => setRejectOpen(true)}
                >
                  <Feather name="x-circle" size={14} color={sub} />
                  <Text style={{ color: sub, fontWeight: "600", fontSize: 13 }}>
                    Denegar sin compensación
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={{ color: sub, fontSize: 11, marginTop: 6, lineHeight: 15 }}>
                Responsable sugerido: {LIABLE_PARTY_LABELS[detail.issue.suggestedLiableParty ?? "platform"]} — si el payout
                del responsable sigue pendiente, se le descontará automáticamente.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[dt.h2, { color: text }]}>Resolución</Text>
            <View style={[dt.card, { backgroundColor: card, borderColor: border }]}>
              <View style={dt.row}>
                <View style={[dt.pill, { backgroundColor: st.color + "20" }]}>
                  <Text style={[dt.pillTxt, { color: st.color }]}>
                    {RESOLUTION_LABELS[detail.issue.resolutionType ?? ""] ?? st.label}
                  </Text>
                </View>
                {detail.issue.resolutionAmount ? (
                  <Text style={{ color: text, fontWeight: "700" }}>{fmt(detail.issue.resolutionAmount)}</Text>
                ) : null}
              </View>
              {detail.issue.customerMessage ? (
                <Text style={{ color: text, fontSize: 13, marginTop: 8 }}>“{detail.issue.customerMessage}”</Text>
              ) : null}
              {detail.issue.internalNote ? (
                <Text style={{ color: sub, fontSize: 12, marginTop: 8 }}>
                  Nota interna: {detail.issue.internalNote}
                </Text>
              ) : null}
              {detail.issue.liableParty ? (
                <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>
                  Responsable: {LIABLE_PARTY_LABELS[detail.issue.liableParty]}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // ── Cargando detalle ──────────────────────────────────────────────────────
  if (selected && !detail) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={[tb.searchWrap, { backgroundColor: inputBg, borderColor: border }]}>
          <Feather name="search" size={14} color={sub} />
          <TextInput
            style={[tb.searchInput, { color: text }] as any}
            placeholder="Buscar por pedido, cliente, negocio, problema..."
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
        <Text style={[tb.count, { color: sub }]}>{filtered.length} incidencias</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[tb.filterRow, { borderBottomColor: border }]}
        contentContainerStyle={tb.filterContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id as any)}
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
          <Feather name="check-circle" size={40} color={sub} />
          <Text style={{ color: sub, fontSize: 15 }}>Sin incidencias pendientes 🎉</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />
          }
        >
          {filtered.map((issue) => {
            const st = STATUS_META[issue.status] ?? { label: issue.status, color: "#888" };
            const pr = PRIORITY_META[issue.priority] ?? { label: issue.priority, color: "#888" };
            const pay = issue.paymentMethod ? PAYMENT_META[issue.paymentMethod] : null;
            return (
              <TouchableOpacity
                key={issue.id}
                onPress={() => openDetail(issue)}
                style={[li.card, { backgroundColor: card, borderColor: border, borderLeftColor: st.color }]}
              >
                <View style={li.top}>
                  <View style={[li.pill, { backgroundColor: st.color + "18" }]}>
                    <View style={[li.dot, { backgroundColor: st.color }]} />
                    <Text style={[li.pillTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                  {issue.priority !== "medium" && (
                    <View style={[li.pill, { backgroundColor: pr.color + "18" }]}>
                      <Text style={[li.pillTxt, { color: pr.color }]}>{pr.label}</Text>
                    </View>
                  )}
                  <Text style={[li.amount, { color: PRIMARY }]}>{fmt(issue.orderTotal)}</Text>
                </View>
                <Text style={[li.title, { color: text }]} numberOfLines={1}>
                  {issue.issueLabel} — {displayOrderNumber({ id: issue.orderId })}
                </Text>
                <Text style={[li.desc, { color: sub }]} numberOfLines={2}>
                  {issue.description}
                </Text>
                <View style={li.mid}>
                  <Feather name="user" size={12} color={sub} />
                  <Text style={[li.bizName, { color: text }]} numberOfLines={1}>
                    {issue.customerName ?? "Cliente"}
                  </Text>
                  <Feather name="briefcase" size={12} color={sub} style={{ marginLeft: 10 }} />
                  <Text style={[li.bizName, { color: sub }]} numberOfLines={1}>
                    {issue.businessName ?? "—"}
                  </Text>
                  {pay && (
                    <View style={[li.payChip, { backgroundColor: pay.color + "18" }]}>
                      <Text style={{ color: pay.color, fontSize: 10, fontWeight: "700" }}>{pay.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={[li.date, { color: sub }]}>
                  {new Date(issue.createdAt).toLocaleString("es-ES")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// Botón de reembolso parcial con input de importe
function PartialRefundButton({
  maxCents,
  disabled,
  onSubmit,
  colors,
}: {
  maxCents: number;
  disabled: boolean;
  onSubmit: (cents: number) => void;
  colors: { text: string; sub: string; inputBg: string; border: string };
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const euros = parseFloat(value.replace(",", "."));
    if (isNaN(euros) || euros <= 0) {
      setError("Importe inválido");
      return;
    }
    const cents = Math.round(euros * 100);
    if (cents > maxCents) {
      setError(`Máximo ${(maxCents / 100).toFixed(2)} €`);
      return;
    }
    setError(null);
    onSubmit(cents);
    setOpen(false);
    setValue("");
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={[dt.btn, { backgroundColor: "#F59E0B" }]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Feather name="scissors" size={14} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Reembolso parcial...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          style={[dt.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1 }]}
          placeholder={`Importe en € (máx. ${(maxCents / 100).toFixed(2)})`}
          placeholderTextColor={colors.sub}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          autoFocus
        />
        <TouchableOpacity style={[dt.btnSend, { backgroundColor: "#F59E0B" }]} onPress={submit}>
          <Feather name="check" size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[dt.btnSend, { backgroundColor: "#6B7280" }]} onPress={() => setOpen(false)}>
          <Feather name="x" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      {error && <Text style={{ color: "#EF4444", fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

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
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 14, fontWeight: "800", marginLeft: "auto" },
  title: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  desc: { fontSize: 12, marginBottom: 6, lineHeight: 16 },
  mid: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  bizName: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  payChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: "auto" },
  date: { fontSize: 11 },
});

const dt = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  backTxt: { fontSize: 14, fontWeight: "600" },
  flash: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  card: { borderRadius: 16, padding: 24, borderWidth: 1, marginBottom: 20 },
  h2: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillTxt: { fontSize: 12, fontWeight: "700" },
  date: { fontSize: 12 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20 },
  photo: { width: 96, height: 96, borderRadius: 10, marginRight: 8 },
  divider: { height: 1, marginVertical: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoIcon: { width: 26, height: 26, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  infoLabel: { width: 120, fontSize: 12 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: "600" },
  payBox: { borderRadius: 10, padding: 14, borderWidth: 1, marginTop: 8 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 },
  stat: { borderRadius: 10, padding: 10, alignItems: "center", minWidth: 90 },
  bubble: { borderRadius: 12, padding: 10, maxWidth: "80%", marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 40,
  } as any,
  btnSend: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  btnConfirm: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
  },
  refundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, paddingVertical: 8 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12, marginBottom: 8 },
});

export default IssuesTab;
