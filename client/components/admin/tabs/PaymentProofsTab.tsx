import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const METHOD_LABELS: Record<string, string> = {
  bizum: "Bizum",
  bizum_manual: "Bizum manual",
  transferencia: "Transferencia SEPA",
  sepa: "Transferencia SEPA",
  paypal: "PayPal",
  stripe_card: "Tarjeta (Stripe)",
  stripe_bizum: "Bizum (Stripe)",
};

const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export const PaymentProofsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/payments/proofs/pending");
      const data = await res.json();
      if (data.success) setProofs(data.proofs ?? []);
    } catch {
      showToast("Error al cargar comprobantes", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const approve = async () => {
    if (!selected) return;
    setProcessing(selected.id);
    try {
      const isSubscription = selected.order_id?.startsWith("sub_");
      const endpoint = isSubscription
        ? `/api/subscriptions/proofs/${selected.id}/approve`
        : `/api/payments/proofs/${selected.id}/approve`;
      const res = await apiRequest("POST", endpoint, {});
      const data = await res.json();
      if (data.success) {
        showToast(
          isSubscription
            ? "✅ Suscripción activada"
            : "✅ Comprobante aprobado — pedido confirmado",
          "success",
        );
        setSelected(null);
        load();
      } else {
        showToast(data.error ?? "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async () => {
    if (!selected) return;
    setProcessing(selected.id);
    try {
      const isSubscription = selected.order_id?.startsWith("sub_");
      const endpoint = isSubscription
        ? `/api/subscriptions/proofs/${selected.id}/reject`
        : `/api/payments/proofs/${selected.id}/reject`;
      const res = await apiRequest("POST", endpoint, { reason: rejectReason });
      const data = await res.json();
      if (data.success) {
        showToast("❌ Comprobante rechazado — cliente notificado", "success");
        setSelected(null);
        setRejectReason("");
        load();
      } else {
        showToast(data.error ?? "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessing(null);
    }
  };

  const s = st(theme);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  // ── Vista detalle ──────────────────────────────────────────────────────────
  if (selected) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            setSelected(null);
            setRejectReason("");
          }}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <Text style={[s.backText, { color: theme.text }]}>
            Volver a la lista
          </Text>
        </TouchableOpacity>

        {/* Imagen del comprobante */}
        {selected.proof_image_url ? (
          <Image
            source={{ uri: selected.proof_image_url }}
            style={{
              width: "100%",
              height: 300,
              borderRadius: 12,
              marginBottom: 12,
            }}
            resizeMode="contain"
          />
        ) : (
          <View
            style={[s.noImage, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="image" size={40} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, marginTop: 8 }}>
              Sin imagen
            </Text>
          </View>
        )}

        {/* Datos */}
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>
            Datos del comprobante
          </Text>
          <DataRow
            label="Cliente"
            value={selected.user_name ?? "—"}
            theme={theme}
          />
          <DataRow
            label="Teléfono"
            value={selected.user_phone ?? "—"}
            theme={theme}
          />
          <DataRow
            label="Negocio"
            value={selected.business_name ?? "—"}
            theme={theme}
          />
          <DataRow
            label="Método"
            value={
              METHOD_LABELS[selected.payment_provider] ??
              selected.payment_provider
            }
            theme={theme}
          />
          <DataRow
            label="Referencia"
            value={selected.reference_number ?? "—"}
            theme={theme}
            bold
          />
          <DataRow
            label="Importe env."
            value={fmt(selected.amount)}
            theme={theme}
            highlight
          />
          <DataRow
            label="Total pedido"
            value={fmt(selected.order_total)}
            theme={theme}
          />
          {selected.verification_notes && (
            <DataRow
              label="Nota"
              value={selected.verification_notes}
              theme={theme}
            />
          )}
          <DataRow
            label="Enviado"
            value={new Date(selected.submitted_at).toLocaleString("es-ES")}
            theme={theme}
          />
        </View>

        {/* Razón de rechazo */}
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <Text style={[s.label, { color: theme.textSecondary }]}>
            Razón de rechazo (si rechazas):
          </Text>
          <TextInput
            style={[
              s.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            placeholder="Ej: Referencia incorrecta, monto no coincide..."
            placeholderTextColor={theme.textSecondary}
            value={rejectReason}
            onChangeText={setRejectReason}
          />
        </View>

        {/* Botones */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[s.btn, { flex: 1, backgroundColor: ComeYaColors.success }]}
            disabled={!!processing}
            onPress={approve}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFF" />
                <Text style={s.btnText}>Aprobar</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { flex: 1, backgroundColor: "#E53935" }]}
            disabled={!!processing}
            onPress={reject}
          >
            <Feather name="x" size={18} color="#FFF" />
            <Text style={s.btnText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
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
      {proofs.length === 0 ? (
        <View style={[s.empty, { backgroundColor: theme.card }]}>
          <Feather name="check-circle" size={48} color={ComeYaColors.success} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>
            Sin comprobantes pendientes
          </Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            Cuando un cliente suba un comprobante de Bizum, SEPA o PayPal
            aparecerá aquí
          </Text>
        </View>
      ) : (
        proofs.map((proof: any) => (
          <TouchableOpacity
            key={proof.id}
            style={[s.card, { backgroundColor: theme.card }]}
            onPress={() => setSelected(proof)}
          >
            <View style={s.row}>
              <View
                style={[
                  s.badge,
                  { backgroundColor: ComeYaColors.warning + "20" },
                ]}
              >
                <Text style={[s.badgeText, { color: ComeYaColors.warning }]}>
                  {METHOD_LABELS[proof.payment_provider] ??
                    proof.payment_provider}
                </Text>
              </View>
              <Text style={[s.amount, { color: ComeYaColors.success }]}>
                {fmt(proof.amount)}
              </Text>
            </View>
            <Text style={[s.name, { color: theme.text }]}>
              {proof.user_name ?? "Cliente"}
            </Text>
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              {proof.order_id?.startsWith("sub_")
                ? "🌟 Suscripción Premium/Business"
                : `Ref: ${proof.reference_number ?? "—"} · ${proof.business_name ?? ""}`}
            </Text>
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              {new Date(proof.submitted_at).toLocaleString("es-ES")}
            </Text>
            <View style={s.tapHint}>
              <Feather name="eye" size={13} color={ComeYaColors.primary} />
              <Text style={[s.tapHintText, { color: ComeYaColors.primary }]}>
                Ver comprobante y verificar
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

function DataRow({ label, value, theme, bold, highlight }: any) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 5,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}
    >
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: highlight ? ComeYaColors.success : theme.text,
          fontSize: 13,
          fontWeight: bold || highlight ? "700" : "400",
          flex: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const st = (theme: any) =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 16,
    },
    backText: { fontSize: 14 },
    card: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: "600" },
    amount: { fontSize: 20, fontWeight: "700" },
    name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
    sub: { fontSize: 12, marginBottom: 2 },
    tapHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    tapHintText: { fontSize: 12 },
    empty: { padding: 40, borderRadius: 14, alignItems: "center", gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "700" },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
    noImage: {
      height: 160,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    label: { fontSize: 13, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      minHeight: 44,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 14,
      borderRadius: 10,
      marginTop: 8,
    },
    btnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  });
