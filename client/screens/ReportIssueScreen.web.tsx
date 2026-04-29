import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

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
  { id: "low", label: "Bajo", color: ComeYaColors.success },
  { id: "medium", label: "Medio", color: ComeYaColors.warning },
  { id: "high", label: "Alto", color: ComeYaColors.error },
];

export default function ReportIssueScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const { orderId, orderNumber } = route.params || {};
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const reportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", new URL(`/api/orders/${data.orderId}/report-issue`, getApiUrl()).toString(), data);
      return res.json();
    },
    onSuccess: () => {
      showToast("Problema reportado exitosamente", "success");
      navigation.goBack();
    },
    onError: (err: any) => showToast(err.message || "Error al reportar problema", "error"),
  });

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPhotos(prev => [...prev, URL.createObjectURL(file)]);
    };
    input.click();
  };

  const handleSubmit = () => {
    if (!selectedType) { showToast("Selecciona el tipo de problema", "warning"); return; }
    if (!description.trim()) { showToast("Describe el problema", "warning"); return; }
    if (!user?.id || !orderId) return;
    reportMutation.mutate({ orderId, reporterId: user.id, issueType: selectedType, description: description.trim(), priority });
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Reportar Problema" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.error + "15" }]}>
          <Feather name="alert-circle" size={28} color={ComeYaColors.error} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Reportar Problema</Text>
        <Text style={[s.sideSub, { color: sub }]}>Pedido #{orderNumber || orderId?.slice(-6)}</Text>

        <View style={[s.infoCard, { backgroundColor: ComeYaColors.warning + "10", borderColor: ComeYaColors.warning + "30" }]}>
          <Feather name="info" size={16} color={ComeYaColors.warning} />
          <Text style={[s.infoText, { color: ComeYaColors.warning }]}>
            Nuestro equipo revisará tu reporte y te contactará en menos de 24 horas.
          </Text>
        </View>

        {/* Prioridad */}
        <Text style={[s.sectionLabel, { color: sub }]}>Prioridad</Text>
        {PRIORITY_OPTIONS.map(opt => (
          <Pressable key={opt.id} onPress={() => setPriority(opt.id)} style={[s.priorityBtn, { backgroundColor: priority === opt.id ? opt.color + "15" : "transparent", borderColor: priority === opt.id ? opt.color : border }]}>
            <View style={[s.priorityDot, { backgroundColor: opt.color }]} />
            <Text style={[s.priorityText, { color: priority === opt.id ? opt.color : text }]}>{opt.label}</Text>
          </Pressable>
        ))}

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Tipo de problema */}
        <Text style={[s.sectionTitle, { color: text }]}>Tipo de problema</Text>
        <View style={s.typeGrid}>
          {ISSUE_TYPES.map(type => (
            <Pressable
              key={type.id}
              onPress={() => setSelectedType(type.id)}
              style={[s.typeCard, { backgroundColor: card, borderColor: selectedType === type.id ? ComeYaColors.primary : border, borderWidth: selectedType === type.id ? 2 : 1 }]}
            >
              <View style={[s.typeIcon, { backgroundColor: selectedType === type.id ? ComeYaColors.primary + "20" : inputBg }]}>
                <Feather name={type.icon as any} size={22} color={selectedType === type.id ? ComeYaColors.primary : sub} />
              </View>
              <Text style={[s.typeLabel, { color: selectedType === type.id ? ComeYaColors.primary : text }]}>{type.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Descripción */}
        <Text style={[s.sectionTitle, { color: text }]}>Describe el problema</Text>
        <TextInput
          style={[s.textarea, { backgroundColor: card, color: text, borderColor: border }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Cuéntanos qué pasó con tu pedido..."
          placeholderTextColor={sub}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Fotos */}
        <Text style={[s.sectionTitle, { color: text }]}>Fotos (opcional)</Text>
        <View style={s.photosRow}>
          {photos.map((uri, i) => (
            <View key={i} style={s.photoWrap}>
              <img src={uri} style={{ width: 80, height: 80, borderRadius: 10, objectFit: "cover" }} />
              <Pressable onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} style={[s.removePhoto, { backgroundColor: ComeYaColors.error }]}>
                <Feather name="x" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          {photos.length < 4 && (
            <Pressable onPress={pickPhoto} style={[s.addPhoto, { backgroundColor: card, borderColor: border }]}>
              <Feather name="camera" size={22} color={sub} />
              <Text style={[s.addPhotoText, { color: sub }]}>Agregar</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={reportMutation.isPending}
          style={[s.submitBtn, { backgroundColor: ComeYaColors.primary, opacity: reportMutation.isPending ? 0.6 : 1 }]}
        >
          {reportMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Enviar reporte</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 260, minWidth: 260, maxWidth: 260, padding: 24, borderRightWidth: 1, paddingTop: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  sideTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  sideSub: { fontSize: 13, textAlign: "center", marginBottom: 16 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 10 },
  priorityBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityText: { fontSize: 14, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 16, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14, marginTop: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  typeCard: { width: "calc(33.33% - 7px)" as any, padding: 16, borderRadius: 14, alignItems: "center" },
  typeIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  typeLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 15, minHeight: 120, marginBottom: 24 },
  photosRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  photoWrap: { position: "relative" },
  removePhoto: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  addPhoto: { width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", justifyContent: "center", alignItems: "center", gap: 4 },
  addPhotoText: { fontSize: 11 },
  submitBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
