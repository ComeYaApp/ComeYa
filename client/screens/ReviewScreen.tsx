import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
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

function StarRating({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (stars: number) => void;
}) {
  const { theme } = useTheme();

  return (
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
            size={36}
            color={star <= rating ? "#FFD700" : theme.textSecondary}
            style={{
              marginHorizontal: 4,
              ...(star <= rating ? {} : { opacity: 0.3 }),
            }}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ReviewScreenRouteProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { orderId, businessId, businessName, deliveryPersonId } = route.params;

  const [businessRating, setBusinessRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reviews", {
        orderId,
        userId: user?.id,
        businessId,
        deliveryPersonId,
        businessRating: businessRating > 0 ? businessRating : undefined,
        deliveryRating: deliveryRating > 0 ? deliveryRating : undefined,
        comment: comment.trim() || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "orders"],
      });
      showToast("Gracias! Tu opinion nos ayuda a mejorar.", "success");
      navigation.goBack();
    },
    onError: () => {
      showToast("No se pudo enviar la resena", "error");
    },
  });

  const handleSubmit = () => {
    if (businessRating === 0 && deliveryRating === 0) {
      showToast("Por favor califica al menos una cosa", "warning");
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
            <Feather name="shopping-bag" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {businessName}
            </ThemedText>
          </View>
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              marginTop: Spacing.xs,
              marginBottom: Spacing.md,
            }}
          >
            Como fue la comida y el servicio?
          </ThemedText>
          <StarRating rating={businessRating} onRate={setBusinessRating} />
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
                Repartidor
              </ThemedText>
            </View>
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                marginBottom: Spacing.md,
              }}
            >
              Como fue la entrega?
            </ThemedText>
            <StarRating rating={deliveryRating} onRate={setDeliveryRating} />
          </Animated.View>
        ) : null}

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
            placeholder="Cuentanos mas sobre tu experiencia..."
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
              : "Enviar calificacion"}
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
  starContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.md,
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
