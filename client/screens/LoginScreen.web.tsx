import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, Pressable, ActivityIndicator,
  TextInput, Text, ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };

// Rojo para versión web
const PRIMARY = "#DC2626"; // Rojo profesional

export default function LoginScreen({ navigation }: Props) {
  const { requestPhoneLogin, loginWithPassword } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"sms" | "password">("sms");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [featuredBusinesses, setFeaturedBusinesses] = useState<any[]>([]);
  const { isMobile } = useResponsive();

  useEffect(() => {
    apiRequest("GET", "/api/business/featured").then(r => r.json())
      .then(d => setFeaturedBusinesses(d.businesses?.slice(0, 4) || []))
      .catch(() => {});
  }, []);

  const handleSMS = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      showToast("Ingresa un número válido", "error"); return;
    }
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const formatted = digits.startsWith("34") ? `+${digits}` : digits.length === 9 ? `+34${digits}` : `+${digits}`;
      const result = await requestPhoneLogin(formatted);
      if (result?.userNotFound) {
        showToast("Cuenta no encontrada. Regístrate primero.", "warning");
        setTimeout(() => navigation.navigate("Signup", { phone: formatted }), 1000);
        return;
      }
      if (result?.requiresVerification) navigation.navigate("VerifyPhone", { phone: formatted });
    } catch (e: any) {
      showToast(e.message || "Error al enviar código", "error");
    } finally { setLoading(false); }
  };

  const handlePassword = async () => {
    if (!identifier || !password) { showToast("Completa todos los campos", "error"); return; }
    setLoading(true);
    try {
      const result = await loginWithPassword(identifier, password);
      if (result?.requiresVerification) {
        const digits = identifier.replace(/\D/g, "");
        const formatted = digits.length === 9 ? `+34${digits}` : identifier;
        navigation.navigate("VerifyPhone", { phone: formatted });
      }
    } catch (e: any) {
      showToast(e.message || "Credenciales incorrectas", "error");
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.root}>
      {/* IZQUIERDA/ARRIBA — Branding Hero */}
      <View style={s.left}>
        <View style={s.leftInner}>
          <View style={s.logoRow}>
            <View style={s.logoCircle}>
              <ComeYaLogo size={48} style={s.logoImage} />
            </View>
            <Text style={s.logoText}>ComeYa</Text>
          </View>
          <Text style={[s.headline, isMobile && { fontSize: 28, lineHeight: 34, marginBottom: 12 }]}>Tu comida favorita,{"\n"}en tu puerta</Text>
          <Text style={[s.subheadline, isMobile && { fontSize: 14, lineHeight: 20, marginBottom: 20 }]}>
            Los mejores restaurantes y negocios locales de Soria, a un clic de distancia.
          </Text>
          {featuredBusinesses.length > 0 && (
            <View style={s.bizGrid}>
              {featuredBusinesses.map((b) => (
                <View key={b.id} style={s.bizCard}>
                  <Image source={{ uri: b.image }} style={s.bizImg} contentFit="cover" />
                  <View style={s.bizOverlay}>
                    <Text style={s.bizName} numberOfLines={1}>{b.name}</Text>
                    <Text style={s.bizRating}>★ {(b.rating / 10).toFixed(1)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={[s.stats, isMobile && { gap: 24 }]}>
            {[["50+", "Negocios"], ["30min", "Entrega promedio"], ["4.8★", "Valoración"]].map(([n, l]) => (
              <View key={l} style={s.stat}>
                <Text style={[s.statN, isMobile && { fontSize: 20 }]}>{n}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ABAJO/DERECHA — Formulario */}
      <View style={s.right}>
        <View style={s.formContainer}>
          <View style={s.formCard}>
            <Text style={s.formTitle}>Bienvenido de vuelta</Text>
            <Text style={s.formSub}>
              {mode === "sms" ? "Ingresa tu número para recibir un código" : "Ingresa tus credenciales"}
            </Text>

            {/* Toggle modo */}
            <View style={s.modeRow}>
              {(["sms", "password"] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[s.modeBtn, mode === m && s.modeBtnActive]}>
                  <Text style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>
                    {m === "sms" ? "📱 SMS" : "🔑 Contraseña"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "sms" ? (
              <View style={s.field}>
                <Text style={s.label}>Número de teléfono</Text>
                <View style={s.inputRow}>
                  <View style={s.prefix}><Text style={s.prefixText}>🇪🇸 +34</Text></View>
                  <TextInput
                    style={s.input}
                    placeholder="612 345 678"
                    placeholderTextColor="#999"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={s.field}>
                  <Text style={s.label}>Correo electrónico o teléfono</Text>
                  <TextInput
                    style={[s.input, s.inputFull]}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="#999"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={s.field}>
                  <View style={s.labelRow}>
                    <Text style={s.label}>Contraseña</Text>
                    <Pressable onPress={() => {}}>
                      <Text style={s.forgotLink}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                  </View>
                  <View style={s.inputRow}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      placeholder="Tu contraseña"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                    />
                    <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                      <Feather name={showPass ? "eye-off" : "eye"} size={20} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            <Pressable
              style={[s.submitBtn, loading && { opacity: 0.7 }]}
              onPress={mode === "sms" ? handleSMS : handlePassword}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{mode === "sms" ? "Enviar código" : "Iniciar sesión"}</Text>
              }
            </Pressable>

            <View style={s.dividerRow}>
              <View style={s.divLine} />
              <Text style={s.divText}>o</Text>
              <View style={s.divLine} />
            </View>

            <Pressable style={s.registerBtn} onPress={() => navigation.navigate("Signup")}>
              <Text style={s.registerText}>Crear cuenta nueva</Text>
            </Pressable>

            <Text style={s.legal}>
              Al continuar, aceptas nuestros{" "}
              <Text style={s.legalLink} onPress={() => navigation.navigate("Terms" as any)}>Términos de Servicio</Text>
              {" "}y{" "}
              <Text style={s.legalLink} onPress={() => navigation.navigate("Privacy" as any)}>Política de Privacidad</Text>
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { 
    flex: 1, 
    flexDirection: "row", 
    backgroundColor: "#fff", 
    minHeight: "100vh" as any,
    flexWrap: "wrap" as any,
  },

  // IZQUIERDA/ARRIBA — Hero Section
  left: { 
    flex: 1,
    minWidth: 300,
    maxWidth: 600,
    backgroundColor: PRIMARY,
    position: "relative" as any,
  },
  leftInner: { 
    padding: 28,
    maxWidth: 600,
    margin: "auto" as any,
  },
  logoRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 24, 
    gap: 16,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center" as any,
    alignItems: "center" as any,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  logoText: { 
    fontSize: 36, 
    fontWeight: "900", 
    color: "#fff", 
    letterSpacing: -1,
  },
  headline: { 
    fontSize: 48, 
    fontWeight: "900", 
    color: "#fff", 
    lineHeight: 56, 
    marginBottom: 24, 
    letterSpacing: -1.5,
  },
  subheadline: { 
    fontSize: 20, 
    color: "rgba(255,255,255,0.9)", 
    lineHeight: 32, 
    marginBottom: 48,
    fontWeight: "400",
  },
  bizGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 16, 
    marginBottom: 48,
  },
  bizCard: { 
    width: "calc(50% - 8px)" as any,
    aspectRatio: 1.4,
    borderRadius: 16, 
    overflow: "hidden", 
    backgroundColor: "rgba(255,255,255,0.1)",
    position: "relative" as any,
  },
  bizImg: { 
    width: "100%" as any, 
    height: "100%" as any,
  },
  bizOverlay: {
    position: "absolute" as any,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" as any,
  },
  bizName: { 
    fontSize: 14, 
    color: "#fff", 
    fontWeight: "700",
    marginBottom: 4,
  },
  bizRating: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  stats: { 
    flexDirection: "row", 
    gap: 56,
  },
  stat: { 
    alignItems: "flex-start",
  },
  statN: { 
    fontSize: 32, 
    fontWeight: "900", 
    color: "#fff", 
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  statL: { 
    fontSize: 14, 
    color: "rgba(255,255,255,0.8)", 
    fontWeight: "500",
  },

  // DERECHA/ABAJO — Form Container
  right: { 
    flex: 1,
    minWidth: 300,
    backgroundColor: "#fafafa",
    display: "flex" as any,
    alignItems: "center" as any,
    justifyContent: "center" as any,
  },
  formContainer: {
    width: "100%" as any,
    maxWidth: 480,
    padding: 32,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  formTitle: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#1a1a1a", 
    marginBottom: 8, 
    letterSpacing: -0.5,
  },
  formSub: { 
    fontSize: 15, 
    color: "#666", 
    marginBottom: 32, 
    lineHeight: 22,
  },
  modeRow: { 
    flexDirection: "row", 
    backgroundColor: "#f5f5f5", 
    borderRadius: 12, 
    padding: 4, 
    marginBottom: 24,
  },
  modeBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: "center",
  },
  modeBtnActive: { 
    backgroundColor: "#fff", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 4,
  },
  modeBtnText: { 
    fontSize: 14, 
    color: "#666", 
    fontWeight: "600",
  },
  modeBtnTextActive: { 
    color: PRIMARY, 
    fontWeight: "700",
  },
  field: { 
    marginBottom: 20,
  },
  label: { 
    fontSize: 14, 
    fontWeight: "600", 
    color: "#1a1a1a", 
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "600",
  },
  inputRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderWidth: 1.5, 
    borderColor: "#e0e0e0", 
    borderRadius: 10, 
    backgroundColor: "#fff",
    height: 48,
  },
  prefix: { 
    paddingHorizontal: 14, 
    height: "100%" as any,
    justifyContent: "center" as any,
    backgroundColor: "#f8f8f8", 
    borderRightWidth: 1.5, 
    borderRightColor: "#e0e0e0",
  },
  prefixText: { 
    fontSize: 14, 
    color: "#1a1a1a", 
    fontWeight: "600",
  },
  input: { 
    flex: 1, 
    paddingHorizontal: 14, 
    height: 48,
    fontSize: 15, 
    color: "#1a1a1a", 
    outlineStyle: "none",
  } as any,
  inputFull: { 
    borderWidth: 1.5, 
    borderColor: "#e0e0e0", 
    borderRadius: 10, 
    backgroundColor: "#fff",
    paddingHorizontal: 14,
  },
  eyeBtn: { 
    paddingHorizontal: 14,
    height: "100%" as any,
    justifyContent: "center" as any,
  },
  submitBtn: { 
    backgroundColor: PRIMARY, 
    borderRadius: 10, 
    height: 48,
    alignItems: "center", 
    justifyContent: "center" as any,
    marginTop: 8, 
    marginBottom: 24,
  },
  submitText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "700",
  },
  dividerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 16, 
    marginBottom: 24,
  },
  divLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: "#e0e0e0",
  },
  divText: { 
    fontSize: 13, 
    color: "#999", 
    fontWeight: "500",
  },
  registerBtn: { 
    borderWidth: 1.5, 
    borderColor: "#e0e0e0", 
    borderRadius: 10, 
    height: 48,
    alignItems: "center", 
    justifyContent: "center" as any,
    marginBottom: 24,
    backgroundColor: "#fff",
  },
  registerText: { 
    color: "#1a1a1a", 
    fontSize: 15, 
    fontWeight: "600",
  },
  legal: { 
    fontSize: 12, 
    color: "#999", 
    textAlign: "center", 
    lineHeight: 18,
  },
  legalLink: { 
    color: PRIMARY, 
    fontWeight: "600",
  },
});
