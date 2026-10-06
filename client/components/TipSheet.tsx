import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

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

export interface TipStatusInfo {
  method?: string;
  amountCents?: number;
  status?: string; // none | pending | completed | failed
}

interface TipSheetProps {
  visible: boolean;
  orderId: string;
  orderLabel?: string;
  driverName?: string;
  tipStatus?: TipStatusInfo | null;
  onClose: () => void;
  onTipSent?: (status: TipStatusInfo) => void;
}

const QUICK_AMOUNTS = [1, 2, 3, 4, 5];

/**
 * Hoja de propina reutilizable: el cliente da propina electrónica al
 * repartidor de un pedido entregado y confirmado, en cualquier momento.
 * Tarjeta (Payment Sheet, abono inmediato) y Bizum/Transferencia con
 * comprobante (verificación del admin). En web solo hay Bizum/Transferencia.
 */
export default function TipSheet({
  visible,
  orderId,
  orderLabel,
  driverName,
  tipStatus,
  onClose,
  onTipSent,
}: TipSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isWeb = Platform.OS === "web";

  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [method, setMethod] = useState<"stripe" | "manual">(
    isWeb ? "manual" : "stripe",
  );
  const [proof, setProof] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Resultado de la última acción (para mostrar el estado de éxito sin cerrar)
  const [justSent, setJustSent] = useState<TipStatusInfo | null>(null);

  const completed = tipStatus?.status === "completed" && !justSent;

  useEffect(() => {
    if (visible) {
      setJustSent(null);
      setAmount(null);
      setCustomAmount("");
      setProof(null);
      setSending(false);
    }
  }, [visible]);

  const customCents = Math.round(parseFloat(customAmount.replace(",", ".")) * 100);
  const finalAmountCents = amount != null ? amount * 100 : customCents;
  const finalAmountLabel = (finalAmountCents / 100).toFixed(2);

  const pickProof = async () => {
    if (isWeb) {
      const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
      const url = await pickAndUploadImage("tip-proofs");
      if (url) setProof(url);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast("Se necesita permiso de cámara", "warning");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setProof(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!finalAmountCents || finalAmountCents <= 0 || finalAmountCents > 50000) {
      showToast("Elige un importe de propina válido", "warning");
      return;
    }
    if (method === "manual" && !proof) {
      showToast("Adjunta el comprobante del pago", "warning");
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/orders/${orderId}/tip`, {
        amount: finalAmountCents,
        tipMethod: method,
        ...(method === "manual" && proof ? { tipProof: proof } : {}),
      });
      const data = await res.json();

      if (data.needsPayment && data.clientSecret && !isWeb) {
        const StripeModule = await import("@stripe/stripe-react-native");
        const { error: initError } = await StripeModule.initPaymentSheet({
          merchantDisplayName: "ComeYa",
          paymentIntentClientSecret: data.clientSecret,
          allowsDelayedPaymentMethods: false,
          appearance: { colors: { primary: ComeYaColors.primary } },
        });
        if (initError) {
          showToast(initError.message || "No se pudo iniciar el pago", "error");
          setSending(false);
          return;
        }
        const { error: payError } = await StripeModule.presentPaymentSheet();
        if (payError) {
          if (payError.code !== "Canceled") {
            showToast(payError.message || "Pago no completado", "error");
          }
          setSending(false);
          return;
        }
        setJustSent({ method: "stripe", amountCents: finalAmountCents, status: "completed" });
        onTipSent?.({ method: "stripe", amountCents: finalAmountCents, status: "completed" });
        showToast("Propina enviada al repartidor 💝", "success");
      } else if (data.tipPending) {
        setJustSent({ method: "manual", amountCents: finalAmountCents, status: "pending" });
        onTipSent?.({ method: "manual", amountCents: finalAmountCents, status: "pending" });
        showToast(data.message || "Propina declarada", "success");
      } else if (data.success === false || data.error) {
        showToast(data.error || "No se pudo enviar la propina", "error");
        setSending(false);
        return;
      } else {
        setJustSent({ method, amountCents: finalAmountCents, status: "completed" });
        onTipSent?.({ method, amountCents: finalAmountCents, status: "completed" });
        showToast("Propina enviada al repartidor 💝", "success");
      }
      if (!isWeb) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      showToast(error?.message || "No se pudo enviar la propina", "error");
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <View style={styles.grabber} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Estado: propina ya enviada */}
            {completed && (
              <View style={styles.resultBox}>
                <Feather name="heart" size={40} color={ComeYaColors.primary} />
                <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                  Propina enviada 💝
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}
                >
                  {tipStatus?.amountCents
                    ? `Le dejaste ${(tipStatus.amountCents / 100).toFixed(2)} € al repartidor. ¡Gracias!`
                    : "¡Gracias por tu detalle con el repartidor!"}
                </ThemedText>
                <Pressable
                  onPress={handleClose}
                  style={[styles.primaryButton, { backgroundColor: ComeYaColors.primary, marginTop: Spacing.lg }]}
                >
                  <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                    Cerrar
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Estado: recién enviada (pendiente de verificación o pagada) */}
            {!completed && justSent && (
              <View style={styles.resultBox}>
                <Feather name="heart" size={40} color={ComeYaColors.primary} />
                <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                  {justSent.status === "pending"
                    ? "Propina declarada 📋"
                    : "Propina enviada 💝"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}
                >
                  {justSent.status === "pending"
                    ? "Se abonará al repartidor cuando administración verifique tu comprobante."
                    : `Le has enviado ${((justSent.amountCents || 0) / 100).toFixed(2)} € al repartidor. ¡Gracias!`}
                </ThemedText>
                <Pressable
                  onPress={handleClose}
                  style={[styles.primaryButton, { backgroundColor: ComeYaColors.primary, marginTop: Spacing.lg }]}
                >
                  <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                    Cerrar
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Formulario */}
            {!completed && !justSent && (
              <>
                <ThemedText type="h3" style={{ textAlign: "center" }}>
                  Propina al repartidor
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}
                >
                  {driverName
                    ? `Agradece a ${driverName} por el pedido${orderLabel ? ` ${orderLabel}` : ""}`
                    : "Agradece el servicio del repartidor"}
                </ThemedText>

                {tipStatus?.status === "pending" && (
                  <View
                    style={[
                      styles.pendingBanner,
                      { backgroundColor: "#FFF8E1", borderColor: "#F59E0B" },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: "#B45309" }}>
                      Tienes una propina pendiente de verificación en este pedido.
                    </ThemedText>
                  </View>
                )}

                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
                  Elige el importe
                </ThemedText>
                <View style={styles.chipsRow}>
                  {QUICK_AMOUNTS.map((a) => {
                    const active = amount === a;
                    return (
                      <Pressable
                        key={a}
                        onPress={() => {
                          setAmount(a);
                          setCustomAmount("");
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? ComeYaColors.primary : theme.backgroundSecondary,
                            borderColor: active ? ComeYaColors.primary : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ color: active ? "#FFF" : theme.text, fontWeight: "600" }}
                        >
                          {a} €
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={customAmount}
                  onChangeText={(t) => {
                    setCustomAmount(t.replace(/[^0-9.,]/g, ""));
                    setAmount(null);
                  }}
                  placeholder="Otra cantidad (€)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: customAmount ? ComeYaColors.primary : theme.border,
                    },
                  ]}
                />

                {!isWeb && (
                  <>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
                      ¿Cómo quieres pagarla?
                    </ThemedText>
                    <View style={styles.chipsRow}>
                      {(
                        [
                          { id: "stripe", label: "Tarjeta", icon: "credit-card" },
                          { id: "manual", label: "Bizum/Transf.", icon: "smartphone" },
                        ] as const
                      ).map((opt) => {
                        const active = method === opt.id;
                        return (
                          <Pressable
                            key={opt.id}
                            onPress={() => setMethod(opt.id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: active ? ComeYaColors.primary : theme.backgroundSecondary,
                                borderColor: active ? ComeYaColors.primary : theme.border,
                              },
                            ]}
                          >
                            <Feather
                              name={opt.icon as any}
                              size={14}
                              color={active ? "#FFF" : theme.text}
                            />
                            <ThemedText
                              type="small"
                              style={{ color: active ? "#FFF" : theme.text, marginLeft: 4, fontWeight: "600" }}
                            >
                              {opt.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {method === "manual" && (
                  <>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
                    >
                      Envía el importe por Bizum/transferencia a la plataforma y adjunta
                      el comprobante. Se abona al repartidor cuando se verifica.
                    </ThemedText>
                    <Pressable onPress={pickProof} style={styles.proofButton}>
                      <Feather name="camera" size={16} color={ComeYaColors.primary} />
                      <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: 6, fontWeight: "600" }}>
                        {proof ? "Comprobante adjuntado ✓" : "Adjuntar comprobante"}
                      </ThemedText>
                    </Pressable>
                  </>
                )}

                <Pressable
                  onPress={submit}
                  disabled={sending}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: ComeYaColors.primary, marginTop: Spacing.xl },
                    sending && { opacity: 0.6 },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                      Enviar propina
                    </ThemedText>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: "85%",
    ...Shadows.lg,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C9C9C9",
    marginBottom: Spacing.md,
  },
  resultBox: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  pendingBanner: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  input: {
    marginTop: Spacing.sm,
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  primaryButton: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
});
