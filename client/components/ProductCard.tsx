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
import { useCart } from "@/contexts/CartContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ProductCard({ product, onPress }: ProductCardProps) {
  const { theme } = useTheme();
  const { isProductInCart, getCartItem } = useCart();
  const scale = useSharedValue(1);

  const inCart = isProductInCart(product.id);
  const cartItem = getCartItem(product.id);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const formatPrice = () => {
    if (product.isWeightBased) {
      return `$${product.price}/${product.unit}`;
    }
    return `$${product.price}`;
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        { backgroundColor: theme.card },
        Shadows.sm,
        animatedStyle,
        !product.available && styles.unavailable,
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={product.image ? { uri: product.image } : require("../../assets/images/delivery-hero.png")}
          style={styles.image}
          contentFit="cover"
        />
        {!product.available ? (
          <View style={styles.unavailableOverlay}>
            <ThemedText type="caption" style={styles.unavailableText}>
              No disponible
            </ThemedText>
          </View>
        ) : null}
        {inCart && cartItem ? (
          <View
            style={[styles.cartBadge, { backgroundColor: ComeYaColors.primary }]}
          >
            <ThemedText type="caption" style={styles.cartBadgeText}>
              {cartItem.quantity}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.content}>
        <ThemedText type="small" numberOfLines={2} style={styles.name}>
          {product.name}
        </ThemedText>
        <ThemedText
          type="caption"
          numberOfLines={2}
          style={{ color: theme.textSecondary, marginTop: 2 }}
        >
          {product.description}
        </ThemedText>
        <View style={styles.footer}>
          <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
            {formatPrice()}
          </ThemedText>
          {product.requiresNote ? (
            <Badge text="Nota requerida" variant="warning" />
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  unavailable: {
    opacity: 0.6,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 120,
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  unavailableText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cartBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  content: {
    padding: Spacing.md,
  },
  name: {
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
});
