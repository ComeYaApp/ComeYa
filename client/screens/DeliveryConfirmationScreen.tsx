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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type DeliveryConfirmationRouteProp = RouteProp<
  { DeliveryConfirmation: { orderId: string; orderDetails: any } },
  "DeliveryConfirmation"
>;

const ISSUES = [
  { id: "never_arrived", label: "El pedido nunca llegó", icon: "x-circle" },
  { id: "wrong_items", label: "Productos incorrectos", icon: "shuffle" },
  { id: "damaged", label: "Productos dañados", icon: "alert-triangle" },
  { id: "incomplete", label: "Pedido incompleto", icon: "minus-circle" },
  { id: "quality", label: "Mala calidad", icon: "thumbs-down" },
  { id: "other", label: "Otro problema", icon: "help-circle" },
] as const;

export default function DeliveryConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute<DeliveryConfirmationRouteProp>();
  const { orderId, orderDetails } = route.params || {};

  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handlers for navigation callbacks
  const handleConfirmed = () => navigation.goBack();
  const handleDisputed = () => navigation.goBack();

  const handleConfirmDelivery = () => {
    Alert.alert(
      "¿Confirmar entrega?",
      "Al confirmar, los fondos serán liberados al negocio y repartidor. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setLoading(true);
            try {
              const res = await apiRequest(
                "POST",
                "/api/fund-release/confirm-delivery",
                { orderId },
              );
              const data = await res.json();
              if (data.success) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  "¡Gracias!",
                  "Tu confirmación ha sido registrada. Los fondos han sido liberados.",
                  [{ text: "OK", onPress: handleConfirmed }],
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
          },
        },
      ],
    );
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "Disputa registrada",
          "Tu caso será revisado por nuestro equipo. Te contactaremos pronto.",
          [{ text: "OK", onPress: handleDisputed }],
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
        styles.container,
        { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Icono principal */}
        <View style={styles.headerIcon}>
          <View
            style={[
              styles.iconCircle,
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

        <ThemedText type="h2" style={styles.title}>
          ¿Recibiste tu pedido?
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          Confirma que todo está correcto para liberar el pago al negocio y
          repartidor
        </ThemedText>

        {/* Resumen del pedido */}
        <View
          style={[
            styles.orderCard,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View
            style={[styles.orderHeader, { borderBottomColor: theme.border }]}
          >
            <View
              style={[
                styles.businessIcon,
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
          <View style={styles.orderDetail}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Total pagado
            </ThemedText>
            <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
              €{(orderDetails.total / 100).toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.orderDetail}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Entregado
            </ThemedText>
            <ThemedText type="body">{deliveredAt}</ThemedText>
          </View>
        </View>

        {/* Info */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: ComeYaColors.success + "15" },
          ]}
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

        {/* Botones */}
        <Pressable
          style={[
            styles.confirmButton,
            {
              backgroundColor: ComeYaColors.primary,
              opacity: loading ? 0.7 : 1,
            },
          ]}
          onPress={handleConfirmDelivery}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Feather name="check-circle" size={22} color="#FFF" />
              <ThemedText type="body" style={styles.confirmButtonText}>
                Sí, todo está bien
              </ThemedText>
            </>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.issueButton,
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

        {/* Auto-release */}
        <View style={[styles.autoReleaseCard, { backgroundColor: theme.card }]}>
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
            Podrás disputar hasta 3 días después.
          </ThemedText>
        </View>
      </ScrollView>

      {/* Modal de disputa */}
      <Modal
        visible={showDisputeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <ThemedText type="h3">Reportar problema</ThemedText>
              <Pressable
                onPress={() => setShowDisputeModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
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
                      styles.issueOption,
                      {
                        backgroundColor: selected
                          ? ComeYaColors.primary + "15"
                          : theme.backgroundSecondary,
                        borderColor: selected
                          ? ComeYaColors.primary
                          : theme.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedIssue(issue.id);
                      Haptics.selectionAsync();
                    }}
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
                    styles.textArea,
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

            <View
              style={[styles.modalFooter, { borderTopColor: theme.border }]}
            >
              <Pressable
                style={[
                  styles.submitButton,
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
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{
                      color: selectedIssue ? "#FFF" : theme.textSecondary,
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

const styles = StyleSheet.create({
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
  confirmButtonText: { color: "#FFF", fontWeight: "700", fontSize: 17 },
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
