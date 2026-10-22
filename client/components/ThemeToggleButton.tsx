import React from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "@/constants/theme";

interface ThemeToggleButtonProps {
  size?: number;
  variant?: "plain" | "navbar";
  style?: StyleProp<ViewStyle>;
}

export function ThemeToggleButton({
  size = 40,
  variant = "plain",
  style,
}: ThemeToggleButtonProps) {
  const { isDark, setThemeMode } = useTheme();

  const handleToggle = async () => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await setThemeMode(isDark ? "light" : "dark");
    } catch (error) {
      console.error("Theme toggle error:", error);
    }
  };

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel={
        isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      }
      testID="button-theme-toggle"
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        variant === "navbar" && {
          backgroundColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.04)",
        },
        style,
        pressed && styles.buttonPressed,
      ]}
    >
      <Feather
        name={isDark ? "sun" : "moon"}
        size={Math.round(size * 0.55)}
        color={isDark ? ComeYaColors.warning : ComeYaColors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
