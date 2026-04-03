import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Share,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { UserRole } from "@/types";
import { useToast } from "@/contexts/ToastContext";

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
  { id: "bakery", name: "Panaderia" },
  { id: "grocery", name: "Abarrotes" },
  { id: "pharmacy", name: "Farmacia" },
  { id: "other", name: "Otro" },
];

export default function SignupScreen({ navigation, route }: SignupScreenProps) {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const initialPhone = route.params?.phone || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  const [role, setRole] = useState<UserRole>("customer");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUserExistsModal, setShowUserExistsModal] = useState(false);

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 4) return numbers;
    if (numbers.length <= 7)
      return `${numbers.slice(0, 4)} ${numbers.slice(4)}`;
    return `${numbers.slice(0, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, 11);
    setPhone(numbers);
    if (role === "business_owner" && !businessPhone) {
      setBusinessPhone(numbers);
    }
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
  };

  const validateEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (email.trim() && !validateEmail(email)) {
      newErrors.email = "Ingresa un correo válido";
    }

    if (!password) {
      newErrors.password = "La contraseña es requerida";
    } else if (password.length < 8) {
      newErrors.password = "Mínimo 8 caracteres";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    if (!phone) {
      newErrors.phone = "El teléfono es requerido";
    } else if (phone.length < 11) {
      newErrors.phone = "Ingresa 11 dígitos";
    }

    if (role === "business_owner") {
      if (!businessName.trim()) {
        newErrors.businessName = "El nombre del negocio es requerido";
      }
      if (!businessAddress.trim()) {
        newErrors.businessAddress = "La direccion es requerida";
      }
      if (!businessType) {
        newErrors.businessType = "Selecciona el tipo de negocio";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+58${phone}`;
      const result = await signup(
        name,
        role,
        formattedPhone,
        email.trim() ? email : undefined,
        password,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result?.requiresVerification) {
        if (role === "business_owner") {
          await AsyncStorage.setItem(
            PENDING_BUSINESS_DRAFT_KEY,
            JSON.stringify({
              name: businessName.trim(),
              type: businessType,
              address: businessAddress.trim(),
              phone: businessPhone.trim() || formattedPhone,
            })
          );
        }
        navigation.navigate("VerifyPhone", { phone: formattedPhone });
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error.message?.includes("already") || error.message?.includes("existe")) {
        setShowUserExistsModal(true);
      } else {
        setErrors({ email: error.message || "Error al crear la cuenta" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Descubre ComeYa - Tu delivery local de confianza en San Cristóbal. Pide comida y productos del mercado con un toque. Descarga ahora: https://ComeYa.app",
        title: "ComeYa - Delivery Local",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

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
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <View style={styles.backButtonCircle}>
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </View>
            </Pressable>
            <ThemedText type="hero" style={styles.title}>
              Crear cuenta
            </ThemedText>
            <ThemedText type="body" style={styles.subtitle}>
              Registra tu correo, telefono y contrasena
            </ThemedText>
          </View>

          <View style={[styles.formCard, Shadows.lg]}>
            <Input
              label="Nombre completo"
              placeholder="Tu nombre"
              leftIcon="user"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
              testID="input-name"
            />

            <Input
              label="Correo electrónico (opcional)"
              placeholder="tu@email.com"
              leftIcon="mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              testID="input-email"
            />

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Contraseña
              </ThemedText>
              <View
                style={[
                  styles.inputBox,
                  errors.password ? styles.inputBoxError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={20}
                  color="#666666"
                  style={styles.inputBoxIcon}
                />
                <TextInput
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#999999"
                  style={styles.textInput}
                  selectionColor={ComeYaColors.primary}
                  testID="input-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#666666"
                  />
                </Pressable>
              </View>
              {errors.password ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.password}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Confirmar contraseña
              </ThemedText>
              <View
                style={[
                  styles.inputBox,
                  errors.confirmPassword ? styles.inputBoxError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={20}
                  color="#666666"
                  style={styles.inputBoxIcon}
                />
                <TextInput
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#999999"
                  style={styles.textInput}
                  selectionColor={ComeYaColors.primary}
                  testID="input-confirm-password"
                />
              </View>
              {errors.confirmPassword ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.confirmPassword}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Número de teléfono
              </ThemedText>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCode}>
                  <ThemedText type="body" style={styles.countryCodeText}>
                    +58
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
                    size={20}
                    color="#666666"
                    style={styles.inputBoxIcon}
                  />
                  <TextInput
                    placeholder="0414 123 4567"
                    value={formatPhoneDisplay(phone)}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholderTextColor="#999999"
                    style={styles.textInput}
                    selectionColor={ComeYaColors.primary}
                    maxLength={13}
                  />
                </View>
              </View>
              {errors.phone ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.phone}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" style={styles.phoneHint}>
                Te enviaremos un SMS para verificar tu número
              </ThemedText>
            </View>

            {role === "business_owner" ? (
              <>
                <ThemedText type="small" style={styles.inlineSectionTitle}>
                  Datos del negocio
                </ThemedText>
                <ThemedText type="caption" style={styles.inlineSectionNote}>
                  Solo lo esencial para empezar. Podras completar mas datos despues.
                </ThemedText>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Nombre del negocio
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.businessName ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={20}
                      color="#666666"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Ej: Taqueria El Centro"
                      value={businessName}
                      onChangeText={(text) => {
                        setBusinessName(text);
                        if (errors.businessName) {
                          setErrors((prev) => ({ ...prev, businessName: "" }));
                        }
                      }}
                      placeholderTextColor="#999999"
                      style={styles.textInput}
                      selectionColor={ComeYaColors.primary}
                    />
                  </View>
                  {errors.businessName ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessName}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Tipo de negocio
                  </ThemedText>
                  <View style={styles.businessTypeRow}>
                    {BUSINESS_TYPES.map((type) => (
                      <Pressable
                        key={type.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setBusinessType(type.id);
                          if (errors.businessType) {
                            setErrors((prev) => ({ ...prev, businessType: "" }));
                          }
                        }}
                        style={[
                          styles.businessTypeChip,
                          businessType === type.id && styles.businessTypeChipActive,
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={
                            businessType === type.id
                              ? styles.businessTypeChipTextActive
                              : styles.businessTypeChipText
                          }
                        >
                          {type.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  {errors.businessType ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessType}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Direccion
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.businessAddress ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="map-pin"
                      size={20}
                      color="#666666"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Calle y numero"
                      value={businessAddress}
                      onChangeText={(text) => {
                        setBusinessAddress(text);
                        if (errors.businessAddress) {
                          setErrors((prev) => ({ ...prev, businessAddress: "" }));
                        }
                      }}
                      placeholderTextColor="#999999"
                      style={styles.textInput}
                      selectionColor={ComeYaColors.primary}
                    />
                  </View>
                  {errors.businessAddress ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessAddress}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Telefono del negocio (opcional)
                  </ThemedText>
                  <View style={styles.inputBox}>
                    <Feather
                      name="phone"
                      size={20}
                      color="#666666"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Ej: 317 123 4567"
                      value={formatPhoneDisplay(businessPhone)}
                      onChangeText={(text) => setBusinessPhone(text.replace(/\D/g, "").slice(0, 11))}
                      keyboardType="phone-pad"
                      placeholderTextColor="#999999"
                      style={styles.textInput}
                      selectionColor={ComeYaColors.primary}
                      maxLength={13}
                    />
                  </View>
                </View>
              </>
            ) : null}

            <ThemedText type="small" style={styles.roleLabel}>
              ¿Cómo quieres usar ComeYa?
            </ThemedText>
            <View style={styles.rolesContainer}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRole(r.value);
                  }}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor:
                        role === r.value ? ComeYaColors.primaryLight : "#F5F5F5",
                      borderColor:
                        role === r.value ? ComeYaColors.primary : "#E0E0E0",
                      borderWidth: role === r.value ? 2 : 1,
                    },
                  ]}
                  testID={`role-${r.value}`}
                >
                  <View
                    style={[
                      styles.roleIcon,
                      {
                        backgroundColor:
                          role === r.value ? ComeYaColors.primary : "#E0E0E0",
                      },
                    ]}
                  >
                    <Feather
                      name={r.icon}
                      size={22}
                      color={role === r.value ? "#FFFFFF" : "#666666"}
                    />
                  </View>
                  <ThemedText
                    type="small"
                    style={{
                      fontWeight: "600",
                      textAlign: "center",
                      color: "#333333",
                    }}
                  >
                    {r.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: "#666666",
                      textAlign: "center",
                      fontSize: 10,
                    }}
                  >
                    {r.description}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {role === "delivery_driver" ? (
              <ThemedText type="caption" style={styles.roleInlineNote}>
                Repartidor: INE, selfie, licencia, vehiculo, placas, CLABE y contacto de emergencia.
              </ThemedText>
            ) : null}

            <Button
              onPress={handleSignup}
              disabled={isLoading}
              style={styles.signupButton}
              testID="button-signup"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                "Crear cuenta"
              )}
            </Button>

            <ThemedText type="caption" style={styles.termsText}>
              Al registrarte aceptas nuestros términos y condiciones
            </ThemedText>
          </View>

          <ConfirmModal
            visible={showUserExistsModal}
            title="Cuenta ya registrada"
            message="Este correo o telefono ya esta registrado. Inicia sesion para continuar."
            confirmText="Ir a iniciar sesion"
            cancelText="Cerrar"
            onConfirm={() => {
              setShowUserExistsModal(false);
              navigation.navigate("Login");
            }}
            onCancel={() => setShowUserExistsModal(false)}
          />

          <Pressable onPress={handleShare} style={styles.shareButton}>
            <Feather name="share-2" size={18} color="#FFFFFF" />
            <ThemedText type="small" style={styles.shareText}>
              Compartir ComeYa
            </ThemedText>
          </Pressable>

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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.md,
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    textShadow: "1px 1px 3px rgba(0,0,0,0.5)",
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    marginTop: Spacing.xs,
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputWrapper: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: "#333333",
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  phoneInputContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryCode: {
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    height: 52,
  },
  countryCodeText: {
    color: "#333333",
    fontWeight: "600",
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputBoxError: {
    borderColor: ComeYaColors.error,
  },
  inputBoxIcon: {
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#333333",
    letterSpacing: 1,
  },
  inputError: {
    color: ComeYaColors.error,
    marginTop: Spacing.xs,
  },
  phoneHint: {
    color: "#888888",
    marginTop: Spacing.xs,
  },
  roleLabel: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    color: "#333333",
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
  inlineSectionTitle: {
    fontWeight: "700",
    marginBottom: Spacing.xs,
    color: "#2A225E",
  },
  inlineSectionNote: {
    color: "#5D5A78",
    marginBottom: Spacing.sm,
  },
  roleInlineNote: {
    color: "#5D5A78",
    marginBottom: Spacing.md,
  },
  businessTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  businessTypeChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#D9D7E8",
    backgroundColor: "#FFFFFF",
  },
  businessTypeChipActive: {
    borderColor: ComeYaColors.primary,
    backgroundColor: ComeYaColors.primaryLight,
  },
  businessTypeChipText: {
    color: "#5D5A78",
    fontWeight: "600",
  },
  businessTypeChipTextActive: {
    color: ComeYaColors.primary,
    fontWeight: "700",
  },
  signupButton: {
    marginTop: Spacing.xs,
  },
  termsText: {
    textAlign: "center",
    color: "#888888",
    marginTop: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  shareText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginText: {
    color: "rgba(255,255,255,0.8)",
  },
  loginLinkText: {
    color: ComeYaColors.primary,
    fontWeight: "600",
  },
});
