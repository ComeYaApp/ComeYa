import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { mockProducts } from "@/data/mockData";
import { Product } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { apiRequest } from "@/lib/query-client";

type ProductDetailRouteProp = RouteProp<RootStackParamList, "ProductDetail">;
type ProductDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ProductDetail"
>;

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<ProductDetailRouteProp>();
  const navigation = useNavigation<ProductDetailNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addToCart, cart, getCartItem } = useCart();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { productId, businessId, businessName } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitAmount, setUnitAmount] = useState("1");
  const [note, setNote] = useState("");
  const [showBusinessChangeModal, setShowBusinessChangeModal] = useState(false);

  const { data: favoriteData } = useQuery({
    queryKey: ["/api/favorites/check", user?.id, productId],
    enabled: !!user?.id,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (favoriteData?.isFavorite) {
        await apiRequest("DELETE", `/api/favorites/${favoriteData.favoriteId}`);
      } else {
        await apiRequest("POST", "/api/favorites", {
          userId: user?.id,
          productId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites/check", user?.id, productId] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  useEffect(() => {
    // Get product from navigation params (passed from BusinessDetailScreen)
    const productFromParams = route.params.product;
    if (productFromParams) {
      setProduct(productFromParams);
    }

    const existingItem = getCartItem(productId);
    if (existingItem) {
      setQuantity(existingItem.quantity);
      setNote(existingItem.note || "");
      if (existingItem.unitAmount) {
        setUnitAmount(existingItem.unitAmount.toString());
      }
    }
  }, [productId, businessId]);

  const handleAddToCart = async () => {
    if (!product) return;

    if (product.requiresNote && !note.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast(
        "Por favor agrega una especificación para este producto.",
        "warning",
      );
      return;
    }

    if (cart && cart.businessId !== businessId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowBusinessChangeModal(true);
      return;
    }

    await addToCart(
      product,
      businessId,
      businessName,
      quantity,
      note.trim() || undefined,
      product.isWeightBased ? parseFloat(unitAmount) || 1 : undefined,
    );
    navigation.goBack();
  };

  const handleConfirmBusinessChange = async () => {
    if (!product) return;
    await addToCart(
      product,
      businessId,
      businessName,
      quantity,
      note.trim() || undefined,
      product.isWeightBased ? parseFloat(unitAmount) || 1 : undefined,
    );
    setShowBusinessChangeModal(false);
    navigation.goBack();
  };

  const calculateTotal = () => {
    if (!product) return 0;
    if (product.isWeightBased) {
      return product.price * (parseFloat(unitAmount) || 1) * quantity;
    }
    return product.price * quantity;
  };

  if (!product) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <ThemedText type="h2">Producto no encontrado</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.image }}
            style={styles.productImage}
            contentFit="cover"
          />
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.closeButton, { backgroundColor: theme.card }]}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => toggleFavoriteMutation.mutate()}
            style={[styles.favoriteButton, { backgroundColor: theme.card }]}
          >
            <Feather
              name="heart"
              size={24}
              color={favoriteData?.isFavorite ? "#F44336" : theme.text}
              fill={favoriteData?.isFavorite ? "#F44336" : "none"}
            />
          </Pressable>
        </View>

        <View style={styles.content}>
          <ThemedText type="h1">{product.name}</ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            {product.description}
          </ThemedText>

          <View style={styles.priceRow}>
            <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
              ${product.price}
              {product.isWeightBased ? `/${product.unit}` : ""}
            </ThemedText>
            {!product.available ? (
              <Badge text="No disponible" variant="error" />
            ) : null}
          </View>

          {product.isWeightBased ? (
            <View
              style={[
                styles.weightSection,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                Cantidad ({product.unit})
              </ThemedText>
              <View style={styles.weightInputRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    const current = parseFloat(unitAmount) || 1;
                    if (current > 0.5) {
                      setUnitAmount((current - 0.5).toFixed(1));
                    }
                  }}
                  style={[
                    styles.quantityButton,
                    { backgroundColor: theme.card },
                  ]}
                >
                  <Feather name="minus" size={20} color={theme.text} />
                </Pressable>
                <TextInput
                  style={[
                    styles.weightInput,
                    { backgroundColor: theme.card, color: theme.text },
                  ]}
                  value={unitAmount}
                  onChangeText={setUnitAmount}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    const current = parseFloat(unitAmount) || 1;
                    setUnitAmount((current + 0.5).toFixed(1));
                  }}
                  style={[
                    styles.quantityButton,
                    { backgroundColor: theme.card },
                  ]}
                >
                  <Feather name="plus" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.noteSection, { borderColor: theme.border }]}>
            <View style={styles.noteLabelRow}>
              <ThemedText type="h4">
                {product.requiresNote
                  ? "Especificación (requerida)"
                  : "Nota (opcional)"}
              </ThemedText>
              {product.requiresNote ? (
                <Badge text="Requerido" variant="warning" />
              ) : null}
            </View>
            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor:
                    product.requiresNote && !note.trim()
                      ? ComeYaColors.warning
                      : "transparent",
                },
              ]}
              placeholder={
                product.isWeightBased
                  ? "Ej: Carne delgada sin grasa"
                  : "Instrucciones especiales..."
              }
              placeholderTextColor={theme.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.quantitySection}>
            <ThemedText type="h4">Cantidad</ThemedText>
            <View style={styles.quantityRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  if (quantity > 1) setQuantity(quantity - 1);
                }}
                style={[
                  styles.quantityButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="minus" size={20} color={theme.text} />
              </Pressable>
              <ThemedText type="h3" style={styles.quantityText}>
                {quantity}
              </ThemedText>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setQuantity(quantity + 1);
                }}
                style={[
                  styles.quantityButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="plus" size={20} color={theme.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <View style={styles.totalRow}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Total
          </ThemedText>
          <ThemedText type="h2">${calculateTotal().toFixed(2)}</ThemedText>
        </View>
        <Button
          onPress={handleAddToCart}
          disabled={!product.available}
          style={styles.addButton}
        >
          Agregar al carrito
        </Button>
      </View>

      <ConfirmModal
        visible={showBusinessChangeModal}
        title="¿Cambiar de negocio?"
        message="Ya tienes productos de otro negocio en tu carrito. ¿Deseas vaciar el carrito y agregar este producto?"
        confirmText="Cambiar"
        cancelText="Cancelar"
        confirmColor={ComeYaColors.error}
        icon="alert-circle"
        iconColor={ComeYaColors.warning}
        onConfirm={handleConfirmBusinessChange}
        onCancel={() => setShowBusinessChangeModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing["6xl"],
  },
  imageContainer: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: 280,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteButton: {
    position: "absolute",
    top: 50,
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.xl,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
  },
  weightSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  weightInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  weightInput: {
    width: 80,
    height: 48,
    borderRadius: BorderRadius.md,
    fontSize: 18,
    fontWeight: "600",
  },
  noteSection: {
    marginTop: Spacing.xl,
  },
  noteLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  noteInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    minHeight: 80,
    borderWidth: 2,
  },
  quantitySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    minWidth: 40,
    textAlign: "center",
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  addButton: {
    width: "100%",
  },
});
