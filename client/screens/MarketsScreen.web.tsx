import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#E60000";

export default function MarketsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        const all = d.businesses || [];
        setMarkets(
          all
            .filter((b: any) => b.type === "market")
            .map((b: any) => ({
              id: b.id,
              name: b.name,
              description: b.description || "",
              image:
                b.image ||
                "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
              rating: (b.rating || 0) / 100,
              deliveryTime: b.delivery_time || "30-45 min",
              deliveryFee: (b.delivery_fee || 300) / 100,
              isOpen: b.isOpen ?? b.is_open ?? false,
            })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Header */}
        <View
          style={[
            s.header,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={text} />
          </Pressable>
          <View>
            <Text style={[s.headerTitle, { color: text }]}>Mercados</Text>
            <Text style={[s.headerSub, { color: sub }]}>
              {markets.length} mercado{markets.length !== 1 ? "s" : ""}{" "}
              disponible{markets.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View
            style={[
              s.infoBanner,
              { backgroundColor: "#4CAF5015", borderColor: "#4CAF5030" },
            ]}
          >
            <Feather name="info" size={18} color="#4CAF50" />
            <Text style={[s.infoText, { color: "#2E7D32" }]}>
              En los mercados puedes especificar exactamente cómo quieres tus
              productos: "carne delgada sin grasa", "aguacates maduros", etc.
            </Text>
          </View>

          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : markets.length === 0 ? (
            <View
              style={[s.empty, { backgroundColor: card, borderColor: border }]}
            >
              <Feather name="shopping-bag" size={48} color={sub} />
              <Text style={[s.emptyTitle, { color: text }]}>
                No hay mercados disponibles
              </Text>
              <Text style={[s.emptySub, { color: sub }]}>
                Pronto agregaremos más mercados en tu zona
              </Text>
            </View>
          ) : (
            <View style={s.grid}>
              {markets.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    navigation.navigate("BusinessDetail", { businessId: m.id })
                  }
                  style={[
                    s.marketCard,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View style={s.imgWrap}>
                    <Image
                      source={{ uri: m.image }}
                      style={s.img}
                      contentFit="cover"
                    />
                    <View style={[s.typeBadge, { backgroundColor: "#4CAF50" }]}>
                      <Feather name="shopping-bag" size={11} color="#fff" />
                      <Text style={s.typeBadgeText}>Mercado</Text>
                    </View>
                    {!m.isOpen && (
                      <View style={s.closedOverlay}>
                        <Text style={s.closedText}>Cerrado</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.marketInfo}>
                    <Text style={[s.marketName, { color: text }]}>
                      {m.name}
                    </Text>
                    {m.description ? (
                      <Text
                        style={[s.marketDesc, { color: sub }]}
                        numberOfLines={2}
                      >
                        {m.description}
                      </Text>
                    ) : null}
                    <View style={s.metaRow}>
                      <View style={s.metaItem}>
                        <Feather name="star" size={13} color="#FFD700" />
                        <Text style={[s.metaText, { color: sub }]}>
                          {m.rating.toFixed(1)}
                        </Text>
                      </View>
                      <View style={s.metaItem}>
                        <Feather name="clock" size={13} color={sub} />
                        <Text style={[s.metaText, { color: sub }]}>
                          {m.deliveryTime}
                        </Text>
                      </View>
                      <View style={s.metaItem}>
                        <Feather name="truck" size={13} color={sub} />
                        <Text style={[s.metaText, { color: sub }]}>
                          {m.deliveryFee.toFixed(2)} €
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={sub}
                    style={s.arrow}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13 },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 900, paddingBottom: 60 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  loadingWrap: { alignItems: "center", paddingTop: 60 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 15, textAlign: "center" },
  grid: { gap: 14 },
  marketCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden" as any,
  },
  imgWrap: { position: "relative" as any, width: 140, height: 110 },
  img: { width: 140, height: 110 },
  typeBadge: {
    position: "absolute" as any,
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closedText: { color: "#fff", fontWeight: "700" },
  marketInfo: { flex: 1, padding: 16 },
  marketName: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  marketDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 13 },
  arrow: { marginRight: 16 },
});
