import React, { useState } from "react";
import {
  View, StyleSheet, Pressable, ActivityIndicator,
  TextInput, ScrollView, Text,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">;
  route: RouteProp<RootStackParamList, "Signup">;
};

const PRIMARY = ComeYaColors.primary;
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
      {/* IZQUIERDA */}
      <View style={s.left}>
        <View style={s.leftInner}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
            <Text style={s.backText}>Volver</Text>
          </Pressable>
          <Text style={s.headline}>Únete a{"\n"}ComeYa</Text>
          <Text style={s.sub}>Conectamos los mejores negocios locales de Soria contigo.</Text>

          <View style={s.features}>
            {[
              { icon: "map-pin", text: "Tracking GPS en tiempo real" },
              { icon: "clock", text: "Entrega en 30-45 minutos" },
              { icon: "gift", text: "Puntos y recompensas" },
              { icon: "shield", text: "Pagos 100% seguros" },
            ].map((f) => (
              <View key={f.text} style={s.featureRow}>
                <View style={s.featureIcon}>
                  <Feather name={f.icon as any} size={16} color={PRIMARY} />
                </View>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* DERECHA */}
      <View style={s.right}>
        <ScrollView contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.formTitle}>Crear cuenta</Text>
          <Text style={s.formSub}>Rellena tus datos para empezar</Text>

          {/* Rol */}
          <Text style={s.label}>¿Cómo usarás ComeYa?</Text>
          <View style={s.roleRow}>
            {ROLES.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRole(r.value)}
                style={[s.roleCard, role === r.value && s.roleCardActive]}
              >
                <Feather name={r.icon as any} size={20} color={role === r.value ? PRIMARY : "#666"} />
                <Text style={[s.roleLabel, role === r.value && { color: PRIMARY }]}>{r.label}</Text>
                <Text style={s.roleDesc}>{r.desc}</Text>
              </Pressable>
            ))}
          </View>

          {/* Campos */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Nombre completo</Text>
              <TextInput style={s.input} placeholder="Tu nombre" placeholderTextColor="#aaa" value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.label}>Teléfono</Text>
              <View style={s.inputRow}>
                <View style={s.prefix}><Text style={s.prefixText}>🇪🇸 +34</Text></View>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="612 345 678" placeholderTextColor="#aaa" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Correo electrónico</Text>
            <TextInput style={s.input} placeholder="correo@ejemplo.com" placeholderTextColor="#aaa" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Contraseña</Text>
            <View style={s.inputRow}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Mínimo 8 caracteres" placeholderTextColor="#aaa" value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
              <Pressable onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color="#666" />
              </Pressable>
            </View>
          </View>

          <Pressable style={[s.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Crear cuenta</Text>}
          </Pressable>

          <View style={s.loginRow}>
            <Text style={s.loginText}>¿Ya tienes cuenta? </Text>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={s.loginLink}>Inicia sesión</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#fff" },
  left: { flex: 1, backgroundColor: "#1a1a1a" },
  leftInner: { flex: 1, padding: 48, justifyContent: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 40 },
  backText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  headline: { fontSize: 40, fontWeight: "900", color: "#fff", lineHeight: 48, marginBottom: 16 },
  sub: { fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 24, marginBottom: 40 },
  features: { gap: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,107,53,0.15)", justifyContent: "center", alignItems: "center" },
  featureText: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  right: { width: 480, backgroundColor: "#fff" },
  formScroll: { padding: 48 },
  formTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  formSub: { fontSize: 14, color: "#666", marginBottom: 24 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  roleCard: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#e0e0e0", alignItems: "center", gap: 4 },
  roleCardActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + "08" },
  roleLabel: { fontSize: 13, fontWeight: "700", color: "#333" },
  roleDesc: { fontSize: 10, color: "#999", textAlign: "center" },
  row: { flexDirection: "row", gap: 12 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 10, backgroundColor: "#fafafa", overflow: "hidden" },
  prefix: { paddingHorizontal: 12, paddingVertical: 13, backgroundColor: "#f0f0f0", borderRightWidth: 1, borderRightColor: "#e0e0e0" },
  prefixText: { fontSize: 13, color: "#333", fontWeight: "600" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: "#1a1a1a", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 10, backgroundColor: "#fafafa", outlineStyle: "none" } as any,
  eyeBtn: { paddingHorizontal: 12 },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8, marginBottom: 20 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText: { fontSize: 14, color: "#666" },
  loginLink: { fontSize: 14, color: PRIMARY, fontWeight: "700" },
});
