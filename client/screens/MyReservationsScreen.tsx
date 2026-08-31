import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
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

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente de confirmar", color: "#F59E0B", icon: "clock" },
  confirmed: { label: "Confirmada", color: "#10B981", icon: "check-circle" },
  rejected: { label: "Rechazada", color: "#EF4444", icon: "x-circle" },
  cancelled: { label: "Cancelada", color: "#6B7280", icon: "slash" },
};

export default function MyReservationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/reservations/mine");
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
  }, [load]);

  const cancelReservation = (r: any) => {
    Alert.alert(
      "Cancelar reserva",
      `¿Cancelar la reserva del ${r.date} a las ${r.time}?`,
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setCancellingId(r.id);
            try {
              const res = await apiRequest(
                "POST",
                `/api/reservations/${r.id}/cancel`,
                {},
              );
              const data = await res.json();
              if (data.success) {
                Alert.alert("Reserva cancelada", data.message);
              } else {
                Alert.alert("No se pudo cancelar", data.error || "");
              }
              load();
            } catch {
              Alert.alert("Error", "No se pudo cancelar la reserva");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Mis reservas</ThemedText>
        <View style={{ width: 44 }} />
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
        {!loading && reservations.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No tienes reservas todavía
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
              }}
            >
              Entra en un negocio con reservas y toca "Reservar mesa".
            </ThemedText>
          </View>
        )}

        {reservations.map((r: any) => {
          const meta = STATUS_META[r.status] || STATUS_META.pending;
          const cancellable =
            (r.status === "pending" || r.status === "confirmed") &&
            r.date >= new Date().toISOString().slice(0, 10);
          return (
            <View
              key={r.id}
              style={[
                styles.card,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4">{r.businessName || "Negocio"}</ThemedText>
                  {r.businessAddress ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      {r.businessAddress}
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

              <View style={styles.infoRow}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                >
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  a las {r.time}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                >
                  {r.partySize} comensales
                </ThemedText>
              </View>
              {r.businessNote ? (
                <View style={styles.businessNote}>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.text, fontWeight: "600" }}
                  >
                    Nota del negocio: {r.businessNote}
                  </ThemedText>
                </View>
              ) : null}

              {cancellable && (
                <Pressable
                  onPress={() => cancelReservation(r)}
                  disabled={cancellingId === r.id}
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: ComeYaColors.error,
                      opacity: cancellingId === r.id ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather name="x-circle" size={14} color={ComeYaColors.error} />
                  <ThemedText
                    type="small"
                    style={{ color: ComeYaColors.error, marginLeft: 4 }}
                  >
                    {cancellingId === r.id ? "Cancelando..." : "Cancelar reserva"}
                  </ThemedText>
                </Pressable>
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
    marginBottom: Spacing.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  businessNote: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
