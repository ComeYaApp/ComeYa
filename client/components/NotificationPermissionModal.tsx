import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";

interface NotificationPermissionModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function NotificationPermissionModal({
  visible,
  onAccept,
  onDecline,
}: NotificationPermissionModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: ComeYaColors.primaryLight },
            ]}
          >
            <Feather name="bell" size={40} color={ComeYaColors.primary} />
          </View>

          <ThemedText type="h3" style={styles.title}>
            Activa las notificaciones
          </ThemedText>

          <ThemedText
            type="body"
            style={[styles.description, { color: theme.textSecondary }]}
          >
            Te avisaremos cuando tu pedido esté listo, cuando llegue el
            repartidor y sobre ofertas especiales de tus negocios favoritos.
          </ThemedText>

          <View style={styles.benefits}>
            <View style={styles.benefitRow}>
              <Feather
                name="check-circle"
                size={18}
                color={ComeYaColors.success}
              />
              <ThemedText type="body" style={styles.benefitText}>
                Estado de tu pedido en tiempo real
              </ThemedText>
            </View>
            <View style={styles.benefitRow}>
              <Feather
                name="check-circle"
                size={18}
                color={ComeYaColors.success}
              />
              <ThemedText type="body" style={styles.benefitText}>
                Aviso cuando llegue el repartidor
              </ThemedText>
            </View>
            <View style={styles.benefitRow}>
              <Feather
                name="check-circle"
                size={18}
                color={ComeYaColors.success}
              />
              <ThemedText type="body" style={styles.benefitText}>
                Promociones y descuentos exclusivos
              </ThemedText>
            </View>
          </View>

          <Button onPress={onAccept} style={styles.acceptButton}>
            Activar notificaciones
          </Button>

          <Pressable onPress={onDecline} style={styles.declineButton}>
            <ThemedText
              type="body"
              style={[styles.declineText, { color: theme.textSecondary }]}
            >
              Ahora no
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: Spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: 340,
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
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  benefits: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  benefitText: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  acceptButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  declineButton: {
    padding: Spacing.sm,
  },
  declineText: {
    textAlign: "center",
  },
});
