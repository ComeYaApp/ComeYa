import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  Modal,
  TextInput,
  Alert,
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
import { formatEuros } from "@/utils/currency";

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

  const businessId = route.params?.businessId;
  const [isLoading, setIsLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showContactOptions, setShowContactOptions] = useState(false);
  // ── Reserva de mesa ───────────────────────────────────────────────
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveDate, setReserveDate] = useState<string | null>(null);
  const [reserveTime, setReserveTime] = useState<string | null>(null);
  const [reserveParty, setReserveParty] = useState(2);
  const [reserveName, setReserveName] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserveSubmitting, setReserveSubmitting] = useState(false);
  const [reserveOccasion, setReserveOccasion] = useState<string | null>(null);
  const [reserveWaitlisting, setReserveWaitlisting] = useState(false);
  // Disponibilidad real por franja (aforo del negocio)
  const [reserveSlots, setReserveSlots] = useState<any[]>([]);
  const [reserveSlotsLoading, setReserveSlotsLoading] = useState(false);
  const [reserveConfig, setReserveConfig] = useState<any>(null);
  const [reserveSuccess, setReserveSuccess] = useState<any>(null);

  const reserveDates = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    const now = new Date();
    const totalDays = reserveConfig?.advanceDays || 14;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label =
        i === 0
          ? "Hoy"
          : i === 1
            ? "Mañana"
            : d.toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
      out.push({ label, value });
    }
    return out;
  }, [reserveConfig?.advanceDays]);

  // Franjas reales desde el horario y el aforo del negocio
  const loadReserveSlots = useCallback(
    async (date: string, party: number) => {
      setReserveSlotsLoading(true);
      try {
        const res = await apiRequest(
          "GET",
          `/api/reservations/availability?businessId=${businessId}&date=${date}&partySize=${party}`,
        );
        const data = await res.json();
        if (data.success) {
          setReserveSlots(data.slots || []);
          setReserveConfig(data.config || null);
        } else {
          setReserveSlots([]);
        }
      } catch {
        setReserveSlots([]);
      } finally {
        setReserveSlotsLoading(false);
      }
    },
    [businessId],
  );

  const submitReservation = async () => {
    if (!reserveDate || !reserveTime) {
      Alert.alert("Reserva", "Elige fecha y hora.");
      return;
    }
    setReserveSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/reservations", {
        businessId,
        date: reserveDate,
        time: reserveTime,
        partySize: reserveParty,
        customerName: reserveName,
        customerPhone: reservePhone,
        notes: reserveNotes,
        occasion: reserveOccasion || null,
      });
      const data = await res.json();
      if (data.success) {
        if (data.autoConfirmed && data.reservation?.code) {
          setReserveSuccess({
            code: data.reservation.code,
            date: reserveDate,
            time: reserveTime,
            party: reserveParty,
          });
        } else {
          setShowReserveModal(false);
          Alert.alert(
            "Reserva enviada 📅",
            "El negocio la confirmará en breve. Puedes verla en tu perfil → Mis reservas.",
          );
        }
      } else {
        Alert.alert("No se pudo reservar", data.error || "Inténtalo de nuevo");
        if (reserveDate) loadReserveSlots(reserveDate, reserveParty);
      }
    } catch {
      Alert.alert("Error", "No se pudo enviar la reserva");
    } finally {
      setReserveSubmitting(false);
    }
  };

  // 🔔 Avísame: apuntarse a la lista de espera de una franja completa
  const submitWaitlist = async () => {
    if (!reserveDate || !reserveTime) return;
    setReserveWaitlisting(true);
    try {
      const res = await apiRequest("POST", "/api/reservations/waitlist", {
        businessId,
        date: reserveDate,
        time: reserveTime,
        partySize: reserveParty,
      });
      const data = await res.json();
      if (data.success) {
        setShowReserveModal(false);
        Alert.alert(
          "Aviso activado 🔔",
          "Te avisaremos en cuanto se libere una mesa para esa hora. ¡Sé rápido al reservar!",
        );
      } else {
        Alert.alert("No se pudo activar el aviso", data.error || "Inténtalo de nuevo");
      }
    } catch {
      Alert.alert("Error", "No se pudo activar el aviso");
    } finally {
      setReserveWaitlisting(false);
    }
  };

  // Franja completa seleccionada → el botón del modal pasa a "Avísame"
  const selectedSlotFull = !!(
    reserveTime &&
    reserveSlots.find((s: any) => s.time === reserveTime)?.status === "full"
  );

  // Al cambiar fecha o comensales, recargar franjas y limpiar la hora elegida
  useEffect(() => {
    if (!showReserveModal || !reserveDate) return;
    setReserveTime(null);
    loadReserveSlots(reserveDate, reserveParty);
  }, [showReserveModal, reserveDate, reserveParty, loadReserveSlots]);

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
          // Parse openingHours del backend
          let parsedOpeningHours: Business["openingHours"] = [];
          if (data.business.openingHours) {
            if (Array.isArray(data.business.openingHours)) {
              parsedOpeningHours = data.business.openingHours;
            } else if (typeof data.business.openingHours === "object") {
              // Formato { monday: {open, close}, tuesday: ... }
              const dayKeys = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
              parsedOpeningHours = dayKeys.map(day => ({
                day,
                open: data.business.openingHours[day]?.open || "09:00",
                close: data.business.openingHours[day]?.close || "22:00",
              }));
            }
          }

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
            openingHours: parsedOpeningHours,
            address: data.business.address || "Soria, España",
            phone: data.business.phone || "",
            categories: data.business.categories
              ? data.business.categories.split(",")
              : [],
            featured: data.business.isFeatured || false,
            reservationsEnabled:
              data.business.reservationsEnabled === true ||
              data.business.reservationsEnabled === 1,
            deliveryEnabled:
              data.business.deliveryEnabled === undefined ||
              data.business.deliveryEnabled === null
                ? true
                : data.business.deliveryEnabled === true ||
                  data.business.deliveryEnabled === 1,
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

              // Precio con comisión del 15% incluida, redondeado a céntimos
              // (p.price en céntimos → 1050 * 1.15 = 1207.5 → 1208 = 12,08 €)
              const priceWithCommission =
                Math.round((p.price || 0) * 1.15) / 100;

              return {
                id: p.id,
                name: p.name,
                description: p.description || "",
                price: priceWithCommission, // Precio con comisión incluida
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
                  Envío {formatEuros(business.deliveryFee)}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Min. {formatEuros(business.minimumOrder)}
                </ThemedText>
              </View>
              {business.deliveryEnabled === false && (
                <View
                  style={[
                    styles.dineInBadge,
                    { backgroundColor: "rgba(245,158,11,0.12)" },
                  ]}
                >
                  <Feather name="coffee" size={14} color="#B45309" />
                  <ThemedText
                    type="small"
                    style={{
                      color: "#B45309",
                      marginLeft: Spacing.xs,
                      fontWeight: "600",
                    }}
                  >
                    Solo reservas — sin reparto a domicilio
                  </ThemedText>
                </View>
              )}
              <View style={styles.contactRow}>
                {business.reservationsEnabled && (
                  <Pressable
                    onPress={() => {
                      const now = new Date();
                      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      setReserveDate(today);
                      setReserveTime(null);
                      setReserveParty(2);
                      setReserveOccasion(null);
                      setReserveSuccess(null);
                      setReserveName(user?.name || "");
                      setReservePhone(user?.phone || "");
                      setReserveNotes("");
                      setShowReserveModal(true);
                    }}
                    style={[
                      styles.contactButton,
                      styles.reserveButton,
                      { backgroundColor: ComeYaColors.primary },
                    ]}
                  >
                    <Feather name="calendar" size={18} color="#FFFFFF" />
                    <ThemedText
                      type="small"
                      style={{
                        color: "#FFFFFF",
                        marginLeft: Spacing.xs,
                        fontWeight: "600",
                      }}
                    >
                      Reservar mesa
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  onPress={() =>
                    setShowContactOptions(!showContactOptions)
                  }
                  style={[
                    styles.contactButton,
                    styles.reserveButton,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      marginLeft:
                        business.reservationsEnabled ? Spacing.xs : 0,
                    },
                  ]}
                >
                  <Feather
                    name={showContactOptions ? "chevron-up" : "phone"}
                    size={18}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: Spacing.xs,
                      fontWeight: "600",
                    }}
                  >
                    {showContactOptions ? "OCULTAR" : "RESERVAR / CONSULTAR"}
                  </ThemedText>
                </Pressable>
              </View>
              {showContactOptions && (
                <View style={[styles.contactOptions, { borderColor: theme.border }]}>
                  <Pressable
                    onPress={handleCall}
                    style={[
                      styles.contactButton,
                      styles.contactOptionItem,
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
                        fontWeight: "600",
                      }}
                    >
                      LLAMAR
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleWhatsApp}
                    style={[
                      styles.contactButton,
                      styles.contactOptionItem,
                      { backgroundColor: "#25D366" },
                    ]}
                  >
                    <Feather name="message-circle" size={18} color="#FFFFFF" />
                    <ThemedText
                      type="small"
                      style={{
                        color: "#FFFFFF",
                        marginLeft: Spacing.xs,
                        fontWeight: "600",
                      }}
                    >
                      WHATSAPP
                    </ThemedText>
                  </Pressable>
                </View>
              )}
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
              ) : filteredProducts.length === 0 ? (
                <View
                  style={[
                    styles.emptyMenu,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="book-open" size={22} color={theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.textSecondary,
                      marginLeft: Spacing.sm,
                      flex: 1,
                    }}
                  >
                    {business.deliveryEnabled === false
                      ? "Este restaurante trabaja con reservas y no publica carta en la app: el menú se consulta en el local."
                      : "Este negocio aún no ha publicado su menú."}
                  </ThemedText>
                </View>
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
                        product: product,
                      })
                    }
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {business && business.deliveryEnabled !== false && (
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
      )}

      {/* Modal de reserva de mesa */}
      <Modal
        visible={showReserveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReserveModal(false)}
      >
        <View style={styles.reserveOverlay}>
          <View style={[styles.reserveModal, { backgroundColor: theme.card }]}>
            {reserveSuccess ? (
              <View style={styles.reserveSuccessWrap}>
                <View
                  style={[
                    styles.reserveSuccessIcon,
                    { backgroundColor: "rgba(16,185,129,0.12)" },
                  ]}
                >
                  <Feather name="check-circle" size={44} color="#10B981" />
                </View>
                <ThemedText type="h3" style={{ marginTop: Spacing.lg }}>
                  ¡Mesa reservada!
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}
                >
                  {reserveSuccess.party}{" "}
                  {reserveSuccess.party === 1 ? "comensal" : "comensales"} ·{" "}
                  {new Date(`${reserveSuccess.date}T12:00:00`).toLocaleDateString(
                    "es-ES",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}{" "}
                  · {reserveSuccess.time}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.md }}
                >
                  Muestra este código al llegar
                </ThemedText>
                <View
                  style={[
                    styles.reserveCodeBox,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    style={{
                      fontSize: 34,
                      fontWeight: "800",
                      letterSpacing: 2,
                      color: ComeYaColors.primary,
                    }}
                  >
                    {reserveSuccess.code}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    setShowReserveModal(false);
                    navigation.navigate("MyReservations");
                  }}
                  style={[
                    styles.reserveSubmit,
                    { backgroundColor: ComeYaColors.primary },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{ color: "#FFF", fontWeight: "700" }}
                  >
                    Ver mis reservas
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setShowReserveModal(false)}
                  style={{ marginTop: Spacing.sm }}
                >
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Cerrar
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
            <View style={styles.reserveHeader}>
              <ThemedText type="h3">Reservar mesa</ThemedText>
              <Pressable onPress={() => setShowReserveModal(false)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
              >
                Fecha (próximos 14 días)
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.xs }}
              >
                {reserveDates.map((d) => (
                  <Pressable
                    key={d.value}
                    onPress={() => setReserveDate(d.value)}
                    style={[
                      styles.reserveDateChip,
                      {
                        borderColor:
                          reserveDate === d.value
                            ? ComeYaColors.primary
                            : theme.border,
                        backgroundColor:
                          reserveDate === d.value
                            ? ComeYaColors.primary
                            : "transparent",
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          reserveDate === d.value ? "#FFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {d.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>

              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  marginTop: Spacing.md,
                  marginBottom: Spacing.xs,
                }}
              >
                Hora {reserveConfig ? "· verde: libre · ámbar: últimas mesas" : ""}
              </ThemedText>
              {reserveSlotsLoading ? (
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, paddingVertical: Spacing.md }}
                >
                  Consultando disponibilidad...
                </ThemedText>
              ) : reserveSlots.length === 0 ? (
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, paddingVertical: Spacing.md }}
                >
                  No hay franjas de reserva para este día. Prueba otra fecha.
                </ThemedText>
              ) : (
                <View style={styles.reserveTimeRow}>
                  {reserveSlots.map((slot: any) => {
                    const disabled = slot.isPast;
                    const full = slot.status === "full";
                    const selected = reserveTime === slot.time;
                    const borderColor = selected
                      ? ComeYaColors.primary
                      : slot.status === "last"
                        ? "#F59E0B"
                        : full
                          ? ComeYaColors.error
                          : theme.border;
                    const bg = selected
                      ? ComeYaColors.primary
                      : disabled
                        ? theme.backgroundSecondary
                        : "transparent";
                    const textColor = selected
                      ? "#FFF"
                      : disabled
                        ? theme.textSecondary
                        : slot.status === "last"
                          ? "#B45309"
                          : full
                            ? ComeYaColors.error
                            : theme.text;
                    return (
                      <Pressable
                        key={slot.time}
                        onPress={() => !disabled && setReserveTime(slot.time)}
                        disabled={disabled}
                        style={[
                          styles.reserveTimeChip,
                          {
                            borderColor,
                            backgroundColor: bg,
                            opacity: disabled ? 0.55 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: textColor, fontWeight: "600" }}
                        >
                          {slot.time}
                        </ThemedText>
                        {slot.status === "last" && !selected ? (
                          <View
                            style={[
                              styles.slotDot,
                              { backgroundColor: "#F59E0B" },
                            ]}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
                {selectedSlotFull ? (
                  <ThemedText
                    type="caption"
                    style={{ color: ComeYaColors.error, marginTop: Spacing.xs }}
                  >
                    Esta hora está completa. Puedes activar el aviso 🔔 y te
                    notificaremos si se libera una mesa.
                  </ThemedText>
                ) : null}

              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  marginTop: Spacing.md,
                  marginBottom: Spacing.xs,
                }}
              >
                Comensales
              </ThemedText>
              <View style={styles.reservePartyRow}>
                <Pressable
                  onPress={() =>
                    setReserveParty((p) => Math.max(1, p - 1))
                  }
                  style={[
                    styles.reservePartyBtn,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="minus" size={18} color={theme.text} />
                </Pressable>
                <ThemedText type="h4" style={{ marginHorizontal: Spacing.lg }}>
                  {reserveParty}
                </ThemedText>
                <Pressable
                  onPress={() =>
                    setReserveParty((p) =>
                      Math.min(reserveConfig?.maxPartySize || 20, p + 1),
                    )
                  }
                  style={[
                    styles.reservePartyBtn,
                    { backgroundColor: ComeYaColors.primary },
                  ]}
                >
                  <Feather name="plus" size={18} color="#FFF" />
                </Pressable>
              </View>
              {reserveConfig ? (
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Grupos de hasta {reserveConfig.maxPartySize} comensales
                </ThemedText>
              ) : null}

              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  marginTop: Spacing.md,
                  marginBottom: Spacing.xs,
                }}
              >
                ¿Celebras algo? (opcional)
              </ThemedText>
              <View style={styles.reserveTimeRow}>
                {(
                  [
                    { id: "birthday", label: "🎂 Cumpleaños" },
                    { id: "anniversary", label: "❤️ Aniversario" },
                    { id: "date", label: "💍 Cita" },
                    { id: "family", label: "👨‍👩‍👧 Familiar" },
                    { id: "business", label: "💼 Negocios" },
                  ] as const
                ).map((o) => {
                  const active = reserveOccasion === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => setReserveOccasion(active ? null : o.id)}
                      style={[
                        styles.reserveTimeChip,
                        {
                          borderColor: active ? ComeYaColors.primary : theme.border,
                          backgroundColor: active ? ComeYaColors.primary : "transparent",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: active ? "#FFF" : theme.text,
                          fontWeight: "600",
                        }}
                      >
                        {o.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={reserveName}
                onChangeText={setReserveName}
                placeholder="Tu nombre"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.reserveInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
              <TextInput
                value={reservePhone}
                onChangeText={setReservePhone}
                placeholder="Tu teléfono (opcional)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                style={[
                  styles.reserveInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
              <TextInput
                value={reserveNotes}
                onChangeText={setReserveNotes}
                placeholder="Notas (opcional): alergias, trona, celebración..."
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.reserveInput,
                  styles.reserveNotesInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />

              {selectedSlotFull ? (
                <Pressable
                  onPress={submitWaitlist}
                  disabled={reserveWaitlisting}
                  style={[
                    styles.reserveSubmit,
                    {
                      backgroundColor: "#F59E0B",
                      opacity: reserveWaitlisting ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather name="bell" size={16} color="#FFF" />
                  <ThemedText
                    type="body"
                    style={{ color: "#FFF", fontWeight: "700", marginLeft: Spacing.sm }}
                  >
                    {reserveWaitlisting
                      ? "Activando aviso..."
                      : "🔔 Avísame si queda una mesa"}
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={submitReservation}
                  disabled={reserveSubmitting}
                  style={[
                    styles.reserveSubmit,
                    {
                      backgroundColor: ComeYaColors.primary,
                      opacity: reserveSubmitting ? 0.6 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{ color: "#FFF", fontWeight: "700" }}
                  >
                    {reserveSubmitting ? "Enviando..." : "Enviar reserva"}
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  dineInBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  reserveOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  reserveModal: {
    maxHeight: "90%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  reserveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  reserveDateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  reserveTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  reserveTimeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  slotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reservePartyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  reservePartyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reserveInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginTop: Spacing.sm,
  },
  reserveNotesInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  reserveSubmit: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  reserveSuccessWrap: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.lg,
  },
  reserveSuccessIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  reserveCodeBox: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  reserveButton: {
    flex: 1,
  },
  contactOptions: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  contactOptionItem: {
    flex: 1,
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
  emptyMenu: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  productsSection: {
    paddingHorizontal: Spacing.lg,
  },
  productsSectionTitle: {
    marginBottom: Spacing.md,
  },
});
