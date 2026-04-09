import React, { useState } from "react";
import {
  View, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, ImageBackground, TextInput, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { UserRole } from "@/types";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

const foodBgImage = require("../../assets/images/food-ingredients-bg.png");
const PENDING_BUSINESS_DRAFT_KEY = "@ComeYa_pending_business_draft";

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">;
  route: RouteProp<RootStackParamList, "Signup">;
};

const ROLES: { value: UserRole; label: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { value: "customer",        label: "Cliente",     icon: "user",         description: "Pide comida y productos" },
  { value: "business_owner",  label: "Negocio",     icon: "shopping-bag", description: "Vende tus productos" },
  { value: "delivery_driver", label: "Repartidor",  icon: "truck",        description: "Entrega pedidos" },
];

const BUSINESS_TYPES = [
  { id: "restaurant", name: "Restaurante" },
  { id: "market",     name: "Mercado" },
  { id: "bakery",     name: "Panadería" },
  { id: "pharmacy",   name: "Farmacia" },
  { id: "other",      name: "Otro" },
];

const TOTAL_STEPS = 4;

export default function SignupScreen({ navigation, route }: SignupScreenProps) {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const initialPhone = route.params?.phone?.replace("+34", "") || "";

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUserExistsModal, setShowUserExistsModal] = useState(false);

  // Paso 1 — Rol + datos personales
  const [role, setRole] = useState<UserRole>("customer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState(initialPhone);

  // Paso 2 — Dirección
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("Soria");
  const [zipCode, setZipCode] = useState("");

  // Paso 3 — Contraseña + email + datos negocio
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");

  // Paso 4 — Documentos
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [autonomoDocumentUri, setAutonomoDocumentUri] = useState<string | null>(null);

  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, "");
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)} ${n.slice(3)}`;
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)}`;
  };

  const needsDocs = role === "delivery_driver" || role === "business_owner";

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!firstName.trim()) e.firstName = "Nombre requerido";
      if (!lastName.trim()) e.lastName = "Apellidos requeridos";
      if (!dni.trim()) e.dni = "DNI/NIE requerido";
      else if (!/^[0-9XYZ][0-9]{6,7}[A-Z]$/i.test(dni.trim())) e.dni = "Formato inválido (ej: 12345678A)";
      if (!phone || phone.replace(/\D/g, "").length < 9) e.phone = "Teléfono de 9 dígitos requerido";
    }
    if (s === 2) {
      if (!street.trim()) e.street = "Calle requerida";
      if (!city.trim()) e.city = "Ciudad requerida";
    }
    if (s === 3) {
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Correo inválido";
      if (!password) e.password = "Contraseña requerida";
      else if (password.length < 8) e.password = "Mínimo 8 caracteres";
      if (password !== confirmPassword) e.confirmPassword = "Las contraseñas no coinciden";
      if (role === "business_owner") {
        if (!businessName.trim()) e.businessName = "Nombre del negocio requerido";
      }
    }
    if (s === 4 && needsDocs) {
      if (!idDocumentUri) e.idDocument = "Foto del DNI/NIE requerida";
      if (!autonomoDocumentUri) e.autonomoDocument = "Documento de autónomo/empresa requerido";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    Haptics.selectionAsync();
    if (step === 3 && !needsDocs) {
      handleSignup();
    } else if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleSignup();
    }
  };

  const handleBack = () => {
    if (step === 1) navigation.goBack();
    else { setStep(step - 1); setErrors({}); }
    Haptics.selectionAsync();
  };

  const pickDocument = async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Se necesita permiso para acceder a la galería", "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const formattedPhone = `+34${phone.replace(/\D/g, "")}`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const fullAddress = `${street.trim()}, ${city.trim()}${zipCode ? ` ${zipCode}` : ""}`;

      const result = await signup(fullName, role, formattedPhone, email.trim() || undefined, password);

      if (result?.requiresVerification) {
        // Guardar datos extra para completar perfil tras verificación
        await AsyncStorage.setItem("@ComeYa_signup_extra", JSON.stringify({
          dni: dni.trim().toUpperCase(),
          address: fullAddress,
        }));

        if (role === "business_owner") {
          await AsyncStorage.setItem(PENDING_BUSINESS_DRAFT_KEY, JSON.stringify({
            name: businessName.trim(),
            type: businessType,
            address: fullAddress,
            phone: formattedPhone,
          }));
        }

        // Si hay documentos, subirlos al servidor
        if (needsDocs && (idDocumentUri || autonomoDocumentUri)) {
          try {
            const userId = result.userId;
            if (userId) {
              const formData = new FormData();
              if (idDocumentUri) {
                formData.append("idDocument", { uri: idDocumentUri, name: "id_document.jpg", type: "image/jpeg" } as any);
              }
              if (autonomoDocumentUri) {
                formData.append("autonomoDocument", { uri: autonomoDocumentUri, name: "autonomo_document.jpg", type: "image/jpeg" } as any);
              }
              await apiRequest("POST", `/api/users/${userId}/verification-documents`, formData);
            }
          } catch (e) {
            console.error("Error uploading docs:", e);
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("VerifyPhone", { phone: formattedPhone });
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error.message?.includes("already") || error.message?.includes("existe")) {
        setShowUserExistsModal(true);
      } else {
        showToast(error.message || "Error al crear la cuenta", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = ["¿Quién eres?", "Tu dirección", "Acceso", "Documentos"];
  const stepSubtitles = [
    "Datos personales para verificar tu identidad",
    "Dirección de entrega o residencia",
    "Correo y contraseña para entrar",
    "Necesitamos verificar tu actividad",
  ];

  return (
    <ImageBackground source={foodBgImage} style={styles.container} resizeMode="cover">
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <View style={styles.backButtonCircle}>
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </View>
            </Pressable>
            <ThemedText type="hero" style={styles.title}>{stepTitles[step - 1]}</ThemedText>
            <ThemedText type="body" style={styles.subtitle}>{stepSubtitles[step - 1]}</ThemedText>

            {/* Progress bar */}
            <View style={styles.progressBar}>
              {Array.from({ length: needsDocs ? TOTAL_STEPS : 3 }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, { backgroundColor: i < step ? ComeYaColors.primary : "rgba(255,255,255,0.4)" }]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.formCard, Shadows.lg]}>

            {/* ── PASO 1: Rol + datos personales ── */}
            {step === 1 && (
              <>
                <ThemedText type="small" style={styles.sectionLabel}>¿Cómo quieres usar ComeYa?</ThemedText>
                <View style={styles.rolesContainer}>
                  {ROLES.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => { setRole(r.value); Haptics.selectionAsync(); }}
                      style={[styles.roleCard, {
                        backgroundColor: role === r.value ? ComeYaColors.primaryLight : "#F5F5F5",
                        borderColor: role === r.value ? ComeYaColors.primary : "#E0E0E0",
                        borderWidth: role === r.value ? 2 : 1,
                      }]}
                    >
                      <View style={[styles.roleIcon, { backgroundColor: role === r.value ? ComeYaColors.primary : "#E0E0E0" }]}>
                        <Feather name={r.icon} size={22} color={role === r.value ? "#FFF" : "#666"} />
                      </View>
                      <ThemedText type="small" style={{ fontWeight: "600", textAlign: "center", color: "#333" }}>{r.label}</ThemedText>
                      <ThemedText type="caption" style={{ color: "#666", textAlign: "center", fontSize: 10 }}>{r.description}</ThemedText>
                    </Pressable>
                  ))}
                </View>

                <Field label="Nombre *" placeholder="Tu nombre" value={firstName} onChangeText={setFirstName} error={errors.firstName} icon="user" autoCapitalize="words" />
                <Field label="Apellidos *" placeholder="Tus apellidos" value={lastName} onChangeText={setLastName} error={errors.lastName} icon="user" autoCapitalize="words" />
                <Field label="DNI / NIE *" placeholder="12345678A" value={dni} onChangeText={(t) => setDni(t.toUpperCase())} error={errors.dni} icon="credit-card" autoCapitalize="characters" />

                <ThemedText type="small" style={styles.inputLabel}>Teléfono *</ThemedText>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <ThemedText type="body" style={styles.countryCodeText}>🇪🇸 +34</ThemedText>
                  </View>
                  <View style={[styles.inputBox, errors.phone ? styles.inputBoxError : null]}>
                    <Feather name="phone" size={18} color="#666" style={{ marginRight: 8 }} />
                    <TextInput
                      placeholder="612 345 678"
                      value={formatPhone(phone)}
                      onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 9))}
                      keyboardType="phone-pad"
                      placeholderTextColor="#999"
                      style={styles.textInput}
                      maxLength={11}
                    />
                  </View>
                </View>
                {errors.phone ? <ThemedText type="caption" style={styles.inputError}>{errors.phone}</ThemedText> : null}
              </>
            )}

            {/* ── PASO 2: Dirección ── */}
            {step === 2 && (
              <>
                <Field label="Calle y número *" placeholder="Calle Mayor 12" value={street} onChangeText={setStreet} error={errors.street} icon="map-pin" autoCapitalize="words" />
                <Field label="Ciudad *" placeholder="Soria" value={city} onChangeText={setCity} error={errors.city} icon="map" autoCapitalize="words" />
                <Field label="Código postal" placeholder="42001" value={zipCode} onChangeText={setZipCode} icon="hash" keyboardType="numeric" />
              </>
            )}

            {/* ── PASO 3: Contraseña + email + negocio ── */}
            {step === 3 && (
              <>
                <Field label="Correo electrónico (opcional)" placeholder="tu@email.com" value={email} onChangeText={setEmail} error={errors.email} icon="mail" keyboardType="email-address" autoCapitalize="none" />

                <ThemedText type="small" style={styles.inputLabel}>Contraseña *</ThemedText>
                <View style={[styles.inputBox, errors.password ? styles.inputBoxError : null]}>
                  <Feather name="lock" size={18} color="#666" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#999"
                    style={styles.textInput}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#666" />
                  </Pressable>
                </View>
                {errors.password ? <ThemedText type="caption" style={styles.inputError}>{errors.password}</ThemedText> : null}

                <View style={{ marginTop: Spacing.md }}>
                  <ThemedText type="small" style={styles.inputLabel}>Confirmar contraseña *</ThemedText>
                  <View style={[styles.inputBox, errors.confirmPassword ? styles.inputBoxError : null]}>
                    <Feather name="lock" size={18} color="#666" style={{ marginRight: 8 }} />
                    <TextInput
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor="#999"
                      style={styles.textInput}
                    />
                  </View>
                  {errors.confirmPassword ? <ThemedText type="caption" style={styles.inputError}>{errors.confirmPassword}</ThemedText> : null}
                </View>

                {role === "business_owner" && (
                  <>
                    <View style={styles.divider} />
                    <ThemedText type="small" style={[styles.sectionLabel, { marginTop: 0 }]}>Datos del negocio</ThemedText>
                    <Field label="Nombre del negocio *" placeholder="Restaurante El Olivo" value={businessName} onChangeText={setBusinessName} error={errors.businessName} icon="briefcase" autoCapitalize="words" />
                    <ThemedText type="small" style={styles.inputLabel}>Tipo de negocio</ThemedText>
                    <View style={styles.chipRow}>
                      {BUSINESS_TYPES.map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => { setBusinessType(t.id); Haptics.selectionAsync(); }}
                          style={[styles.chip, businessType === t.id && styles.chipActive]}
                        >
                          <ThemedText type="caption" style={businessType === t.id ? styles.chipTextActive : styles.chipText}>{t.name}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* ── PASO 4: Documentos ── */}
            {step === 4 && needsDocs && (
              <>
                <View style={[styles.infoBanner, { backgroundColor: ComeYaColors.primary + "15", borderColor: ComeYaColors.primary + "40" }]}>
                  <Feather name="info" size={16} color={ComeYaColors.primary} />
                  <ThemedText type="small" style={{ color: ComeYaColors.primary, flex: 1, marginLeft: 8 }}>
                    Tu cuenta quedará en revisión hasta que verifiquemos tus documentos (24-48h).
                  </ThemedText>
                </View>

                <DocUpload
                  label="Foto del DNI / NIE *"
                  description="Anverso y reverso en una sola imagen"
                  uri={idDocumentUri}
                  error={errors.idDocument}
                  onPress={() => pickDocument(setIdDocumentUri)}
                />

                <DocUpload
                  label={role === "business_owner" ? "Certificado de autónomo / empresa *" : "Documento de autónomo *"}
                  description="Alta en Hacienda o certificado de empresa"
                  uri={autonomoDocumentUri}
                  error={errors.autonomoDocument}
                  onPress={() => pickDocument(setAutonomoDocumentUri)}
                />
              </>
            )}

            <Button onPress={handleNext} disabled={isLoading} style={{ marginTop: Spacing.lg }}>
              {isLoading
                ? <ActivityIndicator color="#FFF" />
                : step === 3 && !needsDocs ? "Crear cuenta"
                : step === TOTAL_STEPS || (step === 3 && !needsDocs) ? "Crear cuenta"
                : "Continuar"}
            </Button>

            <ThemedText type="caption" style={styles.termsText}>
              Al registrarte aceptas nuestros términos y condiciones
            </ThemedText>
          </View>

          <ConfirmModal
            visible={showUserExistsModal}
            title="Cuenta ya registrada"
            message="Este teléfono ya está registrado. Inicia sesión para continuar."
            confirmText="Ir a iniciar sesión"
            cancelText="Cerrar"
            onConfirm={() => { setShowUserExistsModal(false); navigation.navigate("Login"); }}
            onCancel={() => setShowUserExistsModal(false)}
          />

          <View style={styles.loginLink}>
            <ThemedText type="body" style={styles.loginText}>¿Ya tienes cuenta? </ThemedText>
            <Pressable onPress={() => navigation.goBack()}>
              <ThemedText type="body" style={styles.loginLinkText}>Inicia sesión</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

// ── Componentes auxiliares ──

function Field({ label, placeholder, value, onChangeText, error, icon, autoCapitalize, keyboardType }: any) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ThemedText type="small" style={styles.inputLabel}>{label}</ThemedText>
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        <Feather name={icon} size={18} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={autoCapitalize || "none"}
          keyboardType={keyboardType || "default"}
          placeholderTextColor="#999"
          style={styles.textInput}
        />
      </View>
      {error ? <ThemedText type="caption" style={styles.inputError}>{error}</ThemedText> : null}
    </View>
  );
}

function DocUpload({ label, description, uri, error, onPress }: any) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <ThemedText type="small" style={styles.inputLabel}>{label}</ThemedText>
      <ThemedText type="caption" style={{ color: "#888", marginBottom: Spacing.sm }}>{description}</ThemedText>
      <Pressable
        onPress={onPress}
        style={[styles.docUpload, uri ? styles.docUploadDone : null, error ? styles.inputBoxError : null]}
      >
        <Feather name={uri ? "check-circle" : "upload"} size={22} color={uri ? ComeYaColors.success : "#888"} />
        <ThemedText type="small" style={{ color: uri ? ComeYaColors.success : "#666", marginLeft: 8, fontWeight: "600" }}>
          {uri ? "Documento subido ✓" : "Seleccionar imagen"}
        </ThemedText>
      </Pressable>
      {error ? <ThemedText type="caption" style={styles.inputError}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  scrollContent: { paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  backButton: { marginBottom: Spacing.md },
  backButtonCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  title: { color: "#FFF" },
  subtitle: { color: "rgba(255,255,255,0.8)", marginTop: Spacing.xs },
  progressBar: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  formCard: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionLabel: { fontWeight: "700", color: "#333", marginBottom: Spacing.sm, marginTop: Spacing.sm },
  rolesContainer: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  roleCard: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: "center" },
  roleIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  inputLabel: { color: "#333", fontWeight: "600", marginBottom: Spacing.xs },
  phoneRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xs },
  countryCode: { backgroundColor: "#F5F5F5", borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, justifyContent: "center", borderWidth: 1.5, borderColor: "#E0E0E0", height: 52 },
  countryCodeText: { color: "#333", fontWeight: "600" },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: "#E0E0E0", paddingHorizontal: Spacing.md, height: 52, marginBottom: Spacing.xs },
  inputBoxError: { borderColor: ComeYaColors.error },
  textInput: { flex: 1, fontSize: 16, color: "#333" },
  inputError: { color: ComeYaColors.error, marginBottom: Spacing.xs },
  divider: { height: 1, backgroundColor: "#E0E0E0", marginVertical: Spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  chip: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: "#D9D7E8", backgroundColor: "#FFF" },
  chipActive: { borderColor: ComeYaColors.primary, backgroundColor: ComeYaColors.primaryLight },
  chipText: { color: "#5D5A78", fontWeight: "600" },
  chipTextActive: { color: ComeYaColors.primary, fontWeight: "700" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  docUpload: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#E0E0E0", borderStyle: "dashed", borderRadius: BorderRadius.lg, padding: Spacing.lg, backgroundColor: "#FAFAFA" },
  docUploadDone: { borderColor: ComeYaColors.success, borderStyle: "solid", backgroundColor: ComeYaColors.success + "10" },
  termsText: { textAlign: "center", color: "#888", marginTop: Spacing.md },
  loginLink: { flexDirection: "row", justifyContent: "center", marginBottom: Spacing.lg },
  loginText: { color: "rgba(255,255,255,0.8)" },
  loginLinkText: { color: ComeYaColors.primary, fontWeight: "600" },
});
