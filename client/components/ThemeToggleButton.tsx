import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing } from "@/constants/theme";

export function ThemeToggleButton() {
  const { isDark, setThemeMode } = useTheme();

  const handleToggle = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setThemeMode(isDark ? "light" : "dark");
    } catch (error) {
      console.error('Theme toggle error:', error);
    }
  };

  return (
    <Pressable
      onPress={handleToggle}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      testID="button-theme-toggle"
    >
      <Feather
        name={isDark ? "sun" : "moon"}
        size={22}
        color={isDark ? ComeYaColors.warning : ComeYaColors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
