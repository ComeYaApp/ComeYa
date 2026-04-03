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

const VENEZUELA_BANKS = [
  { id: "banesco", name: "Banesco" },
  { id: "bdv", name: "Banco de Venezuela" },
  { id: "mercantil", name: "Mercantil" },
  { id: "provincial", name: "BBVA Provincial" },
  { id: "bicentenario", name: "Bicentenario" },
  { id: "bnc", name: "BNC" },
  { id: "exterior", name: "Banco Exterior" },
  { id: "sofitasa", name: "Sofitasa" },
];

const METHODS = [
  { id: "pago_movil", label: "Pago Móvil", icon: "smartphone" as const },
  { id: "binance",    label: "Binance Pay", icon: "zap" as const },
  { id: "zinli",      label: "Zinli",       icon: "credit-card" as const },
  { id: "zelle",      label: "Zelle",       icon: "dollar-sign" as const },
];

interface Account {
  id: string;
  method: string;
  isDefault: boolean;
  label?: string;
  pagoMovilPhone?: string;
  pagoMovilBank?: string;
  pagoMovilCedula?: string;
  binanceId?: string;
  binanceEmail?: string;
  zinliEmail?: string;
  zelleEmail?: string;
  zellePhone?: string;
}

export default function PaymentWalletSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMethod, setActiveMethod] = useState("pago_movil");

  // Form state
  const [pagoMovilPhone, setPagoMovilPhone] = useState("");
  const [pagoMovilBank, setPagoMovilBank] = useState("banesco");
  const [pagoMovilCedula, setPagoMovilCedula] = useState("");
  const [binanceId, setBinanceId] = useState("");
  const [binanceEmail, setBinanceEmail] = useState("");
  const [zinliEmail, setZinliEmail] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [zellePhone, setZellePhone] = useState("");

  const isCustomer = user?.role === "customer";

  const title = isCustomer
    ? "Mis métodos de pago"
    : "Cuentas para recibir pagos";

  const subtitle = isCustomer
    ? "Configura tus cuentas para pagar más rápido"
    : "El admin usará estos datos para enviarte tus pagos";

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await apiRequest("GET", "/api/payouts/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        // Pre-llenar con cuenta existente del método activo
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
    if (!acc) return;
    setPagoMovilPhone(acc.pagoMovilPhone || "");
    setPagoMovilBank(acc.pagoMovilBank || "banesco");
    setPagoMovilCedula(acc.pagoMovilCedula || "");
    setBinanceId(acc.binanceId || "");
    setBinanceEmail(acc.binanceEmail || "");
    setZinliEmail(acc.zinliEmail || "");
    setZelleEmail(acc.zelleEmail || "");
    setZellePhone(acc.zellePhone || "");
  };

  const handleMethodChange = (method: string) => {
    setActiveMethod(method);
    prefillForm(accounts, method);
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Eliminar cuenta existente del mismo método si existe
      const existing = accounts.find(a => a.method === activeMethod);
      if (existing) {
        await apiRequest("DELETE", `/api/payouts/accounts/${existing.id}`);
      }

      await apiRequest("POST", "/api/payouts/accounts", {
        method: activeMethod,
        isDefault: true,
        pagoMovilPhone: pagoMovilPhone || undefined,
        pagoMovilBank: pagoMovilBank || undefined,
        pagoMovilCedula: pagoMovilCedula || undefined,
        binanceId: binanceId || undefined,
        binanceEmail: binanceEmail || undefined,
        zinliEmail: zinliEmail || undefined,
        zelleEmail: zelleEmail || undefined,
        zellePhone: zellePhone || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Cuenta guardada", "success");
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3">{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
        </View>
      </View>

      {/* Tabs de métodos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
        {METHODS.map(m => {
          const hasAccount = accounts.some(a => a.method === m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => handleMethodChange(m.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: activeMethod === m.id ? ComeYaColors.primary : theme.card,
                  borderColor: activeMethod === m.id ? ComeYaColors.primary : theme.border,
                },
              ]}
            >
              <Feather name={m.icon} size={16} color={activeMethod === m.id ? "#FFF" : theme.text} />
              <ThemedText type="small" style={{ color: activeMethod === m.id ? "#FFF" : theme.text, marginLeft: 4, fontWeight: "600" }}>
                {m.label}
              </ThemedText>
              {hasAccount && (
                <View style={[styles.dot, { backgroundColor: activeMethod === m.id ? "#FFF" : ComeYaColors.success }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>

          {/* Pago Móvil */}
          {activeMethod === "pago_movil" && (
            <>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>📱 Pago Móvil</ThemedText>
              <ThemedText type="small" style={styles.label}>Teléfono</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={pagoMovilPhone}
                onChangeText={setPagoMovilPhone}
                placeholder="04XX-XXX-XXXX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
              <ThemedText type="small" style={styles.label}>Cédula</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={pagoMovilCedula}
                onChangeText={setPagoMovilCedula}
                placeholder="V-00000000"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText type="small" style={styles.label}>Banco</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  {VENEZUELA_BANKS.map(b => (
                    <Pressable
                      key={b.id}
                      onPress={() => { setPagoMovilBank(b.id); Haptics.selectionAsync(); }}
                      style={[styles.bankChip, { backgroundColor: pagoMovilBank === b.id ? ComeYaColors.primary : theme.backgroundSecondary, borderColor: pagoMovilBank === b.id ? ComeYaColors.primary : theme.border }]}
                    >
                      <ThemedText type="small" style={{ color: pagoMovilBank === b.id ? "#FFF" : theme.text }}>{b.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {/* Binance */}
          {activeMethod === "binance" && (
            <>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>⚡ Binance Pay</ThemedText>
              <ThemedText type="small" style={styles.label}>Binance ID / Pay ID</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={binanceId}
                onChangeText={setBinanceId}
                placeholder="123456789"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              <ThemedText type="small" style={styles.label}>Email de Binance (opcional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={binanceEmail}
                onChangeText={setBinanceEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {/* Zinli */}
          {activeMethod === "zinli" && (
            <>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>💳 Zinli</ThemedText>
              <ThemedText type="small" style={styles.label}>Email de Zinli</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={zinliEmail}
                onChangeText={setZinliEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {/* Zelle */}
          {activeMethod === "zelle" && (
            <>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>💵 Zelle</ThemedText>
              <ThemedText type="small" style={styles.label}>Email de Zelle</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={zelleEmail}
                onChangeText={setZelleEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ThemedText type="small" style={styles.label}>Teléfono de Zelle (opcional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={zellePhone}
                onChangeText={setZellePhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </>
          )}

          <Button onPress={handleSave} disabled={saving} style={{ marginTop: Spacing.md }}>
            {saving ? <ActivityIndicator color="#FFF" /> : "Guardar cuenta"}
          </Button>
        </View>

        {/* Cuentas guardadas */}
        {accounts.length > 0 && (
          <View style={{ marginTop: Spacing.xl }}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Cuentas guardadas</ThemedText>
            {accounts.map(acc => {
              const method = METHODS.find(m => m.id === acc.method);
              const detail = acc.pagoMovilPhone || acc.binanceId || acc.zinliEmail || acc.zelleEmail || "—";
              return (
                <View key={acc.id} style={[styles.accountRow, { backgroundColor: theme.card, borderColor: theme.border }, Shadows.sm]}>
                  <Feather name={method?.icon || "credit-card"} size={20} color={ComeYaColors.primary} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{method?.label || acc.method}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{detail}</ThemedText>
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
  tabs: { maxHeight: 56, marginBottom: Spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg },
  label: { marginBottom: Spacing.xs, fontWeight: "600", marginTop: Spacing.md },
  input: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 16, marginBottom: Spacing.xs },
  bankChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  accountRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  defaultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginRight: Spacing.sm },
});
