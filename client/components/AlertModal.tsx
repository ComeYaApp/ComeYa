import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "./ThemedText";
import { Button } from "./Button";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";

const { width: screenWidth } = Dimensions.get("window");

type AlertType = "success" | "error" | "warning" | "info";

interface AlertModalProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onClose: () => void;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

export function AlertModal({
  visible,
  type,
  title,
  message,
  onClose,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  onConfirm,
  showCancel = false,
}: AlertModalProps) {
  const getIconConfig = () => {
    switch (type) {
      case "success":
        return { name: "check-circle" as const, color: ComeYaColors.success };
      case "error":
        return { name: "x-circle" as const, color: ComeYaColors.error };
      case "warning":
        return { name: "alert-triangle" as const, color: ComeYaColors.warning };
      case "info":
        return { name: "info" as const, color: ComeYaColors.primary };
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const iconConfig = getIconConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView intensity={20} tint="dark" style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modalContainer, Shadows.xl]}>
          <View style={[styles.iconContainer, { backgroundColor: `${iconConfig.color}15` }]}>
            <Feather name={iconConfig.name} size={48} color={iconConfig.color} />
          </View>

          <ThemedText type="h3" style={styles.title}>
            {title}
          </ThemedText>

          <ThemedText type="body" style={styles.message}>
            {message}
          </ThemedText>

          <View style={styles.buttonContainer}>
            {showCancel && (
              <Pressable
                onPress={handleCancel}
                style={[styles.button, styles.cancelButton]}
              >
                <ThemedText type="body" style={styles.cancelButtonText}>
                  {cancelText}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={handleConfirm}
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: iconConfig.color },
                !showCancel && styles.fullWidthButton,
              ]}
            >
              <ThemedText type="body" style={styles.confirmButtonText}>
                {confirmText}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: screenWidth - Spacing.xl * 2,
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    color: "#333333",
    textAlign: "center",
    marginBottom: Spacing.sm,
    fontWeight: "700",
  },
  message: {
    color: "#666666",
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  fullWidthButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cancelButtonText: {
    color: "#666666",
    fontWeight: "600",
  },
  confirmButton: {
    ...Shadows.sm,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
