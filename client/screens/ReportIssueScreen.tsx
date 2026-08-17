import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteParams = RouteProp<RootStackParamList, "ReportIssue">;

const ISSUE_TYPES = [
  { id: "missing_items", label: "Artículos faltantes", icon: "package" },
  { id: "wrong_items", label: "Artículos incorrectos", icon: "alert-circle" },
  { id: "damaged", label: "Producto dañado", icon: "alert-triangle" },
  { id: "quality", label: "Mala calidad", icon: "thumbs-down" },
  { id: "late_delivery", label: "Entrega tardía", icon: "clock" },
  { id: "driver_issue", label: "Problema con repartidor", icon: "user-x" },
  { id: "other", label: "Otro problema", icon: "help-circle" },
];

const PRIORITY_OPTIONS = [
  { id: "low", label: "BAJA", color: ComeYaColors.success },
  { id: "medium", label: "MEDIA", color: ComeYaColors.warning },
  { id: "high", label: "ALTA", color: ComeYaColors.error },
];

export default function ReportIssueScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { orderId, orderNumber } = route.params || {};

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const reportMutation = useMutation({
    mutationFn: async (data: {
      orderId: string;
      reporterId: string;
      issueType: string;
      description: string;
      priority: string;
    }) => {
      return apiRequest(
        "POST",
        new URL(
          `/api/orders/${data.orderId}/report-issue`,
          getApiUrl(),
        ).toString(),
        data,
      );
    },
    onSuccess: () => {
      showToast("Problema reportado exitosamente", "success");
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "issues"],
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      showToast(error.message || "Error al reportar incidencia", "error");
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedType) {
      showToast("Selecciona el tipo de problema", "warning");
      return;
    }
    if (!description.trim()) {
      showToast("Describe el problema", "warning");
      return;
    }
    if (!user?.id || !orderId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reportMutation.mutate({
      orderId,
      reporterId: user.id,
      issueType: selectedType,
      description: description.trim(),
      priority,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Reportar Incidencia</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
          >
            Pedido #{orderNumber || orderId?.slice(-6)}
          </ThemedText>

          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            Tipo de problema
          </ThemedText>

          <View style={styles.typeGrid}>
            {ISSUE_TYPES.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedType(type.id);
                }}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      selectedType === type.id
                        ? ComeYaColors.primary
                        : "transparent",
                    borderWidth: 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.typeIcon,
                    {
                      backgroundColor:
                        selectedType === type.id
                          ? ComeYaColors.primary + "20"
                          : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={type.icon as any}
                    size={24}
                    color={
                      selectedType === type.id
                        ? ComeYaColors.primary
                        : theme.textSecondary
                    }
                  />
                </View>
                <ThemedText
                  type="caption"
                  style={{
                    textAlign: "center",
                    color:
                      selectedType === type.id
                        ? ComeYaColors.primary
                        : theme.text,
                    fontWeight: selectedType === type.id ? "600" : "400",
                  }}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
          >
            Prioridad
          </ThemedText>
          <View style={styles.priorityRow}>
            {PRIORITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPriority(opt.id);
                }}
                style={[
                  styles.priorityButton,
                  {
                    backgroundColor:
                      priority === opt.id ? opt.color : theme.card,
                    borderColor: opt.color,
                    borderWidth: 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: priority === opt.id ? "#fff" : opt.color,
                    fontWeight: "600",
                  }}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
          >
            Describe el problema
          </ThemedText>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: theme.card, color: theme.text },
            ]}
            placeholder="Cuéntanos qué pasó con tu pedido..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}
          >
            Fotos (opcional)
          </ThemedText>
          <View style={styles.photoGrid}>
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photo} />
                <Pressable
                  onPress={() => removePhoto(index)}
                  style={styles.removePhoto}
                >
                  <Feather name="x" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < 4 && (
              <Pressable
                onPress={pickImage}
                style={[styles.addPhoto, { backgroundColor: theme.card }]}
              >
                <Feather name="camera" size={24} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Agregar
                </ThemedText>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Pressable
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              { opacity: reportMutation.isPending ? 0.7 : 1 },
            ]}
            disabled={reportMutation.isPending}
          >
            <ThemedText
              type="body"
              style={{ color: "#fff", fontWeight: "600" }}
            >
              {reportMutation.isPending ? "Enviando..." : "Enviar Reporte"}
            </ThemedText>
          </Pressable>
        </Animated.View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeCard: {
    width: "31%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    boxShadow: "0px 2px 4px rgba(0,0,0,0.08)",
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  priorityRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  textArea: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 120,
    fontSize: 16,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  photoWrapper: {
    position: "relative",
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ComeYaColors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: ComeYaColors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.xl,
  },
});
