import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Share,
  Platform,
  Dimensions,
  FlatList,
  TextInput,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { ComeYaLogo } from "@/components/ComeYaLogo";
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
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

const { width: screenWidth } = Dimensions.get("window");

interface FeaturedBusiness {
  id: string;
  name: string;
  image?: string;
  type: string;
  rating: number;
  deliveryTime?: string;
}

const bgImage = require("../../assets/images/autlan-background.jpg");

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme } = useTheme();
  const {
    requestPhoneLogin,
    loginWithPassword,
    loginWithBiometric,
    biometricAvailable,
    biometricType,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  // Default to SMS to avoid "código inválido" before sending code
  const [loginMode, setLoginMode] = useState<"sms" | "password">("sms");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [errors, setErrors] = useState<{
    phone?: string;
    identifier?: string;
    password?: string;
  }>({});
  const [featuredBusinesses, setFeaturedBusinesses] = useState<
    FeaturedBusiness[]
  >([]);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }>({ visible: false, type: "info", title: "", message: "" });

  useEffect(() => {
    fetchFeaturedBusinesses();
    checkBiometricLogin();
  }, []);

  const fetchFeaturedBusinesses = async () => {
    try {
      const res = await apiRequest("GET", "/api/businesses/featured");
      const data = await res.json();
      setFeaturedBusinesses(data.businesses || []);
    } catch (error) {
      console.log("Could not fetch featured businesses");
    }
  };

  const checkBiometricLogin = async () => {
    if (biometricAvailable) {
      const storedPhone = await import(
        "@react-native-async-storage/async-storage"
      ).then((m) => m.default.getItem("@ComeYa_biometric_phone"));
      setShowBiometricOption(!!storedPhone);
    }
  };

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6)
      return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, 9);
    setPhone(numbers);
    if (errors.phone) setErrors({});
  };

  const validate = () => {
    const newErrors: {
      phone?: string;
      identifier?: string;
      password?: string;
    } = {};

    if (loginMode === "sms") {
      if (!phone) {
        newErrors.phone = "El teléfono es requerido";
      } else if (phone.length < 9) {
        newErrors.phone = "Ingresa 9 dígitos";
      }
    } else {
      if (!identifier) {
        newErrors.identifier = "Correo o teléfono es requerido";
      }
      if (!password) {
        newErrors.password = "La contraseña es requerida";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const digits = identifier.replace(/\D/g, "");
      const normalizedPhone =
        digits.length === 9 ? `+34${digits}` : identifier.replace(/\s+/g, "");
      const result = await loginWithPassword(identifier, password);

      if (result?.requiresVerification) {
        setAlertConfig({
          visible: true,
          type: "info",
          title: "Verificación requerida",
          message: "Verifica tu teléfono para continuar",
        });
        setTimeout(() => {
          navigation.navigate("VerifyPhone", { phone: normalizedPhone });
        }, 1500);
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error.message || "Error al iniciar sesión";
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Error de autenticación",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const digits = phone.replace(/\D/g, "");
      const normalizedPhone =
        digits.length === 9 ? `+34${digits}` : `+${digits}`;
      const result = await requestPhoneLogin(normalizedPhone);

      if (result?.userNotFound) {
        setAlertConfig({
          visible: true,
          type: "warning",
          title: "Cuenta no encontrada",
          message: "No encontramos tu cuenta. Regístrate primero.",
        });
        setTimeout(() => {
          navigation.navigate("Signup", { phone: normalizedPhone });
        }, 1500);
        return;
      }

      if (result?.requiresVerification) {
        navigation.navigate("VerifyPhone", { phone: normalizedPhone });
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Error al enviar código",
        message:
          error.message ||
          "No pudimos enviar el código SMS. Intenta nuevamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const success = await loginWithBiometric();
      if (!success) {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Verificación fallida",
          message:
            "No se pudo verificar tu identidad. Intenta con otro método.",
        });
      }
    } catch (error) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Error biométrico",
        message: "Hubo un problema con la autenticación biométrica.",
      });
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Descubre ComeYa - Tu delivery local de confianza en Soria. Pide comida y productos del mercado con un toque. Descarga ahora: https://ComeYa.app",
        title: "ComeYa - Delivery Local",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const getBiometricIcon = () => {
    if (biometricType === "face") return "smile";
    return "lock";
  };

  const getBiometricLabel = () => {
    if (biometricType === "face") return "Face ID";
    return "Huella digital";
  };

  return (
    <ImageBackground
      source={bgImage}
      style={styles.container}
      resizeMode="cover"
    >
      <View
        style={[styles.themeToggleContainer, { top: insets.top + Spacing.md }]}
      >
        <ThemeToggleButton />
      </View>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <ComeYaLogo size={120} />
            <ThemedText type="hero" style={styles.appName}>
              ComeYa
            </ThemedText>
            <ThemedText type="body" style={styles.slogan}>
              tu comida, tu ciudad
            </ThemedText>
          </View>

          <BlurView
            intensity={80}
            tint="light"
            style={[styles.formCard, Shadows.lg]}
          >
            <ThemedText type="h3" style={styles.formTitle}>
              Bienvenido a ComeYa
            </ThemedText>
            <ThemedText type="body" style={styles.formSubtitle}>
              {loginMode === "password"
                ? "Usa tu correo o teléfono con contraseña"
                : "Te enviaremos un código SMS para verificar"}
            </ThemedText>

            {loginMode === "password" ? (
              <>
                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Correo o teléfono
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.identifier ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="user"
                      size={20}
                      color="#666666"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="correo@ejemplo.com o +34..."
                      value={identifier}
                      onChangeText={(text) => {
                        setIdentifier(text);
                        if (errors.identifier)
                          setErrors((prev) => ({ ...prev, identifier: "" }));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholderTextColor="#999999"
                      style={styles.textInput}
                      selectionColor={ComeYaColors.primary}
                      testID="input-identifier"
                    />
                  </View>
                  {errors.identifier ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.identifier}
                    </ThemedText>
                  ) : null}
                </View>

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
                      placeholder="Tu contraseña"
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password)
                          setErrors((prev) => ({ ...prev, password: "" }));
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
              </>
            ) : (
              <View style={styles.inputWrapper}>
                <ThemedText type="small" style={styles.inputLabel}>
                  Número de teléfono
                </ThemedText>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCode}>
                    <ThemedText type="body" style={styles.countryCodeText}>
                      🇪🇸 +34
                    </ThemedText>
                  </View>
                  <View style={styles.inputBox}>
                    <Feather
                      name="phone"
                      size={20}
                      color="#666666"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="612 345 678"
                      value={formatPhoneDisplay(phone)}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      placeholderTextColor="#999999"
                      style={styles.textInput}
                      selectionColor={ComeYaColors.primary}
                      maxLength={11}
                      testID="input-phone"
                    />
                  </View>
                </View>
                {errors.phone ? (
                  <ThemedText type="caption" style={styles.inputError}>
                    {errors.phone}
                  </ThemedText>
                ) : null}
              </View>
            )}

            <Button
              onPress={
                loginMode === "password"
                  ? handlePasswordLogin
                  : handlePhoneLogin
              }
              disabled={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : loginMode === "password" ? (
                "Iniciar sesión"
              ) : (
                "Enviar código SMS"
              )}
            </Button>

            <Pressable
              onPress={() => {
                setLoginMode(loginMode === "password" ? "sms" : "password");
                setErrors({});
              }}
              style={styles.switchModeButton}
            >
              <Feather
                name={loginMode === "password" ? "message-circle" : "key"}
                size={16}
                color={ComeYaColors.primary}
              />
              <ThemedText type="small" style={styles.switchModeText}>
                {loginMode === "password"
                  ? "Iniciar con código SMS"
                  : "Iniciar con contraseña"}
              </ThemedText>
            </Pressable>

            {showBiometricOption && biometricAvailable ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <ThemedText type="caption" style={styles.dividerText}>
                    o usa
                  </ThemedText>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={handleBiometricLogin}
                  disabled={isBiometricLoading}
                  style={[styles.biometricButton, Shadows.sm]}
                  testID="button-biometric"
                >
                  {isBiometricLoading ? (
                    <ActivityIndicator
                      color={ComeYaColors.primary}
                      size="small"
                    />
                  ) : (
                    <>
                      <View style={styles.biometricIcon}>
                        <Feather
                          name={getBiometricIcon()}
                          size={22}
                          color={ComeYaColors.primary}
                        />
                      </View>
                      <ThemedText type="body" style={styles.biometricText}>
                        Entrar con {getBiometricLabel()}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </BlurView>

          {featuredBusinesses.length > 0 ? (
            <View style={styles.featuredSection}>
              <ThemedText type="body" style={styles.featuredTitle}>
                Negocios destacados
              </ThemedText>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={featuredBusinesses}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.featuredList}
                renderItem={({ item }) => (
                  <Pressable style={styles.featuredCard}>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.featuredImage}
                        resizeMode="cover"
                        onError={() => {
                          // Handle image load error silently
                        }}
                      />
                    ) : (
                      <PlaceholderImage
                        width={140}
                        height={100}
                        icon="image"
                        style={styles.featuredImage}
                      />
                    )}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.8)"]}
                      style={styles.featuredGradient}
                    >
                      <ThemedText
                        type="small"
                        style={styles.featuredName}
                        numberOfLines={1}
                      >
                        {item.name}
                      </ThemedText>
                      <View style={styles.featuredMeta}>
                        <Feather
                          name="star"
                          size={12}
                          color={ComeYaColors.primary}
                        />
                        <ThemedText
                          type="caption"
                          style={styles.featuredRating}
                        >
                          {((item.rating || 0) / 10).toFixed(1)}
                        </ThemedText>
                        {item.deliveryTime ? (
                          <ThemedText
                            type="caption"
                            style={styles.featuredTime}
                          >
                            {item.deliveryTime}
                          </ThemedText>
                        ) : null}
                      </View>
                    </LinearGradient>
                  </Pressable>
                )}
              />
            </View>
          ) : null}

          <Pressable onPress={handleShare} style={styles.shareButton}>
            <Feather name="share-2" size={18} color="#FFFFFF" />
            <ThemedText type="small" style={styles.shareText}>
              Compartir ComeYa
            </ThemedText>
          </Pressable>

          <View style={styles.footer}>
            <ThemedText type="body" style={styles.footerText}>
              ¿No tienes cuenta?{" "}
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("Signup")}>
              <ThemedText type="body" style={styles.signupLink}>
                Regístrate
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.contactInfo}>
            <ThemedText type="caption" style={styles.contactText}>
              ¿Problemas para entrar? Llámanos o escríbenos:
            </ThemedText>
            <View style={styles.contactButtons}>
              <Pressable style={styles.contactButton}>
                <Feather name="phone" size={16} color="#FFFFFF" />
                <ThemedText type="caption" style={styles.contactButtonText}>
                  Llamar
                </ThemedText>
              </Pressable>
              <Pressable style={styles.contactButton}>
                <Feather name="message-circle" size={16} color="#FFFFFF" />
                <ThemedText type="caption" style={styles.contactButtonText}>
                  WhatsApp
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  themeToggleContainer: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.sm,
  },
  appName: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  slogan: {
    color: ComeYaColors.primary,
    fontStyle: "italic",
    fontWeight: "500",
  },
  formCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  formTitle: {
    textAlign: "center",
    color: "#333333",
    marginBottom: Spacing.xs,
  },
  formSubtitle: {
    textAlign: "center",
    color: "#666666",
    marginBottom: Spacing.lg,
    fontSize: 14,
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
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: Spacing.md,
    height: 52,
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
  inputBoxError: {
    borderColor: ComeYaColors.error,
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  switchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  switchModeText: {
    color: ComeYaColors.primary,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    color: "#888888",
    marginHorizontal: Spacing.md,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: ComeYaColors.primary,
    gap: Spacing.sm,
  },
  biometricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ComeYaColors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  biometricText: {
    fontWeight: "600",
    color: ComeYaColors.primary,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  shareText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  footerText: {
    color: "rgba(255,255,255,0.8)",
  },
  signupLink: {
    color: ComeYaColors.primary,
    fontWeight: "600",
  },
  contactInfo: {
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  contactText: {
    color: "rgba(255,255,255,0.7)",
    marginBottom: Spacing.sm,
  },
  contactButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  contactButtonText: {
    color: "#FFFFFF",
  },
  featuredSection: {
    marginBottom: Spacing.lg,
  },
  featuredTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
  },
  featuredList: {
    paddingRight: Spacing.md,
    gap: Spacing.md,
  },
  featuredCard: {
    width: 140,
    height: 100,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#333",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  featuredName: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  featuredRating: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  featuredTime: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    marginLeft: 4,
  },
});
