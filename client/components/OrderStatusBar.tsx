import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, ComeYaColors } from "@/constants/theme";
import { OrderStatus } from "@/types";

interface OrderStatusBarProps {
  status: OrderStatus;
}

const STATUS_STEPS = [
  { key: "confirmed", label: "Recibido", icon: "check-circle" as const },
  { key: "preparing", label: "Preparando", icon: "loader" as const },
  { key: "on_the_way", label: "En camino", icon: "truck" as const },
  { key: "delivered", label: "Entregado", icon: "package" as const },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 2,
  picked_up: 3,
  on_the_way: 3,
  in_transit: 3,
  delivered: 4,
  cancelled: -1,
};

function StatusDot({
  isActive,
  isCompleted,
  isCurrent,
  index,
}: {
  isActive: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  index: number;
}) {
  const { theme } = useTheme();
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (isCurrent) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        true,
      );
    }
  }, [isCurrent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isCurrent ? pulseScale.value : 1 }],
  }));

  const backgroundColor = isCompleted
    ? ComeYaColors.primary
    : isActive
      ? ComeYaColors.primary
      : theme.border;

  return (
    <Animated.View style={[styles.dot, { backgroundColor }, animatedStyle]}>
      {isCompleted ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
    </Animated.View>
  );
}

export function OrderStatusBar({ status }: OrderStatusBarProps) {
  const { theme } = useTheme();
  const currentStep = STATUS_ORDER[status];

  if (status === "cancelled") {
    return (
      <View style={styles.cancelledContainer}>
        <Feather name="x-circle" size={24} color={ComeYaColors.error} />
        <ThemedText
          type="h4"
          style={{ color: ComeYaColors.error, marginLeft: Spacing.sm }}
        >
          Pedido cancelado
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stepsContainer}>
        {STATUS_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber;
          const isActive = currentStep >= stepNumber;
          const isCurrent = currentStep === stepNumber;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <StatusDot
                  isActive={isActive}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  index={index}
                />
                <ThemedText
                  type="caption"
                  style={[
                    styles.stepLabel,
                    {
                      color: isActive ? theme.text : theme.textSecondary,
                      fontWeight: isCurrent ? "700" : "400",
                    },
                  ]}
                >
                  {step.label}
                </ThemedText>
              </View>
              {index < STATUS_STEPS.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor: isCompleted
                        ? ComeYaColors.primary
                        : theme.border,
                    },
                  ]}
                />
              ) : null}
            </React.Fragment>
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
  stepsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stepItem: {
    alignItems: "center",
    width: 70,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  stepLabel: {
    textAlign: "center",
  },
  line: {
    flex: 1,
    height: 3,
    marginTop: 12,
    marginHorizontal: -8,
  },
  cancelledContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
});
