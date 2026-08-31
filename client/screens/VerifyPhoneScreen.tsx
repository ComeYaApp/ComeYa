import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

const PENDING_BUSINESS_DRAFT_KEY = "@ComeYa_pending_business_draft";
const PENDING_BUSINESS_ONBOARDING_KEY = "@ComeYa_pending_business_onboarding";
const PENDING_DRIVER_ONBOARDING_KEY = "@ComeYa_pending_driver_onboarding";

type VerifyPhoneScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "VerifyPhone">;
  route: RouteProp<RootStackParamList, "VerifyPhone">;
};

export default function VerifyPhoneScreen({
  navigation,
  route,
}: VerifyPhoneScreenProps) {
  const { theme } = useTheme();
  const { verifyPhone, resendVerification } = useAuth();
  const insets = useSafeAreaInsets();
  const phone = route.params?.phone || "";

  // UN SOLO campo de código (no 6 celdas): el pegado funciona de forma
  // nativa en iOS y Android, igual que la sugerencia SMS del sistema. Las
  // cajas de detrás son solo decoración.
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError("");
  };

  // ── Autollenado del código SMS ────────────────────────────────────────────
  // Rellena los 6 dígitos y verifica automáticamente. Lo usan tanto la
  // sugerencia del sistema (textContentType="oneTimeCode") como la lectura
  // del portapapeles al volver a la app (patrón estándar de Uber/Rappi).
  const applyCode = (fullCode: string) => {
    const digits = fullCode.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) return false;
    setCode(digits);
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Auto-submit: el efecto de abajo detecta el código completo
    return true;
  };

  // Lectura del portapapeles al volver a la app: si el SMS se copió (muchos
  // clientes de SMS lo hacen), el código se detecta solo
  const lastClipboardCode = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === "web") return;

    const checkClipboard = async () => {
      try {
        const Clipboard = await import("expo-clipboard");
        const hasString = await Clipboard.hasStringAsync();
        if (!hasString) return;
        const text = (await Clipboard.getStringAsync()) || "";
        const match = text.match(/\b(\d{6})\b/);
        if (!match) return;
        const smsCode = match[1];
        if (smsCode === lastClipboardCode.current) return; // ya aplicado
        if (code === smsCode) return; // ya escrito
        lastClipboardCode.current = smsCode;
        applyCode(smsCode);
      } catch {
        // sin permiso de portapapeles — se ignora silenciosamente
      }
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkClipboard();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Ingresa el código completo");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const verifiedUser = await verifyPhone(phone, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (verifiedUser.role === "delivery_driver") {
        await AsyncStorage.setItem(PENDING_DRIVER_ONBOARDING_KEY, "1");
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }

      if (verifiedUser.role === "business_owner") {
        const draftRaw = await AsyncStorage.getItem(PENDING_BUSINESS_DRAFT_KEY);
        const draft = draftRaw ? JSON.parse(draftRaw) : undefined;
        if (draftRaw) {
          await AsyncStorage.removeItem(PENDING_BUSINESS_DRAFT_KEY);
        }
        if (draft) {
          try {
            await apiRequest("POST", "/api/business/create", {
              name: draft.name,
              type: draft.type,
              address: draft.address,
              phone: draft.phone,
            });
          } catch (createError) {
            await AsyncStorage.setItem(
              PENDING_BUSINESS_ONBOARDING_KEY,
              JSON.stringify({ openAddModal: true, draft }),
            );
            navigation.reset({ index: 0, routes: [{ name: "Main" }] });
            return;
          }
        }
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }

      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const rawMessage = error.message || "";
      if (rawMessage.toLowerCase().includes("expired") || rawMessage.toLowerCase().includes("expirado")) {
        setError("El código ha expirado. Solicita uno nuevo.");
      } else if (rawMessage.toLowerCase().includes("invalid") || rawMessage.toLowerCase().includes("incorrecto") || rawMessage.toLowerCase().includes("inválido")) {
        setError("Código incorrecto. Verifica e intenta de nuevo.");
      } else if (rawMessage.toLowerCase().includes("not found") || rawMessage.toLowerCase().includes("no encontrado")) {
        setError("Número no registrado. Crea una cuenta primero.");
      } else if (rawMessage.toLowerCase().includes("network") || rawMessage.toLowerCase().includes("fetch") || rawMessage.toLowerCase().includes("connection")) {
        setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
      } else {
        setError(rawMessage || "Error al verificar. Intenta de nuevo.");
      }
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit cuando los 6 dígitos están completos (autofill SMS,
  // portapapeles o pegado manual). Un solo efecto, sin duplicados.
  useEffect(() => {
    if (code.length === 6 && !isLoading) {
      Keyboard.dismiss();
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await resendVerification(phone);
      setCountdown(60);
      setCanResend(false);
      setError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setError("Error al reenviar codigo");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsResending(false);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: ComeYaColors.primaryLight },
            ]}
          >
            <Feather name="smartphone" size={48} color={ComeYaColors.primary} />
          </View>
        </View>

        <ThemedText type="hero" style={styles.title}>
          Verifica tu telefono
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          Enviamos un código de 6 dígitos a{"\n"}
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {formatPhone(phone)}
          </ThemedText>
        </ThemedText>

        {/* Cajas decorativas + UN campo real encima (pegado nativo) */}
        <View style={styles.codeContainer}>
          <View style={styles.codeBoxes}>
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: error
                      ? ComeYaColors.error
                      : code[index]
                        ? ComeYaColors.primary
                        : theme.border,
                  },
                ]}
              >
                <ThemedText type="h3" style={{ color: theme.text }}>
                  {code[index] || ""}
                </ThemedText>
              </View>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={6}
            selectTextOnFocus
            autoFocus
            caretHidden
            // Autollenado del código SMS: iOS muestra la sugerencia del
            // sistema sobre el teclado; Android autocompleta con sms-otp
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={styles.hiddenInput}
            testID="code-input"
          />
        </View>

        {error ? (
          <ThemedText
            type="small"
            style={[styles.error, { color: ComeYaColors.error }]}
          >
            {error}
          </ThemedText>
        ) : null}

        <Button
          onPress={handleVerify}
          disabled={isLoading || code.length !== 6}
          style={styles.verifyButton}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Verificar"
          )}
        </Button>

        <View style={styles.resendContainer}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            ¿No recibiste el codigo?{" "}
          </ThemedText>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={isResending}>
              {isResending ? (
                <ActivityIndicator size="small" color={ComeYaColors.primary} />
              ) : (
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, fontWeight: "600" }}
                >
                  Reenviar
                </ThemedText>
              )}
            </Pressable>
          ) : (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {countdown}s
            </ThemedText>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.xl,
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  codeContainer: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  codeBoxes: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  // El campo real es invisible y cubre las cajas: recibe el foco, el
  // teclado numérico y — lo importante — el PEGADO y el autofill del SMS
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  error: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  verifyButton: {
    marginTop: Spacing.xl,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
});
