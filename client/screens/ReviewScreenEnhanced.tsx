import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

type ReviewScreenRouteProp = RouteProp<
  {
    Review: {
      orderId: string;
      businessId: string;
      businessName: string;
      deliveryPersonId?: string;
    };
  },
  "Review"
>;

interface ReviewTag {
  id: string;
  tagName: string;
  category: string;
  icon: string;
  isPositive: boolean;
}

function StarRating({
  rating,
  onRate,
  label,
}: {
  rating: number;
  onRate: (stars: number) => void;
  label?: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.ratingSection}>
      {label && (
        <ThemedText
          type="body"
          style={{ marginBottom: Spacing.xs, fontWeight: "600" }}
        >
          {label}
        </ThemedText>
      )}
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRate(star);
            }}
          >
            <Feather
              name={star <= rating ? "star" : "star"}
              size={32}
              color={star <= rating ? "#FFD700" : theme.textSecondary}
              style={{
                marginHorizontal: 4,
                ...(star <= rating ? {} : { opacity: 0.3 }),
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ReviewScreenEnhanced() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ReviewScreenRouteProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { orderId, businessId, businessName, deliveryPersonId } = route.params;

  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packagingRating, setPackagingRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [wantTip, setWantTip] = useState<boolean | null>(null);
  const [tipAmount, setTipAmount] = useState(0);

  const { data: tagsData } = useQuery({
    queryKey: ["/api/reviews/tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reviews/tags");
      return response.json();
    },
  });

  const availableTags: ReviewTag[] = tagsData?.tags || [];

  const handlePickImage = async () => {
    if (photos.length >= 3) {
      showToast("M\u00e1ximo 3 fotos", "warning");
      return;
    }

    // Web: usar input file
    if (Platform.OS === "web") {
      const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
      const url = await pickAndUploadImage("reviews");
      if (url) setPhotos([...photos, url]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotos([...photos, base64Image]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reviews", {
        orderId,
        userId: user?.id,
        businessId,
        deliveryPersonId,
        foodRating: foodRating > 0 ? foodRating : undefined,
        deliveryRating: deliveryRating > 0 ? deliveryRating : undefined,
        packagingRating: packagingRating > 0 ? packagingRating : undefined,
        driverRating: driverRating > 0 ? driverRating : undefined,
        comment: comment.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        photos: photos.length > 0 ? photos : undefined,
        // tipAmount en céntimos: el servidor abona la wallet en céntimos
        tipAmount: wantTip ? tipAmount * 100 : 0,
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "orders"],
      });
      showToast("¡Gracias! Tu opinión nos ayuda a mejorar.", "success");
      navigation.goBack();
    },
    onError: () => {
      showToast("No se pudo enviar la reseña", "error");
    },
  });

  const handleSubmit = () => {
    if (
      foodRating === 0 &&
      deliveryRating === 0 &&
      packagingRating === 0 &&
      driverRating === 0
    ) {
      showToast("Por favor califica al menos un aspecto", "warning");
      return;
    }
    submitReviewMutation.mutate();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Calificar pedido</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather
              name="shopping-bag"
              size={20}
              color={ComeYaColors.primary}
            />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {businessName}
            </ThemedText>
          </View>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              marginTop: Spacing.xs,
              marginBottom: Spacing.md,
            }}
          >
            Califica diferentes aspectos de tu pedido
          </ThemedText>

          <StarRating
            rating={foodRating}
            onRate={setFoodRating}
            label="Comida"
          />
          <StarRating
            rating={packagingRating}
            onRate={setPackagingRating}
            label="Empaque"
          />
        </Animated.View>

        {deliveryPersonId ? (
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={[
              styles.section,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="truck" size={20} color="#00BCD4" />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                Entrega
              </ThemedText>
            </View>
            <StarRating
              rating={deliveryRating}
              onRate={setDeliveryRating}
              label="Velocidad"
            />
            <StarRating
              rating={driverRating}
              onRate={setDriverRating}
              label="Repartidor"
            />
          </Animated.View>
        ) : null}

        {availableTags.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(250)}
            style={[
              styles.section,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="tag" size={20} color="#FF9800" />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                Etiquetas (opcional)
              </ThemedText>
            </View>
            <View style={styles.tagsContainer}>
              {availableTags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: selectedTags.includes(tag.id)
                        ? tag.isPositive
                          ? ComeYaColors.success + "20"
                          : ComeYaColors.error + "20"
                        : theme.backgroundSecondary,
                      borderColor: selectedTags.includes(tag.id)
                        ? tag.isPositive
                          ? ComeYaColors.success
                          : ComeYaColors.error
                        : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={tag.icon as any}
                    size={14}
                    color={
                      selectedTags.includes(tag.id)
                        ? tag.isPositive
                          ? ComeYaColors.success
                          : ComeYaColors.error
                        : theme.textSecondary
                    }
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      marginLeft: 4,
                      color: selectedTags.includes(tag.id)
                        ? tag.isPositive
                          ? ComeYaColors.success
                          : ComeYaColors.error
                        : theme.text,
                    }}
                  >
                    {tag.tagName}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(280)}
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="camera" size={20} color="#E91E63" />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Fotos (opcional)
            </ThemedText>
          </View>
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <Pressable
                  onPress={() => handleRemovePhoto(index)}
                  style={styles.removePhotoBtn}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {photos.length < 3 && (
              <Pressable
                onPress={handlePickImage}
                style={[styles.addPhotoBtn, { borderColor: theme.border }]}
              >
                <Feather name="plus" size={24} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(300)}
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="message-circle" size={20} color="#9C27B0" />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Comentario (opcional)
            </ThemedText>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Cuéntanos más sobre tu experiencia..."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.textArea,
              { backgroundColor: theme.backgroundSecondary, color: theme.text },
            ]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Animated.View>

        {deliveryPersonId ? (
          <Animated.View
            entering={FadeInDown.delay(350)}
            style={[
              styles.section,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="heart" size={20} color={ComeYaColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                Propina al repartidor
              </ThemedText>
            </View>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginBottom: Spacing.md,
              }}
            >
              ¿Deseas dar una propina al repartidor?
            </ThemedText>

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginBottom: Spacing.md,
              }}
            >
              <Pressable
                onPress={() => {
                  setWantTip(true);
                  Haptics.selectionAsync();
                }}
                style={[
                  {
                    flex: 1,
                    paddingVertical: Spacing.md,
                    borderRadius: BorderRadius.md,
                    alignItems: "center",
                    borderWidth: 2,
                  },
                  wantTip === true
                    ? {
                        backgroundColor: ComeYaColors.primary,
                        borderColor: ComeYaColors.primary,
                      }
                    : {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: wantTip === true ? "#FFF" : theme.text,
                    fontWeight: "600",
                  }}
                >
                  Sí
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setWantTip(false);
                  setTipAmount(0);
                  Haptics.selectionAsync();
                }}
                style={[
                  {
                    flex: 1,
                    paddingVertical: Spacing.md,
                    borderRadius: BorderRadius.md,
                    alignItems: "center",
                    borderWidth: 2,
                  },
                  wantTip === false
                    ? {
                        backgroundColor: ComeYaColors.primary,
                        borderColor: ComeYaColors.primary,
                      }
                    : {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: wantTip === false ? "#FFF" : theme.text,
                    fontWeight: "600",
                  }}
                >
                  No
                </ThemedText>
              </Pressable>
            </View>

            {wantTip === true && (
              <View
                style={{
                  flexDirection: "row",
                  gap: Spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                {[1, 2, 3, 5].map((amount) => (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      setTipAmount(amount);
                      Haptics.selectionAsync();
                    }}
                    style={[
                      {
                        paddingHorizontal: Spacing.lg,
                        paddingVertical: Spacing.sm,
                        borderRadius: BorderRadius.full,
                        borderWidth: 2,
                      },
                      tipAmount === amount
                        ? {
                            backgroundColor: ComeYaColors.primary,
                            borderColor: ComeYaColors.primary,
                          }
                        : {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: theme.border,
                          },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color:
                          tipAmount === amount ? "#FFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {amount} €
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {wantTip === false && (
              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  fontStyle: "italic",
                }}
              >
                Puedes añadir una propina más tarde desde el historial de
                pedidos.
              </ThemedText>
            )}
          </Animated.View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitReviewMutation.isPending}
          style={[
            styles.submitButton,
            {
              backgroundColor: ComeYaColors.primary,
              opacity: submitReviewMutation.isPending ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="send" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }}
          >
            {submitReviewMutation.isPending
              ? "Enviando..."
              : "Enviar calificación"}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingSection: {
    marginBottom: Spacing.md,
  },
  starContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  photosContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  photoWrapper: {
    position: "relative",
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  removePhotoBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ComeYaColors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  textArea: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    fontSize: 16,
    minHeight: 100,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
});
