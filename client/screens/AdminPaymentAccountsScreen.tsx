import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { apiRequest } from "../lib/query-client";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "../constants/theme";

const PROVIDERS = [
  {
    key: "bizum",
    label: "Bizum",
    color: "#00ADEF",
    icon: "smartphone" as const,
    fields: [
      {
        key: "phone",
        label: "Numero de telefono",
        placeholder: "+34 600 000 000",
        keyboard: "phone-pad" as const,
      },
      {
        key: "name",
        label: "Nombre del titular",
        placeholder: "ComeYa SL",
        keyboard: "default" as const,
      },
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
        keyboard: "email-address" as const,
      },
    ],
  },
];

export default function AdminPaymentAccountsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Record<string, any>>({});
  const [stripeStatus, setStripeStatus] = useState<any>(null);

  useEffect(() => {
    loadAccounts();
    loadStripeStatus();
  }, []);

  const loadStripeStatus = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/finance/stripe-status");
      const data = await res.json();
      if (data.success) setStripeStatus(data.status);
    } catch {
      /* estado no disponible */
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await apiRequest(
        "GET",
        "/api/payment-accounts/admin/receiving-accounts",
      );
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        data.accounts.forEach((acc: any) => {
          map[acc.provider] = acc.accountData;
        });
        setAccounts(map);
      }
    } catch (e) {
      Alert.alert("Error", "No se pudieron cargar las cuentas");
    } finally {
      setLoading(false);
    }
  };

  const update = (provider: string, field: string, value: string) => {
    setAccounts((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const save = async (provider: string) => {
    setSaving(provider);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/payment-accounts/admin/receiving-accounts/${provider}`,
        {
          accountData: accounts[provider],
          isActive: true,
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Guardado", "Cuenta actualizada correctamente");
      } else {
        Alert.alert("Error", data.error || "No se pudo guardar");
      }
    } catch {
      Alert.alert("Error", "No se pudo guardar la cuenta");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.md,
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Cuentas Receptoras
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name="info" size={18} color={ComeYaColors.primary} />
          <Text style={[styles.infoText, { color: ComeYaColors.primary }]}>
            Configura las cuentas donde los clientes enviaran sus pagos manuales
            (Bizum, Transferencia SEPA y PayPal). Los cobros con tarjeta entran
            automaticamente por Stripe.
          </Text>
        </View>

        {/* Stripe (plataforma) — conexión por variables de entorno */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
          onPress={() => navigation.navigate("AdminStripeSetup" as never)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: "#635BFF" + "20" },
              ]}
            >
              <Feather name="zap" size={22} color="#635BFF" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Stripe (cobros con tarjeta)
            </Text>
            <View style={{ flex: 1 }} />
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: stripeStatus?.isConnected
                    ? ComeYaColors.success + "20"
                    : ComeYaColors.warning + "20",
                },
              ]}
            >
              <Text
                style={{
                  color: stripeStatus?.isConnected
                    ? ComeYaColors.success
                    : ComeYaColors.warning,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {stripeStatus?.isConnected ? "Conectado" : "Sin configurar"}
              </Text>
            </View>
          </View>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            {stripeStatus?.isConnected
              ? `Cuenta: ${stripeStatus?.accountName || "ComeYa"} · Saldo disponible ${((stripeStatus?.balance?.available || 0) / 100).toFixed(2)} €`
              : "Falta configurar STRIPE_SECRET_KEY en el servidor"}
          </Text>
          <View style={styles.tapHint}>
            <Feather name="chevron-right" size={14} color={ComeYaColors.primary} />
            <Text style={[styles.tapHintText, { color: ComeYaColors.primary }]}>
              Ver estado y abrir el panel de Stripe
            </Text>
          </View>
        </TouchableOpacity>

        {PROVIDERS.map((provider) => (
          <View
            key={provider.key}
            style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: provider.color + "20" },
                ]}
              >
                <Feather
                  name={provider.icon}
                  size={22}
                  color={provider.color}
                />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {provider.label}
              </Text>
            </View>

            {provider.fields.map((field) => (
              <View key={field.key}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  {field.label}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={accounts[provider.key]?.[field.key] || ""}
                  onChangeText={(val) => update(provider.key, field.key, val)}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType={field.keyboard}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: provider.color }]}
              onPress={() => save(provider.key)}
              disabled={saving === provider.key}
            >
              {saving === provider.key ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar {provider.label}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  back: { padding: Spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  tapHintText: { fontSize: 13, fontWeight: "600" },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 15,
    borderWidth: 1,
  },
  saveBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
