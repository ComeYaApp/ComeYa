import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const response = await apiRequest("DELETE", "/api/auth/account");
      const data = await response.json();

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Cuenta eliminada correctamente", "success");
        // Cerrar sesión y volver al inicio
        await logout();
        navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
      } else {
        throw new Error(data.error || "Error al eliminar la cuenta");
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        error.message || "No se pudo eliminar la cuenta. Intenta nuevamente.",
        "error",
      );
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: "#F5F5F5" }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={ComeYaColors.primary} />
          </Pressable>
          <ThemedText type="hero" style={styles.title}>
            Eliminar cuenta
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            Esta acción es permanente e irreversible
          </ThemedText>
        </View>

        {/* Warning Card */}
        <View style={[styles.warningCard, Shadows.md]}>
          <Feather name="alert-triangle" size={48} color={ComeYaColors.error} />
          <ThemedText type="body" style={styles.warningText}>
            Al eliminar tu cuenta, se borrarán permanentemente todos tus datos personales. Esta acción no se puede deshacer.
          </ThemedText>
        </View>

        {/* What gets deleted */}
        <View style={[styles.card, Shadows.sm]}>
          <ThemedText type="small" style={styles.sectionTitle}>
            Datos que se eliminarán
          </ThemedText>
          <View style={styles.listItem}>
            <Feather name="user" size={18} color={ComeYaColors.error} />
            <ThemedText type="body" style={styles.listText}>
              Perfil personal (nombre, email, teléfono, DNI, foto)
            </ThemedText>
          </View>
          <View style={styles.listItem}>
            <Feather name="shopping-bag" size={18} color={ComeYaColors.error} />
            <ThemedText type="body" style={styles.listText}>
              Historial de pedidos y direcciones
            </ThemedText>
          </View>
          <View style={styles.listItem}>
            <Feather name="heart" size={18} color={ComeYaColors.error} />
            <ThemedText type="body" style={styles.listText}>
              Favoritos y preferencias
            </ThemedText>
          </View>
          <View style={styles.listItem}>
            <Feather name="message-circle" size={18} color={ComeYaColors.error} />
            <ThemedText type="body" style={styles.listText}>
              Mensajes y chats
            </ThemedText>
          </View>
          <View style={styles.listItem}>
            <Feather name="bell" size={18} color={ComeYaColors.error} />
            <ThemedText type="body" style={styles.listText}>
              Tokens de notificaciones
            </ThemedText>
          </View>
        </View>

        {/* What stays */}
        <View style={[styles.card, Shadows.sm]}>
          <ThemedText type="small" style={styles.sectionTitle}>
            Datos que se conservan (obligación legal)
          </ThemedText>
          <View style={styles.listItem}>
            <Feather name="file-text" size={18} color="#666" />
            <ThemedText type="body" style={styles.listText}>
              Registros financieros anonimizados (5 años)
            </ThemedText>
          </View>
          <View style={styles.listItem}>
            <Feather name="dollar-sign" size={18} color="#666" />
            <ThemedText type="body" style={styles.listText}>
              Comprobantes de pago anonimizados (5 años)
            </ThemedText>
          </View>
        </View>

        {/* Delete Button */}
        <Button
          onPress={() => {
            Haptics.selectionAsync();
            setShowConfirmModal(true);
          }}
          disabled={isLoading}
          style={{
            backgroundColor: ComeYaColors.error,
            marginTop: Spacing.lg,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={styles.deleteButtonContent}>
              <Feather name="trash-2" size={20} color="#FFF" />
              <ThemedText type="body" style={styles.deleteButtonText}>
                Eliminar mi cuenta permanentemente
              </ThemedText>
            </View>
          )}
        </Button>

        <ThemedText type="caption" style={styles.footerText}>
          Si tienes dudas, contáctanos en support@comeya.es antes de eliminar tu cuenta.
        </ThemedText>
      </ScrollView>

      <ConfirmModal
        visible={showConfirmModal}
        variant="danger"
        title="¿Eliminar cuenta?"
        message="Esta acción es IRREVERSIBLE. Todos tus datos personales serán eliminados permanentemente. Los registros financieros se conservarán anonimizados por obligación legal. ¿Estás completamente seguro?"
        confirmText="Sí, eliminar mi cuenta"
        cancelText="Cancelar"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowConfirmModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  title: { color: "#333" },
  subtitle: { color: "#666", marginTop: Spacing.xs },
  warningCard: {
    backgroundColor: "#FFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: ComeYaColors.error + "30",
  },
  warningText: {
    color: ComeYaColors.error,
    textAlign: "center",
    marginTop: Spacing.md,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#333",
    marginBottom: Spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  listText: {
    color: "#555",
    flex: 1,
  },
  deleteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  deleteButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },
  footerText: {
    textAlign: "center",
    color: "#888",
    marginTop: Spacing.lg,
  },
});