import React, { useState, useEffect, useCallback } from "react";
import {
  View, StyleSheet, ScrollView, Pressable,
  TextInput, Text, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Business } from "@/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
// Rojo para versión web
const PRIMARY = "#DC2626";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "restaurant", label: "Restaurantes" },
  { id: "market", label: "Mercados" },
];

const SORT = [
  { id: "rating", label: "⭐ Mejor valorados" },
  { id: "delivery", label: "⚡ Más rápidos" },
  { id: "price", label: "💰 Más económicos" },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rating");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const CATEGORY_STYLE: Record<string, { icon: string; color: string; label: string }> = {
    pizza: { icon: "circle", color: "#E91E63", label: "Pizzas" },
    burger: { icon: "layers", color: "#F44336", label: "Hamburguesas" },
    burgers: { icon: "layers", color: "#F44336", label: "Hamburguesas" },
    sushi: { icon: "wind", color: "#00BCD4", label: "Sushi" },
    pollo: { icon: "feather", color: "#FF9800", label: "Pollo" },
    mariscos: { icon: "anchor", color: "#2196F3", label: "Mariscos" },
    tacos: { icon: "sun", color: "#FF5722", label: "Mexicana" },
    mexicana: { icon: "sun", color: "#FF5722", label: "Mexicana" },
    mercado: { icon: "shopping-bag", color: "#4CAF50", label: "Mercado" },
    carniceria: { icon: "shopping-bag", color: "#795548", label: "Carnicería" },
  };

  const dynamicCategories = React.useMemo(() => {
    const seen = new Set<string>();
    const cats: { id: string; icon: string; color: string; label: string }[] = [];
    businesses.forEach((b) => {
      const firstCat = b.categories[0]?.toLowerCase().trim();
      if (!firstCat || seen.has(firstCat)) return;
      seen.add(firstCat);
      const style = CATEGORY_STYLE[firstCat] || { icon: "tag", color: PRIMARY, label: firstCat.charAt(0).toUpperCase() + firstCat.slice(1) };
      cats.push({ id: firstCat, ...style });
    });
    return cats;
  }, [businesses]);

  useEffect(() => {
    apiRequest("GET", "/api/businesses").then(r => r.json()).then(data => {
      const list: Business[] = (data.businesses || []).map((b: any) => ({
        id: b.id, name: b.name, description: b.description || "",
        type: b.type || "restaurant",
        profileImage: b.image || null,
        bannerImage: b.cover_image || b.image || null,
        rating: (b.rating || 0) / 100,
        reviewCount: b.total_ratings || 0,
        deliveryTime: b.delivery_time || "30-45 min",
        deliveryFee: (b.delivery_fee || 300) / 100,
        minimumOrder: (b.min_order || 1000) / 100,
        isOpen: b.isOpen === true || b.isOpen === 1 || b.is_open === true || b.is_open === 1,
        openingHours: [], address: b.address || "Soria, España",
        phone: b.phone || "",
        categories: b.categories ? b.categories.split(",") : [],
        featured: b.is_featured || false,
      }));
      setBusinesses(list);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = businesses.filter(b => {
    if (typeFilter !== "all" && b.type !== typeFilter) return false;
    if (activeCategory && !b.categories.some(c => c.toLowerCase().trim() === activeCategory)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.categories.some(c => c.toLowerCase().includes(q));
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "delivery") return parseInt(a.deliveryTime) - parseInt(b.deliveryTime);
    if (sortBy === "price") return a.deliveryFee - b.deliveryFee;
    return 0;
  });

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* NAVBAR */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={s.navLeft}>
          <View style={s.navLogo}>
            <View style={s.navLogoCircle}>
              <ComeYaLogo size={28} />
            </View>
            <Text style={s.navLogoText}>ComeYa</Text>
          </View>
          <View style={[s.navSearch, { backgroundColor: bg, borderColor: border }]}>
            <Feather name="search" size={16} color={sub} />
            <TextInput
              style={[s.navSearchInput, { color: text }]}
              placeholder="Buscar restaurantes o platos..."
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
            {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={16} color={sub} /></Pressable> : null}
          </View>
        </View>
        <View style={s.navRight}>
          <Pressable style={s.navBtn} onPress={() => navigation.navigate("OrderTracking" as any, { orderId: "" })}>
            <Feather name="package" size={18} color={text} />
            <Text style={[s.navBtnText, { color: text }]}>Pedidos</Text>
          </Pressable>
          <Pressable style={[s.navBtn, s.navCartBtn]} onPress={() => navigation.navigate("Cart")}>
            <Feather name="shopping-cart" size={18} color="#fff" />
            <Text style={[s.navBtnText, { color: "#fff" }]}>Carrito</Text>
          </Pressable>
          <Pressable style={s.navAvatar} onPress={() => navigation.navigate("Main" as any)}>
            <Text style={s.navAvatarText}>{user?.name?.charAt(0)?.toUpperCase() || "U"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.body}>
        {/* SIDEBAR */}
        <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
          <Text style={[s.sideTitle, { color: sub }]}>TIPO</Text>
          {FILTERS.map(f => (
            <Pressable key={f.id} onPress={() => setTypeFilter(f.id)} style={[s.sideItem, typeFilter === f.id && s.sideItemActive]}>
              <Text style={[s.sideItemText, { color: typeFilter === f.id ? PRIMARY : text }]}>{f.label}</Text>
            </Pressable>
          ))}

          <Text style={[s.sideTitle, { color: sub, marginTop: 24 }]}>ORDENAR</Text>
          {SORT.map(f => (
            <Pressable key={f.id} onPress={() => setSortBy(f.id)} style={[s.sideItem, sortBy === f.id && s.sideItemActive]}>
              <Text style={[s.sideItemText, { color: sortBy === f.id ? PRIMARY : text }]}>{f.label}</Text>
            </Pressable>
          ))}

          {dynamicCategories.length > 0 && (
            <>
              <Text style={[s.sideTitle, { color: sub, marginTop: 24 }]}>CATEGORÍAS</Text>
              {dynamicCategories.map(c => (
                <Pressable key={c.id} onPress={() => setActiveCategory(activeCategory === c.id ? null : c.id)} style={[s.sideItem, activeCategory === c.id && s.sideItemActive]}>
                  <View style={[s.catDot, { backgroundColor: c.color }]} />
                  <Text style={[s.sideItemText, { color: activeCategory === c.id ? PRIMARY : text }]}>{c.label}</Text>
                </Pressable>
              ))}
            </>
          )}

          {(typeFilter !== "all" || activeCategory || sortBy !== "rating") && (
            <Pressable onPress={() => { setTypeFilter("all"); setActiveCategory(null); setSortBy("rating"); }} style={s.clearBtn}>
              <Text style={s.clearBtnText}>Limpiar filtros</Text>
            </Pressable>
          )}
        </View>

        {/* CONTENIDO PRINCIPAL */}
        <ScrollView style={s.main} contentContainerStyle={s.mainContent} showsVerticalScrollIndicator={false}>
          {/* Hero banner */}
          {!search && typeFilter === "all" && !activeCategory && (
            <View style={[s.hero, { backgroundColor: PRIMARY }]}>
              <View>
                <Text style={s.heroTitle}>¿Qué quieres pedir hoy?</Text>
                <Text style={s.heroSub}>Entrega en 30-45 min · Soria, España</Text>
              </View>
              <Text style={s.heroEmoji}>🍔🍕🍣</Text>
            </View>
          )}

          {/* Resultados */}
          <View style={s.resultsHeader}>
            <Text style={[s.resultsCount, { color: text }]}>
              {loading ? "Cargando..." : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
            </Text>
          </View>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 48 }}>🔍</Text>
              <Text style={[s.emptyTitle, { color: text }]}>Sin resultados</Text>
              <Text style={[s.emptySub, { color: sub }]}>Prueba con otra búsqueda o categoría</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {filtered.map(b => (
                <Pressable
                  key={b.id}
                  style={[s.card, { backgroundColor: card }]}
                  onPress={() => navigation.navigate("BusinessDetail", { businessId: b.id })}
                >
                  <View style={s.cardImgWrap}>
                    <Image source={{ uri: b.bannerImage }} style={s.cardImg} contentFit="cover" />
                    {!b.isOpen && (
                      <View style={s.closedOverlay}>
                        <Text style={s.closedText}>Cerrado</Text>
                      </View>
                    )}
                    {b.featured && (
                      <View style={s.featuredBadge}>
                        <Text style={s.featuredBadgeText}>⭐ Destacado</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.cardBody}>
                    <Text style={[s.cardName, { color: text }]} numberOfLines={1}>{b.name}</Text>
                    <Text style={[s.cardDesc, { color: sub }]} numberOfLines={1}>{b.description || b.categories.join(" · ")}</Text>
                    <View style={s.cardMeta}>
                      <View style={s.metaItem}>
                        <Feather name="star" size={12} color="#FFB800" />
                        <Text style={[s.metaText, { color: text }]}>{b.rating > 0 ? b.rating.toFixed(1) : "Nuevo"}</Text>
                      </View>
                      <Text style={[s.metaDot, { color: sub }]}>·</Text>
                      <View style={s.metaItem}>
                        <Feather name="clock" size={12} color={sub} />
                        <Text style={[s.metaText, { color: sub }]}>{b.deliveryTime}</Text>
                      </View>
                      <Text style={[s.metaDot, { color: sub }]}>·</Text>
                      <Text style={[s.metaText, { color: sub }]}>€{b.deliveryFee.toFixed(2)} envío</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const CARD_WIDTH = 280;

const s = StyleSheet.create({
  root: { flex: 1 },
  navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, zIndex: 10 },
  navLeft: { flexDirection: "row", alignItems: "center", gap: 20, flex: 1 },
  navLogo: { flexDirection: "row", alignItems: "center", gap: 10 },
  navLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  navLogoText: { fontSize: 20, fontWeight: "900", color: PRIMARY },
  navSearch: { flex: 1, maxWidth: 480, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  navSearchInput: { flex: 1, fontSize: 14, outlineStyle: "none" } as any,
  navRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  navCartBtn: { backgroundColor: PRIMARY },
  navBtnText: { fontSize: 14, fontWeight: "600" },
  navAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY + "20", justifyContent: "center", alignItems: "center" },
  navAvatarText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  body: { flex: 1, flexDirection: "row" },
  sidebar: { width: 220, paddingVertical: 24, paddingHorizontal: 16, borderRightWidth: 1 },
  sideTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  sideItemActive: { backgroundColor: PRIMARY + "12" },
  sideItemText: { fontSize: 14, fontWeight: "500" },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  clearBtn: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#F44336", alignItems: "center" },
  clearBtnText: { fontSize: 13, color: "#F44336", fontWeight: "600" },
  main: { flex: 1 },
  mainContent: { padding: 24, paddingBottom: 48 },
  hero: { borderRadius: 16, padding: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 6 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  heroEmoji: { fontSize: 40 },
  resultsHeader: { marginBottom: 16 },
  resultsCount: { fontSize: 14, fontWeight: "600" },
  loadingBox: { paddingVertical: 80, alignItems: "center" },
  emptyBox: { paddingVertical: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  card: { width: CARD_WIDTH, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardImgWrap: { position: "relative" },
  cardImg: { width: "100%", height: 160 },
  closedOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" } as any,
  closedText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  featuredBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "#FFB800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  featuredBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  cardBody: { padding: 14 },
  cardName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardDesc: { fontSize: 13, marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12 },
  metaDot: { fontSize: 12 },
});
