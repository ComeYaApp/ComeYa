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
const PRIMARY = "#E60000";

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

  const reserveDates = (() => {
    const out: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
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
  })();

  const RESERVE_TIMES = [
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "20:00", "20:30", "21:00", "21:30", "22:00", "22:30",
  ];

  const submitReservation = async () => {
    if (!reserveDate || !reserveTime) return;
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
      });
      const data = await res.json();
      if (data.success) {
        setShowReserveModal(false);
        (window as any).alert(
          "Reserva enviada 📅 El negocio la confirmará en breve. Puedes verla en tu perfil → Mis reservas.",
        );
      } else {
        (window as any).alert(data.error || "No se pudo reservar");
      }
    } catch {
      (window as any).alert("No se pudo enviar la reserva");
    } finally {
      setReserveSubmitting(false);
    }
  };

  const { isMobile } = useResponsive();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";
  const inputBg = isDark ? "#222" : "#f8f8f8";

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
                      {deliveryFee.toFixed(2)} € envío
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

          {/* Botón único RESERVAR / CONSULTAR (+ Reservar mesa si aplica) */}
          <View style={[s.reserveWrap, { backgroundColor: card, borderBottomColor: border }]}>
            {business?.reservationsEnabled && (
              <Pressable
                onPress={() => {
                  setReserveDate(null);
                  setReserveTime(null);
                  setReserveParty(2);
                  setReserveName("");
                  setReservePhone("");
                  setReserveNotes("");
                  setShowReserveModal(true);
                }}
                style={[s.reserveBtn, { backgroundColor: PRIMARY }]}
              >
                <Feather name="calendar" size={16} color="#fff" />
                <Text style={s.reserveBtnTxt}>Reservar mesa</Text>
              </Pressable>
            )}
            {business?.deliveryEnabled === false && (
              <View style={s.dineInBadge}>
                <Feather name="coffee" size={13} color="#B45309" />
                <Text style={[s.dineInBadgeTxt, { color: "#B45309" }]}>
                  Solo reservas — sin reparto
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => setShowContactOptions(!showContactOptions)}
              style={[
                s.reserveBtn,
                {
                  backgroundColor: "#F1F5F9",
                  marginLeft: business?.reservationsEnabled ? 8 : 0,
                },
              ]}
            >
              <Feather
                name={showContactOptions ? "chevron-up" : "phone"}
                size={16}
                color={PRIMARY}
              />
              <Text style={[s.reserveBtnTxt, { color: PRIMARY }]}>
                {showContactOptions ? "OCULTAR" : "RESERVAR / CONSULTAR"}
              </Text>
            </Pressable>
            {showContactOptions && (
              <View style={s.contactOptions}>
                <Pressable
                  onPress={() =>
                    business?.phone &&
                    (window as any).open(`tel:${business.phone}`)
                  }
                  style={[s.contactOpt, { backgroundColor: "#F1F5F9" }]}
                >
                  <Feather name="phone" size={16} color={PRIMARY} />
                  <Text style={[s.contactOptTxt, { color: PRIMARY }]}>
                    LLAMAR
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const phone = (business?.phone || "").replace(/\D/g, "");
                    if (phone)
                      (window as any).open(`https://wa.me/${phone}`, "_blank");
                  }}
                  style={[s.contactOpt, { backgroundColor: "#25D366" }]}
                >
                  <Feather name="message-circle" size={16} color="#fff" />
                  <Text style={[s.contactOptTxt, { color: "#fff" }]}>
                    WHATSAPP
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View
            style={[
              s.catBar,
              { backgroundColor: card, borderBottomColor: border },
            ]}
          >            <ScrollView
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
                            {p.price.toFixed(2)} €
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

        {/* CARRITO FLOTANTE DERECHA / BARRA INFERIOR EN MÓVIL
            (oculto en negocios "solo reservas") */}
        {business?.deliveryEnabled !== false && !isMobile ? (
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
                        {(item.product.price * item.quantity).toFixed(2)} €
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
                      {cartTotal.toFixed(2)} €
                    </Text>
                  </View>
                  <View style={s.cartRow}>
                    <Text style={[s.cartRowLabel, { color: sub }]}>Envío</Text>
                    <Text style={[s.cartRowValue, { color: text }]}>
                      {deliveryFee.toFixed(2)} €
                    </Text>
                  </View>
                  <View style={[s.cartRow, s.cartTotal]}>
                    <Text style={[s.cartTotalLabel, { color: text }]}>
                      Total
                    </Text>
                    <Text style={[s.cartTotalValue, { color: PRIMARY }]}>
                      {(cartTotal + deliveryFee).toFixed(2)} €
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
        ) : business?.deliveryEnabled !== false && cartItems.length > 0 ? (
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
                {(cartTotal + deliveryFee).toFixed(2)} €
              </Text>
            </View>
            <Pressable style={s.cartBarBtn} onPress={goToCheckout}>
              <Text style={s.cartBarBtnText}>Ir al checkout</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {/* Modal de reserva de mesa */}
        {showReserveModal && (
          <View style={s.reserveOverlay}>
            <View
              style={[s.reserveModal, { backgroundColor: card }]}
            >
              <View style={s.reserveModalHeader}>
                <Text style={[s.reserveModalTitle, { color: text }]}>
                  Reservar mesa
                </Text>
                <Pressable onPress={() => setShowReserveModal(false)}>
                  <Feather name="x" size={20} color={sub} />
                </Pressable>
              </View>
              <Text style={[s.reserveLabel, { color: sub }]}>
                Fecha (próximos 14 días)
              </Text>
              <View style={s.reserveChipRow}>
                {reserveDates.map((d) => (
                  <Pressable
                    key={d.value}
                    onPress={() => setReserveDate(d.value)}
                    style={[
                      s.reserveChip,
                      {
                        borderColor:
                          reserveDate === d.value ? PRIMARY : border,
                        backgroundColor:
                          reserveDate === d.value ? PRIMARY : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.reserveChipTxt,
                        { color: reserveDate === d.value ? "#fff" : text },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.reserveLabel, { color: sub }]}>Hora</Text>
              <View style={s.reserveChipRow}>
                {RESERVE_TIMES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setReserveTime(t)}
                    style={[
                      s.reserveChip,
                      {
                        borderColor: reserveTime === t ? PRIMARY : border,
                        backgroundColor:
                          reserveTime === t ? PRIMARY : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.reserveChipTxt,
                        { color: reserveTime === t ? "#fff" : text },
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.reserveLabel, { color: sub }]}>Comensales</Text>
              <View style={s.reservePartyRow}>
                <Pressable
                  onPress={() => setReserveParty((p) => Math.max(1, p - 1))}
                  style={[s.reservePartyBtn, { backgroundColor: inputBg }]}
                >
                  <Feather name="minus" size={16} color={text} />
                </Pressable>
                <Text style={[s.reservePartyVal, { color: text }]}>
                  {reserveParty}
                </Text>
                <Pressable
                  onPress={() => setReserveParty((p) => Math.min(20, p + 1))}
                  style={[s.reservePartyBtn, { backgroundColor: PRIMARY }]}
                >
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
              </View>
              <input
                placeholder="Tu nombre"
                value={reserveName}
                onChange={(e: any) => setReserveName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginTop: 10,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  fontSize: 14,
                  color: text,
                  backgroundColor: inputBg,
                }}
              />
              <input
                placeholder="Tu teléfono (opcional)"
                value={reservePhone}
                onChange={(e: any) => setReservePhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginTop: 10,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  fontSize: 14,
                  color: text,
                  backgroundColor: inputBg,
                }}
              />
              <input
                placeholder="Notas (opcional): alergias, trona, celebración..."
                value={reserveNotes}
                onChange={(e: any) => setReserveNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginTop: 10,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  fontSize: 14,
                  color: text,
                  backgroundColor: inputBg,
                }}
              />
              <Pressable
                onPress={submitReservation}
                disabled={reserveSubmitting}
                style={[s.checkoutBtn, { opacity: reserveSubmitting ? 0.6 : 1 }]}
              >
                <Text style={s.checkoutBtnText}>
                  {reserveSubmitting ? "Enviando..." : "Enviar reserva"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
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
  reserveWrap: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  reserveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    cursor: "pointer" as any,
  },
  reserveBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  dineInBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F59E0B15",
    marginLeft: 8,
  },
  dineInBadgeTxt: { fontSize: 12, fontWeight: "700", marginLeft: 6 },
  reserveOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 500,
    padding: 16,
  } as any,
  reserveModal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "85vh",
    overflowY: "auto",
    borderRadius: 16,
    padding: 24,
  } as any,
  reserveModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reserveModalTitle: { fontSize: 20, fontWeight: "800" },
  reserveLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
  reserveChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reserveChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  reserveChipTxt: { fontSize: 13, fontWeight: "600" },
  reservePartyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  reservePartyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reservePartyVal: { fontSize: 18, fontWeight: "800" },
  contactOptions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  contactOpt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    cursor: "pointer" as any,
  },
  contactOptTxt: { fontSize: 13, fontWeight: "800" },
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