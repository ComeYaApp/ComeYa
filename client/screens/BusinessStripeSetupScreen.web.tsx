import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const PRIMARY = "#E60000";

interface StripeStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string;
}

export default function BusinessStripeSetupScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<StripeStatus>({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });

  const loadStatus = async () => {
    try {
      const d = await apiRequest("GET", "/api/business/stripe/status").then(
        (r) => r.json(),
      );
      if (d.success)
        setStatus({
          connected: d.connected || false,
          chargesEnabled: d.chargesEnabled || false,
          payoutsEnabled: d.payoutsEnabled || false,
          detailsSubmitted: d.detailsSubmitted || false,
          accountId: d.accountId,
        });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const d = await apiRequest(
        "POST",
        "/api/business/stripe/connect",
        {},
      ).then((r) => r.json());
      if (d.success && d.onboardingUrl) window.open(d.onboardingUrl, "_blank");
      else showToast(d.error || "No se pudo iniciar la conexión", "error");
    } catch {
      showToast("Error al conectar con Stripe", "error");
    } finally {
      setConnecting(false);
      setTimeout(loadStatus, 2000);
    }
  };

  const handleDashboard = async () => {
    try {
      const d = await apiRequest(
        "GET",
        "/api/business/stripe/dashboard-link",
      ).then((r) => r.json());
      if (d.success && d.url) window.open(d.url, "_blank");
      else showToast("No se pudo abrir el dashboard", "error");
    } catch {
      showToast("Error", "error");
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "¿Estás seguro? No podrás recibir pagos hasta que vuelvas a conectar tu cuenta.",
      )
    )
      return;
    try {
      const d = await apiRequest(
        "DELETE",
        "/api/business/stripe/disconnect",
      ).then((r) => r.json());
      if (d.success) {
        showToast("Cuenta desconectada", "success");
        loadStatus();
      }
    } catch {
      showToast("Error al desconectar", "error");
    }
  };

  const statusColor = !status.connected
    ? sub
    : status.chargesEnabled && status.payoutsEnabled
      ? "#10B981"
      : status.detailsSubmitted
        ? "#F59E0B"
        : "#EF4444";
  const statusLabel = !status.connected
    ? "No conectada"
    : status.chargesEnabled && status.payoutsEnabled
      ? "Activa y verificada"
      : status.detailsSubmitted
        ? "En verificación"
        : "Información incompleta";
  const statusIcon = !status.connected
    ? "x-circle"
    : status.chargesEnabled && status.payoutsEnabled
      ? "check-circle"
      : status.detailsSubmitted
        ? "clock"
        : "alert-circle";

  const REQUIREMENTS = [
    "DNI o NIE",
    "NIF / CIF (número fiscal)",
    "Cuenta bancaria (IBAN español)",
    "Comprobante de domicilio",
  ];
  const INFO_ROWS = [
    { label: "Frecuencia", value: "Diaria (automática)" },
    { label: "Método", value: "Transferencia bancaria" },
    { label: "Tiempo", value: "2-3 días hábiles" },
    { label: "Comisión Stripe", value: "1.5% + 0.25 EUR" },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Configuración de Pagos"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View
            style={[s.sideIconWrap, { backgroundColor: statusColor + "15" }]}
          >
            <Feather name={statusIcon as any} size={32} color={statusColor} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Stripe Connect</Text>
          <View
            style={[
              s.statusBadge,
              {
                backgroundColor: statusColor + "15",
                borderColor: statusColor + "30",
              },
            ]}
          >
            <Text
              style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
        {status.connected && (
          <View style={s.sideChecks}>
            {[
              { label: "Recibir pagos", ok: status.chargesEnabled },
              { label: "Transferencias", ok: status.payoutsEnabled },
            ].map((item) => (
              <View key={item.label} style={s.checkRow}>
                <Feather
                  name={item.ok ? "check-circle" : "x-circle"}
                  size={16}
                  color={item.ok ? "#10B981" : "#EF4444"}
                />
                <Text style={[s.checkLabel, { color: text }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      <ScrollView
        style={s.main}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <>
            {/* Estado */}
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <View
                  style={[
                    s.statusIcon,
                    { backgroundColor: statusColor + "20" },
                  ]}
                >
                  <Feather
                    name={statusIcon as any}
                    size={28}
                    color={statusColor}
                  />
                </View>
                <View>
                  <Text style={[s.statusTitle, { color: statusColor }]}>
                    {statusLabel}
                  </Text>
                  <Text style={[s.statusSub, { color: sub }]}>
                    Estado de tu cuenta Stripe Connect
                  </Text>
                </View>
              </View>
              {status.connected && (
                <View style={[s.checksRow, { borderTopColor: border }]}>
                  {[
                    { label: "Recibir pagos", ok: status.chargesEnabled },
                    {
                      label: "Transferencias bancarias",
                      ok: status.payoutsEnabled,
                    },
                  ].map((item) => (
                    <View key={item.label} style={s.checkItem}>
                      <Feather
                        name={item.ok ? "check-circle" : "x-circle"}
                        size={18}
                        color={item.ok ? "#10B981" : "#EF4444"}
                      />
                      <Text style={[s.checkItemText, { color: text }]}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {!status.connected ? (
              <>
                <View
                  style={[
                    s.infoBanner,
                    {
                      backgroundColor: PRIMARY + "10",
                      borderColor: PRIMARY + "30",
                    },
                  ]}
                >
                  <Feather name="info" size={18} color={PRIMARY} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.bannerTitle, { color: PRIMARY }]}>
                      Conecta tu cuenta de Stripe
                    </Text>
                    <Text style={[s.bannerSub, { color: PRIMARY }]}>
                      Para recibir pagos de tus ventas, necesitas conectar tu
                      cuenta de Stripe Connect.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleConnect}
                  disabled={connecting}
                  style={[
                    s.primaryBtn,
                    { backgroundColor: PRIMARY, opacity: connecting ? 0.6 : 1 },
                  ]}
                >
                  {connecting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="link" size={18} color="#fff" />
                      <Text style={s.primaryBtnText}>
                        Conectar Cuenta Stripe
                      </Text>
                    </>
                  )}
                </Pressable>
                <View
                  style={[
                    s.card,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View style={s.cardHeader}>
                    <Feather name="list" size={18} color={PRIMARY} />
                    <Text style={[s.cardTitle, { color: text }]}>
                      ¿Qué necesitas?
                    </Text>
                  </View>
                  {REQUIREMENTS.map((r) => (
                    <View key={r} style={s.reqRow}>
                      <Feather name="check" size={16} color="#10B981" />
                      <Text style={[s.reqText, { color: text }]}>{r}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Pressable
                  onPress={handleDashboard}
                  style={[
                    s.secondaryBtn,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <Feather name="external-link" size={18} color={PRIMARY} />
                  <Text style={[s.secondaryBtnText, { color: PRIMARY }]}>
                    Abrir Dashboard de Stripe
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDisconnect}
                  style={[
                    s.dangerBtn,
                    { backgroundColor: card, borderColor: "#EF4444" },
                  ]}
                >
                  <Feather name="x-circle" size={18} color="#EF4444" />
                  <Text style={[s.dangerBtnText]}>Desconectar Cuenta</Text>
                </Pressable>
              </>
            )}

            {/* Info transferencias */}
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="info" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>
                  Información de Transferencias
                </Text>
              </View>
              {INFO_ROWS.map((row) => (
                <View
                  key={row.label}
                  style={[s.infoRow, { borderBottomColor: border }]}
                >
                  <Text style={[s.infoLabel, { color: sub }]}>{row.label}</Text>
                  <Text style={[s.infoValue, { color: text }]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                s.helpCard,
                { backgroundColor: cardBg, borderColor: border },
              ]}
            >
              <Feather name="help-circle" size={16} color={sub} />
              <Text style={[s.helpText, { color: sub }]}>
                Tus ingresos se procesan directamente a través de Stripe
                Connect. Recibes el 100% del precio base de tus productos.
                ComeYa agrega un 15% de markup al precio final del cliente.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  sideIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  sideTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sideChecks: { padding: 16, gap: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkLabel: { fontSize: 13 },
  sideFooter: { borderTopWidth: 1, padding: 16, marginTop: "auto" as any },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1, height: "100vh" as any },
  content: { padding: 32, maxWidth: 680, paddingBottom: 80 },
  loadingWrap: { alignItems: "center", paddingTop: 60 },
  card: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  statusTitle: { fontSize: 18, fontWeight: "700" },
  statusSub: { fontSize: 13, marginTop: 2 },
  checksRow: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkItemText: { fontSize: 14 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  bannerSub: { fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  dangerBtnText: { color: "#EF4444", fontSize: 15, fontWeight: "600" },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  reqText: { fontSize: 14 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: "600" },
  helpCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  helpText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
