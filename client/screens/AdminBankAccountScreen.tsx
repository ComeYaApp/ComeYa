import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

export default function AdminBankAccountScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [clabe, setClabe] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notes, setNotes] = useState("");

  const { data } = useQuery({
    queryKey: ["/api/weekly-settlement/admin/bank-account"],
    onSuccess: (data: any) => {
      if (data?.bankAccount) {
        setBankName(data.bankAccount.bank_name || "");
        setAccountHolder(data.bankAccount.account_holder || "");
        setClabe(data.bankAccount.clabe || "");
        setAccountNumber(data.bankAccount.account_number || "");
        setNotes(data.bankAccount.notes || "");
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(
        "POST",
        "/api/weekly-settlement/admin/bank-account",
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      showToast("Cuenta bancaria guardada", "success");
      queryClient.invalidateQueries({
        queryKey: ["/api/weekly-settlement/admin/bank-account"],
      });
    },
  });

  const handleSave = () => {
    if (!bankName.trim() || !accountHolder.trim() || !clabe.trim()) {
      showToast("Completa los campos obligatorios", "warning");
      return;
    }

    if (clabe.length !== 18) {
      showToast("La CLABE debe tener 18 dígitos", "error");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveMutation.mutate({
      bankName: bankName.trim(),
      accountHolder: accountHolder.trim(),
      clabe: clabe.trim(),
      accountNumber: accountNumber.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="h2">Cuenta Bancaria</ThemedText>
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary, marginTop: 4 }}
        >
          Los drivers depositarán aquí sus liquidaciones
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <View style={styles.inputGroup}>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", marginBottom: 8 }}
            >
              Banco *
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Ej: BBVA, Santander, Banorte"
              placeholderTextColor={theme.textSecondary}
              value={bankName}
              onChangeText={setBankName}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", marginBottom: 8 }}
            >
              Titular de la cuenta *
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Nombre completo o razón social"
              placeholderTextColor={theme.textSecondary}
              value={accountHolder}
              onChangeText={setAccountHolder}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", marginBottom: 8 }}
            >
              CLABE Interbancaria * (18 dígitos)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  fontFamily: "monospace",
                },
              ]}
              placeholder="000000000000000000"
              placeholderTextColor={theme.textSecondary}
              value={clabe}
              onChangeText={(text) =>
                setClabe(text.replace(/\D/g, "").slice(0, 18))
              }
              keyboardType="numeric"
              maxLength={18}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", marginBottom: 8 }}
            >
              Número de cuenta (opcional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Número de cuenta"
              placeholderTextColor={theme.textSecondary}
              value={accountNumber}
              onChangeText={setAccountNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText
              type="body"
              style={{ fontWeight: "600", marginBottom: 8 }}
            >
              Notas (opcional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              placeholder="Información adicional"
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={[
              styles.saveButton,
              {
                backgroundColor: ComeYaColors.primary,
                opacity: saveMutation.isPending ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="save" size={20} color="#FFF" />
            <ThemedText
              type="body"
              style={{ color: "#FFF", marginLeft: 8, fontWeight: "600" }}
            >
              {saveMutation.isPending ? "Guardando..." : "Guardar Cuenta"}
            </ThemedText>
          </Pressable>
        </View>

        {data?.bankAccount && (
          <View
            style={[
              styles.previewCard,
              { backgroundColor: ComeYaColors.success + "20" },
            ]}
          >
            <Feather
              name="check-circle"
              size={24}
              color={ComeYaColors.success}
            />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText
                type="body"
                style={{ fontWeight: "600", marginBottom: 4 }}
              >
                Cuenta activa
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Los drivers verán esta información para depositar
              </ThemedText>
            </View>
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
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
