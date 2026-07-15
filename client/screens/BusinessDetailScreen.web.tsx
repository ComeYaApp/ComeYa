import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useResponsive } from "@/hooks/useResponsive";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "BusinessDetail">;
const PRIMARY = "#DC2626";

export default function BusinessDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { theme, isDark } = useTheme();
  const { cart, addToCart, removeFromCart, getCartItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { isMobile } = useResponsive();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  const businessId = route.params?.businessId;

  // Redirigir silenciosamente si no hay businessId
  useEffect(() => {
    if (businessId) return;
    const target = isAuthenticated ? "Main" : "Login";
    navigation.reset({ index: 0, routes: [{ name: target as any }] });
  }, [businessId, isAuthenticated, navigation]);

  useEffect(() => {
    if (!businessId) return;
    apiRequest("GET", `/api/business/${businessId}`)
      .then((r) => r.json())
      .then((data) => {
        setBusiness(data.business);
        const prods = (data.business?.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          price: ((p.price || 0) / 100) * 1.15,
          image: p.image || null,
          category: p.category || "General",
          isAvailable:
            p.isAvailable === true ||
            p.isAvailable === 1 ||
            p.is_available === true ||
            p.is_available === 1,
          businessId: businessId,
        }));
        setProducts(prods);
        if (prods.length > 0) setActiveCategory(prods[0].category);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [businessId]);

  // Fallback: solo mostrar spinner durante la redirección
  if (!businessId) {
    return (
      <View style={[s.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const filteredProducts = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;

  const cartItems = cart?.items || [];
  const cartTotal = cartItems.reduce(
    (s: number, i: any) => s + i.product.price * i.quantity,
    0,
  );
  const cartCount = cartItems.reduce((s: number, i: any) => s + i.quantity, 0);

  const deliveryFee = business?.deliveryFee
    ? Math.max(business.deliveryFee, 250) / 100
    : 2.5;

  const handleAddItem = (product: any) => {
    addToCart(product, businessId, business?.name || "", 1);
  };

  const handleRemoveItem = (productId: string) => {
    const item = cartItems.find((i: any) => i.product.id === productId);
    if (item) removeFromCart(item.id);
  };

  const goToCheckout = () => {
    navigation.navigate("Checkout", {
      calculatedDeliveryFee: deliveryFee,
      orderType: "delivery",
    } as any);
  };

  if (loading)
    return (
      <View style={[s.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  if (!business) {
    return (
      <View style={[s.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center", padding: 40 }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🏪</Text>
        <Text style={[s.cartTitle, { color: text }]}>Negocio no encontrado</Text>
        <Pressable
          style={[s.checkoutBtn, { marginTop: 24 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={s.checkoutBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* NAVBAR */}
      <View
        style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
          <Text style={[s.backText, { color: text }]}>Volver</Text>
        </Pressable>
        <Text style={[s.navTitle, { color: text }]}>{business?.name}</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={s.body}>
        <ScrollView style={s.main} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <Image
              source={{ uri: business?.image }}
              style={s.heroImg}
              contentFit="cover"
            />
            <View style={[s.heroOverlay, { backgroundColor: card }]}>
              <View style={s.heroInfo}>
                <Text style={[s.heroName, { color: text }]}>
                  {business?.name}
                </Text>
                <Text style={[s.heroDesc, { color: sub }]}>
                  {business?.description}
                </Text>
                <View style={s.heroMeta}>
                  <View style={s.metaChip}>
                    <Feather name="star" size={14} color="#FFB800" />
                    <Text style={[s.metaChipText, { color: text }]}>
                      {((business?.rating || 0) / 100).toFixed(1)}
                    </Text>
                  </View>
                  <View style={s.metaChip}>
                    <Feather name="clock" size={14} color={sub} />
                    <Text style={[s.metaChipText, { color: sub }]}>
                      {business?.deliveryTime || "30-45 min"}
                    </Text>
                  </View>
                  <View style={s.metaChip}>
                    <Feather name="truck" size={14} color={sub} />
                    <Text style={[s.metaChipText, { color: sub }]}>
                      €{deliveryFee.toFixed(2)} envío
                    </Text>
                  </View>
                  <View
                    style={[
                      s.statusBadge,
                      {
                        backgroundColor: business?.isOpen
                          ? "#4CAF5020"
                          : "#9E9E9E20",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: business?.isOpen ? "#4CAF50" : "#9E9E9E",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {business?.isOpen ? "Abierto" : "Cerrado"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View
            style={[
              s.catBar,
              { backgroundColor: card, borderBottomColor: border },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.catScroll}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[s.catBtn, activeCategory === cat && s.catBtnActive]}
                >
                  <Text
                    style={[
                      s.catBtnText,
                      activeCategory === cat && s.catBtnTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={s.productsSection}>
            {activeCategory && (
              <Text style={[s.catTitle, { color: text }]}>
                {activeCategory}
              </Text>
            )}
            <View style={s.productsGrid}>
              {filteredProducts
                .filter((p) => p.isAvailable)
                .map((p) => {
                  const cartItem = getCartItem(p.id);
                  const qty = cartItem?.quantity || 0;
                  return (
                    <View
                      key={p.id}
                      style={[s.productCard, { backgroundColor: card }]}
                    >
                      <Image
                        source={{ uri: p.image }}
                        style={s.productImg}
                        contentFit="cover"
                      />
                      <View style={s.productBody}>
                        <Text
                          style={[s.productName, { color: text }]}
                          numberOfLines={2}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={[s.productDesc, { color: sub }]}
                          numberOfLines={2}
                        >
                          {p.description}
                        </Text>
                        <View style={s.productFooter}>
                          <Text style={[s.productPrice, { color: PRIMARY }]}>
                            €{p.price.toFixed(2)}
                          </Text>
                          {qty === 0 ? (
                            <Pressable
                              style={s.addBtn}
                              onPress={() => handleAddItem(p)}
                            >
                              <Feather name="plus" size={16} color="#fff" />
                            </Pressable>
                          ) : (
                            <View style={s.qtyRow}>
                              <Pressable
                                style={s.qtyBtn}
                                onPress={() => handleRemoveItem(p.id)}
                              >
                                <Feather
                                  name="minus"
                                  size={14}
                                  color={PRIMARY}
                                />
                              </Pressable>
                              <Text style={[s.qtyText, { color: text }]}>
                                {qty}
                              </Text>
                              <Pressable
                                style={s.qtyBtn}
                                onPress={() => handleAddItem(p)}
                              >
                                <Feather
                                  name="plus"
                                  size={14}
                                  color={PRIMARY}
                                />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        </ScrollView>

        {/* CARRITO FLOTANTE DERECHA / BARRA INFERIOR EN MÓVIL */}
        {!isMobile ? (
          <View
            style={[
              s.cartPanel,
              { backgroundColor: card, borderLeftColor: border },
            ]}
          >
            <Text style={[s.cartTitle, { color: text }]}>Tu pedido</Text>
            {cartItems.length === 0 ? (
              <View style={s.cartEmpty}>
                <Text style={{ fontSize: 40 }}>🛒</Text>
                <Text style={[s.cartEmptyText, { color: sub }]}>
                  Añade productos para empezar
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  style={s.cartItems}
                  showsVerticalScrollIndicator={false}
                >
                  {cartItems.map((item: any) => (
                    <View
                      key={item.id}
                      style={[s.cartItem, { borderBottomColor: border }]}
                    >
                      <Pressable
                        onPress={() => removeFromCart(item.id)}
                        style={s.removeItemBtn}
                      >
                        <Feather name="x" size={12} color="#EF4444" />
                      </Pressable>
                      <View style={s.cartItemQty}>
                        <Text style={s.cartItemQtyText}>{item.quantity}x</Text>
                      </View>
                      <Text
                        style={[s.cartItemName, { color: text, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {item.product.name}
                      </Text>
                      <Text style={[s.cartItemPrice, { color: text }]}>
                        €{(item.product.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={[s.cartSummary, { borderTopColor: border }]}>
                  <View style={s.cartRow}>
                    <Text style={[s.cartRowLabel, { color: sub }]}>
                      Subtotal
                    </Text>
                    <Text style={[s.cartRowValue, { color: text }]}>
                      €{cartTotal.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.cartRow}>
                    <Text style={[s.cartRowLabel, { color: sub }]}>Envío</Text>
                    <Text style={[s.cartRowValue, { color: text }]}>
                      €{deliveryFee.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[s.cartRow, s.cartTotal]}>
                    <Text style={[s.cartTotalLabel, { color: text }]}>
                      Total
                    </Text>
                    <Text style={[s.cartTotalValue, { color: PRIMARY }]}>
                      €{(cartTotal + deliveryFee).toFixed(2)}
                    </Text>
                  </View>
                  <Pressable style={s.checkoutBtn} onPress={goToCheckout}>
                    <Text style={s.checkoutBtnText}>
                      Ir al checkout ({cartCount})
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : cartItems.length > 0 ? (
          <View
            style={[
              s.cartBarMobile,
              { backgroundColor: card, borderTopColor: border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.cartBarCount, { color: text }]}>
                {cartCount} producto{cartCount !== 1 ? "s" : ""}
              </Text>
              <Text style={[s.cartBarTotal, { color: PRIMARY }]}>
                €{(cartTotal + deliveryFee).toFixed(2)}
              </Text>
            </View>
            <Pressable style={s.cartBarBtn} onPress={goToCheckout}>
              <Text style={s.cartBarBtnText}>Ir al checkout</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: 80 },
  backText: { fontSize: 14, fontWeight: "600" },
  navTitle: { fontSize: 16, fontWeight: "700" },
  body: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  hero: {},
  heroImg: { width: "100%", height: 280 },
  heroOverlay: { padding: 24 },
  heroInfo: {},
  heroName: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  heroDesc: { fontSize: 15, marginBottom: 14, lineHeight: 22 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  metaChipText: { fontSize: 13, fontWeight: "500" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  catBar: { borderBottomWidth: 1, paddingVertical: 4 },
  catScroll: { paddingHorizontal: 24, gap: 4 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  catBtnActive: { backgroundColor: PRIMARY },
  catBtnText: { fontSize: 14, fontWeight: "600", color: "#666" },
  catBtnTextActive: { color: "#fff" },
  productsSection: { padding: 24 },
  catTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  productsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  productCard: {
    width: 220,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  productImg: { width: "100%", height: 130 },
  productBody: { padding: 12 },
  productName: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  productDesc: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: { fontSize: 16, fontWeight: "800" },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 16,
    textAlign: "center",
  },
  cartPanel: {
    width: 320,
    borderLeftWidth: 1,
    padding: 20,
    flexDirection: "column",
  },
  cartTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  cartEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  cartEmptyText: { fontSize: 14, textAlign: "center" },
  cartItems: { flex: 1 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
    position: "relative",
  },
  removeItemBtn: {
    position: "absolute",
    top: 8,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  cartItemQty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  cartItemQtyText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  cartItemName: { fontSize: 13 },
  cartItemPrice: { fontSize: 13, fontWeight: "600" },
  cartSummary: { borderTopWidth: 1, paddingTop: 14, gap: 8 },
  cartRow: { flexDirection: "row", justifyContent: "space-between" },
  cartRowLabel: { fontSize: 13 },
  cartRowValue: { fontSize: 13, fontWeight: "600" },
  cartTotal: { marginTop: 4 },
  cartTotalLabel: { fontSize: 16, fontWeight: "800" },
  cartTotalValue: { fontSize: 18, fontWeight: "900" },
  checkoutBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  checkoutBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cartBarMobile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cartBarCount: { fontSize: 13, fontWeight: "600" },
  cartBarTotal: { fontSize: 18, fontWeight: "900" },
  cartBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  cartBarBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});