// 🗓️ ComeYa Plan: organiza tu noche completa (copas → cena → postre) con mesa
// real en cada parada. Cada parada se reserva con el flujo normal.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ComeYaPlanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [date, setDate] = useState(toDateStr(new Date(Date.now() + 24 * 3600 * 1000)));
  const [party, setParty] = useState(2);
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserved, setReserved] = useState<Record<string, boolean>>({});
  const [reserving, setReserving] = useState<string | null>(null);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() + i * 24 * 3600 * 1000);
    return {
      value: toDateStr(d),
      label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }),
    };
  });

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setReserved({});
    try {
      const res = await apiRequest(
        "GET",
        `/api/reservations/plan?date=${date}&partySize=${party}`,
      );
      const data = await res.json();
      setStops(data.success ? data.stops || [] : []);
    } catch {
      setStops([]);
    } finally {
      setLoading(false);
    }
  }, [date, party]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const reserveStop = async (stop: any) => {
    setReserving(stop.stage);
    try {
      const res = await apiRequest("POST", "/api/reservations", {
        businessId: stop.businessId,
        date,
        time: stop.time,
        partySize: party,
        customerName: user?.name || "",
        customerPhone: user?.phone || "",
        notes: `ComeYa Plan · ${stop.label}`,
      });
      const data = await res.json();
      if (data.success) {
        setReserved((m) => ({ ...m, [stop.stage]: true }));
        showToast(`Reservado: ${stop.name} a las ${stop.time}`, "success");
      } else {
        showToast(data.error || "No se pudo reservar", "error");
      }
    } catch {
      showToast("No se pudo reservar", "error");
    } finally {
      setReserving(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>

      <ThemedText type="h2">Tu noche, planificada 🗓️</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, marginBottom: Spacing.md }}>
        Elegimos tres paradas con mesa real: copas, cena y postre.
      </ThemedText>

      {/* Día */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.sm }}>
        {days.map((d) => {
          const active = d.value === date;
          return (
            <Pressable
              key={d.value}
              onPress={() => setDate(d.value)}
              style={[styles.chip, { backgroundColor: active ? ComeYaColors.primary : theme.card, borderColor: active ? ComeYaColors.primary : theme.border }]}
            >
              <ThemedText type="small" style={{ color: active ? "#FFF" : theme.text, fontWeight: "600", textTransform: "capitalize" }}>
                {d.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Personas */}
      <View style={styles.partyRow}>
        <Feather name="users" size={16} color={ComeYaColors.primary} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>Personas:</ThemedText>
        <Pressable onPress={() => setParty((p) => Math.max(1, p - 1))} style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="minus" size={14} color={theme.text} />
        </Pressable>
        <ThemedText style={{ fontWeight: "800" }}>{party}</ThemedText>
        <Pressable onPress={() => setParty((p) => Math.min(20, p + 1))} style={[styles.stepBtn, { backgroundColor: ComeYaColors.primary }]}>
          <Feather name="plus" size={14} color="#FFF" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={ComeYaColors.primary} style={{ marginTop: Spacing["3xl"] }} />
      ) : stops.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="moon" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Sin paradas disponibles ese día
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
            Prueba con otra fecha: buscamos negocios con mesa real en cada franja.
          </ThemedText>
        </View>
      ) : (
        stops.map((stop, i) => (
          <View key={stop.stage} style={[styles.stopCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <View style={styles.stopIndex}>
              <ThemedText style={{ color: "#FFF", fontWeight: "800" }}>{i + 1}</ThemedText>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{stop.label}</ThemedText>
              <ThemedText style={{ fontWeight: "800", fontSize: 16 }}>{stop.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {((stop.rating || 0) / 10).toFixed(1)} ★ · mesa a las {stop.time}
              </ThemedText>
            </View>
            {reserved[stop.stage] ? (
              <View style={[styles.okChip, { backgroundColor: "#10B98118" }]}>
                <Feather name="check-circle" size={14} color="#10B981" />
                <ThemedText type="caption" style={{ color: "#10B981", marginLeft: 4, fontWeight: "700" }}>Listo</ThemedText>
              </View>
            ) : (
              <Pressable
                onPress={() => reserveStop(stop)}
                disabled={reserving === stop.stage}
                style={[styles.reserveBtn, { opacity: reserving === stop.stage ? 0.6 : 1 }]}
              >
                {reserving === stop.stage ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700" }}>Reservar</ThemedText>
                )}
              </Pressable>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing["4xl"], maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1 },
  partyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginVertical: Spacing.md },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: Spacing["3xl"] },
  stopCard: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  stopIndex: { width: 34, height: 34, borderRadius: 17, backgroundColor: ComeYaColors.primary, alignItems: "center", justifyContent: "center" },
  okChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  reserveBtn: { backgroundColor: ComeYaColors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
});
