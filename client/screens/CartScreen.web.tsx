import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/contexts/CartContext";
import { ComeYaColors } from "@/constants/theme";

// Rojo para versión web
const PRIMARY = "#DC2626";

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  // Obtener items del carrito
  const cartItems = cart?.items || [];
  const subtotal = cartItems.reduce((s: number, i: any) => s + (i.product.price * i.quantity), 0);
  const deliveryFee = cartItems.length > 0 ? 2.99 : 0;
  const total = subtotal + deliveryFee;

  // Funciones adaptadas
  const handleIncrement = (item: any) => {
    updateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = (item: any) => {
    if (item.quantity > 1) {
      updateQuantity(item.id, item.quantity - 1);
    } else {
      removeFromCart(item.id);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* NAVBAR */}
      <View style={[s.navbar, { backgroundColor: card, borderBottomColor: border }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
          <Text style={[s.backText, { color: text }]}>Seguir comprando</Text>
        </Pressable>
        <Text style={[s.navTitle, { color: text }]}>Tu carrito</Text>
        <View style={{ width: 140 }} />
      </View>

      <View style={s.body}>
        {/* IZQUIERDA — Productos */}
        <ScrollView style={s.left} contentContainerStyle={s.leftContent} showsVerticalScrollIndicator={false}>
          {cartItems.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 64 }}>🛒</Text>
              <Text style={[s.emptyTitle, { color: text }]}>Tu carrito está vacío</Text>
              <Text style={[s.emptySub, { color: sub }]}>Añade productos de un restaurante para continuar</Text>
              <Pressable style={s.browseBtn} onPress={() => navigation.navigate("Main")}>
                <Text style={s.browseBtnText}>Explorar restaurantes</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[s.sectionTitle, { color: text }]}>
                {cartItems[0]?.product?.name ? cart?.businessName : "Tu pedido"} · {cartItems.reduce((s: number, i: any) => s + i.quantity, 0)} artículos
              </Text>
              {cartItems.map((item: any) => (
                <View key={item.id} style={[s.itemCard, { backgroundColor: card, borderColor: border }]}>
                  <Image source={{ uri: item.product.image }} style={s.itemImg} contentFit="cover" />
                  <View style={s.itemInfo}>
                    <Text style={[s.itemName, { color: text }]}>{item.product.name}</Text>
                    <Text style={[s.itemPrice, { color: PRIMARY }]}>€{item.product.price.toFixed(2)} / ud.</Text>
                  </View>
                  <View style={s.qtyRow}>
                    <Pressable style={[s.qtyBtn, { borderColor: border }]} onPress={() => handleDecrement(item)}>
                      <Feather name="minus" size={14} color={text} />
                    </Pressable>
                    <Text style={[s.qtyText, { color: text }]}>{item.quantity}</Text>
                    <Pressable style={[s.qtyBtn, { borderColor: border }]} onPress={() => handleIncrement(item)}>
                      <Feather name="plus" size={14} color={text} />
                    </Pressable>
                  </View>
                  <Text style={[s.itemTotal, { color: text }]}>€{(item.product.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <Pressable onPress={clearCart} style={s.clearBtn}>
                <Feather name="trash-2" size={14} color="#F44336" />
                <Text style={s.clearBtnText}>Vaciar carrito</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* DERECHA — Resumen */}
        {cartItems.length > 0 && (
          <View style={[s.summary, { backgroundColor: card, borderLeftColor: border }]}>
            <Text style={[s.summaryTitle, { color: text }]}>Resumen del pedido</Text>
            <View style={[s.summaryBox, { borderColor: border }]}>
              {cartItems.map((item: any) => (
                <View key={item.id} style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: sub }]}>{item.quantity}x {item.product.name}</Text>
                  <Text style={[s.summaryValue, { color: text }]}>€{(item.product.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: sub }]}>Subtotal</Text>
              <Text style={[s.summaryValue, { color: text }]}>€{subtotal.toFixed(2)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: sub }]}>Envío estimado</Text>
              <Text style={[s.summaryValue, { color: text }]}>€{deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={[s.summaryRow, s.totalRow, { borderTopColor: border }]}>
              <Text style={[s.totalLabel, { color: text }]}>Total</Text>
              <Text style={[s.totalValue, { color: PRIMARY }]}>€{total.toFixed(2)}</Text>
            </View>
            <Pressable style={s.checkoutBtn} onPress={() => navigation.navigate("Checkout")}>
              <Text style={s.checkoutBtnText}>Ir al checkout</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
            <Text style={[s.secureText, { color: sub }]}>🔒 Pago 100% seguro</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: 160 },
  backText: { fontSize: 14, fontWeight: "600" },
  navTitle: { fontSize: 18, fontWeight: "800" },
  body: { flex: 1, flexDirection: "row" },
  left: { flex: 1 },
  leftContent: { padding: 32, maxWidth: 720, alignSelf: "center", width: "100%" } as any,
  empty: { alignItems: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptySub: { fontSize: 15, textAlign: "center" },
  browseBtn: { backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  itemCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  itemImg: { width: 72, height: 72, borderRadius: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  qtyText: { fontSize: 15, fontWeight: "700", minWidth: 20, textAlign: "center" },
  itemTotal: { fontSize: 16, fontWeight: "800", minWidth: 60, textAlign: "right" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  clearBtnText: { color: "#F44336", fontSize: 13, fontWeight: "600" },
  summary: { width: 340, padding: 24, borderLeftWidth: 1 },
  summaryTitle: { fontSize: 18, fontWeight: "800", marginBottom: 20 },
  summaryBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  totalRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 17, fontWeight: "800" },
  totalValue: { fontSize: 20, fontWeight: "900" },
  checkoutBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, marginBottom: 10 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secureText: { fontSize: 12, textAlign: "center" },
});
