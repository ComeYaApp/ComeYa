// Todas las reservas de mesa del sistema (panel admin, solo lectura): el
// admin supervisa el estado global; la mesa la gestiona cada negocio desde su
// agenda. Multiplataforma: panel web (AdminShell) y menú admin móvil.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#F59E0B", bg: "#F59E0B18" },
  confirmed: { label: "Confirmada", color: "#10B981", bg: "#10B98118" },
  seated: { label: "En la mesa", color: "#3B82F6", bg: "#3B82F618" },
  completed: { label: "Completada", color: "#6B7280", bg: "#6B728018" },
  no_show: { label: "No vino", color: "#EF4444", bg: "#EF444418" },
  rejected: { label: "Rechazada", color: "#EF4444", bg: "#EF444418" },
  cancelled: { label: "Cancelada", color: "#6B7280", bg: "#6B728018" },
};

const OCCASION_LABELS: Record<string, string> = {
  birthday: "Cumpleaños",
  anniversary: "Aniversario",
  date: "Cita",
  family: "Familia",
  business: "Negocios",
  celebration: "Celebración",
};

type Filter = "active" | "today" | "all";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function AdminReservationsTab() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<Filter>("active");
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs =
        filter === "active"
          ? "status=active"
          : filter === "today"
            ? `status=all&date=${todayStr()}`
            : "status=all";
      const res = await apiRequest("GET", `/api/reservations/admin/all?${qs}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.reservations || []);
        setTotals(data.totals || {});
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  const activeTotals =
    (totals.pending || 0) + (totals.confirmed || 0) + (totals.seated || 0);

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={ComeYaColors.primary}
        />
      }
    >
      <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
        Reservas de mesa
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
      >
        Vista global de todas las reservas (solo lectura: la mesa la gestiona
        cada negocio desde su agenda).
      </ThemedText>

      <View style={styles.totalsRow}>
        <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h3">{activeTotals}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Activas ahora
          </ThemedText>
        </View>
        <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h3">{totals.completed || 0}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Completadas
          </ThemedText>
        </View>
        <View style={[styles.totalCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h3">{totals.no_show || 0}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            No vinieron
          </ThemedText>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { id: "active", label: "Activas" },
            { id: "today", label: "Hoy" },
            { id: "all", label: "Todas" },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filter === f.id ? ComeYaColors.primary : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: filter === f.id ? "#FFF" : theme.text,
                fontWeight: "700",
              }}
            >
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="calendar" size={48} color={theme.textSecondary} />
          <ThemedText
            type="h4"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            Sin reservas para este filtro
          </ThemedText>
        </View>
      ) : null}

      {rows.map((r) => {
        const meta = STATUS_META[r.status] || {
          label: r.status,
          color: "#6B7280",
          bg: "#6B728018",
        };
        return (
          <View
            key={r.id}
            style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "700" }} numberOfLines={1}>
                  {r.businessName || "Negocio"} · {r.time}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {prettyDate(r.date)} · {r.partySize} pax ·{" "}
                  {r.customerName || "Cliente"}
                  {r.customerPhone ? ` · ${r.customerPhone}` : ""}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {r.code ? `${r.code} · ` : ""}
                  {r.preOrderId ? "Con pedido anticipado" : "Solo mesa"}
                  {r.occasion
                    ? ` · ${OCCASION_LABELS[r.occasion] || r.occasion}`
                    : ""}
                  {r.feeChargedAt ? " · Tarifa cobrada" : ""}
                </ThemedText>
              </View>
              <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                <ThemedText
                  type="caption"
                  style={{ color: meta.color, fontWeight: "700" }}
                >
                  {meta.label}
                </ThemedText>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  totalsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  totalCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  empty: { alignItems: "center", marginTop: Spacing["3xl"] },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
});
