import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BusinessCard } from "@/components/BusinessCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { mockBusinesses } from "@/data/mockData";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type MarketsScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MarketsScreenNavigationProp>();
  const { theme } = useTheme();

  const markets = mockBusinesses.filter((b) => b.type === "market");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Mercados</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View
          style={[styles.infoBanner, { backgroundColor: "#4CAF50" + "15" }]}
        >
          <Feather name="info" size={20} color="#4CAF50" />
          <ThemedText type="small" style={styles.infoText}>
            En los mercados puedes especificar exactamente como quieres tus
            productos: "carne delgada sin grasa", "aguacates maduros", etc.
          </ThemedText>
        </View>

        {/* Markets List */}
        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Mercados disponibles
          </ThemedText>
          {markets.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onPress={() =>
                navigation.navigate("BusinessDetail", {
                  businessId: business.id,
                })
              }
            />
          ))}
        </View>

        {markets.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather
              name="shopping-bag"
              size={64}
              color={theme.textSecondary}
            />
            <ThemedText type="h3" style={styles.emptyTitle}>
              No hay mercados disponibles
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Pronto agregaremos mas mercados en tu zona
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    color: "#4CAF50",
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
});
