import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { Business } from "@/types";
import { formatEuros } from "@/utils/currency";

interface BusinessCardProps {
  business: Business;
  onPress: () => void;
  compact?: boolean;
  cardWidth?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BusinessCard({
  business,
  onPress,
  compact = false,
  cardWidth,
}: BusinessCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  if (compact) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.compactCard,
          { backgroundColor: theme.card },
          Shadows.md,
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri: business.profileImage }}
          style={styles.compactImage}
          contentFit="cover"
        />
        <View style={styles.compactContent}>
          <ThemedText type="small" numberOfLines={1} style={styles.compactName}>
            {business.name}
          </ThemedText>
          <View style={styles.ratingRow}>
            <Feather name="star" size={12} color={ComeYaColors.warning} />
            <ThemedText type="caption" style={styles.ratingText}>
              {business.rating}
            </ThemedText>
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        { backgroundColor: theme.card },
        Shadows.md,
        animatedStyle,
        cardWidth ? { width: cardWidth } : undefined,
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: business.bannerImage }}
          style={styles.image}
          contentFit="cover"
        />
        {!business.isOpen ? (
          <View style={styles.closedOverlay}>
            <View style={styles.closedBadge}>
              <Feather name="lock" size={18} color="#FFFFFF" />
              <ThemedText type="small" style={styles.closedBadgeText}>
                CERRADO
              </ThemedText>
            </View>
          </View>
        ) : null}
        {business.type === "market" ? (
          <Badge text="Mercado" variant="primary" style={styles.typeBadge} />
        ) : null}
        {business.featured ? (
          <Badge text="Destacado" variant="warning" style={styles.featuredBadge} />
        ) : null}
      </View>
      <View style={[styles.content, !business.isOpen && styles.contentClosed]}>
        <View style={styles.header}>
          <ThemedText type="h4" numberOfLines={1} style={styles.name}>
            {business.name}
          </ThemedText>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color={ComeYaColors.warning} />
            <ThemedText type="small" style={styles.rating}>
              {business.rating > 0 ? business.rating.toFixed(1) : "Nuevo"}
            </ThemedText>
            {business.reviewCount > 0 && (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                ({business.reviewCount})
              </ThemedText>
            )}
          </View>
        </View>
        <ThemedText
          type="caption"
          numberOfLines={1}
          style={{ color: theme.textSecondary }}
        >
          {business.categories.join(" · ")}
        </ThemedText>
        <View style={styles.footer}>
          <View style={styles.deliveryInfo}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              style={[styles.deliveryText, { color: theme.textSecondary }]}
            >
              {business.deliveryTime}
            </ThemedText>
          </View>
          <View style={styles.deliveryInfo}>
            {business.distance != null && (
              <>
                <Feather name="map-pin" size={12} color={ComeYaColors.primary} />
                <ThemedText type="caption" style={{ color: ComeYaColors.primary, fontWeight: "600" }}>
                  {business.distance} km
                </ThemedText>
              </>
            )}
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: business.distance != null ? Spacing.md : 0 }}>
              Envío {formatEuros(business.deliveryFee)}
            </ThemedText>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 110,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  closedText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  closedBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1,
  },
  contentClosed: {
    opacity: 0.6,
  },
  featuredBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  typeBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  name: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: {
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveryText: {
    marginLeft: 2,
  },
  compactCard: {
    width: 140,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginRight: Spacing.md,
  },
  compactImage: {
    width: "100%",
    height: 100,
  },
  compactContent: {
    padding: Spacing.sm,
  },
  compactName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontWeight: "500",
  },
});
