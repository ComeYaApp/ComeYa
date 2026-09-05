// Reservas entre amigos: pantalla pública a la que llega el enlace compartido.
// Sin necesidad de cuenta: nombre + "Voy" / "No voy".
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function JoinReservationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const token = route.params?.token || "";

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"joined" | "declined" | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiRequest("GET", `/api/reservations/group/${token}`)
      .then((r) => r.json())
      .then((d) => setInfo(d.success ? d : null))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [token]);

  const act = async (kind: "join" | "decline") => {
    if (!name.trim()) {
      showToast("Dinos tu nombre primero", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/reservations/group/${token}/${kind === "join" ? "join" : "decline"}`,
        { name: name.trim() },
      );
      const data = await res.json();
      if (data.success) {
        setDone(kind === "join" ? "joined" : "declined");
        showToast(
          kind === "join"
            ? "¡Te esperamos en la mesa! 🎉"
            : "Aviso enviado al organizador",
          "success",
        );
      } else {
        showToast(data.error || "No se pudo confirmar", "error");
      }
    } catch {
      showToast("No se pudo confirmar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing["3xl"] }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing["3xl"] }]}>
        <Feather name="link-2" size={48} color={theme.textSecondary} />
        <ThemedText type="h4" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Enlace no válido o caducado
        </ThemedText>
      </View>
    );
  }

  const r = info.reservation;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>

      <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
        <View style={[styles.emojiWrap, { backgroundColor: `${ComeYaColors.primary}12` }]}>
          <ThemedText style={{ fontSize: 34 }}>🍽️</ThemedText>
        </View>
        <ThemedText type="h3" style={{ marginTop: Spacing.md }}>
          {r.organizer || "Un amigo"} te invita a {r.businessName}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          {new Date(`${r.date}T12:00:00`).toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          · {r.time} · {r.partySize} comensales
        </ThemedText>

        <View style={[styles.countRow, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="users" size={14} color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ marginLeft: 6, fontWeight: "700" }}>
            {info.confirmedCount}/{r.partySize} confirmados ·{" "}
            {info.spotsLeft > 0 ? `${info.spotsLeft} plazas libres` : "Mesa completa"}
          </ThemedText>
        </View>

        {info.participants.length > 0 ? (
          <View style={{ marginTop: Spacing.sm, gap: 4 }}>
            {info.participants.map((p: any) => (
              <View key={p.id} style={styles.pRow}>
                <Feather
                  name={p.status === "confirmed" ? "check-circle" : "x-circle"}
                  size={14}
                  color={p.status === "confirmed" ? "#10B981" : theme.textSecondary}
                />
                <ThemedText type="small" style={{ marginLeft: 6 }}>
                  {p.name}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {done ? (
        <View style={[styles.doneCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <Feather name="check-circle" size={40} color={done === "joined" ? "#10B981" : "#6B7280"} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
            {done === "joined" ? "¡Confirmado! Te esperan en la mesa 🎉" : "Gracias por avisar"}
          </ThemedText>
        </View>
      ) : info.spotsLeft > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable
            onPress={() => act("join")}
            disabled={submitting}
            style={[styles.goBtn, { opacity: submitting ? 0.6 : 1 }]}
          >
            <ThemedText style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>
              ¡Voy! ✅
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => act("decline")} disabled={submitting} style={styles.declineBtn}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No puedo ir
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  content: { padding: Spacing.lg, paddingBottom: Spacing["4xl"], maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", marginBottom: Spacing.md },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  emojiWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  countRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: Spacing.md },
  pRow: { flexDirection: "row", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, marginBottom: Spacing.sm },
  goBtn: { backgroundColor: ComeYaColors.primary, borderRadius: BorderRadius.lg, alignItems: "center", paddingVertical: Spacing.md },
  declineBtn: { alignItems: "center", paddingVertical: Spacing.md },
  doneCard: { borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: "center" },
});
