import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "danger";
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.modal, { backgroundColor: theme.card }, Shadows.lg]}
        >
          <ThemedText type="h3" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.message, { color: theme.textSecondary }]}
          >
            {message}
          </ThemedText>
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.button,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <ThemedText type="body">{cancelText}</ThemedText>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[
                styles.button,
                {
                  backgroundColor:
                    variant === "danger"
                      ? ComeYaColors.error
                      : ComeYaColors.primary,
                },
              ]}
            >
              <ThemedText type="body" style={{ color: "#FFF" }}>
                {confirmText}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  message: {
    marginBottom: Spacing.xl,
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
