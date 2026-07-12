import React from "react";
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
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";

const PRIMARY = "#DC2626";

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  const [orderType, setOrderType] = React.useState<"delivery" | "pickup">(
    "delivery",
  );
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] =
    React.useState<number>(2.99);
  const [selectedAddress, setSelectedAddress] = React.useState<any>(null);
  const [businessData, setBusinessData] = React.useState<any>(null);
  const [loadingFee, setLoadingFee] = React.useState(false);

  // Cargar negocio
  React.useEffect(() => {
    if (!cart?.businessId) return;
    apiRequest("GET", `/api/businesses/${cart.businessId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setBusinessData(data.business);
      })
      .catch(() => {});
  }, [cart?.businessId]);

  // Cargar dirección por defecto
  React.useEffect(() => {
    if (!user?.id) return;
    apiRequest("GET", `/api/users/${user.id}/addresses`)
      .then((r) => r.json())
      .then((data) => {
        const addrs = data.addresses || [];
        const def = addrs.find((a: any) => a.isDefault) || addrs[0];
        setSelectedAddress(def || null);
      })
      .catch(() => {});
  }, [user?.id]);

  // Calcular fee real
  React.useEffect(() => {
    if (orderType === "pickup") {
      setCalculatedDeliveryFee(0);
      return;
    }
    if (!selectedAddress?.latitude || !businessData?.latitude) {
      setCalculatedDeliveryFee(
        businessData?.deliveryFee ? businessData.deliveryFee / 100 : 2.99,
      );
      return;
    }
    setLoadingFee(true);
    apiRequest("POST", "/api/orders/calculate-delivery", {
      businessLat: businessData.latitude,
      businessLng: businessData.longitude,
      deliveryLat: selectedAddress.latitude,
      deliveryLng: selectedAddress.longitude,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCalculatedDeliveryFee(data.deliveryFee / 100);
      })
      .catch(() => {})
      .finally(() => setLoadingFee(false));
  }, [selectedAddress, businessData, orderType]);

  const cartItems = cart?.items || [];
  const subtotal = cartItems.reduce(
    (s: number, i: any) => s + i.product.price * i.quantity,
    0,
  );
  const deliveryFee = orderType === "pickup" ? 0 : calculatedDeliveryFee;
  const total = subtotal + deliveryFee;
  const minimumOrder = businessData?.minimumOrder || 0;
  const canProceed = subtotal >= minimumOrder;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View
        style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
          <Text style={[s.backText, { color: text }]}>Seguir comprando</Text>
        </Pressable>
        <Text style={[s.navTitle, { color: text }]}>Tu carrito</Text>
        <View style={{ width: 140 }} />
      </View>

      <View style={[s.body, isMobile && s.bodyMobile]}>
        <ScrollView
          style={s.left}
          contentContainerStyle={[
            s.leftContent,
            isMobile && s.leftContentMobile,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {cartItems.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 64 }}>🛒</Text>
              <Text style={[s.emptyTitle, { color: text }]}>
                Tu carrito está vacío
              </Text>
              <Text style={[s.emptySub, { color: sub }]}>
                Añade productos de un restaurante para continuar
              </Text>
              <Pressable
                style={s.browseBtn}
                onPress={() => navigation.navigate("Main")}
              >
                <Text style={s.browseBtnText}>Explorar restaurantes</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[s.sectionTitle, { color: text }]}>
                {cart?.businessName} ·{" "}
                {cartItems.reduce((s: number, i: any) => s + i.quantity, 0)}{" "}
                artículos
              </Text>
              {cartItems.map((item: any) => (
                <View
                  key={item.id}
                  style={[
                    s.itemCard,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Pressable
                    onPress={() => removeFromCart(item.id)}
                    style={s.removeItemBtn}
                  >
                    <Feather name="x" size={14} color="#EF4444" />
                  </Pressable>
                  <Image
                    source={{ uri: item.product.image }}
                    style={s.itemImg}
                    contentFit="cover"
                  />
                  <View style={s.itemInfo}>
                    <Text style={[s.itemName, { color: text }]}>
                      {item.product.name}
                    </Text>
                    <Text style={[s.itemPrice, { color: PRIMARY }]}>
                      €{item.product.price.toFixed(2)} / ud.
                    </Text>
                  </View>
                  <View style={s.qtyRow}>
                    <Pressable
                      style={[s.qtyBtn, { borderColor: border }]}
                      onPress={() =>
                        item.quantity > 1
                          ? updateQuantity(item.id, item.quantity - 1)
                          : removeFromCart(item.id)
                      }
                    >
                      <Feather name="minus" size={14} color={text} />
                    </Pressable>
                    <Text style={[s.qtyText, { color: text }]}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={[s.qtyBtn, { borderColor: border }]}
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Feather name="plus" size={14} color={text} />
                    </Pressable>
                  </View>
                  <Text style={[s.itemTotal, { color: text }]}>
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              <Pressable onPress={clearCart} style={s.clearBtn}>
                <Feather name="trash-2" size={14} color="#F44336" />
                <Text style={s.clearBtnText}>Vaciar carrito</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {cartItems.length > 0 && (
          <View
            style={[
              s.summary,
              { backgroundColor: card },
              isMobile ? s.summaryMobile : { borderLeftColor: border },
            ]}
          >
            <Text style={[s.summaryTitle, { color: text }]}>
              Resumen del pedido
            </Text>

            {/* Selector delivery / pickup */}
            <View
              style={[
                s.orderTypeRow,
                { backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0" },
              ]}
            >
              <Pressable
                onPress={() => setOrderType("delivery")}
                style={[
                  s.orderTypeBtn,
                  orderType === "delivery" && {
                    backgroundColor: PRIMARY,
                    borderRadius: 8,
                  },
                ]}
              >
                <Feather
                  name="truck"
                  size={14}
                  color={orderType === "delivery" ? "#fff" : sub}
                />
                <Text
                  style={[
                    s.orderTypeTxt,
                    { color: orderType === "delivery" ? "#fff" : sub },
                  ]}
                >
                  Envío
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setOrderType("pickup")}
                style={[
                  s.orderTypeBtn,
                  orderType === "pickup" && {
                    backgroundColor: PRIMARY,
                    borderRadius: 8,
                  },
                ]}
              >
                <Feather
                  name="shopping-bag"
                  size={14}
                  color={orderType === "pickup" ? "#fff" : sub}
                />
                <Text
                  style={[
                    s.orderTypeTxt,
                    { color: orderType === "pickup" ? "#fff" : sub },
                  ]}
                >
                  Recoger
                </Text>
              </Pressable>
            </View>

            {!canProceed && minimumOrder > 0 && (
              <View style={[s.minOrderBadge, { backgroundColor: "#FFF3E0" }]}>
                <Feather name="alert-circle" size={14} color="#FF9800" />
                <Text style={{ color: "#E65100", fontSize: 12, marginLeft: 6 }}>
                  Mín. €{minimumOrder} (faltan €
                  {(minimumOrder - subtotal).toFixed(2)})
                </Text>
              </View>
            )}

            <View style={[s.summaryBox, { borderColor: border }]}>
              {cartItems.map((item: any) => (
                <View key={item.id} style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: sub }]}>
                    {item.quantity}x {item.product.name}
                  </Text>
                  <Text style={[s.summaryValue, { color: text }]}>
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: sub }]}>Subtotal</Text>
              <Text style={[s.summaryValue, { color: text }]}>
                €{subtotal.toFixed(2)}
              </Text>
            </View>
            {orderType === "delivery" && (
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: sub }]}>
                  Envío {loadingFee ? "..." : ""}
                </Text>
                {loadingFee ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Text style={[s.summaryValue, { color: text }]}>
                    €{deliveryFee.toFixed(2)}
                  </Text>
                )}
              </View>
            )}
            {orderType === "pickup" && (
              <View
                style={[
                  s.summaryRow,
                  { backgroundColor: "#E8F5E9", padding: 8, borderRadius: 8 },
                ]}
              >
                <Text style={{ color: "#2E7D32", fontSize: 12 }}>
                  🎉 Sin coste de envío al recoger
                </Text>
              </View>
            )}
            <View
              style={[s.summaryRow, s.totalRow, { borderTopColor: border }]}
            >
              <Text style={[s.totalLabel, { color: text }]}>Total</Text>
              <Text style={[s.totalValue, { color: PRIMARY }]}>
                €{total.toFixed(2)}
              </Text>
            </View>
            <Pressable
              style={[s.checkoutBtn, !canProceed && { opacity: 0.5 }]}
              onPress={() =>
                canProceed &&
                navigation.navigate("Checkout", {
                  calculatedDeliveryFee: deliveryFee,
                  orderType,
                } as any)
              }
              disabled={!canProceed}
            >
              <Text style={s.checkoutBtnText}>
                {canProceed ? "Ir al checkout" : `Mínimo €${minimumOrder}`}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
            <Text style={[s.secureText, { color: sub }]}>
              🔒 Pago 100% seguro
            </Text>
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
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: 160 },
  backText: { fontSize: 14, fontWeight: "600" },
  navTitle: { fontSize: 18, fontWeight: "800" },
  body: { flex: 1, flexDirection: "row" },
  bodyMobile: { flexDirection: "column" },
  left: { flex: 1 },
  leftContent: {
    padding: 32,
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  } as any,
  leftContentMobile: { padding: 16 } as any,
  empty: { alignItems: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptySub: { fontSize: 15, textAlign: "center" },
  browseBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemImg: { width: 72, height: 72, borderRadius: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: "800",
    minWidth: 60,
    textAlign: "right",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  removeItemBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  clearBtnText: { color: "#F44336", fontSize: 13, fontWeight: "600" },
  summary: { width: 340, padding: 24, borderLeftWidth: 1 },
  summaryMobile: {
    width: "100%" as any,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    padding: 20,
  },
  summaryTitle: { fontSize: 18, fontWeight: "800", marginBottom: 20 },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  totalRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 17, fontWeight: "800" },
  totalValue: { fontSize: 20, fontWeight: "900" },
  checkoutBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secureText: { fontSize: 12, textAlign: "center" },
  orderTypeRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 10,
    marginBottom: 14,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  orderTypeTxt: { fontSize: 13, fontWeight: "600" },
  minOrderBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
});
