import React, { useState, useEffect } from "react";
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
import { useResponsive } from "@/hooks/useResponsive";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Business } from "@/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PRIMARY = "#DC2626";

const FILTERS = [
  { id: "all",        label: "Todos"        },
  { id: "restaurant", label: "Restaurantes" },
  { id: "market",     label: "Mercados"     },
];
const SORT = [
  { id: "rating",   label: "Mejor valorados" },
  { id: "delivery", label: "Más rápidos"     },
  { id: "price",    label: "Más económicos"  },
];

const CATEGORY_STYLE: Record<string, { icon: string; color: string; label: string }> = {
  pizza:     { icon: "circle",       color: "#E91E63", label: "Pizzas"        },
  burger:    { icon: "layers",       color: "#F44336", label: "Hamburguesas"  },
  burgers:   { icon: "layers",       color: "#F44336", label: "Hamburguesas"  },
  sushi:     { icon: "wind",         color: "#00BCD4", label: "Sushi"         },
  pollo:     { icon: "feather",      color: "#FF9800", label: "Pollo"         },
  mariscos:  { icon: "anchor",       color: "#2196F3", label: "Mariscos"      },
  tacos:     { icon: "sun",          color: "#FF5722", label: "Mexicana"      },
  mexicana:  { icon: "sun",          color: "#FF5722", label: "Mexicana"      },
  mercado:   { icon: "shopping-bag", color: "#4CAF50", label: "Mercado"       },
  carniceria:{ icon: "shopping-bag", color: "#795548", label: "Carnicería"    },
};

export default function HomeScreen() {
  const navigation   = useNavigation<Nav>();
  const { theme, isDark } = useTheme();
  const { user }     = useAuth();
  const { isMobile, px, gridCols } = useResponsive();

  const [businesses,     setBusinesses]     = useState<Business[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [typeFilter,     setTypeFilter]     = useState("all");
  const [sortBy,         setSortBy]         = useState("rating");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const bg     = isDark ? "#111"     : "#f7f7f7";
  const card   = isDark ? "#1e1e1e"  : "#fff";
  const text   = isDark ? "#fff"     : "#1a1a1a";
  const sub    = isDark ? "#aaa"     : "#666";
  const border = isDark ? "#333"     : "#e8e8e8";
  const inputBg = isDark ? "#2a2a2a" : "#f0f0f0";

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

  const dynamicCategories = React.useMemo(() => {
    const seen = new Set<string>();
    return businesses.reduce<{ id: string; icon: string; color: string; label: string }[]>((acc, b) => {
      const cat = b.categories[0]?.toLowerCase().trim();
      if (!cat || seen.has(cat)) return acc;
      seen.add(cat);
      const style = CATEGORY_STYLE[cat] || { icon: "tag", color: PRIMARY, label: cat.charAt(0).toUpperCase() + cat.slice(1) };
      acc.push({ id: cat, ...style });
      return acc;
    }, []);
  }, [businesses]);

  const filtered = businesses.filter(b => {
    if (typeFilter !== "all" && b.type !== typeFilter) return false;
    if (activeCategory && !b.categories.some(c => c.toLowerCase().trim() === activeCategory)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.categories.some(c => c.toLowerCase().includes(q));
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "rating")   return b.rating - a.rating;
    if (sortBy === "delivery") return parseInt(a.deliveryTime) - parseInt(b.deliveryTime);
    if (sortBy === "price")    return a.deliveryFee - b.deliveryFee;
    return 0;
  });

  const hasActiveFilters = typeFilter !== "all" || activeCategory || sortBy !== "rating";

  // ── Sidebar (desktop) ──────────────────────────────────────────────────────
  const SidebarContent = (
    <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
      <Text style={[s.sideTitle, { color: sub }]}>TIPO</Text>
      {FILTERS.map(f => (
        <Pressable key={f.id} onPress={() => setTypeFilter(f.id)}
          style={[s.sideItem, typeFilter === f.id && { backgroundColor: PRIMARY + "12" }]}>
          <Text style={[s.sideItemText, { color: typeFilter === f.id ? PRIMARY : text }]}>{f.label}</Text>
        </Pressable>
      ))}

      <Text style={[s.sideTitle, { color: sub, marginTop: 20 }]}>ORDENAR</Text>
      {SORT.map(f => (
        <Pressable key={f.id} onPress={() => setSortBy(f.id)}
          style={[s.sideItem, sortBy === f.id && { backgroundColor: PRIMARY + "12" }]}>
          <Feather name={f.id === "rating" ? "star" : f.id === "delivery" ? "zap" : "tag"} size={13} color={sortBy === f.id ? PRIMARY : sub} />
          <Text style={[s.sideItemText, { color: sortBy === f.id ? PRIMARY : text }]}>{f.label}</Text>
        </Pressable>
      ))}

      {dynamicCategories.length > 0 && (
        <>
          <Text style={[s.sideTitle, { color: sub, marginTop: 20 }]}>CATEGORÍAS</Text>
          {dynamicCategories.map(c => (
            <Pressable key={c.id} onPress={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              style={[s.sideItem, activeCategory === c.id && { backgroundColor: PRIMARY + "12" }]}>
              <Feather name={c.icon as any} size={13} color={activeCategory === c.id ? PRIMARY : c.color} />
              <Text style={[s.sideItemText, { color: activeCategory === c.id ? PRIMARY : text }]}>{c.label}</Text>
            </Pressable>
          ))}
        </>
      )}

      {hasActiveFilters && (
        <Pressable onPress={() => { setTypeFilter("all"); setActiveCategory(null); setSortBy("rating"); }}
          style={[s.clearBtn, { borderColor: PRIMARY + "60" }]}>
          <Feather name="x" size={13} color={PRIMARY} />
          <Text style={[s.clearBtnText, { color: PRIMARY }]}>Limpiar filtros</Text>
        </Pressable>
      )}
    </View>
  );

  // ── Filtros móvil: chips horizontales ──────────────────────────────────────
  const MobileFilters = (
    <View style={[s.mobileFilters, { backgroundColor: card, borderBottomColor: border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mobileChips}>
        {FILTERS.map(f => (
          <Pressable key={f.id} onPress={() => setTypeFilter(f.id)}
            style={[s.chip, { backgroundColor: typeFilter === f.id ? PRIMARY : inputBg, borderColor: typeFilter === f.id ? PRIMARY : border }]}>
            <Text style={[s.chipText, { color: typeFilter === f.id ? "#fff" : text }]}>{f.label}</Text>
          </Pressable>
        ))}
        <View style={s.chipDivider} />
        {SORT.map(f => (
          <Pressable key={f.id} onPress={() => setSortBy(f.id)}
            style={[s.chip, { backgroundColor: sortBy === f.id ? PRIMARY + "18" : inputBg, borderColor: sortBy === f.id ? PRIMARY : border }]}>
            <Feather name={f.id === "rating" ? "star" : f.id === "delivery" ? "zap" : "tag"} size={12} color={sortBy === f.id ? PRIMARY : sub} />
            <Text style={[s.chipText, { color: sortBy === f.id ? PRIMARY : text }]}>{f.label}</Text>
          </Pressable>
        ))}
        {dynamicCategories.map(c => (
          <Pressable key={c.id} onPress={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
            style={[s.chip, { backgroundColor: activeCategory === c.id ? c.color + "20" : inputBg, borderColor: activeCategory === c.id ? c.color : border }]}>
            <Feather name={c.icon as any} size={12} color={activeCategory === c.id ? c.color : sub} />
            <Text style={[s.chipText, { color: activeCategory === c.id ? c.color : text }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // ── Card width según columnas ──────────────────────────────────────────────
  const cardStyle = isMobile
    ? { width: "100%" as any }
    : gridCols === 2
      ? { width: "47%" as any }
      : { width: 280 };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* ── NAVBAR ── */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: border, paddingHorizontal: px }]}>
        {/* Logo */}
        <View style={s.navLogo}>
          <View style={[s.navLogoCircle, { backgroundColor: isDark ? "#222" : "#fff" }]}>
            <ComeYaLogo size={22} />
          </View>
          {!isMobile && <Text style={s.navLogoText}>ComeYa</Text>}
        </View>

        {/* Search */}
        <View style={[s.navSearch, { backgroundColor: inputBg, borderColor: border, flex: 1, marginHorizontal: isMobile ? 10 : 20 }]}>
          <Feather name="search" size={15} color={sub} />
          <TextInput
            style={[s.navSearchInput, { color: text }]}
            placeholder={isMobile ? "Buscar..." : "Buscar restaurantes o platos..."}
            placeholderTextColor={sub}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={15} color={sub} /></Pressable> : null}
        </View>

        {/* Actions */}
        <View style={s.navActions}>
          {!isMobile && (
            <Pressable style={s.navBtn} onPress={() => navigation.navigate("OrderTracking" as any, { orderId: "" })}>
              <Feather name="package" size={16} color={text} />
              <Text style={[s.navBtnText, { color: text }]}>Pedidos</Text>
            </Pressable>
          )}
          <Pressable style={[s.navCartBtn, { backgroundColor: PRIMARY }]} onPress={() => navigation.navigate("Cart")}>
            <Feather name="shopping-cart" size={16} color="#fff" />
            {!isMobile && <Text style={s.navCartText}>Carrito</Text>}
          </Pressable>
          <Pressable style={[s.navAvatar, { backgroundColor: PRIMARY + "20" }]} onPress={() => navigation.navigate("Main" as any)}>
            <Text style={[s.navAvatarText, { color: PRIMARY }]}>{user?.name?.charAt(0)?.toUpperCase() || "U"}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={s.body}>
        {/* Sidebar desktop */}
        {!isMobile && SidebarContent}

        {/* Contenido principal */}
        <ScrollView style={s.main} contentContainerStyle={[s.mainContent, { padding: px, paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>

          {/* Filtros móvil */}
          {isMobile && MobileFilters}

          {/* Hero */}
          {!search && typeFilter === "all" && !activeCategory && (
            <View style={[s.hero, { marginBottom: 20, padding: isMobile ? 20 : 28 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroTitle, { fontSize: isMobile ? 18 : 24 }]}>¿Qué quieres pedir hoy?</Text>
                <Text style={s.heroSub}>Entrega en 30-45 min · Soria, España</Text>
              </View>
              {!isMobile && <Text style={s.heroEmoji}>🍔🍕🍣</Text>}
            </View>
          )}

          {/* Resultados count */}
          <Text style={[s.resultsCount, { color: sub, marginBottom: 14 }]}>
            {loading ? "Cargando..." : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
          </Text>

          {/* Grid */}
          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
          ) : filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={[s.emptyTitle, { color: text }]}>Sin resultados</Text>
              <Text style={[{ color: sub, fontSize: 14 }]}>Prueba con otra búsqueda o categoría</Text>
            </View>
          ) : (
            <View style={[s.grid, isMobile && s.gridMobile]}>
              {filtered.map(b => (
                <Pressable
                  key={b.id}
                  style={[s.card, cardStyle, { backgroundColor: card }]}
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
                  <View style={[s.cardBody, { padding: isMobile ? 12 : 14 }]}>
                    <Text style={[s.cardName, { color: text }]} numberOfLines={1}>{b.name}</Text>
                    <Text style={[s.cardDesc, { color: sub }]} numberOfLines={1}>{b.description || b.categories.join(" · ")}</Text>
                    <View style={s.cardMeta}>
                      <Feather name="star" size={12} color="#FFB800" />
                      <Text style={[s.metaText, { color: text }]}>{b.rating > 0 ? b.rating.toFixed(1) : "Nuevo"}</Text>
                      <Text style={[s.metaDot, { color: sub }]}>·</Text>
                      <Feather name="clock" size={12} color={sub} />
                      <Text style={[s.metaText, { color: sub }]}>{b.deliveryTime}</Text>
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

const s = StyleSheet.create({
  root:          { flex: 1 },
  // Navbar
  navbar:        { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, zIndex: 10, gap: 0 },
  navLogo:       { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  navLogoCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  navLogoText:   { fontSize: 18, fontWeight: "900", color: PRIMARY },
  navSearch:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  navSearchInput:{ flex: 1, fontSize: 14, outlineStyle: "none" } as any,
  navActions:    { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  navBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  navBtnText:    { fontSize: 13, fontWeight: "600" },
  navCartBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  navCartText:   { fontSize: 13, fontWeight: "600", color: "#fff" },
  navAvatar:     { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  navAvatarText: { fontSize: 14, fontWeight: "700" },
  // Body
  body:          { flex: 1, flexDirection: "row" },
  sidebar:       { width: 210, paddingVertical: 20, paddingHorizontal: 14, borderRightWidth: 1 },
  sideTitle:     { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  sideItem:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  sideItemText:  { fontSize: 13, fontWeight: "500" },
  clearBtn:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  clearBtnText:  { fontSize: 12, fontWeight: "600" },
  // Mobile filters
  mobileFilters: { borderBottomWidth: 1, marginBottom: 14 },
  mobileChips:   { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  chip:          { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText:      { fontSize: 12, fontWeight: "600" },
  chipDivider:   { width: 1, height: 20, backgroundColor: "#e0e0e0", marginHorizontal: 4 },
  // Main
  main:          { flex: 1 },
  mainContent:   { paddingBottom: 48 },
  hero:          { borderRadius: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: PRIMARY, marginBottom: 20 },
  heroTitle:     { fontWeight: "800", color: "#fff", marginBottom: 4 },
  heroSub:       { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  heroEmoji:     { fontSize: 36 },
  resultsCount:  { fontSize: 13, fontWeight: "600" },
  loadingBox:    { paddingVertical: 60, alignItems: "center" },
  emptyBox:      { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyTitle:    { fontSize: 18, fontWeight: "700" },
  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  gridMobile:    { flexDirection: "column", gap: 12 },
  card:          { borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  cardImgWrap:   { position: "relative" as any },
  cardImg:       { width: "100%", height: 150 },
  closedOverlay: { position: "absolute" as any, inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  closedText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  featuredBadge: { position: "absolute" as any, top: 8, left: 8, backgroundColor: "#FFB800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  cardBody:      {},
  cardName:      { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  cardDesc:      { fontSize: 12, marginBottom: 8 },
  cardMeta:      { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaText:      { fontSize: 12 },
  metaDot:       { fontSize: 12 },
});
