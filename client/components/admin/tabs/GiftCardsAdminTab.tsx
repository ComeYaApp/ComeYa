import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiErrorMessage } from "@/lib/query-client";
import { BorderRadius, Spacing } from "@/constants/theme";

const PRIMARY = "#E60000";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Pendiente de pago", color: "#F59E0B" },
  pending_verification: { label: "Verificando", color: "#3B82F6" },
  active: { label: "Activa", color: "#10B981" },
  rejected: { label: "Rechazada", color: "#EF4444" },
};

const fmt = (cents?: number | null) =>
  `${((cents ?? 0) / 100).toFixed(2)} €`;
const cardAmount = (gc: any) => Number(gc?.amountCents ?? gc?.amount ?? 0);
const cardCreatedAt = (gc: any) => gc?.createdAt ?? gc?.created_at;

export function GiftCardsAdminTab() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/gift-cards/pending");
      const data = await res.json();
      if (data.success) setCards(data.giftCards ?? []);
    } catch (error) {
      flash(false, getApiErrorMessage(error, "Error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async (gc: any) => {
    setProcessing(gc.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/gift-cards/${gc.id}/activate`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        flash(
          true,
          `Gift Card activada${data.expiresAt ? ` — caduca el ${new Date(data.expiresAt).toLocaleDateString("es-ES")}` : ""}`,
        );
        setCards((prev) => prev.filter((c) => c.id !== gc.id));
        setSelected(null);
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch (error) {
      flash(false, getApiErrorMessage(error, "Error"));
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (gc: any) => {
    setProcessing(gc.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/gift-cards/${gc.id}/reject`,
        { reason: rejectReason.trim() },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "Gift Card rechazada y cliente notificado");
        setCards((prev) => prev.filter((c) => c.id !== gc.id));
        setSelected(null);
        setRejectReason("");
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch (error) {
      flash(false, getApiErrorMessage(error, "Error"));
    } finally {
      setProcessing(null);
    }
  };

  const confirmActivate = (gc: any) => {
    Alert.alert(
      "Activar Gift Card",
      `Se activará ${gc.code} por ${fmt(cardAmount(gc))}. Verifica el comprobante antes de continuar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Activar",
          onPress: () => activate(gc),
        },
      ],
    );
  };

  const confirmReject = (gc: any) => {
    if (!rejectReason.trim()) {
      flash(false, "Escribe una razón de rechazo");
      return;
    }
    Alert.alert(
      "Rechazar Gift Card",
      `¿Rechazar ${gc.code}? El comprador recibirá el motivo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Rechazar",
          style: "destructive",
          onPress: () => reject(gc),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
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
          <View style={[s.iconWrap, { backgroundColor: "#EC489918" }]}>
            <Feather name="gift" size={18} color="#EC4899" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>Gift Cards</Text>
            <Text style={[s.sub, { color: theme.textSecondary }]}>
              {cards.length} pendientes de activación
            </Text>
          </View>
        </View>

        {msg && (
          <View
            style={[
              s.msg,
              {
                backgroundColor: msg.ok ? "#10B98112" : "#EF444412",
                borderColor: msg.ok ? "#10B98144" : "#EF444444",
              },
            ]}
          >
            <Feather
              name={msg.ok ? "check-circle" : "alert-circle"}
              size={14}
              color={msg.ok ? "#10B981" : "#EF4444"}
            />
            <Text
              style={{
                color: msg.ok ? "#10B981" : "#EF4444",
                fontSize: 12,
                flex: 1,
              }}
            >
              {msg.text}
            </Text>
          </View>
        )}

        {cards.length === 0 ? (
          <View style={s.empty}>
            <Feather name="check-circle" size={40} color="#10B981" />
            <Text style={[s.emptyTitle, { color: theme.text }]}>
              Sin Gift Cards pendientes
            </Text>
            <Text style={[s.emptySub, { color: theme.textSecondary }]}>
              Cuando un cliente suba el comprobante aparecerá aquí.
            </Text>
          </View>
        ) : (
          cards.map((gc) => {
            const st =
              STATUS_META[gc.status] ?? STATUS_META.pending_payment;
            return (
              <Pressable
                key={gc.id}
                onPress={() => setSelected(gc)}
                style={[
                  s.card,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={s.cardTop}>
                  <View
                    style={[s.typePill, { backgroundColor: "#EC489918" }]}
                  >
                    <Feather name="gift" size={10} color="#EC4899" />
                    <Text style={[s.typeTxt, { color: "#EC4899" }]}>
                      GIFT CARD
                    </Text>
                  </View>
                  <View
                    style={[s.statusPill, { backgroundColor: st.color + "18" }]}
                  >
                    <Text style={[s.statusTxt, { color: st.color }]}>
                      {st.label}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: "#10B981" }]}>
                    {fmt(cardAmount(gc))}
                  </Text>
                </View>
                <Text style={[s.code, { color: theme.text }]}>{gc.code}</Text>
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  Comprada:{" "}
                  {cardCreatedAt(gc)
                    ? new Date(cardCreatedAt(gc)).toLocaleString("es-ES")
                    : "—"}
                </Text>
                {gc.recipientEmail && (
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    Para: {gc.recipientEmail}
                  </Text>
                )}
                {gc.paymentProof ? (
                  <View style={s.proofHint}>
                    <Feather name="image" size={12} color="#3B82F6" />
                    <Text style={{ color: "#3B82F6", fontSize: 11 }}>
                      Comprobante adjunto
                    </Text>
                  </View>
                ) : (
                  <View style={s.proofHint}>
                    <Feather name="alert-circle" size={12} color="#F59E0B" />
                    <Text style={{ color: "#F59E0B", fontSize: 11 }}>
                      Sin comprobante
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelected(null);
          setRejectReason("");
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => {
                setSelected(null);
                setRejectReason("");
              }}
            />
            <View
              style={[
                s.modalCard,
                {
                  backgroundColor: theme.card,
                  paddingBottom: insets.bottom + 16,
                  maxHeight: "90%",
                },
              ]}
            >
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.text }]}>
                  Gestionar Gift Card
                </Text>
                <Pressable
                  onPress={() => {
                    setSelected(null);
                    setRejectReason("");
                  }}
                >
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              {selected && (
                <ScrollView
                  contentContainerStyle={{ gap: 12, padding: 16 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    style={[
                      s.section,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[s.sectionTitle, { color: theme.textSecondary }]}
                    >
                      DATOS DE LA GIFT CARD
                    </Text>
                    <Row label="Código" value={selected.code} theme={theme} />
                    <Row
                      label="Importe"
                      value={fmt(cardAmount(selected))}
                      theme={theme}
                    />
                    <Row
                      label="Estado"
                      value={
                        STATUS_META[selected.status]?.label ??
                        selected.status
                      }
                      theme={theme}
                    />
                    <Row
                      label="Para"
                      value={
                        selected.recipientEmail ??
                        selected.to_email ??
                        "—"
                      }
                      theme={theme}
                    />
                    <Row
                      label="Mensaje"
                      value={selected.message ?? "—"}
                      theme={theme}
                    />
                    <Row
                      label="Creada"
                      value={
                        cardCreatedAt(selected)
                          ? new Date(
                              cardCreatedAt(selected),
                            ).toLocaleString("es-ES")
                          : "—"
                      }
                      theme={theme}
                    />
                  </View>

                  <View
                    style={[
                      s.section,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[s.sectionTitle, { color: theme.textSecondary }]}
                    >
                      COMPROBANTE DE PAGO
                    </Text>
                    {selected.paymentProof ? (
                      <>
                        <Row
                          label="Referencia"
                          value={
                            selected.paymentProof.referenceNumber ?? "—"
                          }
                          theme={theme}
                        />
                        <Row
                          label="Monto enviado"
                          value={fmt(
                            Number(selected.paymentProof.amount ?? 0),
                          )}
                          theme={theme}
                        />
                        {selected.paymentProof.imageUrl && (
                          <Image
                            source={{
                              uri: selected.paymentProof.imageUrl,
                            }}
                            style={s.proofImage}
                            contentFit="contain"
                          />
                        )}
                      </>
                    ) : (
                      <Text style={{ color: "#F59E0B", fontSize: 12 }}>
                        Sin comprobante adjunto. Verifica el pago antes de
                        activar.
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      s.infoBanner,
                      { backgroundColor: "#3B82F612", borderColor: "#3B82F644" },
                    ]}
                  >
                    <Feather name="info" size={14} color="#3B82F6" />
                    <Text
                      style={{ color: "#3B82F6", fontSize: 12, flex: 1 }}
                    >
                      Al activar, la gift card tendrá saldo de{" "}
                      {fmt(cardAmount(selected))} y caducará en 30 días.
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={[s.sectionTitle, { color: theme.textSecondary }]}
                    >
                      RAZÓN DE RECHAZO (si rechazas)
                    </Text>
                    <TextInput
                      style={[
                        s.input,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      placeholder="Ej: comprobante no válido, monto incorrecto..."
                      placeholderTextColor={theme.textSecondary}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                    />
                  </View>

                  <View style={s.actions}>
                    <Pressable
                      onPress={() => confirmReject(selected)}
                      disabled={!!processing}
                      style={[
                        s.btn,
                        { backgroundColor: "#EF4444", opacity: processing ? 0.6 : 1 },
                      ]}
                    >
                      {processing === selected.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Feather name="x-circle" size={16} color="#FFF" />
                          <Text style={s.btnTxt}>Rechazar</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => confirmActivate(selected)}
                      disabled={!!processing}
                      style={[
                        s.btn,
                        { backgroundColor: "#10B981", opacity: processing ? 0.6 : 1 },
                      ]}
                    >
                      {processing === selected.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Feather name="check-circle" size={16} color="#FFF" />
                          <Text style={s.btnTxt}>Activar</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Row({ label, value, theme }: any) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[s.rowValue, { color: theme.text }]} numberOfLines={2}>
        {value ?? "—"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 1 },
  msg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 12, textAlign: "center" },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeTxt: { fontSize: 9, fontWeight: "800" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  amount: { marginLeft: "auto", fontSize: 16, fontWeight: "800" },
  code: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  proofHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  proofImage: {
    width: "100%",
    height: 190,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: "#0001",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnTxt: { color: "#FFF", fontSize: 13, fontWeight: "800" },
});
