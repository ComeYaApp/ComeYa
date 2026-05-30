import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { ThemedText } from "./ThemedText";
import { ComeYaColors, Spacing } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

interface OrderProgressBarProps {
  status: string;
  orderType?: "delivery" | "pickup";
}

const deliverySteps = [
  { key: "pending", label: "Pendiente", icon: "clock" },
  { key: "accepted", label: "Aceptado", icon: "check-circle" },
  { key: "preparing", label: "Preparando", icon: "package" },
  { key: "on_the_way", label: "En camino", icon: "truck" },
  { key: "delivered", label: "Entregado", icon: "check-circle" },
];

const pickupSteps = [
  { key: "pending", label: "Pendiente", icon: "clock" },
  { key: "accepted", label: "Aceptado", icon: "check-circle" },
  { key: "preparing", label: "Preparando", icon: "package" },
  { key: "ready", label: "Listo", icon: "shopping-bag" },
  { key: "delivered", label: "Recogido", icon: "check-circle" },
];

// Mapea statuses antiguos al nuevo sistema
const STATUS_INDEX_OVERRIDE: Record<string, number> = {
  ready: 2, // ready -> preparing
  assigned: 2, // assigned -> preparing
  assigned_driver: 2, // assigned_driver -> preparing
  picked_up: 3, // picked_up -> on_the_way
  in_transit: 3, // in_transit -> on_the_way
  arriving: 3, // arriving -> on_the_way
  confirmed: 1, // confirmed -> accepted
  cancelled: -1,
  refunded: -1,
};

export function OrderProgressBar({
  status,
  orderType = "delivery",
}: OrderProgressBarProps) {
  const statusSteps = orderType === "pickup" ? pickupSteps : deliverySteps;

  const resolvedIndex =
    STATUS_INDEX_OVERRIDE[status] !== undefined
      ? STATUS_INDEX_OVERRIDE[status]
      : statusSteps.findIndex((s) => s.key === status);
  const currentStepIndex = resolvedIndex;
  const progress =
    currentStepIndex >= 0
      ? ((currentStepIndex + 1) / statusSteps.length) * 100
      : 0;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();

    // Animación de pulso para el paso actual
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [status]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      {/* Barra de progreso */}
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {statusSteps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <View key={step.key} style={styles.step}>
              <Animated.View
                style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCircleCompleted,
                  isCurrent && { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Feather
                  name={step.icon as any}
                  size={16}
                  color={isCompleted ? "#FFF" : "#999"}
                />
              </Animated.View>
              <ThemedText
                type="caption"
                style={[
                  styles.stepLabel,
                  isCompleted && styles.stepLabelCompleted,
                ]}
              >
                {step.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: "100%",
    backgroundColor: ComeYaColors.primary,
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  step: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  stepCircleCompleted: {
    backgroundColor: ComeYaColors.primary,
  },
  stepLabel: {
    fontSize: 10,
    color: "#999",
    textAlign: "center",
  },
  stepLabelCompleted: {
    color: ComeYaColors.primary,
    fontWeight: "600",
  },
});
