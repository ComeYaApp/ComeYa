import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
import { useBusiness } from "@/contexts/BusinessContext";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente", color: "#F59E0B", icon: "clock" },
  confirmed: { label: "Confirmada", color: "#10B981", icon: "check-circle" },
  rejected: { label: "Rechazada", color: "#EF4444", icon: "x-circle" },
  cancelled: { label: "Cancelada", color: "#6B7280", icon: "slash" },
};

const FILTERS = [
  { id: "upcoming", label: "Pendientes y confirmadas" },
  { id: "all", label: "Todas" },
];

export default function BusinessReservationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { selectedBusiness } = useBusiness();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("upcoming");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/reservations/business");
      const data = await res.json();
      if (data.success) setReservations(data.reservations || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const act = async (r: any, status: "confirmed" | "rejected") => {
    const note = noteDraft[r.id] || "";
    setActingId(r.id);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/reservations/business/${r.id}/status`,
        { status, businessNote: note },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert(
          status === "confirmed" ? "Reserva confirmada ✅" : "Reserva rechazada",
          status === "confirmed"
            ? "El cliente recibirá una notificación."
            : "El cliente recibirá una notificación.",
        );
      } else {
        Alert.alert("No se pudo gestionar", data.error || "");
      }
      load();
    } catch {
      Alert.alert("Error", "No se pudo gestionar la reserva");
    } finally {
      setActingId(null);
    }
  };

  const displayed = reservations.filter((r: any) =>
    filter === "upcoming"
      ? r.status === "pending" || r.status === "confirmed"
      : true,
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Reservas</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
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
                fontWeight: "600",
              }}
            >
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
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
        {!loading && displayed.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No hay reservas
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
              }}
            >
              Cuando un cliente reserve mesa, aparecerá aquí para que la
              confirmes o rechaces.
            </ThemedText>
          </View>
        )}

        {displayed.map((r: any) => {
          const meta = STATUS_META[r.status] || STATUS_META.pending;
          return (
            <View
              key={r.id}
              style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4">
                    {r.customerName || "Cliente"}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {r.time} · {r.partySize} comensales
                  </ThemedText>
                  {r.businessName ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      {r.businessName}
                    </ThemedText>
                  ) : null}
                  {r.customerPhone ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      📞 {r.customerPhone}
                    </ThemedText>
                  ) : null}
                  {r.notes ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.text, marginTop: 4 }}
                    >
                      📝 {r.notes}
                    </ThemedText>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: meta.color + "18" },
                  ]}
                >
                  <Feather name={meta.icon as any} size={12} color={meta.color} />
                  <ThemedText
                    type="caption"
                    style={{ color: meta.color, marginLeft: 4, fontWeight: "700" }}
                  >
                    {meta.label}
                  </ThemedText>
                </View>
              </View>

              {r.status === "pending" && (
                <>
                  <TextInput
                    value={noteDraft[r.id] || ""}
                    onChangeText={(t) =>
                      setNoteDraft((prev) => ({ ...prev, [r.id]: t }))
                    }
                    placeholder="Nota para el cliente (opcional)"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.noteInput,
                      { color: theme.text, borderColor: theme.border },
                    ]}
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => act(r, "rejected")}
                      disabled={actingId === r.id}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          opacity: actingId === r.id ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Feather name="x" size={15} color={ComeYaColors.error} />
                      <ThemedText
                        type="small"
                        style={{ color: ComeYaColors.error, marginLeft: 4 }}
                      >
                        Rechazar
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => act(r, "confirmed")}
                      disabled={actingId === r.id}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: ComeYaColors.success,
                          opacity: actingId === r.id ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Feather name="check" size={15} color="#FFF" />
                      <ThemedText
                        type="small"
                        style={{ color: "#FFF", marginLeft: 4 }}
                      >
                        Confirmar
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  emptyState: {
    alignItems: "center",
    marginTop: Spacing["4xl"],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
