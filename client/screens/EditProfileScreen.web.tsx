import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";

function resolveProfileImageUrl(img: string): string {
  if (img.startsWith("data:image/")) return img;
  const base = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(img)) return img;
  return `${base}${img.startsWith("/") ? "" : "/"}${img}`;
}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const isDriver   = user?.role === "delivery_driver";
  const isBusiness  = user?.role === "business_owner";
  const { isMobile } = useResponsive();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [dni, setDni] = useState((user as any)?.dni || "");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState("pending");

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      apiRequest("GET", `/api/users/${user.id}/verification-status`),
      apiRequest("GET", "/api/users/profile/full"),
    ]).then(([vRes, pRes]) => Promise.all([vRes.json(), pRes.json()]))
      .then(([vData, pData]) => {
        if (vData.success) setVerificationStatus(vData.verificationStatus || "pending");
        if (pData.success) {
          if (pData.dni) setDni(pData.dni);
          if (pData.address) setAddress(pData.address);
          if (pData.vehicleType) setVehicleType(pData.vehicleType);
          if (pData.vehiclePlate) setVehiclePlate(pData.vehiclePlate);
          if (pData.vehicleBrand) setVehicleBrand(pData.vehicleBrand);
          if (pData.vehicleModel) setVehicleModel(pData.vehicleModel);
          if (pData.vehicleColor) setVehicleColor(pData.vehicleColor);
        }
      }).catch(() => {});

    if (user.profileImage) setProfileImage(resolveProfileImageUrl(user.profileImage));
  }, [user?.id]);

  const pickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingImage(true);
      try {
        const reader = new FileReader();
        const base64: string = await new Promise((res, rej) => {
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const r = await apiRequest("POST", "/api/user/profile-image", { image: base64 });
        const d = await r.json();
        if (d.success) {
          setProfileImage(resolveProfileImageUrl(d.profileImage));
          await updateUser({ profileImage: d.profileImage });
          showToast("Foto actualizada", "success");
        }
      } catch { showToast("Error al subir imagen", "error"); }
      finally { setIsUploadingImage(false); }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast("El nombre es requerido", "error"); return; }
    setIsSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/users/profile", {
        name: name.trim(), phone: phone.trim(),
        email: email.trim() || undefined,
        dni: dni.trim() || undefined,
        address: address.trim() || undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (isDriver && (vehicleType || vehiclePlate)) {
        await apiRequest("PUT", "/api/users/vehicle", {
          vehicleType: vehicleType || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          vehicleBrand: vehicleBrand.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          vehicleColor: vehicleColor.trim() || undefined,
        });
      }
      await updateUser({ name: name.trim(), phone: phone.trim() });
      showToast("Perfil actualizado correctamente", "success");
      navigation.goBack();
    } catch (err: any) {
      showToast(err.message || "No se pudo actualizar el perfil", "error");
    } finally { setIsSaving(false); }
  };

  const statusColor = verificationStatus === "verified" ? ComeYaColors.success : verificationStatus === "rejected" ? ComeYaColors.error : ComeYaColors.warning;
  const statusLabel = verificationStatus === "verified" ? "Verificado ✓" : verificationStatus === "rejected" ? "Rechazado" : "En revisión";

  const Field = ({ label, value, onChange, placeholder, type = "text" }: any) => (
    <View style={s.field}>
      <Text style={[s.label, { color: sub }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={sub}
        keyboardType={type === "email" ? "email-address" : type === "phone" ? "phone-pad" : "default"}
        autoCapitalize={type === "email" ? "none" : "sentences"}
      />
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar — oculto en móvil */}
      {!isMobile && (
      <View style={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <Pressable style={s.avatarWrap} onPress={pickImage} disabled={isUploadingImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, { backgroundColor: ComeYaColors.primary + "20", justifyContent: "center", alignItems: "center" }]}>
              <Feather name="user" size={40} color={ComeYaColors.primary} />
            </View>
          )}
          <View style={[s.cameraBadge, { backgroundColor: ComeYaColors.primary }]}>
            {isUploadingImage ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={14} color="#fff" />}
          </View>
        </Pressable>
        <Text style={[s.userName, { color: text }]}>{user?.name || "Usuario"}</Text>
        <Text style={[s.userRole, { color: sub }]}>
          {user?.role === "customer" ? "Cliente" : user?.role === "business_owner" ? "Negocio" : user?.role === "delivery_driver" ? "Repartidor" : "Admin"}
        </Text>
        {(isDriver || isBusiness) && (
          <View style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Feather name={verificationStatus === "verified" ? "check-circle" : "clock"} size={14} color={statusColor} />
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        )}
        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </View>
      )}

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.sectionTitle, { color: text }]}>Datos personales</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Field label="Nombre completo *" value={name} onChange={setName} placeholder="Nombre y apellidos" />
          <Field label="DNI / NIE *" value={dni} onChange={(t: string) => setDni(t.toUpperCase())} placeholder="12345678A" />
          <Field label="Teléfono *" value={phone} onChange={setPhone} placeholder="+34 6XX XXX XXX" type="phone" />
          <Field label="Email (opcional)" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
          <Field label="Dirección *" value={address} onChange={setAddress} placeholder="Calle Mayor 12, Soria" />
        </View>

        {isDriver && (
          <>
            <Text style={[s.sectionTitle, { color: text }]}>Vehículo</Text>
            <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
              <View style={s.vehicleRow}>
                {[{ id: "bike", label: "Bicicleta" }, { id: "motorcycle", label: "Moto" }, { id: "car", label: "Coche" }].map(v => (
                  <Pressable
                    key={v.id}
                    onPress={() => setVehicleType(v.id)}
                    style={[s.vehicleChip, { backgroundColor: vehicleType === v.id ? ComeYaColors.primary : inputBg, borderColor: vehicleType === v.id ? ComeYaColors.primary : border }]}
                  >
                    <Text style={{ color: vehicleType === v.id ? "#fff" : text, fontWeight: "600", fontSize: 13 }}>{v.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Matrícula" value={vehiclePlate} onChange={(t: string) => setVehiclePlate(t.toUpperCase())} placeholder="1234 ABC" />
              <Field label="Marca" value={vehicleBrand} onChange={setVehicleBrand} placeholder="Honda, Toyota..." />
              <Field label="Modelo" value={vehicleModel} onChange={setVehicleModel} placeholder="CBR 500..." />
              <Field label="Color" value={vehicleColor} onChange={setVehicleColor} placeholder="Rojo, Negro..." />
            </View>
          </>
        )}

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: isSaving ? 0.6 : 1 }]}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar cambios</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 260, padding: 32, borderRightWidth: 1, alignItems: "center", paddingTop: 48 },
  avatarWrap: { position: "relative", marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  cameraBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  userName: { fontSize: 18, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  userRole: { fontSize: 13, marginBottom: 12 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  statusText: { fontSize: 12, fontWeight: "700" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 40, maxWidth: 720 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16, marginTop: 8 },
  card: { borderRadius: 16, padding: 24, borderWidth: 1, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  vehicleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  vehicleChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
