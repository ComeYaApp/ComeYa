import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const VEHICLE_TYPES = [
  { id: "bike", name: "Bicicleta", icon: "wind" },
  { id: "motorcycle", name: "Moto", icon: "zap" },
  { id: "car", name: "Coche", icon: "truck" },
];

const BENEFITS = [
  { icon: "dollar-sign", text: "100% de la tarifa de entrega" },
  { icon: "clock", text: "Horarios completamente flexibles" },
  { icon: "trending-up", text: "Retiros semanales" },
  { icon: "shield", text: "Soporte prioritario" },
];

const REQUIREMENTS = [
  "Mayor de 18 años con DNI/NIE válido",
  "Vehículo en buen estado",
  "Smartphone con GPS",
  "Cuenta bancaria española (IBAN)",
];

export default function BecomeDriverScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickPhoto = (setter: (v: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setter(url);
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!vehicleType) { showToast("Selecciona un tipo de vehículo", "error"); return; }
    if (!vehiclePlate.trim()) { showToast("Ingresa la matrícula de tu vehículo", "error"); return; }
    if (!profilePhoto) { showToast("Agrega tu foto de perfil", "error"); return; }
    if (!idPhoto) { showToast("Agrega foto de tu DNI/NIE", "error"); return; }
    if (!vehiclePhoto) { showToast("Agrega foto de tu vehículo", "error"); return; }
    if (!emergencyContact.trim()) { showToast("Ingresa un contacto de emergencia", "error"); return; }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/delivery/register", {
        userId: user?.id, vehicleType,
        vehiclePlate: vehiclePlate.toUpperCase(),
        profilePhoto, idPhoto, vehiclePhoto, emergencyContact,
      });
      showToast("Solicitud enviada. Espera aprobación del administrador", "success");
      navigation.goBack();
    } catch { showToast("Error al enviar solicitud", "error"); }
    finally { setIsSubmitting(false); }
  };

  const PhotoUpload = ({ label, photo, onPick, required = false }: any) => (
    <View style={s.photoField}>
      <Text style={[s.fieldLabel, { color: sub }]}>{label}{required ? " *" : ""}</Text>
      <Pressable onPress={onPick} style={[s.photoBtn, { backgroundColor: inputBg, borderColor: photo ? ComeYaColors.success : border }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={s.photoPreview} contentFit="cover" />
        ) : (
          <>
            <Feather name="camera" size={24} color={sub} />
            <Text style={[s.photoBtnText, { color: sub }]}>Subir foto</Text>
          </>
        )}
        {photo && (
          <View style={[s.photoCheck, { backgroundColor: ComeYaColors.success }]}>
            <Feather name="check" size={14} color="#fff" />
          </View>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.heroBadge, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="truck" size={32} color={ComeYaColors.primary} />
          <Text style={[s.heroTitle, { color: ComeYaColors.primary }]}>Ser Repartidor</Text>
          <Text style={[s.heroSub, { color: sub }]}>Gana dinero entregando en Soria</Text>
        </View>

        <Text style={[s.sectionLabel, { color: sub }]}>Beneficios</Text>
        {BENEFITS.map((b, i) => (
          <View key={i} style={s.benefitRow}>
            <View style={[s.benefitIcon, { backgroundColor: ComeYaColors.primary + "15" }]}>
              <Feather name={b.icon as any} size={16} color={ComeYaColors.primary} />
            </View>
            <Text style={[s.benefitText, { color: text }]}>{b.text}</Text>
          </View>
        ))}

        <Text style={[s.sectionLabel, { color: sub, marginTop: 20 }]}>Requisitos</Text>
        {REQUIREMENTS.map((r, i) => (
          <View key={i} style={s.reqRow}>
            <Feather name="check-circle" size={14} color={ComeYaColors.success} />
            <Text style={[s.reqText, { color: text }]}>{r}</Text>
          </View>
        ))}

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </View>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.mainTitle, { color: text }]}>Solicitud de repartidor</Text>

        {/* Tipo de vehículo */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.cardTitle, { color: text }]}>Vehículo</Text>
          <View style={s.vehicleRow}>
            {VEHICLE_TYPES.map(v => (
              <Pressable key={v.id} onPress={() => setVehicleType(v.id)} style={[s.vehicleChip, { backgroundColor: vehicleType === v.id ? ComeYaColors.primary : inputBg, borderColor: vehicleType === v.id ? ComeYaColors.primary : border }]}>
                <Feather name={v.icon as any} size={20} color={vehicleType === v.id ? "#fff" : text} />
                <Text style={[s.vehicleChipText, { color: vehicleType === v.id ? "#fff" : text }]}>{v.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.fieldLabel, { color: sub }]}>Matrícula *</Text>
          <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={vehiclePlate} onChangeText={t => setVehiclePlate(t.toUpperCase())} placeholder="1234 ABC" placeholderTextColor={sub} autoCapitalize="characters" />
        </View>

        {/* Fotos */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.cardTitle, { color: text }]}>Documentación</Text>
          <PhotoUpload label="Foto de perfil" photo={profilePhoto} onPick={() => pickPhoto(setProfilePhoto)} required />
          <PhotoUpload label="DNI / NIE (frontal)" photo={idPhoto} onPick={() => pickPhoto(setIdPhoto)} required />
          <PhotoUpload label="Foto del vehículo" photo={vehiclePhoto} onPick={() => pickPhoto(setVehiclePhoto)} required />
        </View>

        {/* Contacto emergencia */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.cardTitle, { color: text }]}>Contacto de emergencia</Text>
          <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Nombre y teléfono" placeholderTextColor={sub} />
        </View>

        <Pressable onPress={handleSubmit} disabled={isSubmitting} style={[s.submitBtn, { backgroundColor: ComeYaColors.primary, opacity: isSubmitting ? 0.6 : 1 }]}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Enviar solicitud</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, padding: 24, borderRightWidth: 1, paddingTop: 32 },
  heroBadge: { padding: 20, borderRadius: 16, alignItems: "center", marginBottom: 20 },
  heroTitle: { fontSize: 18, fontWeight: "800", marginTop: 10 },
  heroSub: { fontSize: 13, marginTop: 4, textAlign: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  benefitIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  benefitText: { fontSize: 13, flex: 1 },
  reqRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  reqText: { fontSize: 13, flex: 1, lineHeight: 18 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 20, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  mainTitle: { fontSize: 24, fontWeight: "800", marginBottom: 24 },
  card: { padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  vehicleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  vehicleChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  vehicleChipText: { fontSize: 13, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase" },
  input: { height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  photoField: { marginBottom: 16 },
  photoBtn: { height: 100, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", justifyContent: "center", alignItems: "center", overflow: "hidden", position: "relative" },
  photoPreview: { width: "100%", height: "100%" },
  photoBtnText: { fontSize: 13, marginTop: 6 },
  photoCheck: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  submitBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
