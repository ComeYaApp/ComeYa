import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function WeeklySettlementScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [proofUrl, setProofUrl] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/weekly-settlement/driver/pending"],
  });

  const { data: walletData } = useQuery<{ success: boolean; wallet: { cashOwed: number } }>({
    queryKey: ["/api/wallet/balance"],
  });

  const { data: bankAccountData } = useQuery({
    queryKey: ["/api/admin/bank-account"],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { settlementId: string; proofUrl: string }) => {
      const response = await apiRequest("POST", "/api/weekly-settlement/driver/submit-proof", data);
      return response.json();
    },
    onSuccess: () => {
      showToast("Comprobante enviado correctamente", "success");
      setProofUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-settlement/driver/pending"] });
    },
    onError: () => {
      showToast("Error al enviar comprobante", "error");
    },
  });

  const settlement = data?.settlement;
  const bankAccount = data?.bankAccount || bankAccountData?.account;
  const currentDebt = (walletData?.wallet?.cashOwed || 0) / 100;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  if (!settlement && currentDebt === 0) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <ThemedText type="h2">Liquidación Semanal</ThemedText>
        </View>
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={64} color={ComeYaColors.success} />
          <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
            ¡Todo al día!
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            No tienes deudas pendientes
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Si no hay settlement pero sí hay deuda, mostrar deuda actual
  if (!settlement && currentDebt > 0) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <ThemedText type="h2">Liquidación Semanal</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            Deuda acumulada
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Monto a pagar */}
          <View style={[styles.amountCard, { backgroundColor: ComeYaColors.error }, Shadows.lg]}>
            <ThemedText type="caption" style={{ color: "#FFF", opacity: 0.8 }}>
              Debes depositar
            </ThemedText>
            <ThemedText type="h1" style={{ color: "#FFF", fontSize: 48, marginVertical: Spacing.sm }}>
              €{currentDebt.toFixed(2)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: "#FFF", opacity: 0.7 }}>
              Pedidos en efectivo pendientes de liquidar
            </ThemedText>
          </View>

          {/* Datos bancarios */}
          {bankAccount && (
            <View style={[styles.bankCard, { backgroundColor: theme.card }, Shadows.md]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Deposita a esta cuenta
              </ThemedText>
              
              <View style={styles.bankRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Banco:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.bank_name}</ThemedText>
              </View>
              
              <View style={styles.bankRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Titular:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.account_holder}</ThemedText>
              </View>
              
              <View style={styles.bankRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>CLABE:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600", fontFamily: "monospace" }}>
                  {bankAccount.clabe}
                </ThemedText>
              </View>
              
              {bankAccount.account_number && (
                <View style={styles.bankRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cuenta:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.account_number}</ThemedText>
                </View>
              )}
            </View>
          )}

          <View style={[styles.infoCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={20} color={ComeYaColors.primary} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>¿Ya depositaste?</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Sube tu comprobante de pago para que se reduzca tu deuda.
              </ThemedText>
            </View>
          </View>

          {/* Subir comprobante */}
          <View style={[styles.proofCard, { backgroundColor: theme.card }, Shadows.md]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Sube tu comprobante
            </ThemedText>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="URL del comprobante (ej: imgur.com/abc123)"
              placeholderTextColor={theme.textSecondary}
              value={proofUrl}
              onChangeText={setProofUrl}
            />
            
            <Pressable
              onPress={() => {
                if (!proofUrl.trim()) {
                  showToast("Ingresa la URL del comprobante", "warning");
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // Crear liquidación manual
                submitMutation.mutate({ settlementId: "manual", proofUrl: proofUrl.trim() });
              }}
              disabled={submitMutation.isPending}
              style={[styles.submitButton, { backgroundColor: ComeYaColors.success, opacity: submitMutation.isPending ? 0.5 : 1 }]}
            >
              <Feather name="upload" size={20} color="#FFF" />
              <ThemedText type="body" style={{ color: "#FFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
                {submitMutation.isPending ? "Enviando..." : "Enviar Comprobante"}
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const weekStart = new Date(settlement.week_start).toLocaleDateString("es-VE");
  const weekEnd = new Date(settlement.week_end).toLocaleDateString("es-VE");
  const deadline = new Date(settlement.created_at);
  deadline.setDate(deadline.getDate() + 2);
  const hoursLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="h2">Liquidación Semanal</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Semana del {weekStart} al {weekEnd}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alerta de tiempo */}
        {settlement.status === "pending" && hoursLeft < 24 && (
          <View style={[styles.alertCard, { backgroundColor: ComeYaColors.error + "20" }]}>
            <Feather name="alert-circle" size={24} color={ComeYaColors.error} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="body" style={{ color: ComeYaColors.error, fontWeight: "600" }}>
                ¡Tiempo límite!
              </ThemedText>
              <ThemedText type="small" style={{ color: ComeYaColors.error }}>
                Te quedan {hoursLeft} horas para depositar o serás bloqueado
              </ThemedText>
            </View>
          </View>
        )}

        {/* Monto a pagar */}
        <View style={[styles.amountCard, { backgroundColor: ComeYaColors.primary }, Shadows.lg]}>
          <ThemedText type="caption" style={{ color: "#FFF", opacity: 0.8 }}>
            Debes depositar
          </ThemedText>
          <ThemedText type="h1" style={{ color: "#FFF", fontSize: 48, marginVertical: Spacing.sm }}>
            €{(settlement.amount_owed / 100).toFixed(2)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: "#FFF", opacity: 0.7 }}>
            Comisiones de plataforma de la semana
          </ThemedText>
        </View>

        {/* Datos bancarios */}
        {bankAccount && (
          <View style={[styles.bankCard, { backgroundColor: theme.card }, Shadows.md]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Deposita a esta cuenta
            </ThemedText>
            
            <View style={styles.bankRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Banco:</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.bank_name}</ThemedText>
            </View>
            
            <View style={styles.bankRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Titular:</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.account_holder}</ThemedText>
            </View>
            
            <View style={styles.bankRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>CLABE:</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600", fontFamily: "monospace" }}>
                {bankAccount.clabe}
              </ThemedText>
            </View>
            
            {bankAccount.account_number && (
              <View style={styles.bankRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cuenta:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{bankAccount.account_number}</ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Subir comprobante */}
        {settlement.status === "pending" && (
          <View style={[styles.proofCard, { backgroundColor: theme.card }, Shadows.md]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Sube tu comprobante
            </ThemedText>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="URL del comprobante (ej: imgur.com/abc123)"
              placeholderTextColor={theme.textSecondary}
              value={proofUrl}
              onChangeText={setProofUrl}
            />
            
            <Pressable
              onPress={() => {
                if (!proofUrl.trim()) {
                  showToast("Ingresa la URL del comprobante", "warning");
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                submitMutation.mutate({ settlementId: settlement.id, proofUrl: proofUrl.trim() });
              }}
              disabled={submitMutation.isPending}
              style={[styles.submitButton, { backgroundColor: ComeYaColors.success, opacity: submitMutation.isPending ? 0.5 : 1 }]}
            >
              <Feather name="upload" size={20} color="#FFF" />
              <ThemedText type="body" style={{ color: "#FFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
                {submitMutation.isPending ? "Enviando..." : "Enviar Comprobante"}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* Estado: Enviado */}
        {settlement.status === "submitted" && (
          <View style={[styles.statusCard, { backgroundColor: ComeYaColors.warning + "20" }]}>
            <Feather name="clock" size={32} color={ComeYaColors.warning} />
            <ThemedText type="h4" style={{ color: ComeYaColors.warning, marginTop: Spacing.md }}>
              Comprobante en revisión
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Tu comprobante está siendo revisado por el equipo. Te notificaremos pronto.
            </ThemedText>
          </View>
        )}
      </ScrollView>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  amountCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  bankCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  proofCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  statusCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
});
