import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, Pressable, ActivityIndicator,
  TextInput, ScrollView, Text,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };

const PRIMARY = ComeYaColors.primary;

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

  useEffect(() => {
    apiRequest("GET", "/api/businesses/featured").then(r => r.json())
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
    <View style={s.root}>
      {/* IZQUIERDA — Branding */}
      <View style={s.left}>
        <View style={s.leftInner}>
          <View style={s.logoRow}>
            <View style={s.logoCircle}>
              <Text style={s.logoEmoji}>🐰</Text>
            </View>
            <Text style={s.logoText}>ComeYa</Text>
          </View>
          <Text style={s.headline}>Tu comida favorita,{"\n"}en tu puerta</Text>
          <Text style={s.subheadline}>
            Los mejores restaurantes y negocios locales de Soria, a un clic de distancia.
          </Text>

          {/* Negocios destacados */}
          {featuredBusinesses.length > 0 && (
            <View style={s.bizGrid}>
              {featuredBusinesses.map((b) => (
                <View key={b.id} style={s.bizCard}>
                  <Image source={{ uri: b.image }} style={s.bizImg} contentFit="cover" />
                  <Text style={s.bizName} numberOfLines={1}>{b.name}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.stats}>
            {[["50+", "Negocios"], ["30min", "Entrega"], ["4.8★", "Valoración"]].map(([n, l]) => (
              <View key={l} style={s.stat}>
                <Text style={s.statN}>{n}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* DERECHA — Formulario */}
      <View style={s.right}>
        <ScrollView contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.formTitle}>Bienvenido</Text>
          <Text style={s.formSub}>
            {mode === "sms" ? "Entra con tu número de teléfono" : "Entra con tu correo y contraseña"}
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
              <Text style={s.label}>Teléfono</Text>
              <View style={s.inputRow}>
                <View style={s.prefix}><Text style={s.prefixText}>🇪🇸 +34</Text></View>
                <TextInput
                  style={s.input}
                  placeholder="612 345 678"
                  placeholderTextColor="#aaa"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          ) : (
            <>
              <View style={s.field}>
                <Text style={s.label}>Correo o teléfono</Text>
                <TextInput
                  style={[s.input, s.inputFull]}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#aaa"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Contraseña</Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Tu contraseña"
                    placeholderTextColor="#aaa"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                    <Feather name={showPass ? "eye-off" : "eye"} size={18} color="#666" />
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
              : <Text style={s.submitText}>{mode === "sms" ? "Enviar código SMS" : "Iniciar sesión"}</Text>
            }
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.divLine} />
            <Text style={s.divText}>¿No tienes cuenta?</Text>
            <View style={s.divLine} />
          </View>

          <Pressable style={s.registerBtn} onPress={() => navigation.navigate("Signup")}>
            <Text style={s.registerText}>Crear cuenta gratis</Text>
          </Pressable>

          <Text style={s.legal}>
            Al continuar aceptas nuestros{" "}
            <Text style={s.legalLink} onPress={() => navigation.navigate("Terms" as any)}>Términos</Text>
            {" "}y{" "}
            <Text style={s.legalLink} onPress={() => navigation.navigate("Privacy" as any)}>Privacidad</Text>
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#fff" },

  // Izquierda
  left: { flex: 1, backgroundColor: PRIMARY },
  leftInner: { flex: 1, padding: 48, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 32, gap: 12 },
  logoCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  logoEmoji: { fontSize: 26 },
  logoText: { fontSize: 28, fontWeight: "900", color: "#fff" },
  headline: { fontSize: 36, fontWeight: "900", color: "#fff", lineHeight: 44, marginBottom: 16 },
  subheadline: { fontSize: 16, color: "rgba(255,255,255,0.8)", lineHeight: 24, marginBottom: 32 },
  bizGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 32 },
  bizCard: { width: 120, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.15)" },
  bizImg: { width: 120, height: 80 },
  bizName: { fontSize: 11, color: "#fff", fontWeight: "600", padding: 6 },
  stats: { flexDirection: "row", gap: 32 },
  stat: { alignItems: "center" },
  statN: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statL: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  // Derecha
  right: { width: 440, backgroundColor: "#fff" },
  formScroll: { padding: 48, justifyContent: "center", minHeight: "100%" as any },
  formTitle: { fontSize: 28, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  formSub: { fontSize: 15, color: "#666", marginBottom: 28 },
  modeRow: { flexDirection: "row", backgroundColor: "#f5f5f5", borderRadius: 10, padding: 4, marginBottom: 24 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 14, color: "#666", fontWeight: "600" },
  modeBtnTextActive: { color: PRIMARY },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 10, backgroundColor: "#fafafa", overflow: "hidden" },
  prefix: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#f0f0f0", borderRightWidth: 1, borderRightColor: "#e0e0e0" },
  prefixText: { fontSize: 14, color: "#333", fontWeight: "600" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: "#1a1a1a", outlineStyle: "none" } as any,
  inputFull: { borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 10, backgroundColor: "#fafafa" },
  eyeBtn: { paddingHorizontal: 14 },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  divText: { fontSize: 13, color: "#999" },
  registerBtn: { borderWidth: 2, borderColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  registerText: { color: PRIMARY, fontSize: 15, fontWeight: "700" },
  legal: { fontSize: 12, color: "#aaa", textAlign: "center", lineHeight: 18 },
  legalLink: { color: PRIMARY, fontWeight: "600" },
});
