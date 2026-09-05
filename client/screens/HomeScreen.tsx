import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useBottomTabBarHeight,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import {
  useNavigation,
  CompositeNavigationProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ComeyaIcon, ComeyaIconName } from "@/components/icons/comeya/ComeyaIcon";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { BusinessCard } from "@/components/BusinessCard";
import { CartButton } from "@/components/CartButton";
import { BusinessCardSkeleton } from "@/components/SkeletonLoader";
import { HomeReserveMode } from "@/components/HomeReserveMode";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { Business } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { formatCurrency } from "@/utils/currency";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { calculateDistance } from "@/utils/distance";

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "HomeTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = Spacing.lg * 2;
const GRID_GAP = Spacing.sm;
// GRID_CARD_WIDTH se calcula dinámicamente en el componente

const filters: { id: string; name: string; icon: ComeyaIconName }[] = [
  { id: "rapido", name: "Rapido", icon: "rayo" },
  { id: "economico", name: "Economico", icon: "dolar" },
  { id: "popular", name: "Popular", icon: "estrella" },
  { id: "open", name: "Abierto ahora", icon: "reloj" },
];
const favoriteFilter = {
  id: "favorites",
  name: "Favoritos",
  icon: "corazon" as ComeyaIconName,
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { settings } = useApp();
  const showCarnivalBanner = false;
  const { width: windowWidth } = useWindowDimensions();
  // Limitar ancho en web escritorio
  const contentWidth = Math.min(windowWidth, 900);
  const GRID_CARD_WIDTH = (contentWidth - GRID_PADDING - GRID_GAP) / 2;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [featuredBusinesses, setFeaturedBusinesses] = useState<Business[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Modo de la Home: pedir (delivery/pickup) o reservar mesa
  const [homeMode, setHomeMode] = useState<"order" | "reserve">("order");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [sortMode, setSortMode] = useState<"distance" | "rating" | "time">(
    "distance",
  );
  const [favoriteBusinessIds, setFavoriteBusinessIds] = useState<
    Set<string | number>
  >(new Set());
  const { showToast } = useToast();

  // Funcionalidades reales de la app (sin mock data)
  const realFeatures: Array<{
    id: string;
    title: string;
    subtitle: string;
    gradient: [string, string, string];
    icon: ComeyaIconName;
    screen: keyof RootStackParamList;
  }> = [
    { id: "vip", title: "Hazte VIP", subtitle: "Envío gratis + 10% dto.", gradient: ["#FFC107", "#FB8C00", "#F4511E"], icon: "medalla", screen: "Subscriptions" },
    { id: "gift", title: "Tarjeta Regalo", subtitle: "El mejor detalle", gradient: ["#EC407A", "#D81B60", "#AD1457"], icon: "regalo", screen: "GiftCards" },
    { id: "points", title: "Tus Puntos", subtitle: "Gana recompensas", gradient: ["#AB47BC", "#8E24AA", "#6A1B9A"], icon: "estrella", screen: "Gamification" },
    { id: "referral", title: "Invita y Gana", subtitle: "Puntos por cada amigo", gradient: ["#29B6F6", "#0288D1", "#01579B"], icon: "corazon", screen: "Referral" },
  ];

  // Obtener ubicación del usuario
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || !isMounted) return;
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (isMounted && location?.coords) {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch { /* ubicación opcional */ }
    })();
    return () => { isMounted = false; };
  }, []);

  // Mapa de iconos de marca por categoría - clave = primera categoria del negocio
  const CATEGORY_STYLE: Record<
    string,
    { icon: ComeyaIconName; label: string }
  > = {
    pizza: { icon: "pizza", label: "Pizzas" },
    burger: { icon: "hamburguesa", label: "Hamburguesas" },
    burgers: { icon: "hamburguesa", label: "Hamburguesas" },
    hamburguesas: { icon: "hamburguesa", label: "Hamburguesas" },
    sushi: { icon: "sushi", label: "Sushi" },
    pollo: { icon: "pollo", label: "Pollo" },
    mariscos: { icon: "paella", label: "Mariscos" },
    paella: { icon: "paella", label: "Paella" },
    tacos: { icon: "taco", label: "Mexicana" },
    mexicana: { icon: "taco", label: "Mexicana" },
    ensaladas: { icon: "ensalada", label: "Ensaladas" },
    ramen: { icon: "ramen", label: "Ramen" },
    asiatica: { icon: "ramen", label: "Asiática" },
    postres: { icon: "postre", label: "Postres" },
    mercado: { icon: "mercado", label: "Mercado" },
    carniceria: { icon: "pollo", label: "Carnicería" },
  };

  // Genera categorias unicas usando SOLO la primera categoria de cada negocio
  const dynamicCategories = React.useMemo(() => {
    const seen = new Set<string>();
    const cats: { id: string; icon: ComeyaIconName; label: string }[] = [];
    businesses.forEach((b) => {
      const firstCat = b.categories[0]?.toLowerCase().trim();
      if (!firstCat || seen.has(firstCat)) return;
      seen.add(firstCat);
      const style = CATEGORY_STYLE[firstCat] || {
        icon: "lupa" as ComeyaIconName,
        label: firstCat.charAt(0).toUpperCase() + firstCat.slice(1),
      };
      cats.push({ id: firstCat, ...style });
    });
    return cats;
  }, [businesses]);

  const loadData = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/businesses");
      const data = await response.json();
      const rawBusinesses = data.businesses || [];

      console.log("🔍 Raw businesses from API:", rawBusinesses);

      // Adaptar datos del backend al formato del frontend
      const businessList: Business[] = rawBusinesses.map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description || "",
        type: b.type || "restaurant",
        profileImage:
          b.image ||
          "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
        bannerImage:
          b.cover_image ||
          b.image ||
          "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
        rating: (b.rating || 0) / 100, // Convertir de centavos a decimal
        reviewCount: b.total_ratings || 0,
        deliveryTime: b.delivery_time || "30-45 min",
        deliveryFee: (b.delivery_fee || 300) / 100,
        minimumOrder: (b.min_order || 1000) / 100,
        isOpen:
          b.isOpen === true ||
          b.isOpen === 1 ||
          b.is_open === true ||
          b.is_open === 1,
        openingHours: [],
        address: b.address || "Soria, España",
        phone: b.phone || "",
        categories: b.categories ? b.categories.split(",") : [],
        featured: b.is_featured || false,
      }));

      console.log("✅ Processed businesses:", businessList);
      console.log(
        "📊 Categories found:",
        businessList.map((b) => ({ name: b.name, categories: b.categories })),
      );

      setBusinesses(businessList);
      setFeaturedBusinesses(businessList.filter((b) => b.featured));
    } catch (error) {
      console.error("Error loading businesses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Búsqueda de productos cross-negocio
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await apiRequest(
          "GET",
          `/api/search/products?q=${encodeURIComponent(searchQuery)}`,
        );
        const data = await response.json();
        if (data.success) {
          setSearchResults(data.results || []);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  // Favoritos de negocio (estrella en la tarjeta del restaurante)
  const loadFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavoriteBusinessIds(new Set());
      return;
    }
    try {
      const response = await apiRequest("GET", "/api/favorites");
      const data = await response.json();
      const ids: (string | number)[] = (data?.favorites?.businesses || []).map(
        (b: any) => b.id,
      );
      setFavoriteBusinessIds(new Set(ids));
    } catch {
      /* favoritos opcionales */
    }
  }, [user?.id]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleBusinessFavorite = useCallback(
    async (businessId: string | number) => {
      if (!user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast(
          "Inicia sesión para guardar tus restaurantes favoritos.",
          "warning",
        );
        navigation.navigate("Login" as never);
        return;
      }
      const isFav = favoriteBusinessIds.has(businessId);
      setFavoriteBusinessIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(businessId);
        } else {
          next.add(businessId);
        }
        return next;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        if (isFav) {
          await apiRequest(
            "DELETE",
            `/api/favorites/business/${businessId}`,
          );
        } else {
          await apiRequest("POST", "/api/favorites", {
            itemType: "business",
            itemId: businessId,
          });
        }
      } catch {
        // revertir si la llamada falla
        setFavoriteBusinessIds((prev) => {
          const next = new Set(prev);
          if (isFav) {
            next.add(businessId);
          } else {
            next.delete(businessId);
          }
          return next;
        });
      }
    },
    [user, favoriteBusinessIds, showToast, navigation],
  );

  const filterBusinesses = useCallback(
    (businessList: Business[]) => {
      let filtered = [...businessList];

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            b.description.toLowerCase().includes(query) ||
            b.categories.some((cat) => cat.toLowerCase().includes(query)),
        );
      }

      if (activeCategory) {
        // Buscar en todas las categorias del negocio, no solo la primera
        filtered = filtered.filter((b) =>
          b.categories.some(
            (cat) => cat.toLowerCase().trim() === activeCategory,
          ),
        );
      }

      if (activeFilter) {
        switch (activeFilter) {
          case "rapido":
            filtered = filtered.filter((b) => {
              const time = parseInt(b.deliveryTime.split("-")[0]);
              return time <= 30;
            });
            break;
          case "economico":
            // deliveryFee está en euros: económico = envío hasta 3 €
            filtered = filtered.filter((b) => b.deliveryFee <= 3);
            break;
          case "popular":
            // Mostrar negocios destacados (featured)
            filtered = filtered.filter((b) => b.featured);
            break;
          case "open":
            filtered = filtered.filter((b) => b.isOpen);
            break;
          case "favorites":
            filtered = filtered.filter((b) => favoriteBusinessIds.has(b.id));
            break;
        }
      }

      return filtered;
    },
    [searchQuery, activeCategory, activeFilter, favoriteBusinessIds],
  );

  // Calcular distancias
  const businessesWithDistance = useMemo(() => {
    if (!userLocation) return businesses;
    return businesses.map(b => {
      if (b.latitude && b.longitude) {
        return { ...b, distance: parseFloat(calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude).toFixed(1)) };
      }
      return b;
    });
  }, [businesses, userLocation]);

  const filteredBusinesses = filterBusinesses(businessesWithDistance);

  // Ordenar por modo (distancia > rating > tiempo)
  const sortedBusinesses = useMemo(() => {
    const s = [...filteredBusinesses];
    s.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      if (sortMode === "distance" && a.distance != null && b.distance != null) return a.distance - b.distance;
      if (sortMode === "time") { const ta = parseInt(a.deliveryTime) || 0; const tb = parseInt(b.deliveryTime) || 0; return ta - tb; }
      return b.rating - a.rating;
    });
    return s;
  }, [filteredBusinesses, sortMode]);

  const restaurants = sortedBusinesses.filter((b) => b.type === "restaurant");
  const markets = sortedBusinesses.filter((b) => b.type === "market");
  const firstName = user?.name.split(" ")[0] || "Usuario";

  const hasActiveFilters = searchQuery.trim() || activeCategory || activeFilter;

  // Cuando hay filtros activos, mostrar todos los negocios (restaurantes + mercados)
  const displayBusinesses = hasActiveFilters ? sortedBusinesses : restaurants;

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing["4xl"] + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Franja de marca */}
        <Animated.View
          entering={FadeInDown.delay(50).springify()}
          style={styles.brandBand}
        >
          <Image
            source={require("../../assets/images/comeya-badge.png")}
            style={styles.brandBadge}
            contentFit="contain"
            pointerEvents="none"
          />
          <Image
            source={require("../../assets/images/comeya-wordmark-white.png")}
            style={styles.brandWordmark}
            contentFit="contain"
          />
        </Animated.View>

        {/* Conmutador Pedir / Reservar mesa */}
        <Animated.View
          entering={FadeInDown.delay(75).springify()}
          style={styles.modeSwitchContainer}
        >
          <Pressable
            onPress={() => {
              if (homeMode !== "order") {
                Haptics.selectionAsync();
                setHomeMode("order");
              }
            }}
            style={[
              styles.modeSwitchBtn,
              homeMode === "order" && styles.modeSwitchBtnActive,
              {
                backgroundColor:
                  homeMode === "order" ? ComeYaColors.primary : "transparent",
              },
            ]}
          >
            <Feather
              name="shopping-bag"
              size={15}
              color={homeMode === "order" ? "#FFF" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                color: homeMode === "order" ? "#FFF" : theme.textSecondary,
                fontWeight: "700",
                marginLeft: 5,
              }}
            >
              Pedir
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              if (homeMode !== "reserve") {
                Haptics.selectionAsync();
                setHomeMode("reserve");
              }
            }}
            style={[
              styles.modeSwitchBtn,
              homeMode === "reserve" && styles.modeSwitchBtnActive,
              {
                backgroundColor:
                  homeMode === "reserve" ? ComeYaColors.primary : "transparent",
              },
            ]}
          >
            <Feather
              name="calendar"
              size={15}
              color={homeMode === "reserve" ? "#FFF" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                color: homeMode === "reserve" ? "#FFF" : theme.textSecondary,
                fontWeight: "700",
                marginLeft: 5,
              }}
            >
              Reservar mesa
            </ThemedText>
          </Pressable>
        </Animated.View>

        {homeMode === "reserve" ? (
          <HomeReserveMode />
        ) : (
        <>

        {/* Question Header */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.questionContainer}
        >
          <ThemedText type="h1" style={styles.questionText}>
            ¿Qué quieres pedir hoy?
          </ThemedText>
        </Animated.View>

        {/* Quick Access Icons */}
        <Animated.View
          entering={FadeInRight.delay(150).springify()}
          style={styles.quickAccessContainer}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAccessScroll}
          >
            {[...dynamicCategories].map((item) => {
              const isActive = activeCategory === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveCategory(isActive ? null : item.id);
                  }}
                  style={({ pressed }) => [
                    styles.quickAccessItem,
                    {
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.quickAccessIcon,
                      isActive && styles.quickAccessIconActive,
                    ]}
                  >
                    <ComeyaIcon name={item.icon} size={30} color="#FFFFFF" />
                  </View>
                  <ThemedText
                    type="caption"
                    style={[
                      styles.quickAccessLabel,
                      isActive && styles.quickAccessLabelActive,
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <ComeyaIcon name="lupa" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar platillo o restaurante..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchLoading && (
            <ActivityIndicator size="small" color={ComeYaColors.primary} />
          )}
        </View>

        {/* Resultados de búsqueda de productos */}
        {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Productos ({searchResults.length})
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.sm }}
            >
              {searchResults.map((product: any, idx: number) => (
                <Pressable
                  key={`${product.id}-${idx}`}
                  onPress={() =>
                    navigation.navigate("BusinessDetail", {
                      businessId: product.business.id,
                    })
                  }
                  style={[
                    styles.productCard,
                    { backgroundColor: theme.card },
                    Shadows.sm,
                  ]}
                >
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                  <View style={{ padding: Spacing.sm }}>
                    <ThemedText
                      type="small"
                      style={{ fontWeight: "600" }}
                      numberOfLines={1}
                    >
                      {product.name}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary }}
                      numberOfLines={1}
                    >
                      {product.business.name}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: ComeYaColors.primary, marginTop: 2 }}
                    >
                      {formatCurrency(product.price)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {hasActiveFilters ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery("");
                setActiveCategory(null);
                setActiveFilter(null);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: theme.card,
                  borderColor: ComeYaColors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="x" size={14} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={[styles.filterText, { color: ComeYaColors.primary }]}
              >
                Limpiar
              </ThemedText>
            </Pressable>
          ) : null}
          {filters.map((filter) => (
            <Pressable
              key={filter.id}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(activeFilter === filter.id ? null : filter.id);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                activeFilter === filter.id
                  ? styles.filterChipActive
                  : styles.filterChipInactive,
                {
                  backgroundColor:
                    activeFilter === filter.id
                      ? ComeYaColors.primary
                      : theme.card,
                  borderColor:
                    activeFilter === filter.id
                      ? ComeYaColors.primary
                      : theme.border,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <ComeyaIcon
                name={filter.icon}
                size={15}
                color={
                  activeFilter === filter.id ? "#FFFFFF" : ComeYaColors.primary
                }
              />
              <ThemedText
                type="small"
                style={[
                  styles.filterText,
                  {
                    color:
                      activeFilter === filter.id ? "#FFFFFF" : theme.text,
                  },
                ]}
              >
                {filter.name}
              </ThemedText>
            </Pressable>
          ))}
          {user && (
            <Pressable
              key={favoriteFilter.id}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(
                  activeFilter === favoriteFilter.id ? null : favoriteFilter.id,
                );
              }}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor:
                    activeFilter === favoriteFilter.id
                      ? ComeYaColors.primary
                      : theme.card,
                  borderColor:
                    activeFilter === favoriteFilter.id
                      ? ComeYaColors.primary
                      : theme.border,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <ComeyaIcon
                name={
                  activeFilter === favoriteFilter.id
                    ? "corazonRelleno"
                    : "corazon"
                }
                size={15}
                color={
                  activeFilter === favoriteFilter.id
                    ? "#FFFFFF"
                    : ComeYaColors.primary
                }
              />
              <ThemedText
                type="small"
                style={[
                  styles.filterText,
                  {
                    color:
                      activeFilter === favoriteFilter.id
                        ? "#FFFFFF"
                        : theme.text,
                  },
                ]}
              >
                {favoriteFilter.name}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>

        {/* Promotions Carousel */}
        {!hasActiveFilters && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3" style={{ marginBottom: 0 }}>Promociones</ThemedText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
              {realFeatures.map((feature) => (
                <Pressable
                  key={feature.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(feature.screen as any); }}
                  style={({ pressed }) => [styles.promoCard, Shadows.md, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <LinearGradient colors={feature.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoGradient}>
                    <View style={styles.promoIconContainer}>
                      <ComeyaIcon name={feature.icon} size={26} color="#FFFFFF" />
                    </View>
                    <View style={styles.promoTextContainer}>
                      <Text style={styles.promoTitle}>{feature.title}</Text>
                      <Text style={styles.promoSubtitle}>{feature.subtitle}</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sort Mode Selector */}
        {!hasActiveFilters && userLocation && (
          <View style={styles.sortRow}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setSortMode("distance"); }} style={[styles.sortChip, sortMode === "distance" && styles.sortChipActive]}>
              <ComeyaIcon name="mapa" size={12} color={sortMode === "distance" ? "#FFFFFF" : theme.textSecondary} />
              <ThemedText type="caption" style={sortMode === "distance" ? styles.sortChipTextActive : styles.sortChipText}>Más cerca</ThemedText>
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setSortMode("rating"); }} style={[styles.sortChip, sortMode === "rating" && styles.sortChipActive]}>
              <ComeyaIcon name="estrella" size={12} color={sortMode === "rating" ? "#FFFFFF" : theme.textSecondary} />
              <ThemedText type="caption" style={sortMode === "rating" ? styles.sortChipTextActive : styles.sortChipText}>Mejor rating</ThemedText>
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setSortMode("time"); }} style={[styles.sortChip, sortMode === "time" && styles.sortChipActive]}>
              <ComeyaIcon name="reloj" size={12} color={sortMode === "time" ? "#FFFFFF" : theme.textSecondary} />
              <ThemedText type="caption" style={sortMode === "time" ? styles.sortChipTextActive : styles.sortChipText}>Más rápido</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Carnival Banner (disabled) */}
        {showCarnivalBanner && settings.carnivalEnabled ? (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Carnival");
              }}
              style={({ pressed }) => [
                styles.carnivalBanner,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={[ComeYaColors.carnival.pink, "#7B1FA2", "#6A1B9A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.carnivalGradient}
              >
                <View style={styles.carnivalSparkles}>
                  <View style={[styles.sparkle, { top: 10, left: 20 }]} />
                  <View style={[styles.sparkle, { top: 30, right: 40 }]} />
                  <View style={[styles.sparkle, { bottom: 15, left: 60 }]} />
                  <View style={[styles.sparkle, { bottom: 25, right: 20 }]} />
                </View>
                <View style={styles.carnivalContent}>
                  <View style={styles.carnivalTextContainer}>
                    <View style={styles.carnivalBadge}>
                      <Feather
                        name="star"
                        size={10}
                        color={ComeYaColors.carnival.gold}
                      />
                      <ThemedText
                        type="caption"
                        style={styles.carnivalBadgeText}
                      >
                        EVENTO ESPECIAL
                      </ThemedText>
                    </View>
                    <ThemedText type="h3" style={styles.carnivalTitle}>
                      Carnaval Soria 2026
                    </ThemedText>
                    <View style={styles.carnivalCTA}>
                      <ThemedText type="small" style={styles.carnivalSubtitle}>
                        Ver programa de eventos
                      </ThemedText>
                      <Feather name="chevron-right" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.carnivalIconContainer}>
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.3)",
                        "rgba(255,255,255,0.1)",
                      ]}
                      style={styles.carnivalIconBg}
                    >
                      <Feather name="calendar" size={28} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Cargando restaurantes...
            </ThemedText>
            {[1, 2, 3, 4].map((i) => (
              <BusinessCardSkeleton key={`skeleton-${i}`} />
            ))}
          </View>
        ) : hasActiveFilters && filteredBusinesses.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View
              style={[
                styles.emptyStateIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="search" size={40} color={theme.textSecondary} />
            </View>
            <ThemedText type="h3" style={styles.emptyStateTitle}>
              Sin resultados
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.emptyStateText, { color: theme.textSecondary }]}
            >
              No encontramos negocios con esos filtros.
              {"\n"}Intenta con otra busqueda o categoria.
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery("");
                setActiveCategory(null);
                setActiveFilter(null);
              }}
              style={[
                styles.emptyStateClearButton,
                { backgroundColor: ComeYaColors.primary },
              ]}
            >
              <Feather name="x" size={16} color="#FFFFFF" />
              <ThemedText
                type="body"
                style={{
                  color: "#FFFFFF",
                  fontWeight: "600",
                  marginLeft: Spacing.xs,
                }}
              >
                Limpiar filtros
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Recomendados de Soria — negocios destacados (plan Top Soria) */}
            {!hasActiveFilters && featuredBusinesses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <ThemedText type="h3" style={styles.sectionTitle}>
                    Los Recomendados de Soria
                  </ThemedText>
                  <Feather name="award" size={18} color={ComeYaColors.primary} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredScroll}
                >
                  {featuredBusinesses.slice(0, 10).map((business, index) => (
                    <Pressable
                      key={`featured-${business.id || index}`}
                      onPress={() =>
                        navigation.navigate("BusinessDetail", {
                          businessId: business.id,
                        })
                      }
                      style={({ pressed }) => [
                        styles.recommendedCard,
                        {
                          backgroundColor: theme.card,
                          opacity: pressed ? 0.9 : 1,
                        },
                        Shadows.md,
                      ]}
                    >
                      <Image
                        source={{ uri: business.bannerImage }}
                        style={styles.recommendedImage}
                        contentFit="cover"
                      />
                      <View style={styles.recommendedInfo}>
                        <ThemedText
                          type="small"
                          style={styles.gridName}
                          numberOfLines={1}
                        >
                          {business.name}
                        </ThemedText>
                        <View style={styles.gridMeta}>
                          <View style={styles.ratingSmall}>
                            <Feather name="star" size={10} color="#FFB800" />
                            <ThemedText
                              type="caption"
                              style={{ marginLeft: 2 }}
                            >
                              {business.rating > 0
                                ? business.rating.toFixed(1)
                                : "Nuevo"}
                            </ThemedText>
                          </View>
                          <View
                            style={[
                              styles.featuredOpenDot,
                              {
                                backgroundColor: business.isOpen
                                  ? "#10B981"
                                  : "#6B7280",
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Restaurant Grid - Todos los restaurantes */}
            {displayBusinesses.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  {hasActiveFilters
                    ? `Resultados (${displayBusinesses.length})`
                    : "Todos los restaurantes"}
                </ThemedText>
                <View style={styles.gridContainer}>
                  {displayBusinesses.map((business, index) => (
                    <Pressable
                      key={business.id || `restaurant-${index}`}
                      onPress={() =>
                        navigation.navigate("BusinessDetail", {
                          businessId: business.id,
                        })
                      }
                      style={({ pressed }) => [
                        styles.gridCard,
                        {
                          width: GRID_CARD_WIDTH,
                          backgroundColor: theme.card,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: business.bannerImage }}
                        style={styles.gridImage}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={() => toggleBusinessFavorite(business.id)}
                        style={({ pressed }) => [
                          styles.gridFavButton,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                        hitSlop={6}
                      >
                        <ComeyaIcon
                          name={
                            favoriteBusinessIds.has(business.id)
                              ? "estrellaRellena"
                              : "estrella"
                          }
                          size={14}
                          color="#FFFFFF"
                        />
                      </Pressable>
                      <View
                        style={[
                          styles.gridOpenBadge,
                          {
                            backgroundColor: business.isOpen
                              ? "#10B981"
                              : "#6B7280",
                          },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={styles.gridOpenBadgeText}
                        >
                          {business.isOpen ? "Abierto" : "Cerrado"}
                        </ThemedText>
                      </View>
                      <View style={styles.gridInfo}>
                        <ThemedText
                          type="small"
                          style={styles.gridName}
                          numberOfLines={1}
                        >
                          {business.name}
                        </ThemedText>
                        <View style={styles.gridMeta}>
                          <View style={styles.ratingSmall}>
                            <Feather name="star" size={10} color="#FFB800" />
                            <ThemedText
                              type="caption"
                              style={{ marginLeft: 2 }}
                            >
                              {business.rating > 0
                                ? business.rating.toFixed(1)
                                : "Nuevo"}
                            </ThemedText>
                          </View>
                          <ThemedText
                            type="caption"
                            style={{ color: theme.textSecondary }}
                          >
                            {business.deliveryTime}
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Markets Section - Prominent Button - Solo mostrar si NO hay filtros */}
            {!hasActiveFilters && (
              <Animated.View
                entering={FadeInDown.delay(300).springify()}
                style={styles.section}
              >
                <View style={styles.bannerRow}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      navigation.navigate("BusinessList");
                    }}
                    style={({ pressed }) => [
                      styles.marketsBanner,
                      styles.bannerHalf,
                      {
                        backgroundColor: ComeYaColors.primary,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                      Shadows.md,
                    ]}
                  >
                    <LinearGradient
                      colors={[ComeYaColors.primary, "#E65100", "#D84315"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.marketsGradient}
                    >
                      <View
                        style={[
                          styles.marketsContent,
                          { flexDirection: "column", alignItems: "center" },
                        ]}
                      >
                        <Feather name="compass" size={28} color="#FFFFFF" />
                        <ThemedText
                          type="small"
                          style={[
                            styles.marketsTitle,
                            { marginTop: Spacing.sm, textAlign: "center" },
                          ]}
                        >
                          Explorar
                        </ThemedText>
                      </View>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      navigation.navigate("BusinessMap");
                    }}
                    style={({ pressed }) => [
                      styles.marketsBanner,
                      styles.bannerHalf,
                      {
                        backgroundColor: "#1565C0",
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                      Shadows.md,
                    ]}
                  >
                    <LinearGradient
                      colors={["#1E88E5", "#1565C0", "#0D47A1"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.marketsGradient}
                    >
                      <View
                        style={[
                          styles.marketsContent,
                          { flexDirection: "column", alignItems: "center" },
                        ]}
                      >
                        <Feather name="map" size={28} color="#FFFFFF" />
                        <ThemedText
                          type="small"
                          style={[
                            styles.marketsTitle,
                            { marginTop: Spacing.sm, textAlign: "center" },
                          ]}
                        >
                          Ver mapa
                        </ThemedText>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Markets Section - Original - Solo mostrar si NO hay filtros */}
            {!hasActiveFilters && (
              <Animated.View
                entering={FadeInDown.delay(350).springify()}
                style={styles.section}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate("Markets");
                  }}
                  style={({ pressed }) => [
                    styles.marketsBanner,
                    {
                      backgroundColor: "#4CAF50",
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                    Shadows.md,
                  ]}
                >
                  <LinearGradient
                    colors={["#66BB6A", "#4CAF50", "#43A047"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.marketsGradient}
                  >
                    <View style={styles.marketsContent}>
                      <View style={styles.marketsIconContainer}>
                        <Feather
                          name="shopping-bag"
                          size={32}
                          color="#FFFFFF"
                        />
                      </View>
                      <View style={styles.marketsTextContainer}>
                        <ThemedText type="h3" style={styles.marketsTitle}>
                          Ver Mercados
                        </ThemedText>
                        <View style={styles.marketsCTA}>
                          <ThemedText
                            type="small"
                            style={styles.marketsSubtitle}
                          >
                            Frutas, verduras, carnes y mas
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.marketsArrow}>
                        <Feather
                          name="chevron-right"
                          size={24}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            )}

            {/* Markets Preview - Solo mostrar si NO hay filtros activos */}
            {!hasActiveFilters && markets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="h3" style={styles.sectionTitle}>
                    Mercados cerca de ti
                  </ThemedText>
                  <Feather
                    name="shopping-bag"
                    size={20}
                    color={theme.textSecondary}
                  />
                </View>
                {markets.map((business, index) => (
                  <BusinessCard
                    key={business.id || `market-${index}`}
                    business={business}
                    onPress={() =>
                      navigation.navigate("BusinessDetail", {
                        businessId: business.id,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
        </>
        )}
      </ScrollView>

      <CartButton
        onPress={() => navigation.navigate("Cart")}
        bottomOffset={tabBarHeight}
      />
    </LinearGradient>
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
    paddingHorizontal: Spacing.lg,
  },
  brandBand: {
    backgroundColor: ComeYaColors.primary,
    marginHorizontal: -Spacing.lg,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  brandBadge: {
    position: "absolute",
    left: Spacing.lg,
    top: 16,
    width: 64,
    height: 64,
  },
  brandWordmark: {
    width: 216,
    height: 74,
  },
  modeSwitchContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(128,128,128,0.12)",
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  modeSwitchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modeSwitchBtnActive: {
    ...Shadows.sm,
  },
  questionContainer: {
    marginBottom: Spacing.lg,
  },
  questionText: {
    fontSize: 26,
  },
  quickAccessContainer: {
    marginBottom: Spacing.md,
  },
  quickAccessScroll: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
  },
  quickAccessItem: {
    alignItems: "center",
    width: 76,
  },
  quickAccessIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: ComeYaColors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  quickAccessIconActive: {
    borderWidth: 3,
    borderColor: ComeYaColors.primaryDark,
  },
  quickAccessLabel: {
    textAlign: "center",
    fontWeight: "500",
  },
  quickAccessLabelActive: {
    color: ComeYaColors.primary,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  filtersContainer: {
    marginBottom: Spacing.lg,
  },
  filtersContent: {
    paddingRight: Spacing.lg,
    gap: Spacing.sm,
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: ComeYaColors.primary,
    borderColor: ComeYaColors.primary,
  },
  filterChipInactive: {
    backgroundColor: "transparent",
  },
  filterText: {
    fontWeight: "600",
  },
  carnivalBanner: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  carnivalGradient: {
    padding: Spacing.lg,
  },
  carnivalContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  carnivalTextContainer: {
    flex: 1,
  },
  carnivalTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  carnivalSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  carnivalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  carnivalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  carnivalSparkles: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  sparkle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  carnivalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    marginBottom: Spacing.xs,
  },
  carnivalBadgeText: {
    color: ComeYaColors.carnival.gold,
    fontWeight: "600",
    marginLeft: 4,
    fontSize: 10,
  },
  carnivalCTA: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  featuredCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: 180,
  },
  popularBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  popularBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
  featuredInfo: {
    padding: Spacing.md,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  gridSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.xl,
    gap: GRID_GAP,
  },
  gridCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: 100,
  },
  gridFavButton: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: ComeYaColors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  gridOpenBadge: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  gridOpenBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  featuredScroll: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  recommendedCard: {
    width: 150,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  recommendedImage: {
    width: "100%",
    height: 90,
  },
  recommendedInfo: {
    padding: Spacing.sm,
  },
  featuredOpenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gridInfo: {
    padding: Spacing.sm,
  },
  gridName: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  gridMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  economicBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  popularSmallBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingSmall: {
    flexDirection: "row",
    alignItems: "center",
  },
  marketsBanner: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  bannerRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  bannerHalf: {
    flex: 1,
    padding: Spacing.lg,
  },
  marketsContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  marketsIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  marketsTextContainer: {
    flex: 1,
  },
  marketsTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  marketsSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  marketsGradient: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  marketsCTA: {
    flexDirection: "row",
    alignItems: "center",
  },
  marketsArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyStateTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyStateClearButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  productCard: {
    width: 140,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  productImage: {
    width: 140,
    height: 100,
  },
  // Promotions
  promoCard: { width: 180, height: 110, borderRadius: BorderRadius.lg, overflow: "hidden" },
  promoGradient: { flex: 1, padding: Spacing.md, justifyContent: "space-between" },
  promoIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  promoTextContainer: { marginTop: Spacing.xs },
  promoTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  promoSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  // Sort Mode
  sortRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  sortChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: "rgba(128,128,128,0.1)", gap: Spacing.xs },
  sortChipActive: { backgroundColor: ComeYaColors.primary },
  sortChipText: { color: "#666", fontWeight: "600" },
  sortChipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  // Recent Orders
  recentOrderCard: { width: 120, borderRadius: BorderRadius.lg, overflow: "hidden" },
  recentOrderImage: { width: 120, height: 80, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg },
  recentOrderPlaceholder: { justifyContent: "center", alignItems: "center" },
  recentOrderInfo: { padding: Spacing.sm },
  recentOrderBusiness: { fontWeight: "600", fontSize: 12 },
});
