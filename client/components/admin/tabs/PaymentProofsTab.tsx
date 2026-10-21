import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#E60000";

const METHOD_LABEL: Record<string, string> = {
  stripe_card: "Tarjeta",
  stripe_bizum: "Bizum (Stripe)",
  bizum_manual: "Bizum manual",
  bizum: "Bizum",
  paypal: "PayPal",
  transferencia: "Transferencia SEPA",
  sepa: "Transferencia SEPA",
  comeyacard: "ComeYaCard",
  cash: "Efectivo",
  wallet: "Saldo ComeYa",
};

const fmt = (cents: number | null | undefined) =>
  `${((cents ?? 0) / 100).toFixed(2)} €`;

/**
 * Bandeja móvil de comprobantes manuales (Bizum, transferencia/SEPA, PayPal).
 *
 * El admin puede ver la imagen, la referencia y aprobar o rechazar el pago
 * sin pasar por la versión web. Aprobar deja el pedido pagado y pendiente
 * de que el NEGOCIO lo acepte.
 */
export function PaymentProofsTab() {
  const { theme, isDark } = useTheme();
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const card = isDark ? "#1a1a1a" : "#fff";
  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const border = isDark ? "#2a2a2a" : "#e8e8e8";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#999" : "#666";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/payments/proofs/pending");
      const data = await res.json();
      if (data.success) setProofs(data.proofs ?? []);
    } catch {
      // se conserva la lista anterior
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (proof: any) => {
    setProcessing(proof.id);
    try {
      const isSubscription =
        proof?.purpose === "subscription" ||
        String(proof?.order_id || proof?.orderId || "").startsWith("sub_");
      const res = await apiRequest(
        "POST",
        isSubscription
          ? `/api/subscriptions/proofs/${proof.id}/approve`
          : `/api/payments/proofs/${proof.id}/approve`,
        {},
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setProofs((prev) => prev.filter((p) => p.id !== proof.id));
        Alert.alert(
          "Pago aprobado",
          isSubscription
            ? "La suscripción quedó activa."
            : "El pedido queda pagado. El negocio ya puede aceptarlo.",
        );
      } else {
        Alert.alert("Error", data.error || "No se pudo aprobar el pago");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setProcessing(rejecting.id);
    try {
      const isSubscription =
        rejecting?.purpose === "subscription" ||
        String(rejecting?.order_id || rejecting?.orderId || "").startsWith(
          "sub_",
        );
      const res = await apiRequest(
        "POST",
        isSubscription
          ? `/api/subscriptions/proofs/${rejecting.id}/reject`
          : `/api/payments/proofs/${rejecting.id}/reject`,
        { reason: reason.trim() || "Rechazado por administración" },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setProofs((prev) => prev.filter((p) => p.id !== rejecting.id));
        setRejecting(null);
        setReason("");
      } else {
        Alert.alert("Error", data.error || "No se pudo rechazar");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={PRIMARY}
        />
      }
    >
      <View style={s.header}>
        <Text style={[s.title, { color: text }]}>Comprobantes pendientes</Text>
        <View style={[s.count, { backgroundColor: PRIMARY + "15" }]}>
          <Text style={{ color: PRIMARY, fontWeight: "800" }}>{proofs.length}</Text>
        </View>
      </View>
      <Text style={[s.sub, { color: sub }]}>
        Revisa la imagen y la referencia antes de aprobar. Al aprobar, el pedido
        queda pagado y el negocio puede aceptarlo.
      </Text>

      {proofs.length === 0 ? (
        <View style={[s.empty, { backgroundColor: card, borderColor: border }]}>
          <Feather name="check-circle" size={34} color="#10B981" />
          <Text style={{ color: text, fontWeight: "700", marginTop: 10 }}>
            No hay pagos pendientes
          </Text>
          <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>
            Los comprobantes nuevos aparecerán aquí.
          </Text>
        </View>
      ) : (
        proofs.map((proof) => {
          const image =
            proof.proofImageUrl ||
            proof.proof_image_url ||
            proof.imageUrl ||
            null;
          const orderLabel =
            proof.orderNumber || proof.order_number || proof.orderId;
          return (
            <View
              key={proof.id}
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardTop}>
                <View>
                  <Text style={[s.order, { color: text }]}>
                    {orderLabel ? `#${String(orderLabel).slice(-8)}` : "Pedido"}
                  </Text>
                  <Text style={{ color: sub, fontSize: 12 }}>
                    {proof.business_name || proof.businessName || "ComeYa"} ·{" "}
                    {METHOD_LABEL[proof.payment_provider || proof.paymentProvider] ||
                      proof.payment_provider ||
                      proof.paymentProvider ||
                      "Pago manual"}
                  </Text>
                </View>
                <Text style={{ color: PRIMARY, fontWeight: "800", fontSize: 16 }}>
                  {fmt(proof.amount)}
                </Text>
              </View>

              {proof.order_status === "cancelled" && (
                <Text
                  style={{
                    color: "#EF4444",
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 6,
                  }}
                >
                  ⚠️ Pedido cancelado: revisa si corresponde reembolso antes de
                  aprobar.
                </Text>
              )}
              <Text style={{ color: sub, fontSize: 12, marginTop: 6 }}>
                Referencia: {proof.reference_number || proof.referenceNumber || "—"}
              </Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>
                Cliente: {proof.user_name || proof.userName || "—"}
              </Text>

              {image ? (
                <Pressable
                  onPress={() => Linking.openURL(image)}
                  style={{ marginTop: 10 }}
                >
                  <Image
                    source={{ uri: image }}
                    style={s.proofImage}
                    contentFit="contain"
                  />
                  <Text style={{ color: PRIMARY, fontSize: 11, marginTop: 4 }}>
                    Toca para abrir el comprobante
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>
                  Sin imagen adjunta
                </Text>
              )}

              <View style={s.actions}>
                <Pressable
                  onPress={() => approve(proof)}
                  disabled={!!processing}
                  style={[
                    s.btn,
                    { backgroundColor: "#10B981", opacity: processing ? 0.6 : 1 },
                  ]}
                >
                  {processing === proof.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="check" size={15} color="#fff" />
                  )}
                  <Text style={s.btnText}>Aprobar pago</Text>
                </Pressable>
                <Pressable
                  onPress={() => setRejecting(proof)}
                  disabled={!!processing}
                  style={[s.btn, { backgroundColor: "#EF4444" }]}
                >
                  <Feather name="x" size={15} color="#fff" />
                  <Text style={s.btnText}>Rechazar</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {rejecting && (
        <View style={[s.rejectBox, { backgroundColor: card, borderColor: border }]}>
          <Text style={{ color: text, fontWeight: "700", marginBottom: 8 }}>
            Motivo del rechazo
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Ej: referencia no coincide"
            placeholderTextColor={sub}
            multiline
            style={[
              s.reasonInput,
              { color: text, borderColor: border, backgroundColor: bg },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => {
                setRejecting(null);
                setReason("");
              }}
              style={[s.btn, { backgroundColor: border, flex: 1 }]}
            >
              <Text style={{ color: text, fontWeight: "700" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={reject}
              disabled={!!processing}
              style={[s.btn, { backgroundColor: "#EF4444", flex: 1 }]}
            >
              <Text style={s.btnText}>Confirmar rechazo</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "800" },
  count: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sub: { fontSize: 12, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  empty: {
    alignItems: "center",
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  order: { fontSize: 15, fontWeight: "800" },
  proofImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#00000008",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rejectBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 70,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
});
