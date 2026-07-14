import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/Badge";
import { CartButton } from "@/components/CartButton";
import { ProductCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { mockBusinesses, mockProducts } from "@/data/mockData";
import { Business, Product } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type BusinessDetailRouteProp = RouteProp<RootStackParamList, "BusinessDetail">;
type BusinessDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BusinessDetail"
>;

export default function BusinessDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<BusinessDetailRouteProp>();
  const navigation = useNavigation<BusinessDetailNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { businessId } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { apiRequest } = await import("@/lib/query-client");
        const response = await apiRequest(
          "GET",
          `/api/businesses/${businessId}`,
        );
        const data = await response.json();

        if (data.success && data.business) {
          // Adapt backend data to frontend format
          const adaptedBusiness: Business = {
            id: data.business.id,
            name: data.business.name,
            description: data.business.description || "",
            type: data.business.type || "restaurant",
            profileImage:
              data.business.image ||
              "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
            bannerImage:
              data.business.coverImage ||
              data.business.image ||
              "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
            rating: (data.business.rating || 0) / 100,
            reviewCount: data.business.totalRatings || 0,
            deliveryTime: data.business.deliveryTime || "30-45 min",
            deliveryFee: (data.business.deliveryFee || 300) / 100,
            minimumOrder: (data.business.minOrder || 1000) / 100,
            isOpen:
              data.business.isOpen === true ||
              data.business.isOpen === 1 ||
              data.business.is_open === true ||
              data.business.is_open === 1,
            openingHours: [],
            address: data.business.address || "Soria, España",
            phone: data.business.phone || "",
            categories: data.business.categories
              ? data.business.categories.split(",")
              : [],
            featured: data.business.isFeatured || false,
          };

          const adaptedProducts: Product[] = (data.business.products || []).map(
            (p: any) => {
              console.log("🔍 Product raw data:", {
                name: p.name,
                isAvailable: p.isAvailable,
                is_available: p.is_available,
                available: p.available,
              });

              // Soportar tanto camelCase como snake_case
              const isAvailable =
                p.isAvailable === true ||
                p.isAvailable === 1 ||
                p.is_available === true ||
                p.is_available === 1;

              // Precio base en euros
              const basePrice = (p.price || 0) / 100;
              // Agregar comisión del 15%
              const priceWithCommission = basePrice * 1.15;

              return {
                id: p.id,
                name: p.name,
                description: p.description || "",
                price: priceWithCommission, // 👈 Precio con comisión incluida
                image:
                  p.image ||
                  "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
                category: p.category || "General",
                isAvailable: isAvailable,
                available: isAvailable,
                businessId: p.businessId || p.business_id,
              };
            },
          );

          setBusiness(adaptedBusiness);
          setProducts(adaptedProducts);
        } else {
          setBusiness(null);
          setProducts([]);
        }
      } catch (error) {
        console.error("Error loading business:", error);
        setBusiness(null);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [businessId]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))];
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const handleCall = () => {
    if (business?.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(`tel:${business.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (business?.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const phone = business.phone.replace(/\D/g, "");
      Linking.openURL(`https://wa.me/${phone}`);
    }
  };

  if (!business && !isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.notFound}>
          <ThemedText type="h2">Negocio no encontrado</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bannerContainer}>
          {business ? (
            <Image
              source={{ uri: business.bannerImage }}
              style={styles.banner}
              contentFit="cover"
            />
          ) : (
            <View
              style={[styles.banner, { backgroundColor: "#E0E0E0" }]}
            />
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.card }]}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>

        {business ? (
          <>
            <View style={styles.profileSection}>
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: business.profileImage }}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              </View>
              <View style={styles.businessInfo}>
                <ThemedText type="h2">{business.name}</ThemedText>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={16} color={ComeYaColors.warning} />
                  <ThemedText type="body" style={styles.rating}>
                    {business.rating}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    ({business.reviewCount} reseñas)
                  </ThemedText>
                </View>
                <View style={styles.badgeRow}>
                  <Badge
                    text={business.isOpen ? "Abierto" : "Cerrado"}
                    variant={business.isOpen ? "success" : "error"}
                  />
                  <Badge
                    text={
                      business.type === "market" ? "Mercado" : "Restaurante"
                    }
                    variant="secondary"
                  />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.infoCard,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {business.description}
              </ThemedText>
              <View style={styles.infoRow}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
                >
                  {business.deliveryTime}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Envío ${business.deliveryFee}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Min. ${business.minimumOrder}
                </ThemedText>
              </View>
              <View style={styles.contactRow}>
                <Pressable
                  onPress={handleCall}
                  style={[
                    styles.contactButton,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name="phone"
                    size={18}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Llamar
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleWhatsApp}
                  style={[styles.contactButton, { backgroundColor: "#25D366" }]}
                >
                  <Feather name="message-circle" size={18} color="#FFFFFF" />
                  <ThemedText
                    type="small"
                    style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}
                  >
                    WhatsApp
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
                contentContainerStyle={styles.categoriesContent}
              >
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(null);
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: !selectedCategory
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: !selectedCategory ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    Todos
                  </ThemedText>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedCategory(cat);
                    }}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor:
                          selectedCategory === cat
                            ? ComeYaColors.primary
                            : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          selectedCategory === cat ? "#FFFFFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {cat}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.productsSection}>
              <ThemedText type="h3" style={styles.productsSectionTitle}>
                {business.type === "market" ? "Productos" : "Menú"}
              </ThemedText>
              {isLoading ? (
                <>
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                </>
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    businessIsOpen={business?.isOpen}
                    onPress={() =>
                      navigation.navigate("ProductDetail", {
                        productId: product.id,
                        businessId: business.id,
                        businessName: business.name,
                      })
                    }
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <CartButton
        onPress={() => {
          if (!user) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            navigation.navigate("Login" as never);
          } else {
            navigation.navigate("Cart");
          }
        }}
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
    paddingBottom: 160,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerContainer: {
    position: "relative",
  },
  banner: {
    width: "100%",
    height: 200,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  profileSection: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginTop: -40,
    marginBottom: Spacing.lg,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  businessInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginTop: Spacing["3xl"],
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: 4,
  },
  rating: {
    fontWeight: "600",
    marginRight: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  infoCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9E9E9E",
    marginHorizontal: Spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  categoriesScroll: {
    marginBottom: Spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  productsSection: {
    paddingHorizontal: Spacing.lg,
  },
  productsSectionTitle: {
    marginBottom: Spacing.md,
  },
});
