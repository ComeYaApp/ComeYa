import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";
type Route = RouteProp<RootStackParamList, "ProductDetail">;

export default function ProductDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { addToCart, cart, getCartItem } = useCart();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { productId, businessId, businessName } = route.params;
  const product = (route.params as any).product;

  const [quantity, setQuantity] = useState(1);
  const [unitAmount, setUnitAmount] = useState("1");
  const [note, setNote] = useState("");
  const [showChangeModal, setShowChangeModal] = useState(false);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: favData } = useQuery({
    queryKey: ["/api/favorites/check", user?.id, productId],
    enabled: !!user?.id,
  });

  const toggleFavMutation = useMutation({
    mutationFn: async () => {
      if ((favData as any)?.isFavorite) {
        await apiRequest(
          "DELETE",
          `/api/favorites/${(favData as any).favoriteId}`,
        );
      } else {
        await apiRequest("POST", "/api/favorites", {
          userId: user?.id,
          productId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/favorites/check", user?.id, productId],
      });
    },
  });

  useEffect(() => {
    const existing = getCartItem(productId);
    if (existing) {
      setQuantity(existing.quantity);
      setNote(existing.note || "");
      if (existing.unitAmount) setUnitAmount(existing.unitAmount.toString());
    }
  }, [productId]);

  const calculateTotal = () => {
    if (!product) return 0;
    if (product.isWeightBased)
      return product.price * (parseFloat(unitAmount) || 1) * quantity;
    return product.price * quantity;
  };

  const handleAdd = async () => {
    if (!product) return;
    if (product.requiresNote && !note.trim()) {
      showToast(
        "Por favor agrega una especificación para este producto.",
        "warning",
      );
      return;
    }
    if (cart && cart.businessId !== businessId) {
      setShowChangeModal(true);
      return;
    }
    await addToCart(
      product,
      businessId,
      businessName,
      quantity,
      note.trim() || undefined,
      product.isWeightBased ? parseFloat(unitAmount) || 1 : undefined,
    );
    navigation.goBack();
  };

  const handleConfirmChange = async () => {
    if (!product) return;
    await addToCart(
      product,
      businessId,
      businessName,
      quantity,
      note.trim() || undefined,
      product.isWeightBased ? parseFloat(unitAmount) || 1 : undefined,
    );
    setShowChangeModal(false);
    navigation.goBack();
  };

  if (!product) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <Text style={[s.notFound, { color: text }]}>
          Producto no encontrado
        </Text>
      </View>
    );
  }

  const isFav = (favData as any)?.isFavorite;

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Change business modal */}
        {showChangeModal && (
          <View style={s.modalOverlay}>
            <View
              style={[s.modal, { backgroundColor: card, borderColor: border }]}
            >
              <Feather
                name="alert-circle"
                size={32}
                color="#F59E0B"
                style={{ marginBottom: 12 }}
              />
              <Text style={[s.modalTitle, { color: text }]}>
                ¿Cambiar de negocio?
              </Text>
              <Text style={[s.modalSub, { color: sub }]}>
                Ya tienes productos de otro negocio en tu carrito. ¿Deseas
                vaciarlo y agregar este producto?
              </Text>
              <View style={s.modalBtns}>
                <Pressable
                  onPress={() => setShowChangeModal(false)}
                  style={[
                    s.modalBtn,
                    { backgroundColor: cardBg, borderColor: border },
                  ]}
                >
                  <Text style={[s.modalBtnText, { color: text }]}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmChange}
                  style={[s.modalBtn, { backgroundColor: "#EF4444" }]}
                >
                  <Text style={[s.modalBtnText, { color: "#fff" }]}>
                    Cambiar
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View style={s.layout}>
          {/* Imagen */}
          <View style={s.imageCol}>
            <Image
              source={{ uri: product.image }}
              style={s.image}
              contentFit="cover"
            />
            <Pressable
              onPress={() => navigation.goBack()}
              style={[s.closeBtn, { backgroundColor: card }]}
            >
              <Feather name="x" size={20} color={text} />
            </Pressable>
            <Pressable
              onPress={() => toggleFavMutation.mutate()}
              style={[s.favBtn, { backgroundColor: card }]}
            >
              <Feather
                name="heart"
                size={20}
                color={isFav ? "#EF4444" : text}
              />
            </Pressable>
          </View>

          {/* Detalle */}
          <ScrollView
            style={[s.detailCol, { backgroundColor: card }]}
            contentContainerStyle={s.detailContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.productName, { color: text }]}>{product.name}</Text>
            {product.description ? (
              <Text style={[s.productDesc, { color: sub }]}>
                {product.description}
              </Text>
            ) : null}

            <View style={s.priceRow}>
              <Text style={[s.price, { color: PRIMARY }]}>
                €{product.price}
                {product.isWeightBased ? `/${product.unit}` : ""}
              </Text>
              {!product.available && (
                <View
                  style={[s.unavailBadge, { backgroundColor: "#EF444420" }]}
                >
                  <Text
                    style={{
                      color: "#EF4444",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    No disponible
                  </Text>
                </View>
              )}
            </View>

            {/* Peso */}
            {product.isWeightBased && (
              <View style={[s.section, { borderTopColor: border }]}>
                <Text style={[s.sectionTitle, { color: text }]}>
                  Cantidad ({product.unit})
                </Text>
                <View style={s.qtyRow}>
                  <Pressable
                    onPress={() => {
                      const c = parseFloat(unitAmount) || 1;
                      if (c > 0.5) setUnitAmount((c - 0.5).toFixed(1));
                    }}
                    style={[s.qtyBtn, { backgroundColor: cardBg }]}
                  >
                    <Feather name="minus" size={18} color={text} />
                  </Pressable>
                  <TextInput
                    value={unitAmount}
                    onChangeText={setUnitAmount}
                    keyboardType="decimal-pad"
                    style={[
                      s.qtyInput,
                      { backgroundColor: cardBg, color: text },
                    ]}
                  />
                  <Pressable
                    onPress={() => {
                      const c = parseFloat(unitAmount) || 1;
                      setUnitAmount((c + 0.5).toFixed(1));
                    }}
                    style={[s.qtyBtn, { backgroundColor: cardBg }]}
                  >
                    <Feather name="plus" size={18} color={text} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Nota */}
            <View style={[s.section, { borderTopColor: border }]}>
              <View style={s.noteLabelRow}>
                <Text style={[s.sectionTitle, { color: text }]}>
                  {product.requiresNote
                    ? "Especificación (requerida)"
                    : "Nota (opcional)"}
                </Text>
                {product.requiresNote && (
                  <View style={[s.reqBadge, { backgroundColor: "#F59E0B20" }]}>
                    <Text
                      style={{
                        color: "#F59E0B",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      Requerido
                    </Text>
                  </View>
                )}
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={
                  product.isWeightBased
                    ? "Ej: Carne delgada sin grasa"
                    : "Instrucciones especiales..."
                }
                placeholderTextColor={sub}
                multiline
                numberOfLines={3}
                style={[
                  s.noteInput,
                  {
                    backgroundColor: cardBg,
                    color: text,
                    borderColor:
                      product.requiresNote && !note.trim()
                        ? "#F59E0B"
                        : "transparent",
                  },
                ]}
              />
            </View>

            {/* Cantidad */}
            <View style={[s.section, { borderTopColor: border }]}>
              <View style={s.qtySection}>
                <Text style={[s.sectionTitle, { color: text }]}>Cantidad</Text>
                <View style={s.qtyRow}>
                  <Pressable
                    onPress={() => {
                      if (quantity > 1) setQuantity(quantity - 1);
                    }}
                    style={[s.qtyBtn, { backgroundColor: cardBg }]}
                  >
                    <Feather name="minus" size={18} color={text} />
                  </Pressable>
                  <Text style={[s.qtyNum, { color: text }]}>{quantity}</Text>
                  <Pressable
                    onPress={() => setQuantity(quantity + 1)}
                    style={[s.qtyBtn, { backgroundColor: cardBg }]}
                  >
                    <Feather name="plus" size={18} color={text} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={[s.footer, { borderTopColor: border }]}>
              <View>
                <Text style={[s.totalLabel, { color: sub }]}>Total</Text>
                <Text style={[s.totalAmount, { color: text }]}>
                  €{calculateTotal().toFixed(2)}
                </Text>
              </View>
              <Pressable
                onPress={handleAdd}
                disabled={!product.available}
                style={[
                  s.addBtn,
                  { backgroundColor: product.available ? PRIMARY : sub },
                ]}
              >
                <Feather name="shopping-cart" size={18} color="#fff" />
                <Text style={s.addBtnText}>Agregar al carrito</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  layout: { flex: 1, flexDirection: "row" },
  imageCol: { flex: 1, position: "relative" as any },
  image: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute" as any,
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  favBtn: {
    position: "absolute" as any,
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  detailCol: { width: 420 },
  detailContent: { padding: 28, paddingBottom: 40 },
  productName: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  productDesc: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  price: { fontSize: 28, fontWeight: "800" },
  unavailBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  section: { borderTopWidth: 1, paddingTop: 20, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  noteLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  noteInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 2,
    textAlignVertical: "top" as any,
  },
  qtySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyInput: {
    width: 70,
    height: 40,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  qtyNum: {
    fontSize: 20,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 20,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { fontSize: 13 },
  totalAmount: { fontSize: 24, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  notFound: { fontSize: 18, textAlign: "center", marginTop: 60 },
  modalOverlay: {
    position: "absolute" as any,
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modal: {
    width: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalSub: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalBtns: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBtnText: { fontSize: 14, fontWeight: "600" },
});
