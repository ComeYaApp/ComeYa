import React, { useState, useEffect, useCallback } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import {
  View,
  ActivityIndicator,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { ISSUE_LABELS, REFUND_METHOD_LABELS } from "@shared/orderIssues";

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
  createdAt: string;
  customerName: string | null;
  orderTotal: number | null;
  paymentMethod: string | null;
  businessName: string | null;
}

interface IssueDetail {
  issue: IssueRow & {
    customerMessage?: string | null;
    internalNote?: string | null;
    suggestedLiableParty?: string;
  };
  order: any;
  customer: any;
  business: any;
  driver: any;
  messages: any[];
  refunds: any[];
  payment: { label: string; refundMethod: string; automatic: boolean; note: string } | null;
  refundableAmount: number;
  customerHistory: {
    issues: any[];
    totalIssues: number;
    totalOrders: number;
    totalRefunded: number;
  };
}

interface TabProps {
  theme: any;
  showToast: (message: string, type: "success" | "error") => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Abierta", color: "#EF4444" },
  in_review: { label: "En revisión", color: "#F59E0B" },
  resolved: { label: "Resuelta", color: "#22C55E" },
  rejected: { label: "Denegada", color: "#9E9E9E" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "URGENTE", color: "#E60000" },
  high: { label: "ALTA", color: "#EF4444" },
  medium: { label: "Media", color: "#F59E0B" },
  low: { label: "Baja", color: "#10B981" },
};

const fmt = (cents?: number | null) => `${((cents ?? 0) / 100).toFixed(2)} €`;

export function IssuesTab({ theme, showToast }: TabProps) {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"open_attention" | "all" | "resolved" | "rejected">(
    "open_attention",
  );
  const [selected, setSelected] = useState<IssueRow | null>(null);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/issues?limit=100");
      const data = await res.json();
      setIssues(data.issues ?? []);
      setCounts(data.counts ?? {});
    } catch {
      showToast("Error al cargar incidencias", "error");
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
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await apiRequest("GET", `/api/admin/issues/${issue.id}`);
      const data = await res.json();
      if (data.success) setDetail(data);
      else showToast("Error al cargar la incidencia", "error");
    } catch {
      showToast("Error de conexión", "error");
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
      showToast("Respuesta enviada al cliente", "success");
    } catch {
      showToast("Error al enviar", "error");
    } finally {
      setSending(false);
    }
  };

  const assign = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await apiRequest("POST", `/api/admin/issues/${selected.id}/assign`);
      await openDetail(selected);
      load();
      showToast("Caso asignado", "success");
    } catch {
      showToast("Error al asignar", "error");
    } finally {
      setActing(false);
    }
  };

  const resolve = async (resolutionType: string, amountCents?: number) => {
    if (!selected || !detail) return;
    setActing(true);
    try {
      const res = await apiRequest("POST", `/api/admin/issues/${selected.id}/resolve`, {
        resolutionType,
        amount: amountCents,
        customerMessage: reply.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        setReply("");
        setPartialOpen(false);
        setPartialAmount("");
        await openDetail(selected);
        load();
        showToast(data.message || "Incidencia resuelta", "success");
      } else {
        showToast(data.error || "Error al resolver", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setActing(false);
    }
  };

  const resolvePartial = () => {
    const euros = parseFloat(partialAmount.replace(",", "."));
    if (isNaN(euros) || euros <= 0) {
      showToast("Importe inválido", "error");
      return;
    }
    const cents = Math.round(euros * 100);
    if (detail && cents > detail.refundableAmount) {
      showToast(`Máximo ${fmt(detail.refundableAmount)}`, "error");
      return;
    }
    resolve("refund_partial", cents);
  };

  const reject = async () => {
    if (!selected) return;
    if (!rejectNote.trim()) {
      showToast("Escribe el motivo de la denegación", "error");
      return;
    }
    setActing(true);
    try {
      await apiRequest("POST", `/api/admin/issues/${selected.id}/reject`, {
        reason: rejectNote.trim(),
        customerMessage: reply.trim() || undefined,
      });
      setRejectNote("");
      setRejectOpen(false);
      setReply("");
      await openDetail(selected);
      load();
      showToast("Incidencia denegada", "success");
    } catch {
      showToast("Error al denegar", "error");
    } finally {
      setActing(false);
    }
  };

  const openCount = (counts.open ?? 0) + (counts.in_review ?? 0);

  const filtered = issues.filter((i) =>
    filter === "open_attention"
      ? i.status === "open" || i.status === "in_review"
      : filter === "all"
        ? true
        : filter === "resolved"
          ? i.status === "resolved"
          : i.status === "rejected",
  );

  // ── Detalle ────────────────────────────────────────────────────────────────
  if (selected) {
    const st = detail
      ? STATUS_META[detail.issue.status] ?? { label: detail.issue.status, color: "#888" }
      : null;

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cabecera */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Pressable
              onPress={() => {
                setSelected(null);
                setDetail(null);
              }}
              style={{ marginRight: 12 }}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3" style={{ flex: 1 }}>
              Incidencia
            </ThemedText>
            {st && (
              <View
                style={{
                  backgroundColor: st.color + "20",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <ThemedText
                  type="caption"
                  style={{ color: st.color, fontWeight: "700" }}
                >
                  {st.label}
                </ThemedText>
              </View>
            )}
          </View>

          {loadingDetail ? (
            <View style={{ padding: 60 }}>
              <ActivityIndicator size="large" color={ComeYaColors.primary} />
            </View>
          ) : detail ? (
            <>
              {/* Descripción y fotos */}
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: Spacing.md,
                  marginBottom: 12,
                }}
              >
                <ThemedText type="h3">{detail.issue.issueLabel}</ThemedText>
                <ThemedText
                  type="body"
                  style={{ marginTop: 6, color: theme.textSecondary }}
                >
                  {detail.issue.description}
                </ThemedText>

                {detail.issue.photos?.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                  >
                    {detail.issue.photos.map((p: string, i: number) => (
                      <Image
                        key={i}
                        source={{ uri: p }}
                        style={{
                          width: 110,
                          height: 110,
                          borderRadius: 10,
                          marginRight: 8,
                        }}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Contexto */}
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: Spacing.md,
                  marginBottom: 12,
                }}
              >
                {[
                  { icon: "package", label: "Pedido", value: `${displayOrderNumber(detail.order)}` },
                  { icon: "user", label: "Cliente", value: detail.customer?.name },
                  { icon: "phone", label: "Teléfono", value: detail.customer?.phone },
                  { icon: "briefcase", label: "Negocio", value: detail.order?.businessName },
                  { icon: "truck", label: "Repartidor", value: detail.driver?.name ?? "Sin asignar" },
                  { icon: "credit-card", label: "Cobrado con", value: detail.payment?.label },
                  { icon: "tag", label: "Total pedido", value: fmt(detail.order?.total) },
                  { icon: "calendar", label: "Reportado", value: new Date(detail.issue.createdAt).toLocaleString("es-ES") },
                ]
                  .filter((r) => r.value)
                  .map((r) => (
                    <View
                      key={r.label}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <Feather name={r.icon as any} size={14} color={ComeYaColors.primary} />
                      <ThemedText
                        type="caption"
                        style={{ width: 100, marginLeft: 8, color: theme.textSecondary }}
                      >
                        {r.label}
                      </ThemedText>
                      <ThemedText type="body" style={{ flex: 1, fontWeight: "600" }}>
                        {r.value}
                      </ThemedText>
                    </View>
                  ))}

                {detail.payment && (
                  <View
                    style={{
                      backgroundColor: detail.payment.automatic ? "#635BFF15" : "#F59E0B15",
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 4,
                    }}
                  >
                    <ThemedText type="caption" style={{ fontWeight: "700" }}>
                      {detail.payment.automatic
                        ? "Reembolso automático por Stripe"
                        : "Requiere transferencia manual"}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      {detail.payment.note}
                    </ThemedText>
                    <ThemedText type="caption" style={{ marginTop: 4, fontWeight: "600" }}>
                      Máximo devoluble: {fmt(detail.refundableAmount)}
                    </ThemedText>
                  </View>
                )}

                {/* Historial del cliente */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  {[
                    { label: "Pedidos", value: String(detail.customerHistory.totalOrders) },
                    { label: "Incidencias", value: String(detail.customerHistory.totalIssues) },
                    { label: "Reembolsado", value: fmt(detail.customerHistory.totalRefunded) },
                  ].map((s) => (
                    <View
                      key={s.label}
                      style={{
                        flex: 1,
                        backgroundColor: theme.background,
                        borderRadius: 10,
                        padding: 8,
                        alignItems: "center",
                      }}
                    >
                      <ThemedText type="body" style={{ fontWeight: "800" }}>
                        {s.value}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {s.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                {detail.customerHistory.totalIssues > 3 && (
                  <ThemedText
                    type="caption"
                    style={{ color: "#F59E0B", marginTop: 6, fontWeight: "600" }}
                  >
                    ⚠️ Cliente con {detail.customerHistory.totalIssues} incidencias — revisa el
                    patrón antes de compensar
                  </ThemedText>
                )}
              </View>

              {/* Reembolsos previos del pedido */}
              {detail.refunds.length > 0 && (
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    padding: Spacing.md,
                    marginBottom: 12,
                  }}
                >
                  <ThemedText type="h4" style={{ marginBottom: 6 }}>
                    Devoluciones de este pedido
                  </ThemedText>
                  {detail.refunds.map((r: any) => (
                    <View
                      key={r.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                      }}
                    >
                      <ThemedText type="body" style={{ fontWeight: "700" }}>
                        {fmt(r.amount)}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {REFUND_METHOD_LABELS[r.method] ?? r.method} · {r.status}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Conversación */}
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: Spacing.md,
                  marginBottom: 12,
                }}
              >
                <ThemedText type="h4" style={{ marginBottom: 8 }}>
                  Conversación con el cliente
                </ThemedText>
                {detail.messages.length === 0 && (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Sin mensajes todavía.
                  </ThemedText>
                )}
                {detail.messages.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      backgroundColor:
                        m.senderType === "admin" ? "#635BFF15" : theme.background,
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 6,
                      alignSelf: m.senderType === "admin" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                    }}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginBottom: 2 }}
                    >
                      {m.senderType === "admin" ? "Soporte" : detail.customer?.name ?? "Cliente"}
                    </ThemedText>
                    <ThemedText type="body">{m.message}</ThemedText>
                  </View>
                ))}
                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: theme.background,
                      color: theme.text,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Escribir al cliente..."
                    placeholderTextColor={theme.textSecondary}
                    value={reply}
                    onChangeText={setReply}
                    multiline
                  />
                  <Pressable
                    onPress={sendReply}
                    disabled={sending || !reply.trim()}
                    style={{
                      backgroundColor: "#3B82F6",
                      borderRadius: 10,
                      marginLeft: 8,
                      width: 42,
                      justifyContent: "center",
                      alignItems: "center",
                      opacity: sending || !reply.trim() ? 0.5 : 1,
                    }}
                  >
                    <Feather name="send" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>

              {/* Resolución o resolución aplicada */}
              {detail.issue.status !== "resolved" && detail.issue.status !== "rejected" ? (
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    padding: Spacing.md,
                  }}
                >
                  <ThemedText type="h4" style={{ marginBottom: 10 }}>
                    Resolver incidencia
                  </ThemedText>

                  {detail.issue.status === "open" && (
                    <Pressable
                      onPress={assign}
                      disabled={acting}
                      style={{
                        backgroundColor: theme.background,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="user-check" size={15} color={theme.text} />
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        Asignarme el caso
                      </ThemedText>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => resolve("refund_full")}
                    disabled={acting || detail.refundableAmount <= 0}
                    style={{
                      backgroundColor: ComeYaColors.primary,
                      borderRadius: 10,
                      padding: 13,
                      marginBottom: 8,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 8,
                      opacity: acting || detail.refundableAmount <= 0 ? 0.6 : 1,
                    }}
                  >
                    {acting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="rotate-ccw" size={15} color="#fff" />
                    )}
                    <ThemedText
                      type="body"
                      style={{ color: "#fff", fontWeight: "700" }}
                    >
                      Reembolsar todo ({fmt(detail.refundableAmount)})
                    </ThemedText>
                  </Pressable>

                  {partialOpen ? (
                    <View style={{ marginBottom: 8 }}>
                      <TextInput
                        style={{
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          fontSize: 15,
                        }}
                        placeholder={`Importe en € (máx. ${(detail.refundableAmount / 100).toFixed(2)})`}
                        placeholderTextColor={theme.textSecondary}
                        value={partialAmount}
                        onChangeText={setPartialAmount}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <View style={{ flexDirection: "row", marginTop: 8 }}>
                        <Pressable
                          onPress={resolvePartial}
                          disabled={acting}
                          style={{
                            flex: 1,
                            backgroundColor: "#F59E0B",
                            borderRadius: 10,
                            padding: 12,
                            marginRight: 8,
                            alignItems: "center",
                          }}
                        >
                          <ThemedText style={{ color: "#fff", fontWeight: "700" }}>
                            Confirmar parcial
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => setPartialOpen(false)}
                          style={{
                            width: 46,
                            backgroundColor: theme.background,
                            borderRadius: 10,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Feather name="x" size={18} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setPartialOpen(true)}
                      disabled={acting || detail.refundableAmount <= 0}
                      style={{
                        backgroundColor: "#F59E0B",
                        borderRadius: 10,
                        padding: 13,
                        marginBottom: 8,
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                        opacity: acting || detail.refundableAmount <= 0 ? 0.6 : 1,
                      }}
                    >
                      <Feather name="scissors" size={15} color="#fff" />
                      <ThemedText
                        type="body"
                        style={{ color: "#fff", fontWeight: "600" }}
                      >
                        Reembolso parcial...
                      </ThemedText>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => resolve("redelivery")}
                    disabled={acting}
                    style={{
                      backgroundColor: "#3B82F6",
                      borderRadius: 10,
                      padding: 13,
                      marginBottom: 8,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 8,
                      opacity: acting ? 0.6 : 1,
                    }}
                  >
                    <Feather name="repeat" size={15} color="#fff" />
                    <ThemedText
                      type="body"
                      style={{ color: "#fff", fontWeight: "600" }}
                    >
                      Reenviar el pedido
                    </ThemedText>
                  </Pressable>

                  {rejectOpen ? (
                    <View>
                      <TextInput
                        style={{
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          fontSize: 14,
                        }}
                        placeholder="Motivo interno de la denegación (obligatorio)"
                        placeholderTextColor={theme.textSecondary}
                        value={rejectNote}
                        onChangeText={setRejectNote}
                        multiline
                      />
                      <View style={{ flexDirection: "row", marginTop: 8 }}>
                        <Pressable
                          onPress={reject}
                          disabled={acting}
                          style={{
                            flex: 1,
                            backgroundColor: "#6B7280",
                            borderRadius: 10,
                            padding: 12,
                            marginRight: 8,
                            alignItems: "center",
                          }}
                        >
                          <ThemedText style={{ color: "#fff", fontWeight: "700" }}>
                            Confirmar denegación
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => setRejectOpen(false)}
                          style={{
                            width: 46,
                            backgroundColor: theme.background,
                            borderRadius: 10,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Feather name="x" size={18} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setRejectOpen(true)}
                      disabled={acting}
                      style={{
                        backgroundColor: theme.border,
                        borderRadius: 10,
                        padding: 13,
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                        opacity: acting ? 0.6 : 1,
                      }}
                    >
                      <Feather name="x-circle" size={15} color={theme.textSecondary} />
                      <ThemedText
                        type="body"
                        style={{ color: theme.textSecondary, fontWeight: "600" }}
                      >
                        Denegar sin compensación
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    padding: Spacing.md,
                  }}
                >
                  <ThemedText type="h4" style={{ marginBottom: 6 }}>
                    Resolución aplicada
                  </ThemedText>
                  {detail.issue.resolutionAmount ? (
                    <ThemedText type="body" style={{ fontWeight: "700" }}>
                      {fmt(detail.issue.resolutionAmount)}
                    </ThemedText>
                  ) : null}
                  {detail.issue.customerMessage ? (
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary, marginTop: 4 }}
                    >
                      "{detail.issue.customerMessage}"
                    </ThemedText>
                  ) : null}
                  {detail.issue.internalNote ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 4 }}
                    >
                      Nota interna: {detail.issue.internalNote}
                    </ThemedText>
                  ) : null}
                </View>
              )}
            </>
          ) : (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No se pudo cargar el detalle.
            </ThemedText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  const FILTERS = [
    { id: "open_attention", label: `Por atender (${openCount})` },
    { id: "all", label: `Todas (${counts.total ?? 0})` },
    { id: "resolved", label: `Resueltas (${counts.resolved ?? 0})` },
    { id: "rejected", label: `Denegadas (${counts.rejected ?? 0})` },
  ] as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id as any)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 18,
                borderWidth: 1,
                marginRight: 8,
                backgroundColor: active ? ComeYaColors.primary : "transparent",
                borderColor: active ? ComeYaColors.primary : theme.border,
              }}
            >
              <ThemedText
                type="caption"
                style={{ color: active ? "#fff" : theme.text, fontWeight: "600" }}
              >
                {f.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 60 }}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ padding: 60, alignItems: "center" }}>
          <Feather name="check-circle" size={44} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: 10 }}
          >
            Sin incidencias pendientes 🎉
          </ThemedText>
        </View>
      ) : (
        filtered.map((issue) => {
          const st = STATUS_META[issue.status] ?? { label: issue.status, color: "#888" };
          const pr = PRIORITY_META[issue.priority] ?? { label: issue.priority, color: "#888" };
          return (
            <Pressable
              key={issue.id}
              onPress={() => openDetail(issue)}
              style={{
                backgroundColor: theme.card,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderLeftWidth: 3,
                borderLeftColor: st.color,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    backgroundColor: st.color + "20",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                  }}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: st.color, fontWeight: "700" }}
                  >
                    {st.label}
                  </ThemedText>
                </View>
                {issue.priority !== "medium" && (
                  <View
                    style={{
                      backgroundColor: pr.color + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10,
                    }}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: pr.color, fontWeight: "700" }}
                    >
                      {pr.label}
                    </ThemedText>
                  </View>
                )}
                <ThemedText
                  type="body"
                  style={{ marginLeft: "auto", color: ComeYaColors.primary, fontWeight: "800" }}
                >
                  {fmt(issue.orderTotal)}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ fontWeight: "700" }} numberOfLines={1}>
                {issue.issueLabel} — {displayOrderNumber({ id: issue.orderId })}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
                numberOfLines={2}
              >
                {issue.description}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 4 }}
              >
                {issue.customerName ?? "Cliente"} ·{" "}
                {new Date(issue.createdAt).toLocaleString("es-ES")}
              </ThemedText>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

export default IssuesTab;
