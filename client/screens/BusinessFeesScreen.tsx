// Tarifas de reservas del negocio: deuda pendiente (0,99 € por comensal que
// asiste), pago con tarjeta (queda guardada para el cobro automático diario)
// y pago manual por Bizum/transferencia con comprobante que verifica el admin.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStripe } from "@stripe/stripe-react-native";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const fmt = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

export default function BusinessFeesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [payInfo, setPayInfo] = useState<any>(null);

  // Pago manual con comprobante
  const [showManual, setShowManual] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [provider, setProvider] = useState<"bizum" | "transferencia">("bizum");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/reservations/fees/pending");
      const data = await res.json();
      if (data.success) setSummary(data);
    } catch {
      showToast("No se pudo cargar las tarifas", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPayInfo = useCallback(async () => {
    if (payInfo) return;
    try {
      const res = await apiRequest("GET", "/api/payments/info");
      const data = await res.json();
      if (data.success) setPayInfo(data);
    } catch {}
  }, [payInfo]);

  const payWithCard = async () => {
    const outstanding = summary?.outstandingCents || 0;
    if (outstanding < 50) return;
    setPaying(true);
    try {
      const res = await apiRequest("POST", "/api/reservations/fees/pay", {});
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || "No se pudo iniciar el pago", "error");
        return;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: "ComeYa",
        returnURL: "comeya://payment-return",
      });
      if (initError) {
        showToast("No se pudo iniciar el pago: " + initError.message, "error");
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          showToast("El pago no se completó", "error");
        }
        return;
      }

      // Verificación server-side antes de dar por pagado
      const confirmRes = await apiRequest(
        "POST",
        "/api/reservations/fees/pay/confirm",
        { paymentIntentId: data.paymentIntentId },
      );
      const confirmData = await confirmRes.json();
      if (confirmData.success) {
        showToast(
          `Tarifas pagadas (${fmt(data.amountCents)}). Tu tarjeta queda guardada para los próximos cobros.`,
          "success",
        );
        load();
      } else {
        showToast(confirmData.error || "No se pudo confirmar el pago", "error");
      }
    } catch {
      showToast("No se pudo procesar el pago", "error");
    } finally {
      setPaying(false);
    }
  };

  const pickProofImage = async () => {
    if (Platform.OS === "web") {
      const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
      const url = await pickAndUploadImage("comprobantes");
      if (url) setProofImage(url);
      return;
    }
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso requerido",
        "Necesitamos acceso a tu galería para subir el comprobante.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0].uri);
    }
  };

  const submitProof = async () => {
    if (!proofImage) {
      showToast("Sube una foto del comprobante", "error");
      return;
    }
    if (!reference.trim()) {
      showToast("Ingresa el número de referencia del pago", "error");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl = proofImage;
      // En nativo la imagen está local: subirla ahora al backend
      if (Platform.OS !== "web") {
        const token = await AsyncStorage.getItem("token");
        const formData = new FormData();
        formData.append("file", {
          uri: proofImage,
          name: "comprobante.jpg",
          type: "image/jpeg",
        } as any);
        const uploadRes = await fetch(
          `${getApiUrl()}/api/payments/upload-proof-image`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error("upload");
        imageUrl = uploadData.url;
      }

      const res = await apiRequest(
        "POST",
        "/api/reservations/fees/submit-proof",
        {
          imageUrl,
          referenceNumber: reference.trim(),
          provider,
        },
      );
      const data = await res.json();
      if (data.success) {
        showToast("Comprobante enviado. Se verificará en breve.", "success");
        setProofImage(null);
        setReference("");
        setShowManual(false);
        load();
      } else {
        showToast(data.error || "No se pudo enviar el comprobante", "error");
      }
    } catch {
      showToast("No se pudo enviar el comprobante", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const outstanding = summary?.outstandingCents || 0;
  const card = summary?.card || null;
  const transactions: any[] = summary?.transactions || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Tarifas de reservas</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={ComeYaColors.primary}
            style={{ marginTop: Spacing["3xl"] }}
          />
        ) : null}

        {!loading && (
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <Feather
              name="credit-card"
              size={22}
              color={outstanding > 0 ? ComeYaColors.primary : ComeYaColors.success}
            />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Pendiente de pago
              </ThemedText>
              <ThemedText type="h1" style={{ color: outstanding > 0 ? ComeYaColors.primary : ComeYaColors.success }}>
                {fmt(outstanding)}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
              >
                {outstanding > 0
                  ? `Tarifa: 0,99 € por comensal que asiste · cobro automático al llegar a ${fmt(summary?.autochargeThresholdCents || 500)}`
                  : "Todo al día ✅"}
              </ThemedText>
            </View>
          </View>
        )}

        {!loading && card ? (
          <View style={[styles.cardRow, { backgroundColor: `${ComeYaColors.success}12` }]}>
            <Feather name="check-circle" size={18} color={ComeYaColors.success} />
            <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm }}>
              Tarjeta guardada {card.brand ? `(${card.brand} ·· ${card.last4})` : ""}: los
              cobros son automáticos, no tienes que hacer nada.
            </ThemedText>
          </View>
        ) : null}

        {!loading && outstanding >= 50 ? (
          <>
            <Pressable
              onPress={payWithCard}
              disabled={paying}
              style={[styles.primaryBtn, { opacity: paying ? 0.7 : 1 }]}
            >
              {paying ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="credit-card" size={18} color="#FFF" />
              )}
              <ThemedText
                style={{ color: "#FFF", fontWeight: "700", marginLeft: Spacing.sm }}
              >
                Pagar {fmt(outstanding)} con tarjeta
              </ThemedText>
            </Pressable>
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginTop: Spacing.xs,
                marginBottom: Spacing.md,
              }}
            >
              Al pagar, tu tarjeta queda guardada y los próximos cobros serán
              automáticos.
            </ThemedText>

            <Pressable
              onPress={() => {
                setShowManual((v) => !v);
                loadPayInfo();
              }}
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
            >
              <Feather name="file-text" size={16} color={theme.text} />
              <ThemedText
                style={{ color: theme.text, fontWeight: "600", marginLeft: Spacing.sm }}
              >
                Pagar por Bizum o transferencia
              </ThemedText>
            </Pressable>
          </>
        ) : null}

        {showManual ? (
          <View
            style={[styles.manualCard, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <ThemedText type="h4">Datos de pago ComeYa</ThemedText>
            {payInfo ? (
              <View style={{ marginTop: Spacing.sm, gap: Spacing.xs }}>
                {payInfo.bizum ? (
                  <Pressable
                    onPress={() => Linking.openURL(`bizum://charge/${payInfo.bizum}`)}
                    style={styles.payInfoRow}
                  >
                    <Feather name="smartphone" size={14} color={ComeYaColors.primary} />
                    <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
                      Bizum: {payInfo.bizum}
                    </ThemedText>
                  </Pressable>
                ) : null}
                {payInfo.iban ? (
                  <View style={styles.payInfoRow}>
                    <Feather name="dollar-sign" size={14} color={ComeYaColors.primary} />
                    <ThemedText
                      type="small"
                      style={{ marginLeft: Spacing.xs, flex: 1 }}
                      selectable
                    >
                      IBAN: {payInfo.iban} ({payInfo.titular})
                    </ThemedText>
                  </View>
                ) : null}
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Importe exacto: {fmt(outstanding)} · Concepto: TARIFAS
                </ThemedText>
              </View>
            ) : (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
              >
                Cargando datos de pago...
              </ThemedText>
            )}

            <View style={[styles.providerRow, { marginTop: Spacing.md }]}>
              {(["bizum", "transferencia"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setProvider(p)}
                  style={[
                    styles.providerChip,
                    {
                      backgroundColor:
                        provider === p ? ComeYaColors.primary : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: provider === p ? "#FFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {p === "bizum" ? "Bizum" : "Transferencia"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={pickProofImage}
              style={[styles.proofPicker, { borderColor: theme.border }]}
            >
              {proofImage ? (
                <Image
                  source={{ uri: proofImage }}
                  style={styles.proofImage}
                  contentFit="cover"
                />
              ) : (
                <>
                  <Feather name="camera" size={24} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                  >
                    Sube la foto del comprobante
                  </ThemedText>
                </>
              )}
            </Pressable>

            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Número de referencia del pago"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
            />

            <Pressable
              onPress={submitProof}
              disabled={submitting}
              style={[styles.primaryBtn, { opacity: submitting ? 0.7 : 1 }]}
            >
              <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>
                {submitting ? "Enviando..." : "Enviar comprobante"}
              </ThemedText>
            </Pressable>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
            >
              Un administrador verificará el pago en breve.
            </ThemedText>
          </View>
        ) : null}

        {transactions.length > 0 ? (
          <View style={{ marginTop: Spacing.lg }}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              Últimos movimientos
            </ThemedText>
            {transactions.map((t: any) => {
              const negative = (t.amount || 0) < 0;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.txRow,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Feather
                    name={negative ? "users" : "check-circle"}
                    size={16}
                    color={negative ? ComeYaColors.primary : ComeYaColors.success}
                  />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText type="small" numberOfLines={2}>
                      {t.description || (negative ? "Tarifa de reserva" : "Pago de tarifas")}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: negative ? ComeYaColors.primary : ComeYaColors.success,
                      fontWeight: "700",
                    }}
                  >
                    {negative ? "" : "+"}
                    {fmt(Math.abs(t.amount || 0))}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : null}
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
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ComeYaColors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  manualCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  payInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  providerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  proofPicker: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    minHeight: 120,
    marginBottom: Spacing.sm,
  },
  proofImage: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
});
