import React, { useState } from "react";
import {
  View, StyleSheet, Pressable, ActivityIndicator,
  TextInput, Text,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">;
  route: RouteProp<RootStackParamList, "Signup">;
};

// Rojo para versión web
const PRIMARY = "#DC2626";
const ROLES = [
  { value: "customer", label: "Cliente", icon: "user", desc: "Pide comida y productos" },
  { value: "business_owner", label: "Negocio", icon: "briefcase", desc: "Vende tus productos" },
  { value: "delivery_driver", label: "Repartidor", icon: "truck", desc: "Entrega pedidos" },
];

export default function SignupScreen({ navigation, route }: Props) {
  const { signup } = useAuth();
  const { showToast } = useToast();
  const [role, setRole] = useState("customer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(route.params?.phone?.replace("+34", "") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !phone || !email || !password) {
      showToast("Completa todos los campos", "error"); return;
    }
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const formatted = digits.startsWith("58") ? `+${digits}` : digits.startsWith("04") ? `+58${digits.slice(1)}` : `+34${digits}`;
      const result = await signup(name.trim(), role as any, formatted, email.trim(), password);
      if (result?.requiresVerification) {
        navigation.navigate("VerifyPhone", { phone: formatted });
      }
    } catch (e: any) {
      showToast(e.message || "Error al crear cuenta", "error");
    } finally { setLoading(false); }
  };

  return (
    <View style={s.root}>
      {/* IZQUIERDA — Hero */}
      <View style={s.left}>
        <View style={s.leftInner}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
            <Text style={s.backText}>Volver al inicio</Text>
          </Pressable>

          <View style={s.logoRow}>
            <View style={s.logoCircle}>
              <ComeYaLogo size={48} style={s.logoImage} />
            </View>
            <Text style={s.logoText}>ComeYa</Text>
          </View>

          <Text style={s.headline}>Únete a la{"\n"}comunidad</Text>
          <Text style={s.sub}>Miles de usuarios ya disfrutan de ComeYa en Soria</Text>

          <View style={s.features}>
            {[
              { icon: "zap", text: "Entrega rápida en 30-45 min" },
              { icon: "shield", text: "Pagos 100% seguros" },
              { icon: "gift", text: "Gana puntos y recompensas" },
              { icon: "star", text: "Acceso a ofertas exclusivas" },
            ].map((f) => (
              <View key={f.text} style={s.featureRow}>
                <View style={s.featureIcon}>
                  <Feather name={f.icon as any} size={18} color="#fff" />
                </View>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* DERECHA — Formulario */}
      <View style={s.right}>
        <View style={s.formContainer}>
          <View style={s.formCard}>
            <Text style={s.formTitle}>Crear cuenta</Text>
            <Text style={s.formSub}>Completa tus datos para empezar</Text>

            {/* Rol */}
            <Text style={s.label}>¿Cómo usarás ComeYa?</Text>
            <View style={s.roleRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  style={[s.roleCard, role === r.value && s.roleCardActive]}
                >
                  <Feather name={r.icon as any} size={22} color={role === r.value ? PRIMARY : "#666"} />
                  <Text style={[s.roleLabel, role === r.value && { color: PRIMARY }]}>{r.label}</Text>
                  <Text style={s.roleDesc}>{r.desc}</Text>
                </Pressable>
              ))}
            </View>

            {/* Campos */}
            <View style={s.field}>
              <Text style={s.label}>Nombre completo</Text>
              <TextInput
                style={[s.input, s.inputFull]}
                placeholder="Tu nombre"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

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

            <View style={s.field}>
              <Text style={s.label}>Correo electrónico</Text>
              <TextInput
                style={[s.input, s.inputFull]}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Contraseña</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Mínimo 8 caracteres"
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

            <Pressable
              style={[s.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Crear cuenta</Text>}
            </Pressable>

            <View style={s.dividerRow}>
              <View style={s.divLine} />
              <Text style={s.divText}>o</Text>
              <View style={s.divLine} />
            </View>

            <View style={s.loginRow}>
              <Text style={s.loginText}>¿Ya tienes cuenta? </Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={s.loginLink}>Inicia sesión</Text>
              </Pressable>
            </View>

            <Text style={s.legal}>
              Al crear una cuenta, aceptas nuestros{" "}
              <Text style={s.legalLink}>Términos de Servicio</Text>
              {" "}y{" "}
              <Text style={s.legalLink}>Política de Privacidad</Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
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

  // IZQUIERDA — Hero
  left: { 
    flex: 1,
    minWidth: 300,
    backgroundColor: PRIMARY,
    position: "relative" as any,
  },
  leftInner: { 
    padding: 64,
    maxWidth: 600,
    margin: "auto" as any,
  },
  backBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 48,
    cursor: "pointer" as any,
  },
  backText: { 
    color: "rgba(255,255,255,0.9)", 
    fontSize: 14,
    fontWeight: "500",
  },
  logoRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 48, 
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
  sub: { 
    fontSize: 20, 
    color: "rgba(255,255,255,0.9)", 
    lineHeight: 32, 
    marginBottom: 48,
  },
  features: { 
    gap: 20,
  },
  featureRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 16,
  },
  featureIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: "rgba(255,255,255,0.15)", 
    justifyContent: "center" as any, 
    alignItems: "center" as any,
  },
  featureText: { 
    fontSize: 16, 
    color: "rgba(255,255,255,0.95)",
    fontWeight: "500",
  },

  // DERECHA — Formulario
  right: { 
    flex: 1,
    backgroundColor: "#fafafa",
    display: "flex" as any,
    alignItems: "center" as any,
    justifyContent: "center" as any,
    overflowY: "auto" as any,
  },
  formContainer: {
    width: "100%" as any,
    maxWidth: 520,
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
    marginBottom: 28,
  },
  label: { 
    fontSize: 14, 
    fontWeight: "600", 
    color: "#1a1a1a", 
    marginBottom: 8,
  },
  roleRow: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 24,
  },
  roleCard: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: "#e0e0e0", 
    alignItems: "center" as any, 
    gap: 6,
    cursor: "pointer" as any,
  },
  roleCardActive: { 
    borderColor: PRIMARY, 
    backgroundColor: PRIMARY + "08",
  },
  roleLabel: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#333",
  },
  roleDesc: { 
    fontSize: 11, 
    color: "#999", 
    textAlign: "center" as any,
  },
  field: { 
    marginBottom: 20,
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
    alignItems: "center" as any, 
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
  loginRow: { 
    flexDirection: "row", 
    justifyContent: "center" as any,
    marginBottom: 20,
  },
  loginText: { 
    fontSize: 14, 
    color: "#666",
  },
  loginLink: { 
    fontSize: 14, 
    color: PRIMARY, 
    fontWeight: "700",
  },
  legal: { 
    fontSize: 12, 
    color: "#999", 
    textAlign: "center" as any, 
    lineHeight: 18,
  },
  legalLink: { 
    color: PRIMARY, 
    fontWeight: "600",
  },
});
