import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function AdminSettlementsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState({
    visible: false,
    id: "",
    notes: "",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/weekly-settlement/admin/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        "POST",
        `/api/weekly-settlement/admin/approve/${id}`,
        {},
      );
      return response.json();
    },
    onSuccess: () => {
      showToast("Liquidación aprobada", "success");
      queryClient.invalidateQueries({
        queryKey: ["/api/weekly-settlement/admin/pending"],
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (data: { id: string; notes: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/weekly-settlement/admin/reject/${data.id}`,
        { notes: data.notes },
      );
      return response.json();
    },
    onSuccess: () => {
      showToast("Liquidación rechazada", "success");
      setRejectModal({ visible: false, id: "", notes: "" });
      queryClient.invalidateQueries({
        queryKey: ["/api/weekly-settlement/admin/pending"],
      });
    },
  });

  const settlements = data?.settlements || [];

  const renderSettlement = ({ item }: { item: any }) => {
    const weekStart = new Date(item.week_start).toLocaleDateString("es-VE");
    const weekEnd = new Date(item.week_end).toLocaleDateString("es-VE");

    return (
      <View style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4">{item.driver_name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {item.driver_phone}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 4 }}
            >
              Semana: {weekStart} - {weekEnd}
            </ThemedText>
          </View>
          <Badge
            text={item.status === "pending" ? "Pendiente" : "Enviado"}
            variant={item.status === "pending" ? "warning" : "info"}
          />
        </View>

        <View style={styles.amountRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Monto a liquidar:
          </ThemedText>
          <ThemedText type="h3" style={{ color: ComeYaColors.primary }}>
            {(item.amount_owed / 100).toFixed(2)} €
          </ThemedText>
        </View>

        {item.payment_proof_url && (
          <Pressable
            onPress={() => Alert.alert("Comprobante", item.payment_proof_url)}
            style={styles.proofButton}
          >
            <Feather name="image" size={16} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{ color: ComeYaColors.primary, marginLeft: 8 }}
            >
              Ver comprobante
            </ThemedText>
          </Pressable>
        )}

        {item.status === "submitted" && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  "Aprobar liquidación",
                  `¿Confirmar que ${item.driver_name} depositó ${(item.amount_owed / 100).toFixed(2)} €?`,
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Aprobar",
                      onPress: () => approveMutation.mutate(item.id),
                    },
                  ],
                );
              }}
              style={[
                styles.actionButton,
                { backgroundColor: ComeYaColors.success },
              ]}
            >
              <Feather name="check" size={18} color="#FFF" />
              <ThemedText type="small" style={{ color: "#FFF", marginLeft: 8 }}>
                Aprobar
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setRejectModal({ visible: true, id: item.id, notes: "" });
              }}
              style={[
                styles.actionButton,
                { backgroundColor: ComeYaColors.error },
              ]}
            >
              <Feather name="x" size={18} color="#FFF" />
              <ThemedText type="small" style={{ color: "#FFF", marginLeft: 8 }}>
                Rechazar
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="h2">Liquidaciones Semanales</ThemedText>
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary, marginTop: 4 }}
        >
          {settlements.length} pendientes
        </ThemedText>
      </View>

      <FlatList
        data={settlements}
        keyExtractor={(item: any) => item.id}
        renderItem={renderSettlement}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather
              name="check-circle"
              size={64}
              color={ComeYaColors.success}
            />
            <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
              Sin liquidaciones pendientes
            </ThemedText>
          </View>
        }
      />

      {/* Modal de rechazo */}
      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setRejectModal({ visible: false, id: "", notes: "" })
        }
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Rechazar liquidación</ThemedText>
              <Pressable
                onPress={() =>
                  setRejectModal({ visible: false, id: "", notes: "" })
                }
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="body" style={{ marginBottom: Spacing.md }}>
              Motivo del rechazo:
            </ThemedText>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Ej: Comprobante ilegible, monto incorrecto..."
              placeholderTextColor={theme.textSecondary}
              value={rejectModal.notes}
              onChangeText={(text) =>
                setRejectModal({ ...rejectModal, notes: text })
              }
              multiline
              numberOfLines={4}
            />

            <Pressable
              onPress={() => {
                if (!rejectModal.notes.trim()) {
                  showToast("Ingresa el motivo del rechazo", "warning");
                  return;
                }
                rejectMutation.mutate({
                  id: rejectModal.id,
                  notes: rejectModal.notes,
                });
              }}
              style={[
                styles.submitButton,
                { backgroundColor: ComeYaColors.error },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFF", fontWeight: "600" }}
              >
                Rechazar liquidación
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.md,
  },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
    textAlignVertical: "top",
  },
  submitButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
