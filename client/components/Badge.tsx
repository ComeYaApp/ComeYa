import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { ComeYaColors } from "@/constants/theme";

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "error";

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ text, variant = "primary", style }: BadgeProps) {
  const { theme: currentTheme } = useTheme();

  const getColors = () => {
    switch (variant) {
      case "primary":
        return {
          bg: ComeYaColors.primaryLight,
          text: ComeYaColors.primaryDark,
        };
      case "secondary":
        return {
          bg: currentTheme.backgroundSecondary,
          text: currentTheme.textSecondary,
        };
      case "success":
        return {
          bg: "#E8F5E9",
          text: ComeYaColors.success,
        };
      case "warning":
        return {
          bg: "#FFF8E1",
          text: "#F57C00",
        };
      case "error":
        return {
          bg: "#FFEBEE",
          text: ComeYaColors.error,
        };
      default:
        return {
          bg: ComeYaColors.primaryLight,
          text: ComeYaColors.primaryDark,
        };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <ThemedText type="caption" style={[styles.text, { color: colors.text }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
  },
});
