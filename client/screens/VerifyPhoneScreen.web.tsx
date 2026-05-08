import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, Text, useWindowDimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
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

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError("");
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: any, index: number) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) { setError("Ingresa el código completo"); return; }
    setIsLoading(true);
    try {
      const verifiedUser = await verifyPhone(phone, fullCode);
      if (verifiedUser.role === "delivery_driver") {
        await AsyncStorage.setItem(PENDING_DRIVER_ONBOARDING_KEY, "1");
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
            await AsyncStorage.setItem(PENDING_BUSINESS_ONBOARDING_KEY, JSON.stringify({ openAddModal: true, draft }));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Código incorrecto");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

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
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="smartphone" size={36} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.title, { color: text }]}>Verifica tu teléfono</Text>
        <Text style={[s.subtitle, { color: sub }]}>
          Enviamos un código de 6 dígitos a{"\n"}
          <Text style={{ fontWeight: "700", color: text }}>{phone}</Text>
        </Text>

        <View style={s.codeRow}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              value={digit}
              onChange={e => handleCodeChange(e.target.value, i)}
              onKeyDown={e => handleKeyDown(e, i)}
              maxLength={1}
              inputMode="numeric"
              style={{
                width: isMobile ? Math.floor((screenWidth - 80) / 6) : 56,
                height: isMobile ? Math.floor((screenWidth - 80) / 6) : 64,
                borderRadius: 12,
                border: `2px solid ${error ? ComeYaColors.error : digit ? ComeYaColors.primary : border}`,
                backgroundColor: card, color: text,
                fontSize: isMobile ? 20 : 28, fontWeight: "700", textAlign: "center",
                outline: "none", transition: "border-color 0.2s",
                flexShrink: 0,
              }}
            />
          ))}
        </View>

        {error ? <Text style={[s.error, { color: ComeYaColors.error }]}>{error}</Text> : null}

        <Pressable
          onPress={handleVerify}
          disabled={isLoading || code.some(d => !d) || code.join("").length !== 6}
          style={[s.btn, { backgroundColor: ComeYaColors.primary, opacity: isLoading || code.some(d => !d) ? 0.5 : 1 }]}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Verificar</Text>
          }
        </Pressable>

        <View style={s.resendRow}>
          <Text style={{ color: sub }}>¿No recibiste el código? </Text>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={isResending}>
              {isResending
                ? <ActivityIndicator size="small" color={ComeYaColors.primary} />
                : <Text style={{ color: ComeYaColors.primary, fontWeight: "700" }}>Reenviar</Text>
              }
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
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  card: { width: "100%" as any, maxWidth: 420, padding: 32, borderRadius: 24, borderWidth: 1, alignItems: "center" },
  logo: { width: 80, height: 40, marginBottom: 24 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center", width: "100%" as any },
  error: { fontSize: 13, marginBottom: 12, textAlign: "center" },
  btn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resendRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  backLink: { flexDirection: "row", alignItems: "center", marginTop: 16 },
});
