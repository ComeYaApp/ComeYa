import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  TextInput,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AlertModal } from "@/components/AlertModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
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

const ROLES: {
  value: UserRole;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}[] = [
  {
    value: "customer",
    label: "Cliente",
    icon: "user",
    description: "Pide comida y productos",
  },
  {
    value: "business_owner",
    label: "Negocio",
    icon: "shopping-bag",
    description: "Vende tus productos",
  },
  {
    value: "delivery_driver",
    label: "Repartidor",
    icon: "truck",
    description: "Entrega pedidos",
  },
];

const BUSINESS_TYPES = [
  { id: "restaurant", name: "Restaurante" },
  { id: "market", name: "Mercado" },
  { id: "bakery", name: "Panadería" },
  { id: "pharmacy", name: "Farmacia" },
  { id: "other", name: "Otro" },
];

const VEHICLE_TYPES = [
  {
    id: "bicycle",
    name: "Bicicleta",
    icon: "🚲",
    requiresPlate: false,
    requiresInsurance: false,
  },
  {
    id: "ebike",
    name: "Bici eléctrica",
    icon: "⚡🚲",
    requiresPlate: false,
    requiresInsurance: false,
  },
  {
    id: "scooter",
    name: "Patinete",
    icon: "🛴",
    requiresPlate: false,
    requiresInsurance: false,
  },
  {
    id: "motorcycle",
    name: "Moto/Ciclomotor",
    icon: "🏍️",
    requiresPlate: true,
    requiresInsurance: true,
  },
  {
    id: "car",
    name: "Coche",
    icon: "🚗",
    requiresPlate: true,
    requiresInsurance: true,
  },
];

const VEHICLE_COLORS = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Rojo",
  "Azul",
  "Verde",
  "Amarillo",
  "Naranja",
  "Otro",
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
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }>({ visible: false, type: "info", title: "", message: "" });

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
  const [idDocumentBackUri, setIdDocumentBackUri] = useState<string | null>(null);
  const [autonomoDocumentUri, setAutonomoDocumentUri] = useState<string | null>(
    null,
  );
  const [vehicleDocumentUri, setVehicleDocumentUri] = useState<string | null>(
    null,
  );
  const [insuranceDocumentUri, setInsuranceDocumentUri] = useState<
    string | null
  >(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("bicycle");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, "");
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)} ${n.slice(3)}`;
    if (n.length <= 9)
      return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)}`;
    return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7, 11)}`;
  };

  const needsDocs = role === "delivery_driver" || role === "business_owner";

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!firstName.trim()) e.firstName = "Nombre requerido";
      if (!lastName.trim()) e.lastName = "Apellidos requeridos";
      // DNI solo obligatorio para drivers y negocios (verificación de identidad)
      if (role !== "customer") {
        if (!dni.trim()) {
          e.dni = "DNI/NIE requerido";
        } else {
          const dniClean = dni.trim().toUpperCase();
          const dniPattern = /^[0-9]{8}[A-Z]$/;
          const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
          if (!dniPattern.test(dniClean) && !niePattern.test(dniClean)) {
            e.dni = "Formato inválido. DNI: 12345678A o NIE: X1234567L";
          }
        }
      } else if (dni.trim()) {
        // Si el cliente introduce DNI voluntariamente, validar formato igualmente
        const dniClean = dni.trim().toUpperCase();
        const dniPattern = /^[0-9]{8}[A-Z]$/;
        const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
        if (!dniPattern.test(dniClean) && !niePattern.test(dniClean)) {
          e.dni = "Formato inválido. DNI: 12345678A o NIE: X1234567L";
        }
      }
      if (!phone || phone.replace(/\D/g, "").length < 7)
        e.phone = "Tel\u00e9fono requerido";
    }
    if (s === 2) {
      if (!street.trim()) e.street = "Calle requerida";
      if (!city.trim()) e.city = "Ciudad requerida";
    }
    if (s === 3) {
      if (!email.trim()) {
        e.email = "Correo electrónico requerido";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        e.email = "Correo inválido";
      }
      if (!password) e.password = "Contraseña requerida";
      else if (password.length < 8) e.password = "Mínimo 8 caracteres";
      if (password !== confirmPassword)
        e.confirmPassword = "Las contraseñas no coinciden";
      if (role === "business_owner") {
        if (!businessName.trim())
          e.businessName = "Nombre del negocio requerido";
      }
    }
    if (s === 4 && needsDocs) {
      if (!idDocumentUri) e.idDocument = "Foto del DNI/NIE requerida";
      if (role === "business_owner") {
        if (!autonomoDocumentUri)
          e.autonomoDocument = "Documento de autónomo/empresa requerido";
      }
      if (role === "delivery_driver") {
        if (!profilePhotoUri) e.profilePhoto = "Foto de perfil requerida";
        if (!autonomoDocumentUri)
          e.autonomoDocument = "Alta de autónomo requerida";
        if (!vehicleType) e.vehicleType = "Tipo de vehículo requerido";

        const selectedVehicle = VEHICLE_TYPES.find((v) => v.id === vehicleType);
        if (selectedVehicle?.requiresPlate) {
          if (!vehiclePlate.trim()) e.vehiclePlate = "Matrícula requerida";
          if (!vehicleBrand.trim()) e.vehicleBrand = "Marca requerida";
          if (!vehicleModel.trim()) e.vehicleModel = "Modelo requerido";
          if (!vehicleColor) e.vehicleColor = "Color requerido";
          if (!vehiclePhotoUri) e.vehiclePhoto = "Foto del vehículo requerida";
          if (!vehicleDocumentUri)
            e.vehicleDocument = "Permiso de circulación requerido";
          if (!insuranceDocumentUri)
            e.insuranceDocument = "Seguro obligatorio requerido";
        } else {
          if (!vehiclePhotoUri) e.vehiclePhoto = "Foto del vehículo requerida";
        }
      }
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
    else {
      setStep(step - 1);
      setErrors({});
    }
    Haptics.selectionAsync();
  };

  const pickImage = async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Permiso requerido",
        message: "Se necesita permiso para acceder a la galería",
      });
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

  const pickDocument = async (setter: (uri: string) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setter(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error("Error picking document:", e);
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const digits = phone.replace(/\D/g, "");
      const formattedPhone = `+34${digits}`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const fullAddress = `${street.trim()}, ${city.trim()}${zipCode ? ` ${zipCode}` : ""}`;

      const result = await signup(
        fullName,
        role,
        formattedPhone,
        email.trim(),
        password,
      );

      if (result?.requiresVerification) {
        // Guardar datos extra para completar perfil tras verificación
        await AsyncStorage.setItem(
          "@ComeYa_signup_extra",
          JSON.stringify({
            dni: dni.trim().toUpperCase(),
            address: fullAddress,
          }),
        );

        if (role === "business_owner") {
          await AsyncStorage.setItem(
            PENDING_BUSINESS_DRAFT_KEY,
            JSON.stringify({
              name: businessName.trim(),
              type: businessType,
              address: fullAddress,
              phone: formattedPhone,
            }),
          );
        }

        // Subir documentos a Cloudinary
        if (needsDocs) {
          try {
            const userId = result.userId;
            if (userId) {
              const documentData: any = {};

              // Convertir URIs a base64
              if (idDocumentUri) {
                const response = await fetch(idDocumentUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.idDocument = base64;
              }

              if (idDocumentBackUri) {
                const response = await fetch(idDocumentBackUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.idDocumentBack = base64;
              }

              if (autonomoDocumentUri) {
                const response = await fetch(autonomoDocumentUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.autonomoDocument = base64;
              }

              if (profilePhotoUri) {
                const response = await fetch(profilePhotoUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.profilePhoto = base64;
              }

              if (vehiclePhotoUri) {
                const response = await fetch(vehiclePhotoUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.vehiclePhoto = base64;
              }

              if (vehicleDocumentUri) {
                const response = await fetch(vehicleDocumentUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.vehicleDocument = base64;
              }

              if (insuranceDocumentUri) {
                const response = await fetch(insuranceDocumentUri);
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                documentData.insuranceDocument = base64;
              }

              // Agregar datos del vehículo si es repartidor
              if (role === "delivery_driver") {
                documentData.userId = userId;
                documentData.vehicleType = vehicleType;
                documentData.vehiclePlate = vehiclePlate.toUpperCase();
                documentData.vehicleBrand = vehicleBrand;
                documentData.vehicleModel = vehicleModel;
                documentData.vehicleColor = vehicleColor;
              } else {
                documentData.userId = userId;
              }

              // Subir a Cloudinary
              await apiRequest(
                "POST",
                "/api/registration/upload-documents",
                documentData,
              );
            }
          } catch (e) {
            console.error("Error uploading docs:", e);
            setAlertConfig({
              visible: true,
              type: "warning",
              title: "Documentos pendientes",
              message:
                "No pudimos subir tus documentos. Puedes completarlos después desde tu perfil.",
            });
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("VerifyPhone", { phone: formattedPhone });
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (
        error.message?.includes("already") ||
        error.message?.includes("existe")
      ) {
        setShowUserExistsModal(true);
      } else {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Error al crear cuenta",
          message:
            error.message || "No pudimos crear tu cuenta. Intenta nuevamente.",
        });
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
    <ImageBackground
      source={foodBgImage}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
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
            <ThemedText type="hero" style={styles.title}>
              {stepTitles[step - 1]}
            </ThemedText>
            <ThemedText type="body" style={styles.subtitle}>
              {stepSubtitles[step - 1]}
            </ThemedText>

            {/* Progress bar */}
            <View style={styles.progressBar}>
              {Array.from({ length: needsDocs ? TOTAL_STEPS : 3 }).map(
                (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor:
                          i < step
                            ? ComeYaColors.primary
                            : "rgba(255,255,255,0.4)",
                      },
                    ]}
                  />
                ),
              )}
            </View>
          </View>

          <View style={[styles.formCard, Shadows.lg]}>
            {/* ── PASO 1: Rol + datos personales ── */}
            {step === 1 && (
              <>
                <ThemedText type="small" style={styles.sectionLabel}>
                  ¿Cómo quieres usar ComeYa?
                </ThemedText>
                <View style={styles.rolesContainer}>
                  {ROLES.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => {
                        setRole(r.value);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor:
                            role === r.value
                              ? ComeYaColors.primaryLight
                              : "#F5F5F5",
                          borderColor:
                            role === r.value ? ComeYaColors.primary : "#E0E0E0",
                          borderWidth: role === r.value ? 2 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.roleIcon,
                          {
                            backgroundColor:
                              role === r.value
                                ? ComeYaColors.primary
                                : "#E0E0E0",
                          },
                        ]}
                      >
                        <Feather
                          name={r.icon}
                          size={22}
                          color={role === r.value ? "#FFF" : "#666"}
                        />
                      </View>
                      <ThemedText
                        type="small"
                        style={{
                          fontWeight: "600",
                          textAlign: "center",
                          color: "#333",
                        }}
                      >
                        {r.label}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{
                          color: "#666",
                          textAlign: "center",
                          fontSize: 10,
                        }}
                      >
                        {r.description}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <Field
                  label="Nombre *"
                  placeholder="Tu nombre"
                  value={firstName}
                  onChangeText={setFirstName}
                  error={errors.firstName}
                  icon="user"
                  autoCapitalize="words"
                />
                <Field
                  label="Apellidos *"
                  placeholder="Tus apellidos"
                  value={lastName}
                  onChangeText={setLastName}
                  error={errors.lastName}
                  icon="user"
                  autoCapitalize="words"
                />

                {role !== "customer" && (
                  <>
                    <ThemedText type="small" style={styles.inputLabel}>
                      DNI / NIE *
                    </ThemedText>
                    <View
                      style={[
                        styles.inputBox,
                        errors.dni ? styles.inputBoxError : null,
                      ]}
                    >
                      <Feather
                        name="credit-card"
                        size={18}
                        color="#666"
                        style={{ marginRight: 8 }}
                      />
                      <TextInput
                        placeholder="12345678A"
                        value={dni}
                        onChangeText={(t) => setDni(t.toUpperCase().slice(0, 12))}
                        autoCapitalize="characters"
                        placeholderTextColor="#999"
                        style={styles.textInput}
                        maxLength={9}
                      />
                    </View>
                    {errors.dni ? (
                      <ThemedText type="caption" style={styles.inputError}>
                        {errors.dni}
                      </ThemedText>
                    ) : null}
                    <ThemedText
                      type="caption"
                      style={{ color: "#888", marginBottom: Spacing.md }}
                    >
                      Por normativa española, necesitamos tu DNI/NIE para verificar tu identidad como profesional (Ley 20/2007 del Estatuto del Trabajo Autónomo).
                    </ThemedText>
                  </>
                )}

                <ThemedText type="small" style={styles.inputLabel}>
                  Teléfono *
                </ThemedText>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <ThemedText type="body" style={styles.countryCodeText}>
                      🇪🇸 +34
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.inputBox,
                      errors.phone ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="phone"
                      size={18}
                      color="#666"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      placeholder="612 345 678"
                      value={formatPhone(phone)}
                      onChangeText={(t) =>
                        setPhone(t.replace(/\D/g, "").slice(0, 12))
                      }
                      keyboardType="phone-pad"
                      placeholderTextColor="#999"
                      style={styles.textInput}
                      maxLength={14}
                    />
                  </View>
                </View>
                {errors.phone ? (
                  <ThemedText type="caption" style={styles.inputError}>
                    {errors.phone}
                  </ThemedText>
                ) : null}
              </>
            )}

            {/* ── PASO 2: Dirección ── */}
            {step === 2 && (
              <>
                <Field
                  label="Calle y número *"
                  placeholder="Calle Mayor 12"
                  value={street}
                  onChangeText={setStreet}
                  error={errors.street}
                  icon="map-pin"
                  autoCapitalize="words"
                />
                <Field
                  label="Ciudad *"
                  placeholder="Soria"
                  value={city}
                  onChangeText={setCity}
                  error={errors.city}
                  icon="map"
                  autoCapitalize="words"
                />
                <Field
                  label="Código postal"
                  placeholder="42001"
                  value={zipCode}
                  onChangeText={setZipCode}
                  icon="hash"
                  keyboardType="numeric"
                />
              </>
            )}

            {/* ── PASO 3: Contraseña + email + negocio ── */}
            {step === 3 && (
              <>
                <Field
                  label="Correo electrónico *"
                  placeholder="tu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  error={errors.email}
                  icon="mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <ThemedText type="small" style={styles.inputLabel}>
                  Contraseña *
                </ThemedText>
                <View
                  style={[
                    styles.inputBox,
                    errors.password ? styles.inputBoxError : null,
                  ]}
                >
                  <Feather
                    name="lock"
                    size={18}
                    color="#666"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#999"
                    style={styles.textInput}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color="#666"
                    />
                  </Pressable>
                </View>
                {errors.password ? (
                  <ThemedText type="caption" style={styles.inputError}>
                    {errors.password}
                  </ThemedText>
                ) : null}

                <View style={{ marginTop: Spacing.md }}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Confirmar contraseña *
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.confirmPassword ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={18}
                      color="#666"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor="#999"
                      style={styles.textInput}
                    />
                  </View>
                  {errors.confirmPassword ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.confirmPassword}
                    </ThemedText>
                  ) : null}
                </View>

                {role === "business_owner" && (
                  <>
                    <View style={styles.divider} />
                    <ThemedText
                      type="small"
                      style={[styles.sectionLabel, { marginTop: 0 }]}
                    >
                      Datos del negocio
                    </ThemedText>
                    <Field
                      label="Nombre del negocio *"
                      placeholder="Restaurante El Olivo"
                      value={businessName}
                      onChangeText={setBusinessName}
                      error={errors.businessName}
                      icon="briefcase"
                      autoCapitalize="words"
                    />
                    <ThemedText type="small" style={styles.inputLabel}>
                      Tipo de negocio
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {BUSINESS_TYPES.map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => {
                            setBusinessType(t.id);
                            Haptics.selectionAsync();
                          }}
                          style={[
                            styles.chip,
                            businessType === t.id && styles.chipActive,
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={
                              businessType === t.id
                                ? styles.chipTextActive
                                : styles.chipText
                            }
                          >
                            {t.name}
                          </ThemedText>
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
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: ComeYaColors.primary + "15",
                      borderColor: ComeYaColors.primary + "40",
                    },
                  ]}
                >
                  <Feather name="info" size={16} color={ComeYaColors.primary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.primary,
                      flex: 1,
                      marginLeft: 8,
                    }}
                  >
                    Tu cuenta quedará en revisión hasta que verifiquemos tus
                    documentos (24-48h).
                  </ThemedText>
                </View>

                <DocUpload
                  label="Foto del DNI / NIE (Anverso) *"
                  description="Parte frontal del documento de identidad"
                  uri={idDocumentUri}
                  error={errors.idDocument}
                  onPress={() => pickDocument(setIdDocumentUri)}
                />

                <DocUpload
                  label="Foto del DNI / NIE (Reverso)"
                  description="Parte trasera del documento de identidad"
                  uri={idDocumentBackUri}
                  error={errors.idDocumentBack}
                  onPress={() => pickDocument(setIdDocumentBackUri)}
                />

                <DocUpload
                  label={
                    role === "business_owner"
                      ? "Certificado de autónomo / empresa *"
                      : "Alta de autónomo (modelo 036/037) *"
                  }
                  description={
                    role === "business_owner"
                      ? "Alta en Hacienda o certificado de empresa"
                      : "Documento de alta en Hacienda como autónomo"
                  }
                  uri={autonomoDocumentUri}
                  error={errors.autonomoDocument}
                  onPress={() => pickDocument(setAutonomoDocumentUri)}
                />

                {role === "delivery_driver" && (
                  <>
                    <View style={styles.divider} />
                    <ThemedText
                      type="small"
                      style={[styles.sectionLabel, { marginTop: 0 }]}
                    >
                      Foto de perfil
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: "#888", marginBottom: Spacing.sm }}
                    >
                      El cliente verá tu foto para identificarte al momento de
                      la entrega
                    </ThemedText>

                    <Pressable
                      onPress={() => pickDocument(setProfilePhotoUri)}
                      style={[
                        styles.photoUpload,
                        profilePhotoUri ? styles.photoUploadDone : null,
                        errors.profilePhoto ? styles.inputBoxError : null,
                      ]}
                    >
                      {profilePhotoUri ? (
                        <View style={styles.photoPreview}>
                          <Image
                            source={{ uri: profilePhotoUri }}
                            style={styles.photoImage}
                          />
                          <View style={styles.photoOverlay}>
                            <Feather
                              name="check-circle"
                              size={32}
                              color="#FFF"
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Feather name="camera" size={32} color="#888" />
                          <ThemedText
                            type="small"
                            style={{
                              color: "#666",
                              marginTop: Spacing.xs,
                              fontWeight: "600",
                            }}
                          >
                            Tomar foto de perfil
                          </ThemedText>
                          <ThemedText
                            type="caption"
                            style={{
                              color: "#888",
                              textAlign: "center",
                              marginTop: 4,
                            }}
                          >
                            Foto clara de tu rostro
                          </ThemedText>
                        </View>
                      )}
                    </Pressable>
                    {errors.profilePhoto ? (
                      <ThemedText type="caption" style={styles.inputError}>
                        {errors.profilePhoto}
                      </ThemedText>
                    ) : null}

                    <View style={styles.divider} />
                    <ThemedText
                      type="small"
                      style={[styles.sectionLabel, { marginTop: 0 }]}
                    >
                      Información del vehículo
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: "#888", marginBottom: Spacing.sm }}
                    >
                      El cliente verá esta información para identificarte
                    </ThemedText>

                    <ThemedText type="small" style={styles.inputLabel}>
                      Tipo de vehículo *
                    </ThemedText>
                    <View style={styles.vehicleTypeGrid}>
                      {VEHICLE_TYPES.map((v) => (
                        <Pressable
                          key={v.id}
                          onPress={() => {
                            setVehicleType(v.id);
                            Haptics.selectionAsync();
                          }}
                          style={[
                            styles.vehicleTypeCard,
                            vehicleType === v.id &&
                              styles.vehicleTypeCardActive,
                          ]}
                        >
                          <ThemedText style={{ fontSize: 28, marginBottom: 4 }}>
                            {v.icon}
                          </ThemedText>
                          <ThemedText
                            type="caption"
                            style={{
                              fontWeight: "600",
                              textAlign: "center",
                              color:
                                vehicleType === v.id
                                  ? ComeYaColors.primary
                                  : "#333",
                            }}
                          >
                            {v.name}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    {errors.vehicleType ? (
                      <ThemedText type="caption" style={styles.inputError}>
                        {errors.vehicleType}
                      </ThemedText>
                    ) : null}

                    {VEHICLE_TYPES.find((v) => v.id === vehicleType)
                      ?.requiresPlate && (
                      <>
                        <Field
                          label="Matrícula *"
                          placeholder="1234ABC"
                          value={vehiclePlate}
                          onChangeText={(t: string) =>
                            setVehiclePlate(t.toUpperCase().slice(0, 10))
                          }
                          error={errors.vehiclePlate}
                          icon="hash"
                          autoCapitalize="characters"
                        />

                        <Field
                          label="Marca *"
                          placeholder="Honda, Yamaha, Seat..."
                          value={vehicleBrand}
                          onChangeText={setVehicleBrand}
                          error={errors.vehicleBrand}
                          icon="tag"
                          autoCapitalize="words"
                        />

                        <Field
                          label="Modelo *"
                          placeholder="PCX 125, Ibiza..."
                          value={vehicleModel}
                          onChangeText={setVehicleModel}
                          error={errors.vehicleModel}
                          icon="tag"
                          autoCapitalize="words"
                        />

                        <ThemedText type="small" style={styles.inputLabel}>
                          Color *
                        </ThemedText>
                        <View style={styles.chipRow}>
                          {VEHICLE_COLORS.map((color) => (
                            <Pressable
                              key={color}
                              onPress={() => {
                                setVehicleColor(color);
                                Haptics.selectionAsync();
                              }}
                              style={[
                                styles.chip,
                                vehicleColor === color && styles.chipActive,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={
                                  vehicleColor === color
                                    ? styles.chipTextActive
                                    : styles.chipText
                                }
                              >
                                {color}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                        {errors.vehicleColor ? (
                          <ThemedText type="caption" style={styles.inputError}>
                            {errors.vehicleColor}
                          </ThemedText>
                        ) : null}

                        <ThemedText type="small" style={styles.inputLabel}>
                          Foto del vehículo *
                        </ThemedText>
                        <ThemedText
                          type="caption"
                          style={{ color: "#888", marginBottom: Spacing.sm }}
                        >
                          Foto clara donde se vea la matrícula y el color
                        </ThemedText>
                        <Pressable
                          onPress={() => pickDocument(setVehiclePhotoUri)}
                          style={[
                            styles.photoUpload,
                            vehiclePhotoUri ? styles.photoUploadDone : null,
                            errors.vehiclePhoto ? styles.inputBoxError : null,
                          ]}
                        >
                          {vehiclePhotoUri ? (
                            <View style={styles.photoPreview}>
                              <Image
                                source={{ uri: vehiclePhotoUri }}
                                style={styles.photoImage}
                              />
                              <View style={styles.photoOverlay}>
                                <Feather
                                  name="check-circle"
                                  size={32}
                                  color="#FFF"
                                />
                              </View>
                            </View>
                          ) : (
                            <View style={styles.photoPlaceholder}>
                              <Feather name="camera" size={32} color="#888" />
                              <ThemedText
                                type="small"
                                style={{
                                  color: "#666",
                                  marginTop: Spacing.xs,
                                  fontWeight: "600",
                                }}
                              >
                                Tomar foto del vehículo
                              </ThemedText>
                            </View>
                          )}
                        </Pressable>
                        {errors.vehiclePhoto ? (
                          <ThemedText type="caption" style={styles.inputError}>
                            {errors.vehiclePhoto}
                          </ThemedText>
                        ) : null}

                        <DocUpload
                          label="Permiso de circulación *"
                          description="Documento del vehículo (ficha técnica)"
                          uri={vehicleDocumentUri}
                          error={errors.vehicleDocument}
                          onPress={() => pickDocument(setVehicleDocumentUri)}
                        />

                        <DocUpload
                          label="Seguro obligatorio *"
                          description="Póliza de seguro vigente del vehículo"
                          uri={insuranceDocumentUri}
                          error={errors.insuranceDocument}
                          onPress={() => pickDocument(setInsuranceDocumentUri)}
                        />
                      </>
                    )}

                    {!VEHICLE_TYPES.find((v) => v.id === vehicleType)
                      ?.requiresPlate && (
                      <>
                        <ThemedText type="small" style={styles.inputLabel}>
                          Foto del vehículo *
                        </ThemedText>
                        <ThemedText
                          type="caption"
                          style={{ color: "#888", marginBottom: Spacing.sm }}
                        >
                          Foto clara de tu bicicleta/patinete
                        </ThemedText>
                        <Pressable
                          onPress={() => pickDocument(setVehiclePhotoUri)}
                          style={[
                            styles.photoUpload,
                            vehiclePhotoUri ? styles.photoUploadDone : null,
                            errors.vehiclePhoto ? styles.inputBoxError : null,
                          ]}
                        >
                          {vehiclePhotoUri ? (
                            <View style={styles.photoPreview}>
                              <Image
                                source={{ uri: vehiclePhotoUri }}
                                style={styles.photoImage}
                              />
                              <View style={styles.photoOverlay}>
                                <Feather
                                  name="check-circle"
                                  size={32}
                                  color="#FFF"
                                />
                              </View>
                            </View>
                          ) : (
                            <View style={styles.photoPlaceholder}>
                              <Feather name="camera" size={32} color="#888" />
                              <ThemedText
                                type="small"
                                style={{
                                  color: "#666",
                                  marginTop: Spacing.xs,
                                  fontWeight: "600",
                                }}
                              >
                                Tomar foto del vehículo
                              </ThemedText>
                            </View>
                          )}
                        </Pressable>
                        {errors.vehiclePhoto ? (
                          <ThemedText type="caption" style={styles.inputError}>
                            {errors.vehiclePhoto}
                          </ThemedText>
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            <Button
              onPress={handleNext}
              disabled={isLoading}
              style={{ marginTop: Spacing.lg }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : step === 3 && !needsDocs ? (
                "Crear cuenta"
              ) : step === TOTAL_STEPS || (step === 3 && !needsDocs) ? (
                "Crear cuenta"
              ) : (
                "Continuar"
              )}
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
            onConfirm={() => {
              setShowUserExistsModal(false);
              navigation.navigate("Login");
            }}
            onCancel={() => setShowUserExistsModal(false)}
          />

          <View style={styles.loginLink}>
            <ThemedText type="body" style={styles.loginText}>
              ¿Ya tienes cuenta?{" "}
            </ThemedText>
            <Pressable onPress={() => navigation.goBack()}>
              <ThemedText type="body" style={styles.loginLinkText}>
                Inicia sesión
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <AlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
    </ImageBackground>
  );
}

// ── Componentes auxiliares ──

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
  autoCapitalize,
  keyboardType,
}: any) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ThemedText type="small" style={styles.inputLabel}>
        {label}
      </ThemedText>
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        <Feather
          name={icon}
          size={18}
          color="#666"
          style={{ marginRight: 8 }}
        />
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
      {error ? (
        <ThemedText type="caption" style={styles.inputError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function DocUpload({ label, description, uri, error, onPress }: any) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <ThemedText type="small" style={styles.inputLabel}>
        {label}
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ color: "#888", marginBottom: Spacing.sm }}
      >
        {description}
      </ThemedText>
      <Pressable
        onPress={onPress}
        style={[
          styles.docUpload,
          uri ? styles.docUploadDone : null,
          error ? styles.inputBoxError : null,
        ]}
      >
        <Feather
          name={uri ? "check-circle" : "upload"}
          size={22}
          color={uri ? ComeYaColors.success : "#888"}
        />
        <ThemedText
          type="small"
          style={{
            color: uri ? ComeYaColors.success : "#666",
            marginLeft: 8,
            fontWeight: "600",
          }}
        >
          {uri ? "Documento subido ✓" : "Seleccionar imagen"}
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="caption" style={styles.inputError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  scrollContent: { paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  backButton: { marginBottom: Spacing.md },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: "#FFF" },
  subtitle: { color: "rgba(255,255,255,0.8)", marginTop: Spacing.xs },
  progressBar: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontWeight: "700",
    color: "#333",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  rolesContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  roleCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  inputLabel: { color: "#333", fontWeight: "600", marginBottom: Spacing.xs },
  phoneRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xs },
  countryCode: {
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    height: 52,
  },
  countryCodeText: { color: "#333", fontWeight: "600" },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: Spacing.md,
    height: 52,
    marginBottom: Spacing.xs,
  },
  inputBoxError: { borderColor: ComeYaColors.error },
  textInput: { flex: 1, fontSize: 16, color: "#333" },
  inputError: { color: ComeYaColors.error, marginBottom: Spacing.xs },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: Spacing.lg,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#D9D7E8",
    backgroundColor: "#FFF",
  },
  chipActive: {
    borderColor: ComeYaColors.primary,
    backgroundColor: ComeYaColors.primaryLight,
  },
  chipText: { color: "#5D5A78", fontWeight: "600" },
  chipTextActive: { color: ComeYaColors.primary, fontWeight: "700" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  docUpload: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    backgroundColor: "#FAFAFA",
  },
  docUploadDone: {
    borderColor: ComeYaColors.success,
    borderStyle: "solid",
    backgroundColor: ComeYaColors.success + "10",
  },
  termsText: { textAlign: "center", color: "#888", marginTop: Spacing.md },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  loginText: { color: "rgba(255,255,255,0.8)" },
  loginLinkText: { color: ComeYaColors.primary, fontWeight: "600" },
  vehicleTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vehicleTypeCard: {
    width: "30%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFF",
    alignItems: "center",
  },
  vehicleTypeCardActive: {
    borderColor: ComeYaColors.primary,
    backgroundColor: ComeYaColors.primaryLight,
  },
  photoUpload: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  photoUploadDone: { borderColor: ComeYaColors.success, borderStyle: "solid" },
  photoPreview: { width: "100%", height: "100%", position: "relative" },
  photoImage: { width: "100%", height: "100%", resizeMode: "cover" },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
});
