import React, { useState } from "react";
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
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";

type Route = RouteProp<
  {
    Review: {
      orderId: string;
      businessId: string;
      businessName: string;
      deliveryPersonId?: string;
      allowTip?: boolean;
    };
  },
  "Review"
>;

function Stars({
  rating,
  onRate,
  label,
}: {
  rating: number;
  onRate: (n: number) => void;
  label: string;
}) {
  const { isDark } = useTheme();
  const sub = isDark ? "#aaa" : "#666";
  return (
    <View style={s.starBlock}>
      <Text style={[s.starLabel, { color: isDark ? "#fff" : "#1a1a1a" }]}>
        {label}
      </Text>
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onRate(n)} style={s.starBtn}>
            <Feather
              name="star"
              size={28}
              color={n <= rating ? "#FFD700" : sub}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ReviewScreenEnhanced() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { orderId, businessId, businessName, deliveryPersonId, allowTip } =
    route.params;

  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packagingRating, setPackagingRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [wantTip, setWantTip] = useState(false);
  const [tipAmount, setTipAmount] = useState(2);
  // En web la propina se envía por pago manual (comprobante verificado por el
  // admin) o en efectivo (doble confirmación). La tarjeta está en la app.
  const [tipMethod, setTipMethod] = useState<"manual" | "cash">("manual");
  const [tipProofUrl, setTipProofUrl] = useState<string | null>(null);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const { data: tagsData } = useQuery({
    queryKey: ["/api/reviews/tags"],
    queryFn: async () => (await apiRequest("GET", "/api/reviews/tags")).json(),
  });
  const tags: any[] = tagsData?.tags || [];

  const handlePickPhoto = async () => {
    if (photos.length >= 3) {
      showToast("Máximo 3 fotos", "warning");
      return;
    }
    const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
    const url = await pickAndUploadImage("reviews");
    if (url) setPhotos([...photos, url]);
  };

  const toggleTag = (id: string) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const submitMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/reviews", {
          orderId,
          userId: user?.id,
          businessId,
          deliveryPersonId,
          foodRating: foodRating || undefined,
          deliveryRating: deliveryRating || undefined,
          packagingRating: packagingRating || undefined,
          driverRating: driverRating || undefined,
          comment: comment.trim() || undefined,
          tags: selectedTags.length ? selectedTags : undefined,
          photos: photos.length ? photos : undefined,
          tipAmount: wantTip ? tipAmount * 100 : 0,
          tipMethod: wantTip ? tipMethod : undefined,
          tipProof:
            wantTip && tipMethod === "manual" ? tipProofUrl : undefined,
        })
      ).json(),
    onSuccess: (data: any) => {
      if (data?.success === false) {
        showToast(data.error || "No se pudo enviar la reseña", "error");
        return;
      }
      if (data?.tipPending) {
        showToast(data.message || "Propina declarada", "success");
      } else {
        showToast("¡Gracias por tu opinión!", "success");
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "orders"],
      });
      navigation.goBack();
    },
    onError: () => showToast("No se pudo enviar la reseña", "error"),
  });

  const handleSubmit = () => {
    if (!foodRating && !deliveryRating && !packagingRating && !driverRating) {
      showToast("Por favor califica al menos un aspecto", "warning");
      return;
    }
    submitMutation.mutate();
  };

  const avgRating = [
    foodRating,
    packagingRating,
    deliveryRating,
    driverRating,
  ].filter(Boolean);
  const avg = avgRating.length
    ? (avgRating.reduce((a, b) => a + b, 0) / avgRating.length).toFixed(1)
    : "—";

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        <MobileSidebarWrapper
          title="Calificar pedido"
          sidebarStyle={[
            s.sidebar,
            { backgroundColor: card, borderRightColor: border },
          ]}
        >
          <View style={[s.sideHeader, { borderBottomColor: border }]}>
            <View style={[s.sideIconWrap, { backgroundColor: PRIMARY + "15" }]}>
              <Feather name="star" size={32} color={PRIMARY} />
            </View>
            <Text style={[s.sideTitle, { color: text }]}>{businessName}</Text>
            <Text style={[s.sideSub, { color: sub }]}>
              Califica tu experiencia
            </Text>
            {avg !== "—" && (
              <View
                style={[
                  s.avgBadge,
                  { backgroundColor: "#FFD70020", borderColor: "#FFD70040" },
                ]}
              >
                <Feather name="star" size={14} color="#FFD700" />
                <Text style={[s.avgText, { color: "#B8860B" }]}>
                  {avg} promedio
                </Text>
              </View>
            )}
          </View>
          <View style={s.sideInfo}>
            {[
              { label: "Comida", val: foodRating },
              { label: "Empaque", val: packagingRating },
              ...(deliveryPersonId
                ? [
                    { label: "Entrega", val: deliveryRating },
                    { label: "Repartidor", val: driverRating },
                  ]
                : []),
            ].map((item) => (
              <View key={item.label} style={s.sideRatingRow}>
                <Text style={[s.sideRatingLabel, { color: sub }]}>
                  {item.label}
                </Text>
                <View style={s.sideStars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Feather
                      key={n}
                      name="star"
                      size={12}
                      color={n <= item.val ? "#FFD700" : border}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
          <View style={[s.sideFooter, { borderTopColor: border }]}>
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
              <Feather name="arrow-left" size={16} color={sub} />
              <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
            </Pressable>
          </View>
        </MobileSidebarWrapper>

        <ScrollView
          style={s.main}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Ratings comida */}
          <View
            style={[s.card, { backgroundColor: card, borderColor: border }]}
          >
            <View style={s.cardHeader}>
              <Feather name="shopping-bag" size={18} color={PRIMARY} />
              <Text style={[s.cardTitle, { color: text }]}>
                Calidad del pedido
              </Text>
            </View>
            <Stars rating={foodRating} onRate={setFoodRating} label="Comida" />
            <Stars
              rating={packagingRating}
              onRate={setPackagingRating}
              label="Empaque"
            />
          </View>

          {/* Ratings entrega */}
          {deliveryPersonId && (
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="truck" size={18} color="#00BCD4" />
                <Text style={[s.cardTitle, { color: text }]}>Entrega</Text>
              </View>
              <Stars
                rating={deliveryRating}
                onRate={setDeliveryRating}
                label="Velocidad"
              />
              <Stars
                rating={driverRating}
                onRate={setDriverRating}
                label="Repartidor"
              />
            </View>
          )}

          {/* Propina al repartidor — solo al confirmar la entrega */}
          {deliveryPersonId && allowTip && (
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="gift" size={18} color="#10B981" />
                <Text style={[s.cardTitle, { color: text }]}>
                  Propina al repartidor (opcional)
                </Text>
              </View>
              <View style={s.tipsWrap}>
                {[1, 2, 3, 4, 5].map((amount) => {
                  const active = wantTip && tipAmount === amount;
                  return (
                    <Pressable
                      key={amount}
                      onPress={() => {
                        setWantTip(true);
                        setTipAmount(amount);
                      }}
                      style={[
                        s.tipBtn,
                        {
                          backgroundColor: active ? "#10B981" : cardBg,
                          borderColor: active ? "#10B981" : border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.tipBtnText,
                          { color: active ? "#fff" : text },
                        ]}
                      >
                        {amount} €
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {wantTip && (
                <>
                  <View style={s.tipsWrap}>
                    {[
                      { id: "manual", label: "Bizum/Transferencia" },
                      { id: "cash", label: "Efectivo" },
                    ].map((opt) => {
                      const active = tipMethod === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setTipMethod(opt.id as any)}
                          style={[
                            s.tipBtn,
                            {
                              backgroundColor: active ? "#10B981" : cardBg,
                              borderColor: active ? "#10B981" : border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.tipBtnText,
                              { color: active ? "#fff" : text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[s.noTipText, { color: sub, marginTop: 8 }]}>
                    {tipMethod === "manual"
                      ? "Envía el importe por Bizum/transferencia al número de la plataforma y adjunta el comprobante. Se abona al repartidor cuando se verifica el pago."
                      : "Le das el efectivo al repartidor en mano. Él lo confirma en su app y queda registrado en sus ganancias."}
                  </Text>
                  {tipMethod === "manual" && (
                    <Pressable
                      onPress={async () => {
                        const { pickAndUploadImage } = await import(
                          "@/utils/uploadImageWeb"
                        );
                        const url = await pickAndUploadImage("tip-proofs");
                        if (url) setTipProofUrl(url);
                      }}
                      style={{
                        marginTop: 8,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Feather name="camera" size={14} color="#10B981" />
                      <Text
                        style={{
                          color: "#10B981",
                          marginLeft: 6,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {tipProofUrl
                          ? "Comprobante adjuntado ✓"
                          : "Adjuntar comprobante (opcional)"}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setWantTip(false)}
                    style={[s.noTipBtn, { marginTop: 12 }]}
                  >
                    <Text style={[s.noTipText, { color: sub }]}>Sin propina</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="tag" size={18} color="#FF9800" />
                <Text style={[s.cardTitle, { color: text }]}>
                  Etiquetas (opcional)
                </Text>
              </View>
              <View style={s.tagsWrap}>
                {tags.map((tag: any) => {
                  const active = selectedTags.includes(tag.id);
                  const color = tag.isPositive ? "#10B981" : "#EF4444";
                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      style={[
                        s.tag,
                        {
                          backgroundColor: active ? color + "20" : cardBg,
                          borderColor: active ? color : border,
                        },
                      ]}
                    >
                      <Feather
                        name={tag.icon as any}
                        size={13}
                        color={active ? color : sub}
                      />
                      <Text
                        style={[s.tagText, { color: active ? color : text }]}
                      >
                        {tag.tagName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Fotos */}
          <View
            style={[s.card, { backgroundColor: card, borderColor: border }]}
          >
            <View style={s.cardHeader}>
              <Feather name="camera" size={18} color="#E91E63" />
              <Text style={[s.cardTitle, { color: text }]}>
                Fotos (opcional, máx. 3)
              </Text>
            </View>
            <View style={s.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={s.photoWrap}>
                  <Image source={{ uri }} style={s.photo} contentFit="cover" />
                  <Pressable
                    onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                    style={s.removePhoto}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 && (
                <Pressable
                  onPress={handlePickPhoto}
                  style={[s.addPhoto, { borderColor: border }]}
                >
                  <Feather name="plus" size={22} color={sub} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Comentario */}
          <View
            style={[s.card, { backgroundColor: card, borderColor: border }]}
          >
            <View style={s.cardHeader}>
              <Feather name="message-circle" size={18} color="#9C27B0" />
              <Text style={[s.cardTitle, { color: text }]}>
                Comentario (opcional)
              </Text>
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Cuéntanos más sobre tu experiencia..."
              placeholderTextColor={sub}
              multiline
              numberOfLines={4}
              style={[s.textarea, { backgroundColor: cardBg, color: text }]}
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
            style={[
              s.submitBtn,
              {
                backgroundColor: PRIMARY,
                opacity: submitMutation.isPending ? 0.6 : 1,
              },
            ]}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={s.submitText}>Enviar calificación</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  sideIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  sideTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  avgBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  avgText: { fontSize: 13, fontWeight: "700" },
  sideInfo: { flex: 1, padding: 16, gap: 10 },
  sideRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideRatingLabel: { fontSize: 13 },
  sideStars: { flexDirection: "row", gap: 2 },
  sideFooter: { borderTopWidth: 1, padding: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1, height: "100vh" as any },
  content: { padding: 32, maxWidth: 680, paddingBottom: 80 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  starBlock: { marginBottom: 14 },
  starLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  starRow: { flexDirection: "row", gap: 4 },
  starBtn: { padding: 2 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: { fontSize: 13, fontWeight: "500" },
  tipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  tipBtnText: { fontSize: 14, fontWeight: "700" },
  noTipBtn: { alignSelf: "flex-start", marginTop: 10, padding: 4 },
  noTipText: { fontSize: 13, textDecorationLine: "underline" },
  photosRow: { flexDirection: "row", gap: 10 },
  photoWrap: { position: "relative" as any },
  photo: { width: 90, height: 90, borderRadius: 10 },
  removePhoto: {
    position: "absolute" as any,
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhoto: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed" as any,
    justifyContent: "center",
    alignItems: "center",
  },
  textarea: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top" as any,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
