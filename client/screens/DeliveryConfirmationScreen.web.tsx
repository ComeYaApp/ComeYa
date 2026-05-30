import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { captureFromCamera, fileToBase64 } from "@/utils/uploadImageWeb";

interface Props {
  orderId: string;
  orderDetails: {
    businessName: string;
    total: number;
    items: any[];
    deliveredAt: string;
  };
  onConfirmed: () => void;
  onDisputed: () => void;
}

const ISSUES = [
  { id: "never_arrived", label: "El pedido nunca llegó", icon: "x-circle" },
  { id: "wrong_items", label: "Productos incorrectos", icon: "shuffle" },
  { id: "damaged", label: "Productos dañados", icon: "alert-triangle" },
  { id: "incomplete", label: "Pedido incompleto", icon: "minus-circle" },
  { id: "quality", label: "Mala calidad", icon: "thumbs-down" },
  { id: "other", label: "Otro problema", icon: "help-circle" },
] as const;

export default function DeliveryConfirmationScreen({
  orderId,
  orderDetails,
  onConfirmed,
  onDisputed,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleTakePhoto = async () => {
    const url = await captureFromCamera("delivery-proofs");
    if (url) setProofPhoto(url);
  };

  const getGPSLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGettingLocation(false);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          setGettingLocation(false);
          reject(new Error("No se pudo obtener la ubicación"));
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  };

  const handleConfirmDelivery = async () => {
    if (
      window.confirm(
        "¿Confirmar entrega? Los fondos serán liberados al negocio y repartidor.",
      )
    ) {
      setLoading(true);
      try {
        // Obtener GPS
        let location = { latitude: 0, longitude: 0 };
        try {
          location = await getGPSLocation();
        } catch {}

        const res = await apiRequest(
          "POST",
          "/api/fund-release/confirm-delivery",
          {
            orderId,
            deliveryLatitude: location.latitude,
            deliveryLongitude: location.longitude,
            deliveryProofPhoto: proofPhoto,
          },
        );
        const data = await res.json();
        if (data.success) {
          Alert.alert(
            "¡Gracias!",
            "Tu confirmación ha sido registrada. Los fondos han sido liberados.",
            [{ text: "OK", onPress: onConfirmed }],
          );
        } else {
          throw new Error(
            data.error || data.message || "Error al confirmar entrega",
          );
        }
      } catch (error: any) {
        Alert.alert("Error", error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmitDispute = async () => {
    if (!selectedIssue) {
      Alert.alert("Error", "Por favor selecciona el tipo de problema");
      return;
    }
    if (selectedIssue === "other" && !disputeReason.trim()) {
      Alert.alert("Error", "Por favor describe el problema");
      return;
    }

    setLoading(true);
    try {
      const issue = ISSUES.find((i) => i.id === selectedIssue);
      const reason =
        selectedIssue === "other"
          ? disputeReason
          : issue?.label || "Problema con el pedido";
      const res = await apiRequest("POST", "/api/fund-release/dispute", {
        orderId,
        reason,
      });
      const data = await res.json();
      if (data.success) {
        setShowDisputeModal(false);
        Alert.alert(
          "Disputa registrada",
          "Tu caso será revisado por nuestro equipo.",
          [{ text: "OK", onPress: onDisputed }],
        );
      } else {
        throw new Error(
          data.error || data.message || "Error al registrar disputa",
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const deliveredAt = new Date(orderDetails.deliveredAt).toLocaleString(
    "es-ES",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <View
      style={[
        s.container,
        { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headerIcon}>
          <View
            style={[
              s.iconCircle,
              { backgroundColor: ComeYaColors.primary + "20" },
            ]}
          >
            <Feather
              name="check-circle"
              size={64}
              color={ComeYaColors.primary}
            />
          </View>
        </View>

        <ThemedText type="h2" style={s.title}>
          ¿Recibiste tu pedido?
        </ThemedText>
        <ThemedText
          type="body"
          style={[s.subtitle, { color: theme.textSecondary }]}
        >
          Confirma que todo está correcto para liberar el pago al negocio y
          repartidor
        </ThemedText>

        {/* Resumen */}
        <View
          style={[s.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={[s.orderHeader, { borderBottomColor: theme.border }]}>
            <View
              style={[
                s.businessIcon,
                { backgroundColor: ComeYaColors.primary + "20" },
              ]}
            >
              <Feather
                name="shopping-bag"
                size={20}
                color={ComeYaColors.primary}
              />
            </View>
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {orderDetails.businessName}
            </ThemedText>
          </View>
          <View style={s.orderDetail}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Total pagado
            </ThemedText>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              €{(orderDetails.total / 100).toFixed(2)}
            </ThemedText>
          </View>
          <View style={s.orderDetail}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Entregado
            </ThemedText>
            <ThemedText type="body">{deliveredAt}</ThemedText>
          </View>
        </View>

        {/* Foto de entrega (opcional en web) */}
        <View style={[s.photoSection, { backgroundColor: theme.card }]}>
          <ThemedText
            type="small"
            style={{ fontWeight: "600", marginBottom: Spacing.sm }}
          >
            Foto de entrega (opcional)
          </ThemedText>
          {proofPhoto ? (
            <View style={s.photoPreview}>
              <img
                src={proofPhoto}
                style={
                  {
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    borderRadius: 12,
                  } as any
                }
              />
              <Pressable
                style={s.removePhoto}
                onPress={() => setProofPhoto(null)}
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[s.photoBtn, { borderColor: theme.border }]}
              onPress={handleTakePhoto}
            >
              <Feather name="camera" size={24} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: 6 }}
              >
                Tomar foto
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* Info */}
        <View
          style={[s.infoCard, { backgroundColor: ComeYaColors.success + "15" }]}
        >
          <Feather name="info" size={20} color={ComeYaColors.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText
              type="small"
              style={{
                color: ComeYaColors.success,
                fontWeight: "700",
                marginBottom: 2,
              }}
            >
              ¿Por qué confirmar?
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Tu confirmación permite que el negocio y el repartidor reciban su
              pago. Si no confirmas en 24 horas, se liberará automáticamente.
            </ThemedText>
          </View>
        </View>

        <Pressable
          style={[
            s.confirmButton,
            {
              backgroundColor: ComeYaColors.primary,
              opacity: loading ? 0.7 : 1,
            },
          ]}
          onPress={handleConfirmDelivery}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={22} color="#fff" />
              <ThemedText type="body" style={s.confirmButtonText}>
                Sí, todo está bien
              </ThemedText>
            </>
          )}
        </Pressable>

        <Pressable
          style={[
            s.issueButton,
            { backgroundColor: theme.card, borderColor: ComeYaColors.error },
          ]}
          onPress={() => setShowDisputeModal(true)}
          disabled={loading}
        >
          <Feather name="alert-circle" size={22} color={ComeYaColors.error} />
          <ThemedText
            type="body"
            style={{
              color: ComeYaColors.error,
              marginLeft: Spacing.sm,
              fontWeight: "600",
            }}
          >
            Reportar un problema
          </ThemedText>
        </Pressable>

        <View style={[s.autoReleaseCard, { backgroundColor: theme.card }]}>
          <Feather name="clock" size={18} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              flex: 1,
              marginLeft: Spacing.sm,
            }}
          >
            Si no confirmas en 24 horas, el pago se liberará automáticamente.
          </ThemedText>
        </View>
      </ScrollView>

      {/* Modal disputa */}
      <Modal
        visible={showDisputeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: theme.card }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h3">Reportar problema</ThemedText>
              <Pressable onPress={() => setShowDisputeModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={s.modalBody}>
              <ThemedText
                type="body"
                style={{ fontWeight: "600", marginBottom: Spacing.md }}
              >
                ¿Qué problema tuviste?
              </ThemedText>
              {ISSUES.map((issue) => {
                const selected = selectedIssue === issue.id;
                return (
                  <Pressable
                    key={issue.id}
                    style={[
                      s.issueOption,
                      {
                        backgroundColor: selected
                          ? ComeYaColors.primary + "15"
                          : theme.backgroundSecondary,
                        borderColor: selected
                          ? ComeYaColors.primary
                          : theme.border,
                      },
                    ]}
                    onPress={() => setSelectedIssue(issue.id)}
                  >
                    <Feather
                      name={issue.icon as any}
                      size={22}
                      color={
                        selected ? ComeYaColors.primary : theme.textSecondary
                      }
                    />
                    <ThemedText
                      type="body"
                      style={{
                        flex: 1,
                        marginLeft: Spacing.sm,
                        color: selected ? ComeYaColors.primary : theme.text,
                      }}
                    >
                      {issue.label}
                    </ThemedText>
                    {selected && (
                      <Feather
                        name="check-circle"
                        size={20}
                        color={ComeYaColors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
              {selectedIssue === "other" && (
                <TextInput
                  style={[
                    s.textArea,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Describe el problema..."
                  placeholderTextColor={theme.textSecondary}
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              )}
            </ScrollView>
            <View style={[s.modalFooter, { borderTopColor: theme.border }]}>
              <Pressable
                style={[
                  s.submitButton,
                  {
                    backgroundColor: selectedIssue
                      ? ComeYaColors.error
                      : theme.backgroundSecondary,
                  },
                ]}
                onPress={handleSubmitDispute}
                disabled={!selectedIssue || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{
                      color: selectedIssue ? "#fff" : theme.textSecondary,
                      fontWeight: "700",
                    }}
                  >
                    Enviar reporte
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 60 },
  headerIcon: { alignItems: "center", marginVertical: 32 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl },
  orderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  businessIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  orderDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  photoSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  photoBtn: {
    height: 120,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  photoPreview: {
    position: "relative",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: 18,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  confirmButtonText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  issueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  autoReleaseCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalBody: { padding: Spacing.lg },
  issueOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
  },
  textArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 15,
    borderWidth: 1,
    marginTop: Spacing.sm,
    minHeight: 100,
  },
  modalFooter: { padding: Spacing.lg, borderTopWidth: 1 },
  submitButton: {
    padding: 16,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
});
