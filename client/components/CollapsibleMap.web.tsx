import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

interface Location {
  latitude: number;
  longitude: number;
  title?: string;
}

interface CollapsibleMapProps {
  businessLocation?: Location;
  deliveryPersonLocation?: Location;
  customerLocation?: Location;
  isLoading?: boolean;
}

export function CollapsibleMap({
  businessLocation,
  deliveryPersonLocation,
  customerLocation,
  isLoading = false,
}: CollapsibleMapProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.webContainer,
        { backgroundColor: theme.backgroundSecondary },
      ]}
    >
      <Feather name="map-pin" size={24} color={ComeYaColors.primary} />
      <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
        Mapa disponible en la app
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
});
