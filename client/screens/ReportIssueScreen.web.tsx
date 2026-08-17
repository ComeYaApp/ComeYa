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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const PRIMARY = "#DC2626";
type Route = RouteProp<RootStackParamList, "ReportIssue">;

const ISSUE_TYPES = [
  { id: "missing_items", label: "Artículos faltantes", icon: "package" },
  { id: "wrong_items", label: "Artículos incorrectos", icon: "alert-circle" },
  { id: "damaged", label: "Producto dañado", icon: "alert-triangle" },
  { id: "quality", label: "Mala calidad", icon: "thumbs-down" },
  { id: "late_delivery", label: "Entrega tardía", icon: "clock" },
  { id: "driver_issue", label: "Problema con repartidor", icon: "user-x" },
  { id: "other", label: "Otro problema", icon: "help-circle" },
];

const PRIORITIES = [
  { id: "low", label: "Bajo", color: "#10B981" },
  { id: "medium", label: "Medio", color: "#F59E0B" },
  { id: "high", label: "Alto", color: "#EF4444" },
];

export default function ReportIssueScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { orderId, orderNumber } = route.params || {};

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const reportMutation = useMutation({
    mutationFn: async () =>
      apiRequest(
        "POST",
        new URL(`/api/orders/${orderId}/report-issue`, getApiUrl()).toString(),
        {
          orderId,
          reporterId: user?.id,
          issueType: selectedType,
          description: description.trim(),
          priority,
        },
      ),
    onSuccess: () => {
      showToast("Problema reportado exitosamente", "success");
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "issues"],
      });
      navigation.goBack();
    },
    onError: (e: any) => showToast(e.message || "Error al reportar", "error"),
  });

  const handlePickPhoto = async () => {
    if (photos.length >= 4) return;
    const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
    const url = await pickAndUploadImage("reports");
    if (url) setPhotos([...photos, url]);
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
    reportMutation.mutate();
  };

  const selectedIssue = ISSUE_TYPES.find((t) => t.id === selectedType);
  const selectedPriority = PRIORITIES.find((p) => p.id === priority);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Reportar Incidencia"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.sideIconWrap, { backgroundColor: "#EF444415" }]}>
            <Feather name="alert-triangle" size={32} color="#EF4444" />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Reportar Problema</Text>
          <Text style={[s.sideSub, { color: sub }]}>
            Pedido #{orderNumber || orderId?.slice(-6)}
          </Text>
          {selectedIssue && (
            <View
              style={[
                s.selBadge,
                {
                  backgroundColor: PRIMARY + "15",
                  borderColor: PRIMARY + "30",
                },
              ]}
            >
              <Feather
                name={selectedIssue.icon as any}
                size={13}
                color={PRIMARY}
              />
              <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: "600" }}>
                {selectedIssue.label}
              </Text>
            </View>
          )}
          {selectedPriority && (
            <View
              style={[
                s.selBadge,
                {
                  backgroundColor: selectedPriority.color + "15",
                  borderColor: selectedPriority.color + "30",
                  marginTop: 6,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedPriority.color,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Prioridad: {selectedPriority.label}
              </Text>
            </View>
          )}
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
        {/* Tipo de problema */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="list" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Tipo de problema</Text>
          </View>
          <View style={s.typeGrid}>
            {ISSUE_TYPES.map((type) => {
              const active = selectedType === type.id;
              return (
                <Pressable
                  key={type.id}
                  onPress={() => setSelectedType(type.id)}
                  style={[
                    s.typeCard,
                    {
                      backgroundColor: active ? PRIMARY + "10" : cardBg,
                      borderColor: active ? PRIMARY : border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.typeIcon,
                      {
                        backgroundColor: active
                          ? PRIMARY + "20"
                          : border + "40",
                      },
                    ]}
                  >
                    <Feather
                      name={type.icon as any}
                      size={22}
                      color={active ? PRIMARY : sub}
                    />
                  </View>
                  <Text
                    style={[s.typeLabel, { color: active ? PRIMARY : text }]}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Prioridad */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="flag" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>Prioridad</Text>
          </View>
          <View style={s.priorityRow}>
            {PRIORITIES.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPriority(p.id)}
                style={[
                  s.priorityBtn,
                  {
                    backgroundColor: priority === p.id ? p.color : cardBg,
                    borderColor: p.color,
                  },
                ]}
              >
                <Text
                  style={[
                    s.priorityBtnText,
                    { color: priority === p.id ? "#fff" : p.color },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Descripción */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="edit-3" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>
              Describe el problema
            </Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Cuéntanos qué pasó con tu pedido..."
            placeholderTextColor={sub}
            multiline
            numberOfLines={5}
            style={[
              s.textarea,
              { backgroundColor: cardBg, color: text, borderColor: border },
            ]}
          />
        </View>

        {/* Fotos */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.cardHeader}>
            <Feather name="camera" size={18} color={PRIMARY} />
            <Text style={[s.cardTitle, { color: text }]}>
              Fotos (opcional, máx. 4)
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
                  <Feather name="x" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < 4 && (
              <Pressable
                onPress={handlePickPhoto}
                style={[
                  s.addPhoto,
                  { borderColor: border, backgroundColor: cardBg },
                ]}
              >
                <Feather name="camera" size={22} color={sub} />
                <Text style={[s.addPhotoText, { color: sub }]}>Agregar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={reportMutation.isPending}
          style={[
            s.submitBtn,
            {
              backgroundColor: PRIMARY,
              opacity: reportMutation.isPending ? 0.6 : 1,
            },
          ]}
        >
          {reportMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={s.submitBtnText}>Enviar reporte</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
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
    marginBottom: 4,
    textAlign: "center",
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  selBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  sideFooter: { borderTopWidth: 1, padding: 16, marginTop: "auto" as any },
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
  content: { padding: 32, maxWidth: 720, paddingBottom: 80 },
  card: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    width: "30%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    gap: 8,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  typeLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  priorityRow: { flexDirection: "row", gap: 12 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
  },
  priorityBtnText: { fontSize: 14, fontWeight: "700" },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top" as any,
  },
  photosRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
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
    gap: 4,
  },
  addPhotoText: { fontSize: 11 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
