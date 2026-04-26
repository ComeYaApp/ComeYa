import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, ComeYaColors } from "@/constants/theme";

export default function DriverMapScreen() {
  const { theme } = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <Feather name="map" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
        Mi Mapa GPS
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
        El mapa está disponible solo en la app móvil
      </ThemedText>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
});
