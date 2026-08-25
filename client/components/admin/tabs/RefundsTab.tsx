import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ActivityIndicator,
  Pressable,
  TextInput,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { REFUND_METHOD_LABELS } from "@shared/orderIssues";

interface RefundRow {
  id: string;
  orderId: string;
  amount: number;
  type: string;
  reason: string | null;
  method: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  customerName: string | null;
  businessName: string | null;
}

interface TabProps {
  theme: any;
  showToast: (message: string, type: "success" | "error") => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B" },
  processing: { label: "Procesando", color: "#3B82F6" },
  completed: { label: "Completada", color: "#22C55E" },
  failed: { label: "Fallida", color: "#EF4444" },
};

const TYPE_LABELS: Record<string, string> = {
  issue: "Incidencia",
  cancellation: "Cancelación",
  dispute: "Disputa",
  manual: "Manual",
};

const fmt = (cents?: number | null) => `${((cents ?? 0) / 100).toFixed(2)} €`;

export function RefundsTab({ theme, showToast }: TabProps) {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

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
      showToast("Error al cargar devoluciones", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await apiRequest("POST", `/api/admin/refunds/${selected.id}/mark-paid`, {
        notes: note.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        setNote("");
        setSelected(null);
        load();
        showToast("Devolución marcada como pagada", "success");
      } else {
        showToast(data.error ?? "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setActing(false);
    }
  };

  const retry = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await apiRequest("POST", `/api/admin/refunds/${selected.id}/retry`);
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        load();
        showToast(data.message ?? "Reintento enviado", "success");
      } else {
        showToast(data.error ?? "No se pudo reintentar", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setActing(false);
    }
  };

  const filtered = refunds.filter((r) => (filter === "all" ? true : r.status === filter));

  // ── Detalle ────────────────────────────────────────────────────────────────
  if (selected) {
    const st = STATUS_META[selected.status] ?? { label: selected.status, color: "#888" };
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: Spacing.md }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Pressable onPress={() => setSelected(null)} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={{ flex: 1 }}>
            Devolución
          </ThemedText>
          <View
            style={{
              backgroundColor: st.color + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <ThemedText type="caption" style={{ color: st.color, fontWeight: "700" }}>
              {st.label}
            </ThemedText>
          </View>
        </View>

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 14,
            padding: Spacing.md,
            marginBottom: 12,
          }}
        >
          <ThemedText
            type="h2"
            style={{ color: ComeYaColors.primary, marginBottom: 10 }}
          >
            {fmt(selected.amount)}
          </ThemedText>
          {[
            { icon: "package", label: "Pedido", value: `#${selected.orderId.slice(-6).toUpperCase()}` },
            { icon: "user", label: "Cliente", value: selected.customerName },
            { icon: "credit-card", label: "Método", value: REFUND_METHOD_LABELS[selected.method] ?? selected.method },
            { icon: "tag", label: "Tipo", value: TYPE_LABELS[selected.type] ?? selected.type },
            { icon: "calendar", label: "Fecha", value: new Date(selected.createdAt).toLocaleString("es-ES") },
            ...(selected.reason
              ? [{ icon: "file-text", label: "Motivo", value: selected.reason }]
              : []),
            ...(selected.failureReason
              ? [{ icon: "alert-triangle", label: "Error", value: selected.failureReason }]
              : []),
          ].map((r) => (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Feather name={r.icon as any} size={14} color={ComeYaColors.primary} />
              <ThemedText
                type="caption"
                style={{ width: 90, marginLeft: 8, color: theme.textSecondary }}
              >
                {r.label}
              </ThemedText>
              <ThemedText type="body" style={{ flex: 1, fontWeight: "600" }}>
                {r.value}
              </ThemedText>
            </View>
          ))}
        </View>

        {selected.status === "pending" && selected.method === "manual_transfer" && (
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              padding: Spacing.md,
            }}
          >
            <ThemedText type="h4" style={{ marginBottom: 8 }}>
              Transferencia manual pendiente
            </ThemedText>
            <TextInput
              style={{
                backgroundColor: theme.background,
                color: theme.text,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
              }}
              placeholder="Referencia de la transferencia (opcional)"
              placeholderTextColor={theme.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Pressable
              onPress={markPaid}
              disabled={acting}
              style={{
                backgroundColor: "#22C55E",
                borderRadius: 10,
                padding: 13,
                marginTop: 10,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                opacity: acting ? 0.6 : 1,
              }}
            >
              {acting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="check" size={15} color="#fff" />
              )}
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
                Ya transferí {fmt(selected.amount)} al cliente
              </ThemedText>
            </Pressable>
          </View>
        )}

        {selected.status === "failed" && (
          <Pressable
            onPress={retry}
            disabled={acting}
            style={{
              backgroundColor: "#3B82F6",
              borderRadius: 10,
              padding: 13,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              opacity: acting ? 0.6 : 1,
            }}
          >
            {acting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="refresh-cw" size={15} color="#fff" />
            )}
            <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
              Reintentar devolución
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {/* KPIs */}
      {summary && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Devuelto (mes)", value: fmt(summary.refunded?.month), color: "#22C55E" },
            {
              label: "Pendiente transferir",
              value: fmt(summary.pendingManual?.amount),
              color: summary.pendingManual?.count > 0 ? "#F59E0B" : "#9E9E9E",
            },
            {
              label: "Fallidas",
              value: fmt(summary.failed?.amount),
              color: summary.failed?.count > 0 ? "#EF4444" : "#9E9E9E",
            },
          ].map((k) => (
            <View
              key={k.label}
              style={{
                flex: 1,
                backgroundColor: theme.card,
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: k.color + "40",
              }}
            >
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {k.label}
              </ThemedText>
              <ThemedText type="body" style={{ color: k.color, fontWeight: "800" }}>
                {k.value}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {[
          { id: "all", label: `Todas (${counts.total ?? 0})`, color: "#3B82F6" },
          { id: "pending", label: `Pendientes (${counts.pending ?? 0})`, color: "#F59E0B" },
          { id: "completed", label: `Completadas (${counts.completed ?? 0})`, color: "#22C55E" },
          { id: "failed", label: `Fallidas (${counts.failed ?? 0})`, color: "#EF4444" },
        ].map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 18,
                borderWidth: 1,
                marginRight: 8,
                backgroundColor: active ? f.color : "transparent",
                borderColor: active ? f.color : theme.border,
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
          <Feather name="credit-card" size={44} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: 10 }}
          >
            Sin devoluciones registradas
          </ThemedText>
        </View>
      ) : (
        filtered.map((r) => {
          const st = STATUS_META[r.status] ?? { label: r.status, color: "#888" };
          return (
            <Pressable
              key={r.id}
              onPress={() => setSelected(r)}
              style={{
                backgroundColor: theme.card,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderLeftWidth: 3,
                borderLeftColor: st.color,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, fontWeight: "800", marginRight: "auto" }}
                >
                  {fmt(r.amount)}
                </ThemedText>
                <View
                  style={{
                    backgroundColor: st.color + "20",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                  }}
                >
                  <ThemedText type="caption" style={{ color: st.color, fontWeight: "700" }}>
                    {st.label}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {REFUND_METHOD_LABELS[r.method] ?? r.method} ·{" "}
                {TYPE_LABELS[r.type] ?? r.type} · #{r.orderId?.slice(-6).toUpperCase()}
              </ThemedText>
              <ThemedText type="caption" style={{ marginTop: 2 }} numberOfLines={1}>
                {r.customerName ?? "Cliente"} — {r.reason ?? "Sin motivo"}
              </ThemedText>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

export default RefundsTab;
