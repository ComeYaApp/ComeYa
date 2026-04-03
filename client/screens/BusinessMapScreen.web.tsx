import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function BusinessMapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Mapa de Negocios</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.body}>
        <Feather name="map" size={48} color={theme.textSecondary} />
        <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
          El mapa solo está disponible en la app móvil
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
          Abre la app en Android o iOS para explorar negocios en el mapa
        </ThemedText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  body: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
});
