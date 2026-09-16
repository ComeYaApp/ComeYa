import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

// Solo configuraciones que el admin cambia en runtime desde el panel.
// Las API keys (Stripe, Gemini, Twilio, etc.) van en variables de entorno de Render.
const SETTINGS: {
  key: string;
  label: string;
  category: string;
  placeholder: string;
  hint?: string;
}[] = [
  // Tarifas (modelo híbrido: markup + comisión + coste de servicio)
  {
    key: "pricing_markup_pct",
    label: "Markup sobre productos (%)",
    category: "Tarifas",
    placeholder: "5",
    hint: "Subida del precio que ve el cliente (10 € → 10,50 € con 5%)",
  },
  {
    key: "pricing_commission_pct",
    label: "Comisión ComeYa (%)",
    category: "Tarifas",
    placeholder: "15",
    hint: "Sobre el subtotal con markup (10,50 € → 1,58 € con 15%)",
  },
  {
    key: "pricing_service_fee_cents",
    label: "Coste de servicio por pedido (céntimos)",
    category: "Tarifas",
    placeholder: "49",
    hint: "Se cobra al cliente en pedidos de reparto (49 = 0,49 €)",
  },
  {
    key: "pricing_reservation_guest_fee_cents",
    label: "Tarifa por comensal de reserva (céntimos)",
    category: "Tarifas",
    placeholder: "99",
    hint: "Se cobra al negocio por comensal asistente (99 = 0,99 €)",
  },
  {
    key: "pricing_reservation_service_fee_cents",
    label: "Coste de servicio por reserva (céntimos)",
    category: "Tarifas",
    placeholder: "49",
    hint: "Se cobra al negocio al liquidar cada reserva (49 = 0,49 €)",
  },
  // Operaciones
  {
    key: "regret_period_seconds",
    label: "Periodo arrepentimiento (seg)",
    category: "Operaciones",
    placeholder: "60",
    hint: "Segundos que tiene el cliente para cancelar gratis",
  },
  {
    key: "business_call_delay_minutes",
    label: "Retraso llamada negocio (min)",
    category: "Operaciones",
    placeholder: "3",
    hint: "Minutos antes de llamar al negocio si no acepta",
  },
  {
    key: "fund_hold_hours",
    label: "Retencion de fondos (horas)",
    category: "Operaciones",
    placeholder: "1",
    hint: "Horas hasta liberar fondos al confirmar entrega",
  },
];

// Cuentas de pago (Bizum, IBAN, PayPal) se gestionan en "Cuentas de pago" del perfil admin.
const CATEGORIES = ["Tarifas", "Operaciones"];

export const SettingsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/settings");
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.settings || []).forEach((s: any) => {
        map[s.key] = s.value;
      });
      setValues(map);
    } catch {
      showToast("Error al cargar configuracion", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async (key: string) => {
    setSaving(key);
    try {
      const res = await apiRequest("PUT", "/api/admin/settings", {
        key,
        value: values[key] ?? "",
      });
      const data = await res.json();
      if (data.success) showToast("Guardado", "success");
      else showToast(data.error ?? "Error", "error");
    } catch {
      showToast("Error de conexion", "error");
    } finally {
      setSaving(null);
    }
  };

  const initialize = async () => {
    try {
      const res = await apiRequest("POST", "/api/admin/settings/initialize");
      const data = await res.json();
      if (data.success) {
        showToast("Configuracion inicializada", "success");
        load();
      }
    } catch {
      showToast("Error al inicializar", "error");
    }
  };

  const s = st(theme);

  if (loading)
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );

  const hasSettings = Object.keys(values).length > 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 80 }}
    >
      <View style={s.headerRow}>
        <Text style={[s.title, { color: theme.text }]}>
          Configuracion del Sistema
        </Text>
        {!hasSettings && (
          <TouchableOpacity
            onPress={initialize}
            style={[s.initBtn, { backgroundColor: ComeYaColors.primary }]}
          >
            <Feather name="settings" size={14} color="#FFF" />
            <Text style={s.initBtnText}>Inicializar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info box */}
      <View
        style={[
          s.infoBox,
          {
            backgroundColor: ComeYaColors.primary + "12",
            borderColor: ComeYaColors.primary + "30",
          },
        ]}
      >
        <Feather name="info" size={14} color={ComeYaColors.primary} />
        <Text style={[s.infoText, { color: ComeYaColors.primary }]}>
          Las API keys (Stripe, Gemini, Twilio, etc.) se configuran en las
          variables de entorno de Render, no aqui.
        </Text>
      </View>

      {CATEGORIES.map((cat) => {
        const items = SETTINGS.filter((s) => s.category === cat);
        return (
          <View key={cat} style={{ marginBottom: 20 }}>
            <Text style={[s.catLabel, { color: theme.textSecondary }]}>
              {cat.toUpperCase()}
            </Text>
            {items.map((item) => (
              <View
                key={item.key}
                style={[s.card, { backgroundColor: theme.card }]}
              >
                <Text style={[s.label, { color: theme.text }]}>
                  {item.label}
                </Text>
                {item.hint && (
                  <Text style={[s.hint, { color: theme.textSecondary }]}>
                    {item.hint}
                  </Text>
                )}
                <View style={s.row}>
                  <TextInput
                    style={[
                      s.input,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    value={values[item.key] ?? ""}
                    onChangeText={(v) =>
                      setValues((prev) => ({ ...prev, [item.key]: v }))
                    }
                    placeholder={item.placeholder}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    keyboardType={
                      item.key.startsWith("pricing_") ||
                      item.key.includes("commission") ||
                      item.key.includes("seconds") ||
                      item.key.includes("minutes") ||
                      item.key.includes("hours")
                        ? "numeric"
                        : "default"
                    }
                  />
                  <TouchableOpacity
                    style={[
                      s.saveBtn,
                      {
                        backgroundColor:
                          saving === item.key
                            ? theme.backgroundSecondary
                            : ComeYaColors.primary,
                      },
                    ]}
                    onPress={() => save(item.key)}
                    disabled={saving === item.key}
                  >
                    {saving === item.key ? (
                      <ActivityIndicator
                        size="small"
                        color={ComeYaColors.primary}
                      />
                    ) : (
                      <Feather name="check" size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
};

const st = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, padding: 16 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "700" },
    initBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    initBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 20,
    },
    infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
    catLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 8,
      marginLeft: 2,
    },
    card: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    label: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
    hint: { fontSize: 11, marginBottom: 8 },
    row: { flexDirection: "row", gap: 8, alignItems: "center" },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
    },
    saveBtn: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
  });
