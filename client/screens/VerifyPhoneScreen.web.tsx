import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_BUSINESS_DRAFT_KEY = "@ComeYa_pending_business_draft";
const PENDING_BUSINESS_ONBOARDING_KEY = "@ComeYa_pending_business_onboarding";
const PENDING_DRIVER_ONBOARDING_KEY = "@ComeYa_pending_driver_onboarding";

export default function VerifyPhoneScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const { verifyPhone, resendVerification } = useAuth();
  const phone = route.params?.phone || "";
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 500;

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";

  // UN SOLO campo de código (no 6 celdas): copiar y pegar funciona de forma
  // nativa, igual que el autofill WebOTP de Chrome.
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // WebOTP (Chrome Android): recibe el código SMS automáticamente si el
  // mensaje lleva el formato estándar "@dominio #código"
  useEffect(() => {
    const nav = navigator as any;
    if (!("OTPCredential" in window) || !nav.credentials?.get) return;

    const ac = new AbortController();
    nav.credentials
      .get({ otp: { transport: "sms" }, signal: ac.signal })
      .then((otp: any) => {
        if (otp?.code) {
          const digits = String(otp.code).replace(/\D/g, "").slice(0, 6);
          if (digits.length === 6) {
            setCode(digits);
            setError("");
          }
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // Verificación automática en cuanto los 6 dígitos están completos
  // (autofill WebOTP, pegado manual o escritura)
  const verifyRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (code.length === 6 && !isLoading) {
      verifyRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));
    setError("");
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Ingresa el código completo");
      return;
    }
    setIsLoading(true);
    try {
      const verifiedUser = await verifyPhone(phone, code);
      if (verifiedUser.role === "delivery_driver") {
        await AsyncStorage.setItem(PENDING_DRIVER_ONBOARDING_KEY, "1");
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }
      if (verifiedUser.role === "business_owner") {
        const draftRaw = await AsyncStorage.getItem(PENDING_BUSINESS_DRAFT_KEY);
        const draft = draftRaw ? JSON.parse(draftRaw) : undefined;
        if (draftRaw) await AsyncStorage.removeItem(PENDING_BUSINESS_DRAFT_KEY);
        if (draft) {
          try {
            await apiRequest("POST", "/api/business/create", draft);
          } catch {
            await AsyncStorage.setItem(
              PENDING_BUSINESS_ONBOARDING_KEY,
              JSON.stringify({ openAddModal: true, draft }),
            );
          }
        }
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }
      // Para cualquier otro rol (customer, admin, etc.), navegar a la pantalla principal
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (err: any) {
      setError(err.message || "Código incorrecto");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // El auto-submit del autofill WebOTP siempre usa la versión más reciente
  verifyRef.current = handleVerify;

  const handleResend = async () => {
    if (!canResend) return;
    setIsResending(true);
    try {
      await resendVerification(phone);
      setCountdown(60);
      setCanResend(false);
      setError("");
    } catch {
      setError("Error al reenviar código");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
        <Image
          source={require("../../assets/images/comeya-logo-final.png")}
          style={s.logo}
          contentFit="contain"
        />
        <View
          style={[
            s.iconCircle,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name="smartphone" size={36} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.title, { color: text }]}>Verifica tu teléfono</Text>
        <Text style={[s.subtitle, { color: sub }]}>
          Enviamos un código de 6 dígitos a{"\n"}
          <Text style={{ fontWeight: "700", color: text }}>{phone}</Text>
        </Text>

        <input
          ref={inputRef}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          maxLength={6}
          inputMode="numeric"
          autoFocus
          placeholder="••••••"
          autoComplete="one-time-code"
          style={{
            width: isMobile ? "100%" : 300,
            height: 64,
            borderRadius: 12,
            border: `2px solid ${error ? ComeYaColors.error : code ? ComeYaColors.primary : border}`,
            backgroundColor: card,
            color: text,
            fontSize: isMobile ? 24 : 30,
            fontWeight: "700",
            textAlign: "center",
            letterSpacing: isMobile ? 12 : 18,
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />

        {error ? (
          <Text style={[s.error, { color: ComeYaColors.error }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleVerify}
          disabled={isLoading || code.length !== 6}
          style={[
            s.btn,
            {
              backgroundColor: ComeYaColors.primary,
              opacity: isLoading || code.length !== 6 ? 0.5 : 1,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Verificar</Text>
          )}
        </Pressable>

        <View style={s.resendRow}>
          <Text style={{ color: sub }}>¿No recibiste el código? </Text>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={isResending}>
              {isResending ? (
                <ActivityIndicator size="small" color={ComeYaColors.primary} />
              ) : (
                <Text
                  style={{ color: ComeYaColors.primary, fontWeight: "700" }}
                >
                  Reenviar
                </Text>
              )}
            </Pressable>
          ) : (
            <Text style={{ color: sub }}>{countdown}s</Text>
          )}
        </View>

        <Pressable onPress={() => navigation.goBack()} style={s.backLink}>
          <Feather name="arrow-left" size={16} color={sub} />
          <Text style={{ color: sub, marginLeft: 6 }}>Cambiar número</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%" as any,
    maxWidth: 420,
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  logo: { width: 80, height: 40, marginBottom: 24 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  error: { fontSize: 13, marginTop: 12, marginBottom: 4, textAlign: "center" },
  btn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resendRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  backLink: { flexDirection: "row", alignItems: "center", marginTop: 16 },
});
