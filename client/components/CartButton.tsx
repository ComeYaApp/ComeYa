import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useCart } from "@/contexts/CartContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";

interface CartButtonProps {
  onPress: () => void;
  bottomOffset?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CartButton({ onPress, bottomOffset = 0 }: CartButtonProps) {
  const { itemCount, subtotal, cart } = useCart();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  if (!cart || itemCount === 0) {
    return null;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        { bottom: insets.bottom + bottomOffset + Spacing.lg },
        Shadows.xl,
        animatedStyle,
      ]}
    >
      <View style={styles.leftContent}>
        <View style={styles.badge}>
          <ThemedText type="caption" style={styles.badgeText}>
            {itemCount}
          </ThemedText>
        </View>
        <ThemedText type="h4" style={styles.text}>
          Ver carrito
        </ThemedText>
      </View>
      <ThemedText type="h4" style={styles.text}>
        ${subtotal.toFixed(2)}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: ComeYaColors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  text: {
    color: "#FFFFFF",
  },
});
