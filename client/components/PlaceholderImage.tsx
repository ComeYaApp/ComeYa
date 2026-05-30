import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { ComeYaColors, BorderRadius } from "@/constants/theme";

interface PlaceholderImageProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
  icon?: keyof typeof Feather.glyphMap;
  text?: string;
}

export function PlaceholderImage({
  width = 100,
  height = 100,
  style,
  icon = "image",
  text,
}: PlaceholderImageProps) {
  return (
    <View style={[styles.container, { width, height }, style]}>
      <Feather
        name={icon}
        size={Math.min(width, height) * 0.3}
        color={ComeYaColors.textSecondary}
      />
      {text && (
        <ThemedText type="caption" style={styles.text}>
          {text}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  text: {
    marginTop: 4,
    textAlign: "center",
    color: ComeYaColors.textSecondary,
  },
});
