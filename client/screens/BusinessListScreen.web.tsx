import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#E60000";

const TABS = [
  { id: "all", label: "Todos", icon: "grid" },
  { id: "restaurant", label: "Restaurantes", icon: "coffee" },
  { id: "market", label: "Mercados", icon: "shopping-bag" },
];
const FILTERS = [
  { id: "open", label: "Abiertos", icon: "clock" },
  { id: "fast", label: "Rápido", icon: "zap" },
  { id: "rating", label: "Mejor valorados", icon: "star" },
];

export default function BusinessListScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    apiRequest("GET", "/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        setBusinesses(
          (d.businesses || []).map((b: any) => ({
            id: b.id,
            name: b.name,
            description: b.description || "",
            type: b.type || "restaurant",
            image:
              b.image ||
              "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
            rating: (b.rating || 0) / 100,
            reviewCount: b.total_ratings || 0,
            deliveryTime: b.delivery_time || "30-45 min",
            deliveryFee: (b.delivery_fee || 300) / 100,
            isOpen: b.isOpen ?? b.is_open ?? false,
            categories: b.categories ? b.categories.split(",") : [],
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFilter = (id: string) =>
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );

  const filtered = useCallback(() => {
    let list = [...businesses];
    if (activeTab !== "all") list = list.filter((b) => b.type === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q),
      );
    }
    if (activeFilters.includes("open")) list = list.filter((b) => b.isOpen);
    if (activeFilters.includes("fast"))
      list = list.filter((b) => parseInt(b.deliveryTime) <= 30);
    if (activeFilters.includes("rating"))
      list = list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [businesses, activeTab, search, activeFilters]);

  const results = filtered();

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View
        style={[s.header, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={text} />
        </Pressable>
        <View>
          <Text style={[s.headerTitle, { color: text }]}>
            Explorar Negocios
          </Text>
          <Text style={[s.headerSub, { color: sub }]}>
            {results.length} negocio{results.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View
          style={[
            s.searchBox,
            { backgroundColor: cardBg, borderColor: border },
          ]}
        >
          <Feather name="search" size={16} color={sub} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar negocios..."
            placeholderTextColor={sub}
            style={[s.searchInput, { color: text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={sub} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={s.layout}>
        {/* Sidebar filtros */}
        <View
          style={[
            s.filterSidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <Text style={[s.filterTitle, { color: sub }]}>CATEGORÍA</Text>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                s.filterItem,
                activeTab === tab.id && { backgroundColor: PRIMARY + "10" },
              ]}
            >
              <Feather
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.id ? PRIMARY : sub}
              />
              <Text
                style={[
                  s.filterItemText,
                  { color: activeTab === tab.id ? PRIMARY : text },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
          <Text style={[s.filterTitle, { color: sub, marginTop: 20 }]}>
            FILTROS
          </Text>
          {FILTERS.map((f) => {
            const active = activeFilters.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggleFilter(f.id)}
                style={[
                  s.filterItem,
                  active && { backgroundColor: PRIMARY + "10" },
                ]}
              >
                <Feather
                  name={f.icon as any}
                  size={16}
                  color={active ? PRIMARY : sub}
                />
                <Text
                  style={[s.filterItemText, { color: active ? PRIMARY : text }]}
                >
                  {f.label}
                </Text>
                {active && (
                  <Feather
                    name="check"
                    size={14}
                    color={PRIMARY}
                    style={{ marginLeft: "auto" as any }}
                  />
                )}
              </Pressable>
            );
          })}
          {(search || activeFilters.length > 0) && (
            <Pressable
              onPress={() => {
                setSearch("");
                setActiveFilters([]);
              }}
              style={[s.clearBtn, { borderColor: "#EF4444" }]}
            >
              <Feather name="x" size={14} color="#EF4444" />
              <Text
                style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}
              >
                Limpiar filtros
              </Text>
            </Pressable>
          )}
        </View>

        {/* Grid */}
        <ScrollView
          style={s.grid}
          contentContainerStyle={s.gridContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : results.length === 0 ? (
            <View
              style={[s.empty, { backgroundColor: card, borderColor: border }]}
            >
              <Feather name="search" size={44} color={sub} />
              <Text style={[s.emptyTitle, { color: text }]}>
                Sin resultados
              </Text>
              <Text style={[s.emptySub, { color: sub }]}>
                No encontramos negocios con esos filtros
              </Text>
            </View>
          ) : (
            <View style={s.cardsGrid}>
              {results.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    navigation.navigate("BusinessDetail", { businessId: b.id })
                  }
                  style={[
                    s.businessCard,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View style={s.businessImgWrap}>
                    <Image
                      source={{ uri: b.image }}
                      style={s.businessImg}
                      contentFit="cover"
                    />
                    {!b.isOpen && (
                      <View style={s.closedOverlay}>
                        <Text style={s.closedText}>Cerrado</Text>
                      </View>
                    )}
                    {b.isOpen && (
                      <View
                        style={[s.openBadge, { backgroundColor: "#10B981" }]}
                      >
                        <Text style={s.openBadgeText}>Abierto</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.businessInfo}>
                    <Text
                      style={[s.businessName, { color: text }]}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                    <Text
                      style={[s.businessDesc, { color: sub }]}
                      numberOfLines={2}
                    >
                      {b.description}
                    </Text>
                    <View style={s.businessMeta}>
                      <View style={s.metaItem}>
                        <Feather name="star" size={12} color="#FFD700" />
                        <Text style={[s.metaText, { color: sub }]}>
                          {b.rating.toFixed(1)}
                        </Text>
                      </View>
                      <View style={s.metaItem}>
                        <Feather name="clock" size={12} color={sub} />
                        <Text style={[s.metaText, { color: sub }]}>
                          {b.deliveryTime}
                        </Text>
                      </View>
                      <View style={s.metaItem}>
                        <Feather name="truck" size={12} color={sub} />
                        <Text style={[s.metaText, { color: sub }]}>
                          {b.deliveryFee.toFixed(2)} €
                        </Text>
                      </View>
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
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14 },
  layout: { flex: 1, flexDirection: "row" },
  filterSidebar: { width: 220, borderRightWidth: 1, padding: 16 },
  filterTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  filterItemText: { fontSize: 14, fontWeight: "500" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  grid: { flex: 1 },
  gridContent: { padding: 24, paddingBottom: 60 },
  loadingWrap: { alignItems: "center", paddingTop: 60 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  businessCard: {
    width: "calc(33.33% - 11px)" as any,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden" as any,
  },
  businessImgWrap: { position: "relative" as any },
  businessImg: { width: "100%", height: 140 },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closedText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  openBadge: {
    position: "absolute" as any,
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  openBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  businessInfo: { padding: 14 },
  businessName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  businessDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  businessMeta: { flexDirection: "row", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
});
