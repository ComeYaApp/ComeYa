import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: "Cambiar contraseña" });
  }, [navigation]);

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showToast("La contraseña actual es requerida", "error");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 8) {
      showToast("La nueva contraseña debe tener mínimo 8 caracteres", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Error al cambiar contraseña");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Contraseña actualizada correctamente", "success");
      navigation.goBack();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo cambiar la contraseña", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={[
            styles.headerSection,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <ThemedText type="h3" style={{ textAlign: "center" }}>
            Cambiar contraseña
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Actualiza tu contraseña para mantener tu cuenta segura
          </ThemedText>
        </View>

        {/* Form Section */}
        <View
          style={[
            styles.formSection,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View style={styles.formRow}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
              Contraseña actual
            </ThemedText>
            <View style={styles.inputContainer}>
              <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSecondary },
                ]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Ingresa tu contraseña actual"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
              Nueva contraseña
            </ThemedText>
            <View style={styles.inputContainer}>
              <Feather name="key" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSecondary },
                ]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Usa una combinación de letras, números y símbolos para mayor seguridad
            </ThemedText>
          </View>

          <View style={styles.formRow}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
              Confirmar nueva contraseña
            </ThemedText>
            <View style={styles.inputContainer}>
              <Feather name="check-circle" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSecondary },
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password requirements */}
          <View style={styles.infoBox}>
            <Feather name="shield" size={16} color={ComeYaColors.primary} />
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
            >
              La contraseña debe tener al menos 8 caracteres y no ser fácilmente predecible.
            </ThemedText>
          </View>
        </View>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.lg,
              backgroundColor: theme.backgroundSecondary,
              borderTopColor: theme.border,
            },
          ]}
        >
          <Button
            onPress={handleChangePassword}
            disabled={isLoading || !currentPassword.trim() || !newPassword.trim() || newPassword !== confirmPassword}
            loading={isLoading}
            style={styles.saveButton}
          >
            Actualizar contraseña
          </Button>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[
              styles.cancelButton,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Feather name="arrow-left" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              Cancelar
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerSection: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  formRow: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ComeYaColors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "white",
    marginTop: Spacing.sm,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: ComeYaColors.primary + "10",
    marginTop: Spacing.lg,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  saveButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});