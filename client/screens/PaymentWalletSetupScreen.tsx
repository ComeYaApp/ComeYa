import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

// ── Métodos disponibles por rol ──────────────────────────────────────────────
//
// CLIENTE → paga con estos métodos en el checkout
//   - Bizum (Stripe)
//   - Tarjeta bancaria (Stripe)
//   - PayPal
//
// NEGOCIO / REPARTIDOR → recibe pagos de ComeYa en estas cuentas
//   - Bizum (número de teléfono)
//   - Transferencia bancaria (IBAN)
//
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMER_METHODS = [
  { id: "bizum",    label: "Bizum",   icon: "smartphone" as const, color: "#00ADEF", desc: "Pago instantáneo desde tu móvil" },
  { id: "tarjeta",  label: "Tarjeta", icon: "credit-card" as const, color: "#635BFF", desc: "Visa, Mastercard, Amex (Stripe)" },
  { id: "paypal",   label: "PayPal",  icon: "dollar-sign" as const, color: "#003087", desc: "Paga con tu cuenta PayPal" },
];

const BUSINESS_METHODS = [
  { id: "bizum",         label: "Bizum",         icon: "smartphone" as const, color: "#00ADEF", desc: "Recibe pagos instantáneos" },
  { id: "transferencia", label: "Transferencia",  icon: "credit-card" as const, color: "#2E7D32", desc: "SEPA / IBAN" },
  { id: "paypal",        label: "PayPal",         icon: "dollar-sign" as const, color: "#003087", desc: "Recibe en tu cuenta PayPal" },
];

interface Account {
  id: string;
  method: string;
  isDefault: boolean;
  // Campos reutilizados para España
  pagoMovilPhone?: string;  // → teléfono Bizum
  binanceId?: string;       // → IBAN
  zelleEmail?: string;      // → titular IBAN / email PayPal
  zinliEmail?: string;      // → titular tarjeta
  zellePhone?: string;      // → últimos 4 tarjeta
}

export default function PaymentWalletSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isCustomer = user?.role === "customer";
  const METHODS = isCustomer ? CUSTOMER_METHODS : BUSINESS_METHODS;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMethod, setActiveMethod] = useState(METHODS[0].id);

  // Campos del formulario
  const [bizumPhone, setBizumPhone] = useState("");
  const [ibanHolder, setIbanHolder] = useState("");
  const [ibanNumber, setIbanNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");

  const title    = isCustomer ? "Mis métodos de pago" : "Cuentas para recibir pagos";
  const subtitle = isCustomer
    ? "Guarda tus datos para pagar más rápido en el checkout"
    : "ComeYa transferirá tus ganancias a estas cuentas";

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const res = await apiRequest("GET", "/api/payouts/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        prefillForm(data.accounts || [], activeMethod);
      }
    } catch {
      showToast("Error cargando cuentas", "error");
    } finally {
      setLoading(false);
    }
  };

  const prefillForm = (accs: Account[], method: string) => {
    const acc = accs.find(a => a.method === method);
    if (!acc) { clearForm(); return; }
    setBizumPhone(acc.pagoMovilPhone || "");
    setIbanHolder(acc.zelleEmail || "");
    setIbanNumber(acc.binanceId || "");
    setCardHolder(acc.zinliEmail || "");
    setCardLast4(acc.zellePhone || "");
    setPaypalEmail(acc.zelleEmail || "");
  };

  const clearForm = () => {
    setBizumPhone(""); setIbanHolder(""); setIbanNumber("");
    setCardHolder(""); setCardLast4(""); setPaypalEmail("");
  };

  const handleMethodChange = (method: string) => {
    setActiveMethod(method);
    prefillForm(accounts, method);
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    // Validación básica
    if (activeMethod === "bizum" && !bizumPhone.trim()) {
      showToast("Introduce tu número de Bizum", "error"); return;
    }
    if (activeMethod === "transferencia" && (!ibanNumber.trim() || !ibanHolder.trim())) {
      showToast("Introduce el IBAN y el titular", "error"); return;
    }
    if (activeMethod === "tarjeta" && (!cardHolder.trim() || !cardLast4.trim())) {
      showToast("Introduce los datos de la tarjeta", "error"); return;
    }
    if (activeMethod === "paypal" && !paypalEmail.trim()) {
      showToast("Introduce tu email de PayPal", "error"); return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const existing = accounts.find(a => a.method === activeMethod);
      if (existing) {
        await apiRequest("DELETE", `/api/payouts/accounts/${existing.id}`);
      }

      await apiRequest("POST", "/api/payouts/accounts", {
        method: activeMethod,
        isDefault: true,
        pagoMovilPhone: activeMethod === "bizum"         ? bizumPhone.trim()   : undefined,
        binanceId:      activeMethod === "transferencia" ? ibanNumber.trim()   : undefined,
        zelleEmail:     activeMethod === "transferencia" ? ibanHolder.trim()
                      : activeMethod === "paypal"        ? paypalEmail.trim()  : undefined,
        zinliEmail:     activeMethod === "tarjeta"       ? cardHolder.trim()   : undefined,
        zellePhone:     activeMethod === "tarjeta"       ? cardLast4.trim()    : undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Guardado correctamente", "success");
      await loadAccounts();
    } catch {
      showToast("Error guardando cuenta", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    Alert.alert("Eliminar cuenta", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          await apiRequest("DELETE", `/api/payouts/accounts/${accountId}`);
          showToast("Cuenta eliminada", "success");
          await loadAccounts();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={ComeYaColors.primary} />
      </View>
    );
  }

  const activeConfig = METHODS.find(m => m.id === activeMethod)!;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3">{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
        </View>
      </View>

      {/* Banner informativo por rol */}
      <View style={[styles.infoBanner, { backgroundColor: ComeYaColors.primary + "12", borderColor: ComeYaColors.primary + "30" }]}>
        <Feather name="info" size={14} color={ComeYaColors.primary} />
        <ThemedText type="caption" style={{ color: ComeYaColors.primary, flex: 1, marginLeft: 6 }}>
          {isCustomer
            ? "Guarda tus métodos para agilizar el pago. Podrás seleccionarlos en el checkout."
            : "ComeYa transferirá tus ganancias a la cuenta que configures aquí tras cada entrega confirmada."}
        </ThemedText>
      </View>

      {/* Tabs de métodos */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
      >
        {METHODS.map(m => {
          const hasAccount = accounts.some(a => a.method === m.id);
          const isActive = activeMethod === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => handleMethodChange(m.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? m.color : theme.card,
                  borderColor: isActive ? m.color : theme.border,
                },
              ]}
            >
              <Feather name={m.icon} size={16} color={isActive ? "#FFF" : theme.text} />
              <ThemedText type="small" style={{ color: isActive ? "#FFF" : theme.text, marginLeft: 4, fontWeight: "600" }}>
                {m.label}
              </ThemedText>
              {hasAccount && (
                <View style={[styles.dot, { backgroundColor: isActive ? "#FFF" : ComeYaColors.success }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}>

        {/* Descripción del método activo */}
        <View style={[styles.methodDesc, { backgroundColor: activeConfig.color + "12" }]}>
          <Feather name={activeConfig.icon} size={20} color={activeConfig.color} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="body" style={{ fontWeight: "700", color: activeConfig.color }}>{activeConfig.label}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>{activeConfig.desc}</ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>

          {/* ── BIZUM ── */}
          {activeMethod === "bizum" && (
            <>
              <ThemedText type="small" style={styles.label}>Número de teléfono Bizum</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={bizumPhone}
                onChangeText={setBizumPhone}
                placeholder="+34 6XX XXX XXX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {isCustomer
                  ? "El número asociado a tu cuenta Bizum"
                  : "ComeYa te enviará el pago a este número de Bizum"}
              </ThemedText>
            </>
          )}

          {/* ── TRANSFERENCIA BANCARIA ── */}
          {activeMethod === "transferencia" && (
            <>
              <ThemedText type="small" style={styles.label}>Titular de la cuenta</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={ibanHolder}
                onChangeText={setIbanHolder}
                placeholder="Nombre y Apellidos"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
              <ThemedText type="small" style={styles.label}>IBAN</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={ibanNumber}
                onChangeText={(t) => setIbanNumber(t.toUpperCase())}
                placeholder="ES00 0000 0000 0000 0000 0000"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                ComeYa realizará transferencias SEPA a este IBAN
              </ThemedText>
            </>
          )}

          {/* ── TARJETA (solo cliente) ── */}
          {activeMethod === "tarjeta" && (
            <>
              <ThemedText type="small" style={styles.label}>Titular de la tarjeta</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={cardHolder}
                onChangeText={setCardHolder}
                placeholder="Nombre en la tarjeta"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
              <ThemedText type="small" style={styles.label}>Últimos 4 dígitos</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={cardLast4}
                onChangeText={setCardLast4}
                placeholder="1234"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                maxLength={4}
              />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                El pago se procesará de forma segura a través de Stripe
              </ThemedText>
            </>
          )}

          {/* ── PAYPAL (cliente Y negocio/repartidor) ── */}
          {activeMethod === "paypal" && (
            <>
              <ThemedText type="small" style={styles.label}>
                {isCustomer ? "Email de PayPal" : "Email de PayPal para recibir pagos"}
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                placeholder="tu@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {isCustomer
                  ? "Serás redirigido a PayPal para completar el pago"
                  : "ComeYa te enviará tus ganancias a esta cuenta PayPal"}
              </ThemedText>
            </>
          )}

          <Button onPress={handleSave} disabled={saving} style={{ marginTop: Spacing.lg }}>
            {saving ? <ActivityIndicator color="#FFF" /> : "Guardar"}
          </Button>
        </View>

        {/* Cuentas guardadas */}
        {accounts.length > 0 && (
          <View style={{ marginTop: Spacing.xl }}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              {isCustomer ? "Métodos guardados" : "Cuentas guardadas"}
            </ThemedText>
            {accounts.map(acc => {
              const method = METHODS.find(m => m.id === acc.method);
              const detail =
                acc.method === "bizum"         ? acc.pagoMovilPhone
                : acc.method === "transferencia" ? acc.binanceId
                : acc.method === "tarjeta"       ? `**** ${acc.zellePhone}`
                : acc.method === "paypal"        ? acc.zelleEmail
                : "—";
              return (
                <View key={acc.id} style={[styles.accountRow, { backgroundColor: theme.card, borderColor: theme.border }, Shadows.sm]}>
                  <View style={[styles.methodIcon, { backgroundColor: (method?.color || ComeYaColors.primary) + "18" }]}>
                    <Feather name={method?.icon || "credit-card"} size={20} color={method?.color || ComeYaColors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{method?.label || acc.method}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{detail || "—"}</ThemedText>
                  </View>
                  {acc.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: ComeYaColors.success + "20" }]}>
                      <ThemedText type="caption" style={{ color: ComeYaColors.success }}>Principal</ThemedText>
                    </View>
                  )}
                  <Pressable onPress={() => handleDelete(acc.id)} style={{ padding: Spacing.sm }}>
                    <Feather name="trash-2" size={18} color={ComeYaColors.error} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, gap: 6 },
  tabs: { maxHeight: 56, marginBottom: Spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  methodDesc: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg },
  label: { marginBottom: Spacing.xs, fontWeight: "600", marginTop: Spacing.md, color: "#333" },
  input: { height: 52, borderRadius: BorderRadius.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, fontSize: 16, marginBottom: Spacing.xs },
  accountRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  methodIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  defaultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginRight: Spacing.sm },
});
