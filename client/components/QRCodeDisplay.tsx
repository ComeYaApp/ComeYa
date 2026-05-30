import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";

interface QRCodeDisplayProps {
  visible: boolean;
  code: string;
  qrData: string;
  onClose: () => void;
}

export function QRCodeDisplay({
  visible,
  code,
  qrData,
  onClose,
}: QRCodeDisplayProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.card },
            Shadows.lg,
          ]}
        >
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>

          <ThemedText
            type="h3"
            style={{ textAlign: "center", marginBottom: Spacing.lg }}
          >
            Código de Recogida
          </ThemedText>

          <View style={[styles.qrContainer, { backgroundColor: "#FFFFFF" }]}>
            <QRCode
              value={qrData}
              size={200}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>

          <View
            style={[
              styles.codeContainer,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              type="h1"
              style={{ fontFamily: "monospace", letterSpacing: 6 }}
            >
              {code}
            </ThemedText>
          </View>

          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.md,
            }}
          >
            Muestra este código al negocio al recoger tu pedido
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  qrContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  codeContainer: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
});
