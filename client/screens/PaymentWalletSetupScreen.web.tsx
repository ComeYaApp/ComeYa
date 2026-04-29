import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const CUSTOMER_METHODS = [
  { id: "bizum", label: "Bizum", icon: "smartphone" as const, color: "#00ADEF", desc: "Pago instantáneo desde tu móvil" },
  { id: "tarjeta", label: "Tarjeta", icon: "credit-card" as const, color: "#635BFF", desc: "Visa, Mastercard — gestionado por Stripe" },
  { id: "paypal", label: "PayPal", icon: "dollar-sign" as const, color: "#003087", desc: "Paga con tu cuenta PayPal" },
];
const BUSINESS_METHODS = [
  { id: "bizum", label: "Bizum", icon: "smartphone" as const, color: "#00ADEF", desc: "Recibe pagos instantáneos en tu móvil" },
  { id: "transferencia", label: "Transferencia", icon: "credit-card" as const, color: "#2E7D32", desc: "Transferencia SEPA a tu cuenta bancaria" },
  { id: "paypal", label: "PayPal", icon: "dollar-sign" as const, color: "#003087", desc: "Recibe en tu cuenta PayPal" },
];

interface Account { id: string; method: string; isDefault: boolean; pagoMovilPhone?: string; binanceId?: string; zelleEmail?: string; }

export default function PaymentWalletSetupScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const isCustomer = user?.role === "customer";
  const METHODS = isCustomer ? CUSTOMER_METHODS : BUSINESS_METHODS;
  const { isMobile } = useResponsive();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMethod, setActiveMethod] = useState(METHODS[0].id);
  const [bizumPhone, setBizumPhone] = useState("");
  const [ibanHolder, setIbanHolder] = useState("");
  const [ibanNumber, setIbanNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const res = await apiRequest("GET", "/api/payouts/accounts");
      const data = await res.json();
      if (data.success) { setAccounts(data.accounts || []); prefill(data.accounts || [], activeMethod); }
    } catch { showToast("Error cargando cuentas", "error"); }
    finally { setLoading(false); }
  };

  const prefill = (accs: Account[], method: string) => {
    const acc = accs.find(a => a.method === method);
    setBizumPhone(acc?.pagoMovilPhone || "");
    setIbanHolder(acc?.zelleEmail || "");
    setIbanNumber(acc?.binanceId || "");
    setPaypalEmail(acc?.zelleEmail || "");
  };

  const handleMethodChange = (method: string) => { setActiveMethod(method); prefill(accounts, method); };

  const handleSave = async () => {
    if (activeMethod === "bizum" && !bizumPhone.trim()) { showToast("Introduce tu número de Bizum", "error"); return; }
    if (activeMethod === "transferencia" && (!ibanNumber.trim() || !ibanHolder.trim())) { showToast("Introduce el IBAN y el titular", "error"); return; }
    if (activeMethod === "paypal" && !paypalEmail.trim()) { showToast("Introduce tu email de PayPal", "error"); return; }
    setSaving(true);
    try {
      const existing = accounts.find(a => a.method === activeMethod);
      if (existing) await apiRequest("DELETE", `/api/payouts/accounts/${existing.id}`);
      await apiRequest("POST", "/api/payouts/accounts", {
        method: activeMethod, isDefault: true,
        pagoMovilPhone: activeMethod === "bizum" ? bizumPhone.trim() : undefined,
        binanceId: activeMethod === "transferencia" ? ibanNumber.trim() : undefined,
        zelleEmail: activeMethod === "transferencia" ? ibanHolder.trim() : activeMethod === "paypal" ? paypalEmail.trim() : undefined,
      });
      showToast("Guardado correctamente ✓", "success");
      await loadAccounts();
    } catch { showToast("Error guardando cuenta", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta cuenta?")) return;
    await apiRequest("DELETE", `/api/payouts/accounts/${id}`);
    showToast("Cuenta eliminada", "success");
    await loadAccounts();
  };

  const activeConfig = METHODS.find(m => m.id === activeMethod)!;
  const isTarjetaCliente = activeMethod === "tarjeta" && isCustomer;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <MobileSidebarWrapper title="Metodos de Pago" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="credit-card" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>{isCustomer ? "Métodos de pago" : "Cuentas de cobro"}</Text>
        <Text style={[s.sideSub, { color: sub }]}>
          {isCustomer ? "Guarda tus preferencias para el checkout" : "ComeYa transferirá tus ganancias aquí"}
        </Text>

        {/* Tabs de métodos */}
        <View style={s.methodList}>
          {METHODS.map(m => {
            const hasAcc = accounts.some(a => a.method === m.id);
            const isActive = activeMethod === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleMethodChange(m.id)}
                style={[s.methodTab, { backgroundColor: isActive ? m.color + "15" : "transparent", borderColor: isActive ? m.color : border }]}
              >
                <Feather name={m.icon} size={18} color={isActive ? m.color : sub} />
                <Text style={[s.methodTabText, { color: isActive ? m.color : text }]}>{m.label}</Text>
                {hasAcc && <View style={[s.dot, { backgroundColor: ComeYaColors.success }]} />}
              </Pressable>
            );
          })}
        </View>

        {!isCustomer && (
          <Pressable
            onPress={() => navigation.navigate("BusinessStripeSetup")}
            style={[s.stripeBtn, { backgroundColor: "#635BFF" + "15", borderColor: "#635BFF" + "40" }]}
          >
            <Feather name="zap" size={16} color="#635BFF" />
            <Text style={[s.stripeBtnText, { color: "#635BFF" }]}>Stripe Connect</Text>
          </Pressable>
        )}

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : (
          <>
            {/* Descripción del método activo */}
            <View style={[s.methodDesc, { backgroundColor: activeConfig.color + "12" }]}>
              <Feather name={activeConfig.icon} size={22} color={activeConfig.color} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.methodDescTitle, { color: activeConfig.color }]}>{activeConfig.label}</Text>
                <Text style={[s.methodDescSub, { color: sub }]}>{activeConfig.desc}</Text>
              </View>
            </View>

            <View style={[s.formCard, { backgroundColor: card, borderColor: border }]}>
              {activeMethod === "bizum" && (
                <>
                  <Text style={[s.fieldLabel, { color: sub }]}>{isCustomer ? "Tu número de teléfono Bizum" : "Número para recibir Bizum"}</Text>
                  <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={bizumPhone} onChangeText={setBizumPhone} placeholder="+34 6XX XXX XXX" placeholderTextColor={sub} />
                </>
              )}
              {activeMethod === "transferencia" && (
                <>
                  <Text style={[s.fieldLabel, { color: sub }]}>Titular de la cuenta</Text>
                  <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={ibanHolder} onChangeText={setIbanHolder} placeholder="Nombre y Apellidos" placeholderTextColor={sub} />
                  <Text style={[s.fieldLabel, { color: sub }]}>IBAN</Text>
                  <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={ibanNumber} onChangeText={t => setIbanNumber(t.replace(/\s/g, "").toUpperCase())} placeholder="ES00 0000 0000 0000 0000 0000" placeholderTextColor={sub} />
                </>
              )}
              {isTarjetaCliente && (
                <View style={[s.stripeInfo, { backgroundColor: "#635BFF" + "10", borderColor: "#635BFF" + "30" }]}>
                  <Feather name="shield" size={32} color="#635BFF" />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={[s.stripeInfoTitle, { color: "#635BFF" }]}>Gestionado por Stripe</Text>
                    <Text style={[s.stripeInfoSub, { color: sub }]}>No necesitas introducir datos de tarjeta aquí. Stripe los almacena de forma segura la primera vez que pagas.</Text>
                  </View>
                </View>
              )}
              {activeMethod === "paypal" && (
                <>
                  <Text style={[s.fieldLabel, { color: sub }]}>{isCustomer ? "Email de tu cuenta PayPal" : "Email de PayPal para recibir pagos"}</Text>
                  <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={paypalEmail} onChangeText={setPaypalEmail} placeholder="tu@email.com" placeholderTextColor={sub} />
                </>
              )}
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[s.saveBtn, { backgroundColor: isTarjetaCliente ? "#635BFF" : ComeYaColors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{isTarjetaCliente ? "Establecer como preferido" : "Guardar"}</Text>}
              </Pressable>
            </View>

            {/* Cuentas guardadas */}
            {accounts.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: text }]}>{isCustomer ? "Métodos guardados" : "Cuentas guardadas"}</Text>
                {accounts.map(acc => {
                  const m = METHODS.find(x => x.id === acc.method);
                  const detail = acc.method === "bizum" ? acc.pagoMovilPhone : acc.method === "transferencia" ? acc.binanceId : acc.method === "tarjeta" ? "Gestionada por Stripe" : acc.zelleEmail;
                  return (
                    <View key={acc.id} style={[s.accRow, { backgroundColor: card, borderColor: border }]}>
                      <View style={[s.accIcon, { backgroundColor: (m?.color || ComeYaColors.primary) + "15" }]}>
                        <Feather name={m?.icon || "credit-card"} size={18} color={m?.color || ComeYaColors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.accMethod, { color: text }]}>{m?.label || acc.method}</Text>
                        <Text style={[s.accDetail, { color: sub }]}>{detail || "—"}</Text>
                      </View>
                      {acc.isDefault && <View style={[s.defaultBadge, { backgroundColor: ComeYaColors.success + "15" }]}><Text style={{ color: ComeYaColors.success, fontSize: 11, fontWeight: "700" }}>Principal</Text></View>}
                      <Pressable onPress={() => handleDelete(acc.id)} style={s.deleteBtn}>
                        <Feather name="trash-2" size={16} color={ComeYaColors.error} />
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, minWidth: 280, maxWidth: 280, padding: 28, borderRightWidth: 1, paddingTop: 48 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 16 },
  sideTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 24, lineHeight: 18 },
  methodList: { width: "100%", gap: 8, marginBottom: 16 },
  methodTab: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  methodTabText: { flex: 1, fontSize: 14, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stripeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12, width: "100%", justifyContent: "center" },
  stripeBtnText: { fontSize: 13, fontWeight: "700" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, width: "100%", justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 },
  methodDesc: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, marginBottom: 16 },
  methodDescTitle: { fontSize: 16, fontWeight: "700" },
  methodDescSub: { fontSize: 13, marginTop: 2 },
  formCard: { padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", marginTop: 12 },
  input: { height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15, marginBottom: 4 },
  stripeInfo: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderRadius: 12, borderWidth: 1 },
  stripeInfoTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  stripeInfoSub: { fontSize: 13, lineHeight: 18 },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  accRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  accIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  accMethod: { fontSize: 14, fontWeight: "700" },
  accDetail: { fontSize: 13, marginTop: 2 },
  defaultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 8 },
  deleteBtn: { padding: 8 },
});
