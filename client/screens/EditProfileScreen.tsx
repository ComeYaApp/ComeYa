import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, ScrollView, ActivityIndicator,
  Pressable, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

function resolveProfileImageUrl(profileImage: string): string {
  if (profileImage.startsWith("data:image/")) return profileImage;
  const apiBase = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(profileImage)) return profileImage;
  return `${apiBase}${profileImage.startsWith("/") ? "" : "/"}${profileImage}`;
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, marginTop: Spacing.lg }}>
      <View style={[styles.sectionIcon, { backgroundColor: ComeYaColors.primary + "18" }]}>
        <Feather name={icon as any} size={16} color={ComeYaColors.primary} />
      </View>
      <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: theme.text }}>{title}</ThemedText>
    </View>
  );
}

function DocUpload({ label, description, uri, onPress, theme }: any) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ThemedText type="small" style={{ fontWeight: "600", color: theme.text, marginBottom: 4 }}>{label}</ThemedText>
      {description && (
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>{description}</ThemedText>
      )}
      <Pressable
        onPress={onPress}
        style={[
          styles.docUpload,
          {
            borderColor: uri ? ComeYaColors.success : theme.border,
            backgroundColor: uri ? ComeYaColors.success + "10" : theme.backgroundSecondary,
          },
        ]}
      >
        <Feather name={uri ? "check-circle" : "upload"} size={20} color={uri ? ComeYaColors.success : theme.textSecondary} />
        <ThemedText type="small" style={{ color: uri ? ComeYaColors.success : theme.textSecondary, marginLeft: 8, fontWeight: "600" }}>
          {uri ? "Documento subido ✓" : "Seleccionar imagen"}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const isDriver   = user?.role === "delivery_driver";
  const isBusiness = user?.role === "business_owner";
  const needsDocs  = isDriver || isBusiness;

  // Datos comunes
  const [name,  setName]  = useState(user?.name  || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
const [dni,   setDni]   = useState((user as any)?.dni   || "");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [profession, setProfession] = useState("");

  // Solo repartidor
  const [vehicleType,  setVehicleType]  = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState<string | null>(null);

// Documentos personales
  const [idDocUri,          setIdDocUri]          = useState<string | null>(null);
  const [idDocBackUri,      setIdDocBackUri]      = useState<string | null>(null);
  const [autonomoDocUri,    setAutonomoDocUri]    = useState<string | null>(null);

  // Documentos del vehículo (para moto/coche)
  const [vehiclePlatePhotoUri,    setVehiclePlatePhotoUri]    = useState<string | null>(null);
  const [vehicleItvPhotoUri,      setVehicleItvPhotoUri]      = useState<string | null>(null);
  const [vehicleInsurancePhotoUri, setVehicleInsurancePhotoUri] = useState<string | null>(null);
  const [vehicleLicensePhotoUri, setVehicleLicensePhotoUri] = useState<string | null>(null);

  const [isSaving,        setIsSaving]        = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
const [verificationStatus, setVerificationStatus] = useState<string>((user as any)?.verificationStatus || "pending");

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: "Editar perfil" });
  }, [navigation]);

  // Cargar datos extra del servidor
  useEffect(() => {
    const load = async () => {
      try {
        const [verRes, profileRes] = await Promise.all([
          apiRequest("GET", `/api/users/${user?.id}/verification-status`),
          apiRequest("GET", "/api/users/profile/full"),
        ]);
        const verData = await verRes.json();
        const profileData = await profileRes.json();
        if (verData.success) setVerificationStatus(verData.verificationStatus || "pending");
        if (profileData.success) {
          if (profileData.dni) setDni(profileData.dni);
          if (profileData.address) setAddress(profileData.address);
          if (profileData.vehicleType) setVehicleType(profileData.vehicleType);
          if (profileData.vehiclePlate) setVehiclePlate(profileData.vehiclePlate);
          if (profileData.vehicleBrand) setVehicleBrand(profileData.vehicleBrand);
          if (profileData.vehicleModel) setVehicleModel(profileData.vehicleModel);
          if (profileData.vehicleColor) setVehicleColor(profileData.vehicleColor);
          if (profileData.vehiclePhoto) setVehiclePhotoUri(profileData.vehiclePhoto);
          
          // Cargar documentos personales
          if (profileData.idDocumentUrl) setIdDocUri(profileData.idDocumentUrl);
          if (profileData.idDocumentBackUrl) setIdDocBackUri(profileData.idDocumentBackUrl);
          if (profileData.autonomoDocumentUrl) setAutonomoDocUri(profileData.autonomoDocumentUrl);
          
          // Cargar documentos del vehículo
          if (profileData.vehiclePlatePhoto) setVehiclePlatePhotoUri(profileData.vehiclePlatePhoto);
          if (profileData.vehicleItvPhoto) setVehicleItvPhotoUri(profileData.vehicleItvPhoto);
          if (profileData.vehicleInsurancePhoto) setVehicleInsurancePhotoUri(profileData.vehicleInsurancePhoto);
          if (profileData.vehicleLicensePhoto) setVehicleLicensePhotoUri(profileData.vehicleLicensePhoto);
        }
      } catch {}
    };
    if (user?.id) load();
}, [user?.id]);

  const pickDocument = async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { showToast("Se necesita permiso de galería", "error"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast("El nombre es requerido", "error"); return; }
    if (!user?.id) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Actualizar perfil básico
      const res = await apiRequest("PUT", "/api/users/profile", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        dni: dni.trim() || undefined,
        address: address.trim() || undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al actualizar");

      // Actualizar vehículo si es repartidor
      if (isDriver && (vehicleType || vehiclePlate || vehicleBrand || vehicleModel || vehicleColor)) {
        // Subir foto de vehículo a Cloudinary si es nueva (URI local)
        let vehiclePhotoUrl: string | undefined = undefined;
        if (vehiclePhotoUri && !vehiclePhotoUri.startsWith('http')) {
          const xhr = new XMLHttpRequest();
          const base64 = await new Promise<string>((resolve, reject) => {
            xhr.onload = () => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(xhr.response);
            };
            xhr.onerror = reject;
            xhr.responseType = 'blob';
            xhr.open('GET', vehiclePhotoUri);
            xhr.send();
          });
          const uploadRes = await apiRequest('POST', '/api/registration/upload-documents', {
            userId: user!.id,
            vehiclePhoto: base64,
            vehicleType,
          });
          const uploadData = await uploadRes.json();
          vehiclePhotoUrl = uploadData.uploadedUrls?.vehiclePhoto;
        } else if (vehiclePhotoUri?.startsWith('http')) {
          vehiclePhotoUrl = vehiclePhotoUri;
        }

        await apiRequest("PUT", "/api/users/vehicle", {
          vehicleType: vehicleType || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          vehicleBrand: vehicleBrand.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
vehicleColor: vehicleColor.trim() || undefined,
          vehiclePhoto: vehiclePhotoUrl,
        });
      }

      await updateUser({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined });

// Subir documentos si se seleccionaron (solo si son cambios locales, no URLs)
      const hasPersonalDocs = (idDocUri && !idDocUri.startsWith('http')) || (idDocBackUri && !idDocBackUri.startsWith('http')) || (autonomoDocUri && !autonomoDocUri.startsWith('http'));
      let needsReverify = false;
      if (needsDocs && hasPersonalDocs) {
        const formData = new FormData();
        // Añadir documentos solo si son nuevos (URI locales, no URLs del servidor)
        if (idDocUri && !idDocUri.startsWith('http')) { formData.append("idDocumentUrl", idDocUri); needsReverify = true; }
        if (idDocBackUri && !idDocBackUri.startsWith('http')) { formData.append("idDocumentBackUrl", idDocBackUri); needsReverify = true; }
        if (autonomoDocUri && !autonomoDocUri.startsWith('http')) { formData.append("autonomoDocumentUrl", autonomoDocUri); needsReverify = true; }
        if (formData.has("idDocumentUrl") || formData.has("idDocumentBackUrl") || formData.has("autonomoDocumentUrl")) {
          await apiRequest("POST", `/api/users/${user.id}/verification-documents`, formData);
        }
        setVerificationStatus("pending");
      }
      
      // Subir documentos del vehículo si hay cambios locales
      const hasVehicleDocs = (vehiclePlatePhotoUri && !vehiclePlatePhotoUri.startsWith('http')) || 
                           (vehicleItvPhotoUri && !vehicleItvPhotoUri.startsWith('http')) ||
                           (vehicleInsurancePhotoUri && !vehicleInsurancePhotoUri.startsWith('http')) ||
                           (vehicleLicensePhotoUri && !vehicleLicensePhotoUri.startsWith('http'));
      if (isDriver && hasVehicleDocs) {
        const vehicleFormData = new FormData();
        if (vehiclePlatePhotoUri && !vehiclePlatePhotoUri.startsWith('http')) vehicleFormData.append("vehiclePlatePhoto", vehiclePlatePhotoUri);
        if (vehicleItvPhotoUri && !vehicleItvPhotoUri.startsWith('http')) vehicleFormData.append("vehicleItvPhoto", vehicleItvPhotoUri);
        if (vehicleInsurancePhotoUri && !vehicleInsurancePhotoUri.startsWith('http')) vehicleFormData.append("vehicleInsurancePhoto", vehicleInsurancePhotoUri);
        if (vehicleLicensePhotoUri && !vehicleLicensePhotoUri.startsWith('http')) vehicleFormData.append("vehicleLicensePhoto", vehicleLicensePhotoUri);
        
// Check if FormData has entries (Array.from not available, use forEach)
        let hasVehicleDocs = false;
        vehicleFormData.forEach(() => { hasVehicleDocs = true; });
        if (hasVehicleDocs) {
          await apiRequest("PUT", "/api/users/vehicle", vehicleFormData);
        }
        setVerificationStatus("pending");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Perfil actualizado correctamente", "success");
      navigation.goBack();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo actualizar el perfil", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { showToast("Se necesita permiso para acceder a las fotos", "error"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled && result.assets[0]) await uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      const xhr = new XMLHttpRequest();
      const base64 = await new Promise<string>((resolve, reject) => {
        xhr.onload = () => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = reject;
        xhr.responseType = "blob";
        xhr.open("GET", uri);
        xhr.send();
      });
      const res = await apiRequest("POST", "/api/user/profile-image", { image: base64 });
      const data = await res.json();
      if (data.success) { await updateUser({ profileImage: data.profileImage }); showToast("Foto actualizada", "success"); }
      else throw new Error(data.error);
    } catch { showToast("Error al subir imagen", "error"); }
    finally { setIsUploadingImage(false); }
  };

  const statusColor = verificationStatus === "verified" ? ComeYaColors.success : verificationStatus === "rejected" ? ComeYaColors.error : ComeYaColors.warning;
  const statusLabel = verificationStatus === "verified" ? "Verificado ✓" : verificationStatus === "rejected" ? "Rechazado — sube nuevos documentos" : "En revisión";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Foto de perfil */}
        <View style={[styles.avatarSection, { backgroundColor: theme.card }, Shadows.md]}>
          <Pressable onPress={handlePickImage} disabled={isUploadingImage}>
            <View style={[styles.avatar, { backgroundColor: ComeYaColors.primary + "20" }]}>
              {isUploadingImage ? (
                <ActivityIndicator size="large" color={ComeYaColors.primary} />
              ) : user?.profileImage ? (
                <Image source={{ uri: resolveProfileImageUrl(user.profileImage) }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Feather name="user" size={40} color={ComeYaColors.primary} />
              )}
            </View>
            <View style={[styles.cameraButton, { backgroundColor: ComeYaColors.primary }]}>
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Toca para cambiar foto
          </ThemedText>
        </View>

        {/* Estado de verificación (solo repartidor/negocio) */}
        {needsDocs && (
          <View style={[styles.statusBanner, { backgroundColor: statusColor + "15", borderColor: statusColor + "40" }]}>
            <Feather name={verificationStatus === "verified" ? "check-circle" : "clock"} size={16} color={statusColor} />
            <ThemedText type="small" style={{ color: statusColor, flex: 1, marginLeft: 8, fontWeight: "600" }}>
              Estado de verificación: {statusLabel}
            </ThemedText>
          </View>
        )}

        <View style={[styles.formSection, { backgroundColor: theme.card }, Shadows.sm]}>

          {/* ── Datos personales ── */}
          <SectionTitle icon="user" title="Datos personales" />

          <Input label="Nombre completo *" leftIcon="user" value={name} onChangeText={setName}
            placeholder="Nombre y apellidos" autoCapitalize="words" />

          <Input label="DNI / NIE *" leftIcon="credit-card" value={dni}
            onChangeText={(t) => setDni(t.toUpperCase())} placeholder="12345678A" autoCapitalize="characters" />

          <Input label="Teléfono *" leftIcon="phone" value={phone} onChangeText={setPhone}
            placeholder="+34 6XX XXX XXX" keyboardType="phone-pad" />

          <Input label="Correo electrónico (opcional)" leftIcon="mail" value={email} onChangeText={setEmail}
            placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" />

          <Input label="Dirección *" leftIcon="map-pin" value={address} onChangeText={setAddress}
            placeholder="Calle Mayor 12, Soria" autoCapitalize="words" />

          {/* ── Vehículo (solo repartidor) ── */}
          {isDriver && (
            <>
              <SectionTitle icon="truck" title="Vehículo" />

              <ThemedText type="small" style={{ fontWeight: "600", color: theme.text, marginBottom: Spacing.sm }}>
                Tipo de vehículo
              </ThemedText>
              <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
                {[
                  { id: "bike",       label: "Bicicleta", icon: "wind" },
                  { id: "motorcycle", label: "Moto",      icon: "zap" },
                  { id: "car",        label: "Coche",     icon: "truck" },
                ].map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => { setVehicleType(v.id); Haptics.selectionAsync(); }}
                    style={[
                      styles.vehicleChip,
                      {
                        backgroundColor: vehicleType === v.id ? ComeYaColors.primary : theme.backgroundSecondary,
                        borderColor: vehicleType === v.id ? ComeYaColors.primary : theme.border,
                      },
                    ]}
                  >
                    <Feather name={v.icon as any} size={16} color={vehicleType === v.id ? "#FFF" : theme.text} />
                    <ThemedText type="small" style={{ color: vehicleType === v.id ? "#FFF" : theme.text, marginLeft: 4, fontWeight: "600" }}>
                      {v.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <Input label="Matrícula" leftIcon="hash" value={vehiclePlate}
                onChangeText={(t) => setVehiclePlate(t.toUpperCase())} placeholder="1234 ABC"
                autoCapitalize="characters" />

              {(vehicleType === 'motorcycle' || vehicleType === 'car') && (
                <>
                  <Input label="Marca" leftIcon="tag" value={vehicleBrand}
                    onChangeText={setVehicleBrand} placeholder="Honda, Toyota..." />
                  <Input label="Modelo" leftIcon="info" value={vehicleModel}
                    onChangeText={setVehicleModel} placeholder="CBR 500, Corolla..." />
                  <Input label="Color" leftIcon="droplet" value={vehicleColor}
                    onChangeText={setVehicleColor} placeholder="Rojo, Negro..." />
                </>
              )}

              <DocUpload
                label="Foto del vehículo *"
                description="Foto clara del vehículo con matrícula visible"
                uri={vehiclePhotoUri}
                onPress={() => pickDocument((uri) => setVehiclePhotoUri(uri))}
                theme={theme}
              />
            </>
          )}

          {/* ── Documentos (repartidor y negocio) ── */}
          {needsDocs && (
            <>
              <SectionTitle icon="file-text" title="Documentos de verificación" />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                {verificationStatus === "rejected"
? "Tus documentos fueron rechazados. Sube nuevas imágenes para volver a solicitar verificación."
                  : "Sube documentos actualizados si necesitas renovar tu verificación."}
              </ThemedText>

              <DocUpload
                label="Foto del DNI / NIE (anverso) *"
                description="Foto del anverso de tu DNI o NIE"
                uri={idDocUri}
                onPress={() => pickDocument(setIdDocUri)}
                theme={theme}
              />

              <DocUpload
                label="Foto del DNI / NIE (reverso) *"
                description="Foto del reverso de tu DNI o NIE"
                uri={idDocBackUri}
                onPress={() => pickDocument(setIdDocBackUri)}
                theme={theme}
              />

<DocUpload
                label={isBusiness ? "Certificado de autónomo / empresa *" : "Documento de autónomo *"}
                description="Alta en Hacienda o certificado de empresa"
                uri={autonomoDocUri}
                onPress={() => pickDocument(setAutonomoDocUri)}
                theme={theme}
              />
            </>
          )}
        </View>

        <View style={[styles.formSection, { backgroundColor: theme.card }, Shadows.sm]}>
          {/* ── Profesión ── */}
          <SectionTitle icon="briefcase" title="Profesión" />

<Input label="Tu profesión" leftIcon="award" value={profession}
            onChangeText={setProfession}
            placeholder="Ej: Repartidor, Chef, Comerciante..." autoCapitalize="words" />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]}>
        <Button onPress={handleSave} disabled={isSaving} loading={isSaving} style={styles.saveButton}>
          Guardar cambios
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  avatarSection: { alignItems: "center", padding: Spacing.xl, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraButton: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  statusBanner: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  formSection: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  sectionIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  vehicleChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  docUpload: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderRadius: BorderRadius.lg, padding: Spacing.lg },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  saveButton: { width: "100%" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
});
