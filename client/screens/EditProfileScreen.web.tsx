import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

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
  const { isMobile } = useResponsive();

  const bg       = isDark ? "#111" : "#f7f7f7";
  const card     = isDark ? "#1e1e1e" : "#fff";
  const border   = isDark ? "#333" : "#e8e8e8";
  const text     = isDark ? "#fff" : "#1a1a1a";
  const sub      = isDark ? "#aaa" : "#666";
  const inputBg  = isDark ? "#2a2a2a" : "#f5f5f5";

  const isDriver   = user?.role === "delivery_driver";
  const isBusiness = user?.role === "business_owner";
  const isCustomer = user?.role === "customer";

  // Datos personales
  const [name,    setName]    = useState(user?.name  || "");
  const [phone,   setPhone]   = useState(user?.phone || "");
  const [email,   setEmail]   = useState(user?.email || "");
  const [dni,     setDni]     = useState((user as any)?.dni     || "");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [isSaving, setIsSaving] = useState(false);

  // Foto de perfil
  const [profileImage,    setProfileImage]    = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Vehículo (driver)
  const [vehicleType,  setVehicleType]  = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  // Verificación
  const [verificationStatus, setVerificationStatus] = useState("pending");

  // Cambio de teléfono
  const [showPhoneModal,  setShowPhoneModal]  = useState(false);
  const [newPhone,        setNewPhone]        = useState("");
  const [otpCode,         setOtpCode]         = useState("");
  const [otpSent,         setOtpSent]         = useState(false);
  const [phoneLoading,    setPhoneLoading]    = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      apiRequest("GET", `/api/users/${user.id}/verification-status`),
      apiRequest("GET", "/api/users/profile/full"),
    ]).then(([vRes, pRes]) => Promise.all([vRes.json(), pRes.json()]))
      .then(([vData, pData]) => {
        if (vData.success) setVerificationStatus(vData.verificationStatus || "pending");
        if (pData.success) {
          if (pData.dni)          setDni(pData.dni);
          if (pData.address)      setAddress(pData.address);
          if (pData.vehicleType)  setVehicleType(pData.vehicleType);
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
        name: name.trim(),
        phone: phone.trim(),
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

  const handleSendOtp = async () => {
    if (!newPhone.trim()) { showToast("Introduce el nuevo teléfono", "error"); return; }
    setPhoneLoading(true);
    try {
      const res = await apiRequest("POST", "/api/users/change-phone", { newPhone: newPhone.trim() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setOtpSent(true);
      showToast("Código enviado por SMS", "success");
    } catch (err: any) {
      showToast(err.message || "Error al enviar código", "error");
    } finally { setPhoneLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { showToast("Introduce el código", "error"); return; }
    setPhoneLoading(true);
    try {
      const res = await apiRequest("POST", "/api/users/verify-phone-change", {
        newPhone: newPhone.trim(),
        code: otpCode.trim(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPhone(newPhone.trim());
      await updateUser({ phone: newPhone.trim() });
      setShowPhoneModal(false);
      setOtpSent(false);
      setNewPhone("");
      setOtpCode("");
      showToast("Teléfono actualizado correctamente", "success");
    } catch (err: any) {
      showToast(err.message || "Código incorrecto", "error");
    } finally { setPhoneLoading(false); }
  };

  const statusColor = verificationStatus === "verified" ? ComeYaColors.success : verificationStatus === "rejected" ? ComeYaColors.error : ComeYaColors.warning;
  const statusLabel = verificationStatus === "verified" ? "Verificado ✓" : verificationStatus === "rejected" ? "Rechazado" : "En revisión";

  const Field = ({ label, value, onChange, placeholder, type = "text", editable = true }: any) => (
    <View style={s.field}>
      <Text style={[s.label, { color: sub }]}>{label}</Text>
      <TextInput
        style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border, opacity: editable ? 1 : 0.6 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={sub}
        keyboardType={type === "email" ? "email-address" : type === "phone" ? "phone-pad" : "default"}
        autoCapitalize={type === "email" ? "none" : "sentences"}
        editable={editable}
      />
    </View>
  );

  // Accesos rápidos según rol
  const quickLinks = [
    ...(isCustomer ? [
      { icon: "package", label: "Mis pedidos", onPress: () => navigation.navigate("Orders") },
      { icon: "map-pin", label: "Mis direcciones", onPress: () => navigation.navigate("SavedAddresses") },
      { icon: "credit-card", label: "Métodos de pago", onPress: () => navigation.navigate("PaymentWalletSetup") },
      { icon: "gift", label: "Mis puntos y recompensas", onPress: () => navigation.navigate("Gamification") },
      { icon: "tag", label: "Mis gift cards", onPress: () => navigation.navigate("GiftCards") },
    ] : []),
    ...(isDriver ? [
      { icon: "truck", label: "Mis entregas", onPress: () => navigation.navigate("DeliveryEarnings") },
      { icon: "dollar-sign", label: "Mis ganancias", onPress: () => navigation.navigate("DeliveryEarnings") },
    ] : []),
    ...(isBusiness ? [
      { icon: "bar-chart-2", label: "Analytics", onPress: () => navigation.navigate("BusinessAnalytics") },
      { icon: "settings", label: "Configurar negocio", onPress: () => navigation.navigate("BusinessManage") },
    ] : []),
    { icon: "bell", label: "Notificaciones", onPress: () => showToast("Próximamente", "info") },
    { icon: "shield", label: "Privacidad y seguridad", onPress: () => showToast("Próximamente", "info") },
    { icon: "help-circle", label: "Soporte", onPress: () => navigation.navigate("Support") },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <MobileSidebarWrapper title="Mi Perfil" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
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
        <Text style={[s.userPhone, { color: sub }]}>{user?.phone || ""}</Text>
        <Text style={[s.userRole, { color: sub }]}>
          {user?.role === "customer" ? "Cliente" : user?.role === "business_owner" ? "Negocio" : user?.role === "delivery_driver" ? "Repartidor" : "Admin"}
        </Text>

        {(isDriver || isBusiness) && (
          <View style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Feather name={verificationStatus === "verified" ? "check-circle" : "clock"} size={14} color={statusColor} />
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        )}

        {/* Accesos rápidos en sidebar */}
        <View style={[s.divider, { backgroundColor: border }]} />
        {quickLinks.map((link, i) => (
          <Pressable key={i} onPress={link.onPress} style={s.sideLink}>
            <Feather name={link.icon as any} size={16} color={sub} />
            <Text style={[s.sideLinkText, { color: text }]}>{link.label}</Text>
          </Pressable>
        ))}

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Datos personales */}
        <Text style={[s.sectionTitle, { color: text }]}>Datos personales</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Field label="Nombre completo *" value={name} onChange={setName} placeholder="Nombre y apellidos" />
          <Field label="DNI / NIE" value={dni} onChange={(t: string) => setDni(t.toUpperCase())} placeholder="12345678A" />
          <Field label="Email (opcional)" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
          <Field label="Dirección" value={address} onChange={setAddress} placeholder="Calle Mayor 12, Soria" />
        </View>

        {/* Teléfono — campo especial con botón cambiar */}
        <Text style={[s.sectionTitle, { color: text }]}>Teléfono</Text>
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <View style={s.phoneRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: sub }]}>NÚMERO ACTUAL</Text>
              <Text style={[s.phoneValue, { color: text }]}>{phone || "No configurado"}</Text>
            </View>
            <Pressable
              onPress={() => setShowPhoneModal(true)}
              style={[s.changePhoneBtn, { backgroundColor: ComeYaColors.primary + "15", borderColor: ComeYaColors.primary }]}
            >
              <Feather name="edit-2" size={14} color={ComeYaColors.primary} />
              <Text style={[s.changePhoneBtnText, { color: ComeYaColors.primary }]}>Cambiar</Text>
            </Pressable>
          </View>
          <Text style={[s.phoneHint, { color: sub }]}>
            Para cambiar tu teléfono recibirás un código SMS de verificación en el nuevo número.
          </Text>
        </View>

        {/* Vehículo (solo driver) */}
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

        {/* Guardar */}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: isSaving ? 0.6 : 1 }]}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Guardar cambios</Text>}
        </Pressable>

        {/* Accesos rápidos en mobile (cuando no hay sidebar) */}
        {isMobile && (
          <>
            <Text style={[s.sectionTitle, { color: text, marginTop: 24 }]}>Accesos rápidos</Text>
            <View style={[s.card, { backgroundColor: card, borderColor: border, padding: 0 }]}>
              {quickLinks.map((link, i) => (
                <Pressable
                  key={i}
                  onPress={link.onPress}
                  style={[s.quickLinkRow, { borderBottomColor: border, borderBottomWidth: i < quickLinks.length - 1 ? 1 : 0 }]}
                >
                  <View style={[s.quickLinkIcon, { backgroundColor: ComeYaColors.primary + "15" }]}>
                    <Feather name={link.icon as any} size={18} color={ComeYaColors.primary} />
                  </View>
                  <Text style={[s.quickLinkText, { color: text }]}>{link.label}</Text>
                  <Feather name="chevron-right" size={16} color={sub} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal cambio de teléfono */}
      <Modal visible={showPhoneModal} transparent animationType="fade" onRequestClose={() => setShowPhoneModal(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowPhoneModal(false)} />
          <View style={[s.modalCard, { backgroundColor: card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: text }]}>Cambiar teléfono</Text>
              <Pressable onPress={() => { setShowPhoneModal(false); setOtpSent(false); setNewPhone(""); setOtpCode(""); }}>
                <Feather name="x" size={20} color={sub} />
              </Pressable>
            </View>

            {!otpSent ? (
              <>
                <Text style={[s.modalHint, { color: sub }]}>
                  Introduce tu nuevo número de teléfono. Te enviaremos un código SMS para verificarlo.
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border, marginBottom: 16 }]}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="+34 6XX XXX XXX"
                  placeholderTextColor={sub}
                  keyboardType="phone-pad"
                />
                <Pressable
                  onPress={handleSendOtp}
                  disabled={phoneLoading}
                  style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: phoneLoading ? 0.6 : 1 }]}
                >
                  {phoneLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Enviar código SMS</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[s.modalHint, { color: sub }]}>
                  Código enviado a {newPhone}. Introdúcelo a continuación.
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border, marginBottom: 16, letterSpacing: 8, textAlign: "center", fontSize: 24, fontWeight: "700" }]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="000000"
                  placeholderTextColor={sub}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={phoneLoading}
                  style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: phoneLoading ? 0.6 : 1 }]}
                >
                  {phoneLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Verificar y cambiar</Text>}
                </Pressable>
                <Pressable onPress={() => setOtpSent(false)} style={{ marginTop: 12, alignItems: "center" }}>
                  <Text style={{ color: ComeYaColors.primary, fontSize: 14 }}>Cambiar número</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  sidebar: { width: 260, padding: 24, borderRightWidth: 1, alignItems: "center", paddingTop: 40 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  cameraBadge: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  userName: { fontSize: 17, fontWeight: "700", marginBottom: 2, textAlign: "center" },
  userPhone: { fontSize: 13, marginBottom: 2, textAlign: "center" },
  userRole: { fontSize: 12, marginBottom: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  statusText: { fontSize: 12, fontWeight: "700" },
  divider: { width: "100%", height: 1, marginVertical: 12 },
  sideLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, width: "100%" },
  sideLinkText: { fontSize: 13, fontWeight: "500" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12, marginTop: 4 },
  card: { borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  phoneValue: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  changePhoneBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  changePhoneBtnText: { fontSize: 13, fontWeight: "700" },
  phoneHint: { fontSize: 12, lineHeight: 18 },
  vehicleRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  vehicleChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  quickLinkRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  quickLinkIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  quickLinkText: { flex: 1, fontSize: 15, fontWeight: "500" },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { width: "90%", maxWidth: 420, borderRadius: 20, padding: 28 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalHint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
});
