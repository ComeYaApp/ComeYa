import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const PROVIDERS = [
  {
    key: "bizum",
    label: "Bizum",
    color: "#00ADEF",
    icon: "smartphone" as const,
    fields: [
      {
        key: "phone",
        label: "Número de teléfono",
        placeholder: "+34 600 000 000",
      },
      { key: "name", label: "Nombre del titular", placeholder: "ComeYa S.L." },
    ],
  },
  {
    key: "transferencia",
    label: "Transferencia SEPA",
    color: "#1A56DB",
    icon: "credit-card" as const,
    fields: [
      {
        key: "iban",
        label: "IBAN",
        placeholder: "ES00 0000 0000 0000 0000 0000",
      },
      { key: "titular", label: "Titular", placeholder: "ComeYa S.L." },
      { key: "banco", label: "Banco", placeholder: "Banco Santander" },
    ],
  },
  {
    key: "paypal",
    label: "PayPal",
    color: "#003087",
    icon: "dollar-sign" as const,
    fields: [
      {
        key: "email",
        label: "Email de PayPal",
        placeholder: "pagos@comeya.es",
      },
    ],
  },
];

export default function AdminPaymentAccountsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Record<string, any>>({});
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0].key);

  useEffect(() => {
    apiRequest("GET", "/api/payment-accounts/admin/receiving-accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const map: Record<string, any> = {};
          data.accounts.forEach((acc: any) => {
            map[acc.provider] = acc.accountData;
          });
          setAccounts(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (provider: string, field: string, value: string) =>
    setAccounts((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));

  const save = async (provider: string) => {
    setSaving(provider);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/payment-accounts/admin/receiving-accounts/${provider}`,
        { accountData: accounts[provider], isActive: true },
      );
      const data = await res.json();
      if (data.success) alert("Cuenta actualizada correctamente");
      else alert(data.error || "No se pudo guardar");
    } catch {
      alert("No se pudo guardar la cuenta");
    } finally {
      setSaving(null);
    }
  };

  const activeConfig = PROVIDERS.find((p) => p.key === activeProvider)!;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Cuentas de Pago"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View
          style={[
            s.iconCircle,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name="settings" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Cuentas Receptoras</Text>
        <Text style={[s.sideSub, { color: sub }]}>
          Configura dónde reciben los pagos manuales de clientes
        </Text>

        <View
          style={[
            s.infoBanner,
            { backgroundColor: ComeYaColors.primary + "10" },
          ]}
        >
          <Feather name="info" size={16} color={ComeYaColors.primary} />
          <Text style={[s.infoText, { color: ComeYaColors.primary }]}>
            Los clientes enviarán sus pagos a estas cuentas al hacer pedidos con
            Bizum o Transferencia.
          </Text>
        </View>

        {PROVIDERS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setActiveProvider(p.key)}
            style={[
              s.providerTab,
              {
                backgroundColor:
                  activeProvider === p.key ? p.color + "15" : "transparent",
                borderColor: activeProvider === p.key ? p.color : border,
              },
            ]}
          >
            <Feather
              name={p.icon}
              size={18}
              color={activeProvider === p.key ? p.color : sub}
            />
            <Text
              style={[
                s.providerTabText,
                { color: activeProvider === p.key ? p.color : text },
              ]}
            >
              {p.label}
            </Text>
            {accounts[p.key] && (
              <View
                style={[s.dot, { backgroundColor: ComeYaColors.success }]}
              />
            )}
          </Pressable>
        ))}

        <Pressable
          onPress={() => navigation.goBack()}
          style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView
        style={s.main}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={ComeYaColors.primary} size="large" />
          </View>
        ) : (
          <View
            style={[s.card, { backgroundColor: card, borderColor: border }]}
          >
            <View style={s.cardHeader}>
              <View
                style={[
                  s.iconBox,
                  { backgroundColor: activeConfig.color + "20" },
                ]}
              >
                <Feather
                  name={activeConfig.icon}
                  size={22}
                  color={activeConfig.color}
                />
              </View>
              <Text style={[s.cardTitle, { color: text }]}>
                {activeConfig.label}
              </Text>
            </View>

            {activeConfig.fields.map((field) => (
              <View key={field.key}>
                <Text style={[s.fieldLabel, { color: sub }]}>
                  {field.label}
                </Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: inputBg,
                      color: text,
                      borderColor: accounts[activeProvider]?.[field.key]
                        ? activeConfig.color
                        : border,
                    },
                  ]}
                  value={accounts[activeProvider]?.[field.key] || ""}
                  onChangeText={(v) => update(activeProvider, field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={sub}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <Pressable
              onPress={() => save(activeProvider)}
              disabled={saving === activeProvider}
              style={[
                s.saveBtn,
                {
                  backgroundColor: activeConfig.color,
                  opacity: saving === activeProvider ? 0.6 : 1,
                },
              ]}
            >
              {saving === activeProvider ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Guardar {activeConfig.label}</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 280,
    minWidth: 280,
    maxWidth: 280,
    padding: 24,
    borderRightWidth: 1,
    paddingTop: 40,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  sideTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  sideSub: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  providerTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  providerTabText: { flex: 1, fontSize: 14, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    justifyContent: "center",
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 600 },
  loading: { paddingVertical: 80, alignItems: "center" },
  card: { padding: 28, borderRadius: 16, borderWidth: 1 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    marginTop: 16,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
