// Cobros de tarifas de reservas (admin): comprobantes de pago manual enviados
// por los negocios, con aprobar (abona la wallet) o rechazar con motivo.
// Multiplataforma: la usa el panel web (AdminShell) y el tab móvil de Finanzas.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const fmt = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

const METHOD_LABELS: Record<string, string> = {
  bizum: "Bizum",
  transferencia: "Transferencia IBAN",
  paypal: "PayPal",
};

export function FeeProofsTab() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(
        "GET",
        "/api/reservations/fees/admin/pending",
      );
      const data = await res.json();
      if (data.success) setProofs(data.proofs || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (proof: any, approve: boolean) => {
    const reason = reasonDraft.trim();
    if (!approve && !reason) {
      showToast("Escribe el motivo del rechazo", "error");
      return;
    }
    setActingId(proof.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/reservations/fees/admin/proofs/${proof.id}/${approve ? "approve" : "reject"}`,
        { reason },
      );
      const data = await res.json();
      if (data.success) {
        showToast(
          approve
            ? `Verificado: ${fmt(proof.amount)} abonados a la deuda`
            : "Comprobante rechazado",
          approve ? "success" : "warning",
        );
        setExpandedId(null);
        setReasonDraft("");
        load();
      } else {
        showToast(data.error || "No se pudo procesar", "error");
      }
    } catch {
      showToast("Error al procesar el comprobante", "error");
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

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
        Cobros de tarifas de reservas
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}
      >
        Comprobantes de pago manual (Bizum/transferencia) enviados por negocios
        para liquidar sus tarifas de reservas (0,99 € por comensal atendido).
        Al aprobar, la deuda se da por pagada.
      </ThemedText>

      {proofs.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="check-circle" size={48} color={theme.textSecondary} />
          <ThemedText
            type="h4"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            Sin comprobantes pendientes
          </ThemedText>
        </View>
      ) : null}

      {proofs.map((p) => {
        const expanded = expandedId === p.id;
        return (
          <View
            key={p.id}
            style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <Pressable
              onPress={() => {
                setExpandedId(expanded ? null : p.id);
                setReasonDraft("");
              }}
              style={styles.cardHeader}
            >
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "700" }}>
                  {p.ownerName || "Negocio"} · {fmt(p.amount)}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {METHOD_LABELS[p.paymentProvider] || p.paymentProvider} · Ref:{" "}
                  {p.referenceNumber || "—"} ·{" "}
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Deuda actual del negocio: {fmt(p.currentOutstandingCents || 0)}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: "#F59E0B18" },
                ]}
              >
                <Feather name="clock" size={12} color="#F59E0B" />
                <ThemedText
                  type="caption"
                  style={{ color: "#F59E0B", marginLeft: 4, fontWeight: "700" }}
                >
                  Pendiente
                </ThemedText>
              </View>
            </Pressable>

            {expanded ? (
              <>
                {p.proofImageUrl ? (
                  <Image
                    source={{ uri: p.proofImageUrl }}
                    style={styles.proofImage}
                    contentFit="contain"
                  />
                ) : null}
                <TextInput
                  value={reasonDraft}
                  onChangeText={setReasonDraft}
                  placeholder="Motivo del rechazo (visible para el negocio)"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.reasonInput,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                />
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => act(p, false)}
                    disabled={actingId === p.id}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.backgroundSecondary },
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
                    onPress={() => act(p, true)}
                    disabled={actingId === p.id}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: ComeYaColors.success },
                    ]}
                  >
                    <Feather name="check" size={15} color="#FFF" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFF", marginLeft: 4 }}
                    >
                      Aprobar y saldar
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : null}
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
  empty: { alignItems: "center", marginTop: Spacing["3xl"] },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  actions: {
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
